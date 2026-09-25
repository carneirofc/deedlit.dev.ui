import { z } from "zod";
import { maybeRow, rows } from "@/lib/library/db/postgres";

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
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

const JobRowSchema = z.object({
  id: z.string(),
  folder_path: z.string().nullable(),
  status: z.string(),
  total_files: z.number(),
  processed_files: z.number(),
  failed_files: z.number(),
  error_message: z.string().nullable(),
  started_at: z.custom<Date>().nullable(),
  finished_at: z.custom<Date>().nullable(),
  created_at: z.custom<Date>(),
});
type JobRow = z.infer<typeof JobRowSchema>;

function toSummary(r: JobRow): JobSummary {
  return {
    id: r.id,
    folderPath: r.folder_path,
    status: r.status,
    totalFiles: r.total_files,
    processedFiles: r.processed_files,
    failedFiles: r.failed_files,
    errorMessage: r.error_message,
    startedAt: r.started_at ? r.started_at.toISOString() : null,
    finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listJobs(limit = 50): Promise<JobSummary[]> {
  const result = await rows<JobRow>(
    `SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.map(toSummary);
}

const FailedJobFileRowSchema = z.object({
  file_path: z.string(),
  error: z.string().nullable(),
});
type FailedJobFileRow = z.infer<typeof FailedJobFileRowSchema>;

export const JobFailedFileSchema = z.object({
  filePath: z.string(),
  error: z.string().nullable(),
});
export type JobFailedFile = z.infer<typeof JobFailedFileSchema>;

export const JobDetailSchema = z.object({
  job: JobSummarySchema,
  failedFiles: z.array(JobFailedFileSchema),
});
export type JobDetail = z.infer<typeof JobDetailSchema>;

export async function getJob(jobId: string): Promise<JobDetail | null> {
  const row = await maybeRow<JobRow>(`SELECT * FROM ingestion_jobs WHERE id = $1`, [jobId]);
  if (!row) return null;
  const failed = await rows<FailedJobFileRow>(
    `SELECT file_path, error FROM ingestion_job_files WHERE job_id = $1 AND status = 'failed' LIMIT 200`,
    [jobId],
  );
  return {
    job: toSummary(row),
    failedFiles: failed.map((f) => ({ filePath: f.file_path, error: f.error })),
  };
}

const CancelledJobRowSchema = z.object({ id: z.string() });
type CancelledJobRow = z.infer<typeof CancelledJobRowSchema>;

export async function cancelJob(jobId: string): Promise<boolean> {
  const row = await maybeRow<CancelledJobRow>(
    `UPDATE ingestion_jobs SET status='cancelled', finished_at=now()
      WHERE id=$1 AND status IN ('pending','running') RETURNING id`,
    [jobId],
  );
  return row !== null;
}
