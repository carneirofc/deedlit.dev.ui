import { z } from "zod";

import { CompactResultSchema, GraphScopeSchema, SafetySchema } from "@/lib/library/schemas";
import type { SortMode } from "@/lib/store/settings";

export const SAFETY_CLASSES = SafetySchema.options;

export const BrowseModeSchema = z.enum(["browse", "semantic", "image", "similar"]);
export type BrowseMode = z.infer<typeof BrowseModeSchema>;

export const JobSummarySchema = z.object({
  id: z.string(),
  folderPath: z.string().nullable(),
  status: z.string(),
  totalFiles: z.number(),
  processedFiles: z.number(),
  failedFiles: z.number(),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

/** A note attached to an image, as surfaced by the lightbox notes panel. */
export const LibraryNoteSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type LibraryNote = z.infer<typeof LibraryNoteSchema>;

export const SimilarRefSchema = z.object({
  id: z.string(),
  thumbUrl: z.string(),
  summary: z.string(),
});
export type SimilarRef = z.infer<typeof SimilarRefSchema>;

/** A point-in-time snapshot of every filter control. Read by fetchPage / doFetch
 * so they always act on fresh state even from callbacks closing over a stale
 * render (see filtersRef in useLibraryFetch). */
export const FilterSnapshotSchema = z.object({
  mode: BrowseModeSchema,
  query: z.string(),
  tags: z.array(z.string()),
  excludeTags: z.array(z.string()),
  modelFamily: z.string(),
  checkpoint: z.string(),
  loras: z.string(),
  sourceTool: z.string(),
  pathFilter: z.string(),
  favorites: z.boolean(),
  minRating: z.number(),
  safety: z.array(SafetySchema),
  limit: z.number(),
  minScore: z.number(),
  similarRef: SimilarRefSchema.nullable(),
  imageFile: z.custom<File | null>(),
  graphScope: GraphScopeSchema.nullable(),
  sort: z.custom<SortMode>(),
});
export type FilterSnapshot = z.infer<typeof FilterSnapshotSchema>;

/** One page fetched via fetchPage: the fresh rows, whether more pages exist,
 * and (by-image only) a note describing which similarity provider matched. */
export const FetchPageResultSchema = z.object({
  fresh: z.array(CompactResultSchema),
  more: z.boolean(),
  note: z.string().optional(),
});
export type FetchPageResult = z.infer<typeof FetchPageResultSchema>;

/** One collapsible per-source-directory section of the results grid. */
export const GroupSectionSchema = z.object({
  key: z.string(),
  items: z.array(CompactResultSchema),
  startOffset: z.number(),
});
export type GroupSection = z.infer<typeof GroupSectionSchema>;

export { CompactResultSchema };
export type { CompactResult } from "@/lib/library/schemas";
