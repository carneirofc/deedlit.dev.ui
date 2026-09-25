import { open, type FileHandle } from "node:fs/promises";
import { inflateSync } from "node:zlib";

import { z } from "zod";

const TextChunkSchema = z.object({
  keyword: z.string(),
  chunkType: z.enum(["tEXt", "zTXt", "iTXt"]),
  text: z.string(),
});
type TextChunk = z.infer<typeof TextChunkSchema>;

const EmbeddedMetadataResultSchema = z.object({
  metadata: z.unknown().optional(),
  error: z.string().optional(),
});
type EmbeddedMetadataResult = z.infer<typeof EmbeddedMetadataResultSchema>;

const ChunkHeaderSchema = z.object({
  length: z.number(),
  type: z.string(),
});
type ChunkHeader = z.infer<typeof ChunkHeaderSchema>;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function parseTextChunk(data: Buffer): TextChunk | null {
  const separator = data.indexOf(0);
  if (separator <= 0) {
    return null;
  }

  return {
    keyword: data.subarray(0, separator).toString("latin1"),
    chunkType: "tEXt",
    text: data.subarray(separator + 1).toString("latin1"),
  };
}

function parseZtxtChunk(data: Buffer): TextChunk | null {
  const separator = data.indexOf(0);
  if (separator <= 0 || separator + 2 > data.length) {
    return null;
  }

  const compressionMethod = data[separator + 1];
  if (compressionMethod !== 0) {
    return null;
  }

  return {
    keyword: data.subarray(0, separator).toString("latin1"),
    chunkType: "zTXt",
    text: inflateSync(data.subarray(separator + 2)).toString("utf8"),
  };
}

function parseItxtChunk(data: Buffer): TextChunk | null {
  const keywordEnd = data.indexOf(0);
  if (keywordEnd <= 0) {
    return null;
  }

  let offset = keywordEnd + 1;
  if (offset + 2 > data.length) {
    return null;
  }

  const compressionFlag = data[offset];
  const compressionMethod = data[offset + 1];
  offset += 2;

  const languageTagEnd = data.indexOf(0, offset);
  if (languageTagEnd === -1) {
    return null;
  }
  offset = languageTagEnd + 1;

  const translatedKeywordEnd = data.indexOf(0, offset);
  if (translatedKeywordEnd === -1) {
    return null;
  }
  offset = translatedKeywordEnd + 1;

  let textData = data.subarray(offset);
  if (compressionFlag === 1) {
    if (compressionMethod !== 0) {
      return null;
    }
    textData = inflateSync(textData);
  }

  return {
    keyword: data.subarray(0, keywordEnd).toString("latin1"),
    chunkType: "iTXt",
    text: textData.toString("utf8"),
  };
}

function parseChunk(type: string, data: Buffer): TextChunk | null {
  if (type === "tEXt") {
    return parseTextChunk(data);
  }

  if (type === "zTXt") {
    return parseZtxtChunk(data);
  }

  if (type === "iTXt") {
    return parseItxtChunk(data);
  }

  return null;
}

function toMetadataObject(chunks: TextChunk[]): unknown {
  const fields: Record<string, unknown> = {};

  for (const chunk of chunks) {
    const normalizedText = chunk.text.trim();
    const parsedValue: unknown = (() => {
      if (!looksLikeJson(normalizedText)) {
        return normalizedText;
      }

      try {
        return JSON.parse(normalizedText) as unknown;
      } catch {
        return normalizedText;
      }
    })();

    const existing = fields[chunk.keyword];
    if (existing === undefined) {
      fields[chunk.keyword] = parsedValue;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(parsedValue);
      continue;
    }

    fields[chunk.keyword] = [existing, parsedValue];
  }

  return {
    source: "embedded-png",
    fields,
  };
}

async function verifyPngSignature(handle: FileHandle): Promise<boolean> {
  const signature = Buffer.alloc(8);
  const { bytesRead } = await handle.read(signature, 0, 8, 0);
  return bytesRead >= 8 && signature.equals(PNG_SIGNATURE);
}

async function readChunkHeader(handle: FileHandle, offset: number): Promise<ChunkHeader | null> {
  const header = Buffer.alloc(8);
  const { bytesRead } = await handle.read(header, 0, 8, offset);
  if (bytesRead < 8) {
    return null;
  }

  return { length: header.readUInt32BE(0), type: header.subarray(4, 8).toString("ascii") };
}

// Stream chunks without loading the entire file into memory: only text chunks'
// data is read; everything else is skipped via the offset arithmetic below.
async function collectTextChunks(handle: FileHandle): Promise<TextChunk[]> {
  const chunks: TextChunk[] = [];
  let offset = 8;

  for (;;) {
    const header = await readChunkHeader(handle, offset);
    if (!header) {
      break;
    }
    const { length, type } = header;

    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const data = Buffer.alloc(length);
      await handle.read(data, 0, length, offset + 8);
      const parsed = parseChunk(type, data);
      if (parsed) {
        chunks.push(parsed);
      }
    }

    if (type === "IEND") {
      break;
    }

    // Move to next chunk: header (8) + data (length) + CRC (4)
    offset += 8 + length + 4;
  }

  return chunks;
}

export async function readEmbeddedMetadataFromPng(imagePath: string): Promise<EmbeddedMetadataResult> {
  let handle;
  try {
    handle = await open(imagePath, "r");

    if (!(await verifyPngSignature(handle))) {
      return {};
    }

    const chunks = await collectTextChunks(handle);
    return chunks.length > 0 ? { metadata: toMetadataObject(chunks) } : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PNG metadata parse error";
    return { error: message };
  } finally {
    await handle?.close();
  }
}
