import { z } from "zod";
import { getLibraryConfig } from "@/lib/library/config";
import { getQdrant } from "@/lib/library/db/qdrant";

declare global {
  var __comfyhelperQdrantReady: boolean | undefined;
}

export const ImageVectorPayloadSchema = z.object({
  image_id: z.string(),
  file_path: z.string(),
  thumbnail_path: z.string().nullable(),
  /**
  * Browser-reachable proxy URLs (absolute) served by comfyhelper.  Stored so
  * the Qdrant dashboard / deedlit.vision test UI can render the image instead
  * of choking on `file_path`, which is a server-local filesystem path.
  */
  thumbnail_url: z.string(),
  image_url: z.string(),
  tags: z.array(z.string()),
  model_family: z.string().nullable(),
  checkpoint: z.string().nullable(),
  loras: z.array(z.string()),
  rating: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  created_at: z.string().nullable(),
  source_tool: z.string().nullable(),
  favorite: z.boolean(),
});
export type ImageVectorPayload = z.infer<typeof ImageVectorPayloadSchema>;

export async function ensureCollection(): Promise<void> {
  if (globalThis.__comfyhelperQdrantReady) return;
  const { qdrantCollection, embeddingDimensions } = getLibraryConfig();
  const client = getQdrant();
  const existing = await client.getCollections();
  const found = existing.collections.some((c) => c.name === qdrantCollection);
  if (!found) {
    await client.createCollection(qdrantCollection, {
      vectors: { size: embeddingDimensions, distance: "Cosine" },
    });
    // Payload indexes for fast filtered retrieval.
    for (const field of ["tags", "model_family", "checkpoint", "loras", "favorite"]) {
      await client.createPayloadIndex(qdrantCollection, { field_name: field, field_schema: "keyword" }).catch(() => {});
    }
    await client.createPayloadIndex(qdrantCollection, { field_name: "rating", field_schema: "integer" }).catch(() => {});
  }
  globalThis.__comfyhelperQdrantReady = true;
}

export async function upsertPoint(
  id: string,
  vector: number[],
  payload: ImageVectorPayload,
): Promise<void> {
  const { qdrantCollection } = getLibraryConfig();
  await getQdrant().upsert(qdrantCollection, {
    wait: true,
    points: [{ id, vector, payload: payload as unknown as Record<string, unknown> }],
  });
}

export async function deletePoint(id: string): Promise<void> {
  const { qdrantCollection } = getLibraryConfig();
  await getQdrant().delete(qdrantCollection, { wait: true, points: [id] });
}

export async function retrieveVector(id: string): Promise<number[] | null> {
  const { qdrantCollection } = getLibraryConfig();
  const result = await getQdrant().retrieve(qdrantCollection, { ids: [id], with_vector: true });
  const point = result[0];
  if (!point || !point.vector) return null;
  return Array.isArray(point.vector) ? (point.vector as number[]) : null;
}

/** Batch-retrieve raw vectors for several points (used for pairwise compare). */
export async function retrieveVectors(ids: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (ids.length === 0) return map;
  const { qdrantCollection } = getLibraryConfig();
  const result = await getQdrant().retrieve(qdrantCollection, { ids, with_vector: true });
  for (const point of result) {
    if (Array.isArray(point.vector)) map.set(String(point.id), point.vector as number[]);
  }
  return map;
}

export const SimilarityPairSchema = z.object({
  a: z.string(),
  b: z.string(),
  score: z.number(),
});
export type SimilarityPair = z.infer<typeof SimilarityPairSchema>;

export const SimilarityMatrixSchema = z.object({
  /** Point ids in the order the matrix offsets reference. */
  ids: z.array(z.string()),
  /** Sparse similarity edges (higher score = more similar, Cosine). */
  pairs: z.array(SimilarityPairSchema),
});
export type SimilarityMatrix = z.infer<typeof SimilarityMatrixSchema>;

/**
 * Qdrant Distance Matrix API — samples `sample` points from the (optionally
 * filtered) collection and returns each point's `neighbors` nearest peers as a
 * sparse similarity matrix.  Purpose-built for clustering: we decode the
 * parallel offset/score arrays into id-pair edges.
 */
export async function searchSimilarityMatrix(
  filter: QdrantFilter | undefined,
  sample: number,
  neighbors: number,
): Promise<SimilarityMatrix> {
  const { qdrantCollection } = getLibraryConfig();
  const res = await getQdrant().searchMatrixOffsets(qdrantCollection, {
    filter: filter as Record<string, unknown> | undefined,
    sample,
    limit: neighbors,
  });
  const ids = (res.ids ?? []).map((id) => String(id));
  const rows = res.offsets_row ?? [];
  const cols = res.offsets_col ?? [];
  const scores = res.scores ?? [];
  const pairs: SimilarityPair[] = [];
  for (let k = 0; k < rows.length; k++) {
    const a = ids[rows[k]];
    const b = ids[cols[k]];
    if (a && b && a !== b) pairs.push({ a, b, score: scores[k] });
  }
  return { ids, pairs };
}

export const QdrantFilterSchema = z.object({
  must: z.array(z.unknown()).optional(),
  must_not: z.array(z.unknown()).optional(),
});
export type QdrantFilter = z.infer<typeof QdrantFilterSchema>;

/** Default HNSW `ef` for search — higher = better recall, slower. */
export const DEFAULT_HNSW_EF = 128;

export const VectorSearchOptionsSchema = z.object({
  /**
  * Cosine cutoff pushed into Qdrant as `score_threshold`. Unlike filtering in
  * JS after the fact, this lets Qdrant keep scanning so it can still return up
  * to `limit` results that clear the bar. 0 / undefined disables it.
  */
  scoreThreshold: z.number().optional(),
  /** HNSW search beam width. Raise for recall on larger collections. */
  hnswEf: z.number().optional(),
  /** Bypass the HNSW index for an exact (slow) brute-force scan — debug/ground-truth. */
  exact: z.boolean().optional(),
  /** Return the stored payload alongside each hit (debug). */
  withPayload: z.boolean().optional(),
});
export type VectorSearchOptions = z.infer<typeof VectorSearchOptionsSchema>;

export const ScoredHitSchema = z.object({
  id: z.string(),
  score: z.number(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type ScoredHit = z.infer<typeof ScoredHitSchema>;

export const IdScorePairSchema = z.object({
  id: z.string(),
  score: z.number(),
});
export type IdScorePair = z.infer<typeof IdScorePairSchema>;

export async function searchByVector(
  vector: number[],
  filter: QdrantFilter | undefined,
  limit: number,
  options: VectorSearchOptions = {},
): Promise<IdScorePair[]> {
  const hits = await searchByVectorDetailed(vector, filter, limit, options);
  return hits.map((h) => ({ id: h.id, score: h.score }));
}

/** Like {@link searchByVector} but can carry the payload (debug surface). */
export async function searchByVectorDetailed(
  vector: number[],
  filter: QdrantFilter | undefined,
  limit: number,
  options: VectorSearchOptions = {},
): Promise<ScoredHit[]> {
  const { qdrantCollection } = getLibraryConfig();
  const { scoreThreshold, hnswEf = DEFAULT_HNSW_EF, exact = false, withPayload = false } = options;
  const { points } = await getQdrant().query(qdrantCollection, {
    query: vector,
    limit,
    filter: filter as Record<string, unknown> | undefined,
    score_threshold: scoreThreshold && scoreThreshold > 0 ? scoreThreshold : undefined,
    params: { hnsw_ef: hnswEf, exact },
    with_payload: withPayload,
  });
  return points.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: withPayload ? ((r.payload as Record<string, unknown> | null) ?? null) : undefined,
  }));
}

export const CollectionInfoSchema = z.object({
  exists: z.boolean(),
  vectorSize: z.number().nullable(),
  distance: z.string().nullable(),
  pointsCount: z.number().nullable(),
});
export type CollectionInfo = z.infer<typeof CollectionInfoSchema>;

const VectorSizeInfoSchema = z.object({
  size: z.number().optional(),
  distance: z.string().optional(),
});
type VectorSizeInfo = z.infer<typeof VectorSizeInfoSchema>;

const ResolvedVectorSizeSchema = z.object({
  size: z.number().nullable(),
  distance: z.string().nullable(),
});
type ResolvedVectorSize = z.infer<typeof ResolvedVectorSizeSchema>;

function toResolvedVectorSize(info: VectorSizeInfo | undefined): ResolvedVectorSize {
  return { size: info?.size ?? null, distance: info?.distance ?? null };
}

function resolveVectorSizeInfo(
  vectors: VectorSizeInfo | Record<string, VectorSizeInfo> | undefined,
): ResolvedVectorSize {
  if (!vectors || typeof vectors !== "object") {
    return toResolvedVectorSize(undefined);
  }

  const isSingle = "size" in vectors && typeof (vectors as VectorSizeInfo).size === "number";
  const info = isSingle ? (vectors as VectorSizeInfo) : (Object.values(vectors)[0] as VectorSizeInfo | undefined);
  return toResolvedVectorSize(info);
}

/** Inspect the live Qdrant collection (dim / metric / size) for diagnostics. */
export async function getCollectionInfo(): Promise<CollectionInfo> {
  const { qdrantCollection } = getLibraryConfig();
  try {
    const info = await getQdrant().getCollection(qdrantCollection);
    const vectors = info.config?.params?.vectors as
      | VectorSizeInfo
      | Record<string, VectorSizeInfo>
      | undefined;
    const { size, distance } = resolveVectorSizeInfo(vectors);
    return { exists: true, vectorSize: size, distance, pointsCount: info.points_count ?? null };
  } catch {
    return { exists: false, vectorSize: null, distance: null, pointsCount: null };
  }
}

export async function recreateCollection(): Promise<void> {
  const { qdrantCollection } = getLibraryConfig();
  await getQdrant().deleteCollection(qdrantCollection).catch(() => {});
  globalThis.__comfyhelperQdrantReady = false;
  await ensureCollection();
}
