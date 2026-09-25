import { z } from "zod";
import { readFile } from "node:fs/promises";

import { getLogger } from "@/lib/logger";
import { getLibraryConfig } from "@/lib/library/config";
import { getImageDetail } from "@/lib/library/repositories/image-repository";
import { withTransaction } from "@/lib/library/db/postgres";
import { linkImageTag, upsertTag } from "@/lib/library/repositories/tag-repository";

const logger = getLogger({ scope: "library-enrichment" });

export const SuggestedTagSchema = z.object({
  name: z.string(),
  confidence: z.number(),
  category: z.string(),
});
export type SuggestedTag = z.infer<typeof SuggestedTagSchema>;

export const EnrichmentResultSchema = z.object({
  caption: z.string(),
  description: z.string(),
  suggested_tags: z.array(SuggestedTagSchema),
  characters: z.array(z.string()),
  styles: z.array(z.string()),
  quality_notes: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
});
export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

/** Enrichment is strictly opt-in via configuration. */
export function shouldRunVisionEnrichment(): boolean {
  const { enrichment } = getLibraryConfig();
  return enrichment.enabled && enrichment.visionProvider !== "none" && enrichment.visionApiUrl !== "";
}

const OUTPUT_INSTRUCTIONS = `You are a precise image cataloguer. Respond ONLY with JSON matching:
{"caption":"short caption","description":"longer visual description","suggested_tags":[{"name":"gothic","confidence":0.9,"category":"style"}],"characters":[],"styles":[],"quality_notes":[]}`;

async function imageToDataUri(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const ext = filePath.toLowerCase().endsWith(".png") ? "png" : filePath.toLowerCase().endsWith(".webp") ? "webp" : "jpeg";
  return `data:image/${ext};base64,${buffer.toString("base64")}`;
}

function buildVisionRequestBody(
  enrichment: ReturnType<typeof getLibraryConfig>["enrichment"],
  dataUri: string,
  existingPrompt: string | null,
): Record<string, unknown> {
  return {
    model: enrichment.visionModel || "gpt-4o-mini",
    messages: [
      { role: "system", content: OUTPUT_INSTRUCTIONS },
      {
        role: "user",
        content: [
          { type: "text", text: `Existing prompt context: ${existingPrompt ?? "(none)"}` },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };
}

const VisionChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});

function normalizeEnrichmentResult(parsed: Partial<EnrichmentResult>): EnrichmentResult {
  return {
    caption: parsed.caption ?? "",
    description: parsed.description ?? "",
    suggested_tags: parsed.suggested_tags ?? [],
    characters: parsed.characters ?? [],
    styles: parsed.styles ?? [],
    quality_notes: parsed.quality_notes ?? [],
    metadata: parsed.metadata ?? {},
  };
}

async function requestVisionCompletion(
  enrichment: ReturnType<typeof getLibraryConfig>["enrichment"],
  dataUri: string,
  existingPrompt: string | null,
): Promise<string | undefined> {
  const body = buildVisionRequestBody(enrichment, dataUri, existingPrompt);
  const res = await fetch(enrichment.visionApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(enrichment.visionApiKey ? { authorization: `Bearer ${enrichment.visionApiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    logger.warn({ status: res.status }, "Vision provider returned non-OK status");
    return undefined;
  }
  const json = VisionChatResponseSchema.parse(await res.json());
  return json.choices?.[0]?.message?.content;
}

/**
 * Call the configured vision provider.  Uses an OpenAI-compatible chat shape by
 * default (works with OpenAI, Ollama, LM Studio, vLLM, etc.).  Returns the raw
 * parsed JSON or null on any failure — enrichment must never break ingestion.
 */
async function callVisionProvider(filePath: string, existingPrompt: string | null): Promise<EnrichmentResult | null> {
  const { enrichment } = getLibraryConfig();
  try {
    const dataUri = await imageToDataUri(filePath);
    const content = await requestVisionCompletion(enrichment, dataUri, existingPrompt);
    if (!content) return null;
    const parsed = JSON.parse(content) as Partial<EnrichmentResult>;
    return normalizeEnrichmentResult(parsed);
  } catch (error) {
    logger.warn({ err: error }, "Vision enrichment call failed");
    return null;
  }
}

export async function describeImage(imageId: string): Promise<EnrichmentResult | null> {
  if (!shouldRunVisionEnrichment()) return null;
  const detail = await getImageDetail(imageId);
  if (!detail) return null;
  return callVisionProvider(detail.filePath, detail.prompt);
}

/**
 * Persist an enrichment result.  Descriptions go to image_descriptions; tags go
 * to image_tags with source=external_vision_llm and never overwrite canonical
 * prompt/metadata tags (Phase 14 trust rules).
 */
export async function saveEnrichment(imageId: string, result: EnrichmentResult): Promise<void> {
  const { enrichment } = getLibraryConfig();
  await withTransaction(async (client) => {
    if (result.description || result.caption) {
      await client.query(
        `INSERT INTO image_descriptions (image_id, description, provider, model, prompt_used, metadata_json)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          imageId,
          [result.caption, result.description].filter(Boolean).join("\n\n"),
          enrichment.visionProvider,
          enrichment.visionModel || null,
          OUTPUT_INSTRUCTIONS,
          JSON.stringify({ characters: result.characters, styles: result.styles, quality_notes: result.quality_notes, ...result.metadata }),
        ],
      );
    }
    for (const tag of result.suggested_tags) {
      const tagId = await upsertTag(client, tag.name, tag.category ?? null, "external_vision_llm");
      await linkImageTag(client, imageId, tagId, { confidence: tag.confidence, source: "external_vision_llm" });
    }
  });
}

export async function enrichImageMetadata(imageId: string): Promise<EnrichmentResult | null> {
  const result = await describeImage(imageId);
  if (result) {
    await saveEnrichment(imageId, result);
  }
  return result;
}
