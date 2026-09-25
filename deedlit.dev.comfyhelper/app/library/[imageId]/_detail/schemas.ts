import { z } from "zod";

export const RelatedTagSchema = z.object({
  name: z.string(),
  coOccurrence: z.number(),
});
export type RelatedTag = z.infer<typeof RelatedTagSchema>;

export const ImageDetailNoteSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type ImageDetailNote = z.infer<typeof ImageDetailNoteSchema>;

export const VectorDebugStatsSchema = z.object({
  dims: z.number(),
  norm: z.number(),
  isZero: z.boolean(),
  nonZero: z.number(),
  min: z.number(),
  max: z.number(),
  sample: z.array(z.number()),
});
export type VectorDebugStats = z.infer<typeof VectorDebugStatsSchema>;

export const VectorDebugHitSchema = z.object({
  id: z.string(),
  score: z.number(),
  isSelf: z.boolean(),
  payload: z.record(z.string(), z.unknown()).nullable(),
});
export type VectorDebugHit = z.infer<typeof VectorDebugHitSchema>;

export const VectorDebugSchema = z.object({
  query: z.object({
    imageId: z.string(),
    vectorFound: z.boolean(),
    stats: VectorDebugStatsSchema.nullable(),
  }),
  collection: z.object({
    exists: z.boolean(),
    vectorSize: z.number().nullable(),
    distance: z.string().nullable(),
    pointsCount: z.number().nullable(),
  }),
  embedding: z.object({
    provider: z.string(),
    dimensions: z.number(),
    hasExternalImageEmbeddings: z.boolean(),
    clipVisionApiUrl: z.string().nullable(),
  }),
  params: z.object({
    limit: z.number(),
    minScore: z.number(),
    hnswEf: z.number(),
    exact: z.boolean(),
  }),
  hits: z.array(VectorDebugHitSchema),
  warnings: z.array(z.string()),
  tookMs: z.number(),
});
export type VectorDebug = z.infer<typeof VectorDebugSchema>;
