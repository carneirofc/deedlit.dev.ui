import { z } from "zod";

// ---------------------------------------------------------------------------
// Types mirroring the library API responses.
// ---------------------------------------------------------------------------

export const JobSummarySchema = z.object({
  id: z.string(),
  folderPath: z.string().nullable(),
  status: z.string(),
  totalFiles: z.number(),
  processedFiles: z.number(),
  failedFiles: z.number(),
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
  /** Current pipeline stage — which microservice is active right now. */
  stage: z.string().nullable(),
  /** Per-stage reached-count for the expandable staircase. */
  stageCounts: z.record(z.string(), z.number()),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

export const JobDetailSchema = z.object({
  job: JobSummarySchema,
  failedFiles: z.array(z.object({ filePath: z.string(), error: z.string().nullable() })),
});
export type JobDetail = z.infer<typeof JobDetailSchema>;

export const IngestOptionsSchema = z.object({
  recursive: z.boolean(),
  generateThumbnails: z.boolean(),
  extractMetadata: z.boolean(),
  runExternalEnrichment: z.boolean(),
  indexQdrant: z.boolean(),
  syncNeo4j: z.boolean(),
});
export type IngestOptions = z.infer<typeof IngestOptionsSchema>;

export const ActionStatusSchema = z.enum(["idle", "running", "done", "error"]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const MaintenanceActionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  endpoint: z.string(),
});
export type MaintenanceAction = z.infer<typeof MaintenanceActionSchema>;

export const ActionRunSchema = z.object({
  status: ActionStatusSchema,
  result: z.string().nullable(),
});
export type ActionRun = z.infer<typeof ActionRunSchema>;

// ---------------------------------------------------------------------------
// Missing-files cleanup — find catalog entries whose source file vanished
// from disk, then un-index the selected stale records via batch-delete.
// ---------------------------------------------------------------------------

export const MissingFileSchema = z.object({
  sha256: z.string(),
  filepath: z.string(),
  filename: z.string().nullable().optional(),
  directory: z.string().nullable().optional(),
});
export type MissingFile = z.infer<typeof MissingFileSchema>;

export const MissingFilesResultSchema = z.object({
  checked: z.number(),
  missing: z.array(MissingFileSchema),
  missingCount: z.number(),
  truncated: z.boolean(),
});
export type MissingFilesResult = z.infer<typeof MissingFilesResultSchema>;

export const MissingStateSchema = z.enum(["idle", "scanning", "done", "error"]);
export type MissingState = z.infer<typeof MissingStateSchema>;

// ---------------------------------------------------------------------------
// API response shapes for `fetchJson<T>` call sites (generic type args must
// not be inline object literals per the zod-schema-types rule).
// ---------------------------------------------------------------------------

export const IngestDispatchResponseSchema = z.object({ job_id: z.string().nullable().optional() });
export type IngestDispatchResponse = z.infer<typeof IngestDispatchResponseSchema>;

export const MaintenanceRunResponseSchema = z.object({
  id: z.string().nullable().optional(),
  job_id: z.string().nullable().optional(),
});
export type MaintenanceRunResponse = z.infer<typeof MaintenanceRunResponseSchema>;

export const BatchDeleteResponseSchema = z.object({ deleted: z.array(z.string()).optional() });
export type BatchDeleteResponse = z.infer<typeof BatchDeleteResponseSchema>;
