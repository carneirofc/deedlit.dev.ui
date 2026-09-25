import { z } from "zod";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { extractMetadataFromBuffer, type ExtractResult } from "@/lib/library/services/metadata-client";
import { normalizeTag } from "@/lib/prompt-tags";

export const SUPPORTED_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg"]);

export const ExtractedLoraSchema = z.object({
  name: z.string(),
  weight: z.number().nullable(),
});
export type ExtractedLora = z.infer<typeof ExtractedLoraSchema>;

export const ExtractedGenerationParamsSchema = z.object({
  seed: z.number().nullable(),
  steps: z.number().nullable(),
  cfgScale: z.number().nullable(),
  sampler: z.string().nullable(),
  scheduler: z.string().nullable(),
  denoise: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  clipSkip: z.number().nullable(),
});
export type ExtractedGenerationParams = z.infer<typeof ExtractedGenerationParamsSchema>;

export const ExtractedImageRecordSchema = z.object({
  filePath: z.string(),
  filename: z.string(),
  extension: z.string(),
  sha256Hash: z.string(),
  perceptualHash: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  fileSizeBytes: z.number(),
  createdAt: z.custom<Date>().nullable(),
  modifiedAt: z.custom<Date>().nullable(),
  sourceTool: z.string().nullable(),
  prompt: z.string().nullable(),
  negativePrompt: z.string().nullable(),
  model: z.string().nullable(),
  workflowJson: z.unknown(),
  metadataJson: z.unknown(),
  tags: z.array(z.string()),
  loras: z.array(ExtractedLoraSchema),
  generationParams: ExtractedGenerationParamsSchema,
});
export type ExtractedImageRecord = z.infer<typeof ExtractedImageRecordSchema>;

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

export function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * 64-bit average hash (aHash): downscale to 8x8 grayscale, threshold against the
 * mean, emit a 16-char hex string.  Good enough for near-duplicate detection.
 */
export async function computePerceptualHash(filePath: string): Promise<string | null> {
  try {
    const data = await sharp(filePath).greyscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
    let sum = 0;
    for (const value of data) sum += value;
    const mean = sum / data.length;
    let bits = "";
    for (const value of data) bits += value >= mean ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt / lora / param parsing
// ---------------------------------------------------------------------------

/** Parse `<lora:name:0.8>` and `<lyco:name:0.8>` references from a prompt. */
export function parseLorasFromPrompt(prompt: string | null | undefined): ExtractedLora[] {
  if (!prompt) return [];
  const out: ExtractedLora[] = [];
  const re = /<(?:lora|lyco):([^:>]+)(?::([0-9.]+))?[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    out.push({ name: match[1].trim(), weight: match[2] ? Number.parseFloat(match[2]) : null });
  }
  return out;
}

/**
 * Clean a single prompt token into a canonical tag:
 * - drop Automatic1111 emphasis weights (`tag:0.65`) and BREAK separators
 * - unwrap balanced emphasis brackets (`(tag)`, `((tag))`, `[tag]`) without
 *   touching legitimate parenthetical booru tags like `taimanin (series)`
 * - unescape `\(` / `\)` and collapse whitespace
 */
function cleanPromptTag(raw: string): string {
  let t = raw.replace(/\\/g, "").replace(/:\s*\d+(?:\.\d+)?/g, "").trim();
  while (/^[([{<]/.test(t) && /[)\]}>]$/.test(t)) {
    t = t.slice(1, -1).trim();
  }
  // Weighted groups can span commas (`((a:0.9), (b))`), leaving a stray bracket
  // after the split. Trim leading/trailing brackets only when unbalanced so
  // legitimate parenthetical tags like `taimanin (series)` are preserved.
  const opens = (t.match(/[([{]/g) ?? []).length;
  const closes = (t.match(/[)\]}]/g) ?? []).length;
  if (opens !== closes) {
    t = t.replace(/^[([{<]+/, "").replace(/[)\]}>]+$/, "").trim();
  }
  return t.replace(/\s+/g, " ").trim();
}

const STOP_TOKENS = new Set(["break", "and", "", "lora", "embedding"]);

/** Strip lora/lyco tags and extract comma/newline-separated booru-style tags. */
export function normalizePromptTags(prompt: string | null | undefined): string[] {
  if (!prompt) return [];
  const withoutLoras = prompt.replace(/<(?:lora|lyco):[^>]*>/gi, " ");
  // A1111 prompts mix commas and newlines as separators; treat both.
  const normalizedSeparators = withoutLoras.replace(/[\r\n]+/g, ",").replace(/\bBREAK\b/g, ",");
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const piece of normalizedSeparators.split(",")) {
    const cleaned = normalizeTag(cleanPromptTag(piece));
    if (!cleaned || STOP_TOKENS.has(cleaned) || cleaned.length > 80) continue;
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      tags.push(cleaned);
    }
  }
  return tags;
}

// ---------------------------------------------------------------------------
// Metadata interpretation (delegated to the deedlit.metadata service)
// ---------------------------------------------------------------------------

const InterpretedMetadataSchema = z.object({
  prompt: z.string().nullable(),
  negativePrompt: z.string().nullable(),
  model: z.string().nullable(),
  sourceTool: z.string().nullable(),
  workflowJson: z.unknown(),
  /** Tags already normalized by the metadata service. */
  tags: z.array(z.string()),
  params: ExtractedGenerationParamsSchema.partial(),
});
type InterpretedMetadata = z.infer<typeof InterpretedMetadataSchema>;

/**
 * Map the deedlit.metadata `ExtractResult` into the monolith's interpreted
 * shape.  The service owns all metadata parsing (A1111 `parameters` blob +
 * ComfyUI node graph); this is a pure field-rename / coercion layer.
 *
 * Notes:
 * - `sourceTool` is the contract enum (`a1111` / `comfyui` / `unknown`); the
 *   `unknown` sentinel is collapsed to `null` to match the prior in-process
 *   behavior (no recognized tool → null source_tool).
 * - `model` is resolved from `references.checkpoints[0]` once #7 populates it;
 *   today references are empty so this stays null until the service fills them.
 * - `workflow_json` is preferred for the stored workflow; the raw API prompt is
 *   used as a fallback so ComfyUI images without an embedded UI graph still keep
 *   their node graph.
 */
function mapExtractParams(params: ExtractResult["params"]): Partial<ExtractedGenerationParams> {
  return {
    seed: params.seed ?? null,
    steps: params.steps ?? null,
    cfgScale: params.cfg ?? null,
    sampler: params.sampler ?? null,
    scheduler: params.scheduler ?? null,
    denoise: params.denoise ?? null,
    width: params.width ?? null,
    height: params.height ?? null,
    clipSkip: params.clipskip ?? null,
  };
}

export function mapExtractResult(extract: ExtractResult): InterpretedMetadata {
  const sourceTool = extract.sourceTool === "unknown" ? null : extract.sourceTool;
  const model = extract.references.checkpoints[0]?.name ?? null;
  const workflowJson = extract.workflow_json ?? extract.api_prompt_json ?? null;

  return {
    prompt: extract.prompt ?? null,
    negativePrompt: extract.negative ?? null,
    model,
    sourceTool,
    workflowJson,
    tags: extract.tags ?? [],
    params: mapExtractParams(extract.params),
  };
}

function mimeForExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const DimsSchema = z.object({ width: z.number().nullable(), height: z.number().nullable() });
type Dims = z.infer<typeof DimsSchema>;

function buildGenerationParams(interpreted: InterpretedMetadata, dims: Dims): ExtractedGenerationParams {
  return {
    seed: interpreted.params.seed ?? null,
    steps: interpreted.params.steps ?? null,
    cfgScale: interpreted.params.cfgScale ?? null,
    sampler: interpreted.params.sampler ?? null,
    scheduler: interpreted.params.scheduler ?? null,
    denoise: interpreted.params.denoise ?? null,
    width: interpreted.params.width ?? dims.width,
    height: interpreted.params.height ?? dims.height,
    clipSkip: interpreted.params.clipSkip ?? null,
  };
}

const ExtractedFileFactsSchema = z.object({
  sha256Hash: z.string(),
  perceptualHash: z.string().nullable(),
  dims: DimsSchema,
  extract: z.custom<ExtractResult>(),
});
type ExtractedFileFacts = z.infer<typeof ExtractedFileFactsSchema>;

async function extractFileFacts(
  filePath: string,
  fileBuffer: Buffer,
  extension: string,
  filename: string,
): Promise<ExtractedFileFacts> {
  const [sha256Hash, perceptualHash, dims, extract] = await Promise.all([
    computeSha256(filePath),
    computePerceptualHash(filePath),
    sharp(filePath)
      .metadata()
      .then((m) => ({ width: m.width ?? null, height: m.height ?? null }))
      .catch(() => ({ width: null, height: null })),
    extractMetadataFromBuffer(fileBuffer, mimeForExtension(extension), filename),
  ]);
  return { sha256Hash, perceptualHash, dims, extract };
}

export async function extractImageMetadata(filePath: string): Promise<ExtractedImageRecord> {
  const extension = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);
  const fileStat = await stat(filePath);

  // Pixel work stays local (sha256 / phash / dims); metadata parsing is owned by
  // the deedlit.metadata service. Read the bytes once and reuse for the upload.
  const fileBuffer = await readFile(filePath);

  const { sha256Hash, perceptualHash, dims, extract } = await extractFileFacts(
    filePath,
    fileBuffer,
    extension,
    filename,
  );

  const interpreted = mapExtractResult(extract);
  // Prefer the service's normalized tags; only re-derive locally if the service
  // returned none but we do have a prompt (defensive — shouldn't happen).
  const tags =
    interpreted.tags.length > 0 ? interpreted.tags : normalizePromptTags(interpreted.prompt);
  // LoRAs are parsed from the prompt until the service populates references.loras (#7).
  const loras = parseLorasFromPrompt(interpreted.prompt);
  const generationParams = buildGenerationParams(interpreted, dims);

  return {
    filePath,
    filename,
    extension,
    sha256Hash,
    perceptualHash,
    width: dims.width,
    height: dims.height,
    fileSizeBytes: fileStat.size,
    createdAt: fileStat.birthtime ?? null,
    modifiedAt: fileStat.mtime ?? null,
    sourceTool: interpreted.sourceTool,
    prompt: interpreted.prompt,
    negativePrompt: interpreted.negativePrompt,
    model: interpreted.model,
    workflowJson: interpreted.workflowJson,
    // Store the full parsed ExtractResult as the canonical metadata view (the raw
    // embedded chunks are no longer parsed in-process).
    metadataJson: extract,
    tags,
    loras,
    generationParams,
  };
}
