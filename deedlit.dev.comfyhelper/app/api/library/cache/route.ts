import { z } from "zod";

import { getRedisClient } from "@/lib/library/db/redis";
import { handleRoute, jsonError } from "@/lib/library/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CacheSampleEntrySchema = z.object({
  sha256: z.string(),
  hasThumb: z.boolean(),
  hasOrig: z.boolean(),
  thumbTtl: z.number().nullable(),
  origTtl: z.number().nullable(),
});

const CacheStatsSchema = z.object({
  thumbCount: z.number(),
  origCount: z.number(),
  totalDataKeys: z.number(),
  usedMemoryHuman: z.string().nullable(),
  usedMemoryBytes: z.number().nullable(),
  maxMemoryHuman: z.string().nullable(),
  keyspaceHits: z.number().nullable(),
  keyspaceMisses: z.number().nullable(),
  hitRate: z.number().nullable(),
});

export const CacheStatsResponseSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  redisUrl: z.string().nullable(),
  stats: CacheStatsSchema,
  sample: z.array(CacheSampleEntrySchema),
});

export type CacheStatsResponse = z.infer<typeof CacheStatsResponseSchema>;

const KeyFlagsSchema = z.object({ hasThumb: z.boolean(), hasOrig: z.boolean() });
type KeyFlags = z.infer<typeof KeyFlagsSchema>;

async function scanKeys(redis: ReturnType<typeof getRedisClient>, pattern: string): Promise<string[]> {
  if (!redis) return [];
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
    keys.push(...batch);
    cursor = nextCursor;
  } while (cursor !== "0");
  return keys;
}

function parseMemoryInfo(info: string, field: string): string | null {
  const match = info.match(new RegExp(`^${field}:(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function parseStatsInfo(info: string, field: string): number | null {
  const match = info.match(new RegExp(`^${field}:(\\d+)$`, "m"));
  return match ? parseInt(match[1], 10) : null;
}

function emptyStats(): z.infer<typeof CacheStatsSchema> {
  return {
    thumbCount: 0,
    origCount: 0,
    totalDataKeys: 0,
    usedMemoryHuman: null,
    usedMemoryBytes: null,
    maxMemoryHuman: null,
    keyspaceHits: null,
    keyspaceMisses: null,
    hitRate: null,
  };
}

function redactRedisUrl(redisUrl: string): string {
  return redisUrl.replace(/:[^:@]+@/, ":***@");
}

function computeHitRate(hits: number | null, misses: number | null): number | null {
  if (hits === null || misses === null || hits + misses === 0) return null;
  return Math.round((hits / (hits + misses)) * 1000) / 10;
}

function mergeKeySets(thumbKeys: string[], origKeys: string[]): Map<string, KeyFlags> {
  const defaultFlags = KeyFlagsSchema.parse({ hasThumb: false, hasOrig: false });
  const sha256Set = new Map<string, KeyFlags>();
  for (const k of thumbKeys) {
    const sha256 = k.replace(/^img:/, "").replace(/:thumb:data$/, "");
    sha256Set.set(sha256, { ...(sha256Set.get(sha256) ?? defaultFlags), hasThumb: true });
  }
  for (const k of origKeys) {
    const sha256 = k.replace(/^img:/, "").replace(/:orig:data$/, "");
    sha256Set.set(sha256, { ...(sha256Set.get(sha256) ?? defaultFlags), hasOrig: true });
  }
  return sha256Set;
}

async function buildSample(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  thumbKeys: string[],
  origKeys: string[],
): Promise<z.infer<typeof CacheStatsResponseSchema>["sample"]> {
  const sha256Set = mergeKeySets(thumbKeys, origKeys);
  const sampleEntries = [...sha256Set.entries()].slice(0, 30);
  if (sampleEntries.length === 0) return [];

  const pipe = redis.pipeline();
  for (const [sha256, flags] of sampleEntries) {
    pipe.ttl(flags.hasThumb ? `img:${sha256}:thumb:data` : "__missing__");
    pipe.ttl(flags.hasOrig ? `img:${sha256}:orig:data` : "__missing__");
  }
  const ttlResults = await pipe.exec();
  return sampleEntries.map(([sha256, flags], i) => ({
    sha256,
    hasThumb: flags.hasThumb,
    hasOrig: flags.hasOrig,
    thumbTtl: flags.hasThumb && ttlResults ? (ttlResults[i * 2][1] as number) : null,
    origTtl: flags.hasOrig && ttlResults ? (ttlResults[i * 2 + 1][1] as number) : null,
  }));
}

async function buildConnectedStats(
  redisUrl: string,
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
): Promise<CacheStatsResponse> {
  // Parallel: scan thumb keys, scan orig keys, info memory, info stats
  const [thumbKeys, origKeys, memInfo, statsInfo] = await Promise.all([
    scanKeys(redis, "img:*:thumb:data"),
    scanKeys(redis, "img:*:orig:data"),
    redis.info("memory").catch(() => ""),
    redis.info("stats").catch(() => ""),
  ]);

  const keyspaceHits = parseStatsInfo(statsInfo, "keyspace_hits");
  const keyspaceMisses = parseStatsInfo(statsInfo, "keyspace_misses");
  const sample = await buildSample(redis, thumbKeys, origKeys);

  return {
    configured: true,
    connected: true,
    redisUrl: redactRedisUrl(redisUrl),
    stats: {
      thumbCount: thumbKeys.length,
      origCount: origKeys.length,
      totalDataKeys: thumbKeys.length + origKeys.length,
      usedMemoryHuman: parseMemoryInfo(memInfo, "used_memory_human"),
      usedMemoryBytes: parseStatsInfo(memInfo, "used_memory"),
      maxMemoryHuman: parseMemoryInfo(memInfo, "maxmemory_human"),
      keyspaceHits,
      keyspaceMisses,
      hitRate: computeHitRate(keyspaceHits, keyspaceMisses),
    },
    sample,
  };
}

export async function GET() {
  return handleRoute(async () => {
    const redisUrl = process.env.REDIS_URL?.trim() ?? null;
    if (!redisUrl) {
      const body: CacheStatsResponse = { configured: false, connected: false, redisUrl: null, stats: emptyStats(), sample: [] };
      return Response.json(body);
    }

    const redis = getRedisClient();
    if (!redis) return jsonError("Redis client unavailable.", 503);

    try {
      await redis.ping();
    } catch {
      const body: CacheStatsResponse = {
        configured: true,
        connected: false,
        redisUrl: redactRedisUrl(redisUrl),
        stats: emptyStats(),
        sample: [],
      };
      return Response.json(body);
    }

    return Response.json(await buildConnectedStats(redisUrl, redis));
  });
}

export async function DELETE() {
  return handleRoute(async () => {
    const redis = getRedisClient();
    if (!redis) return jsonError("Redis not configured.", 503);
    // Scan all image cache keys (both :data and :ct variants)
    const allKeys = await scanKeys(redis, "img:*");
    if (allKeys.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < allKeys.length; i += batchSize) {
        await redis.del(...allKeys.slice(i, i + batchSize));
      }
    }
    return Response.json({ deleted: allKeys.length });
  });
}
