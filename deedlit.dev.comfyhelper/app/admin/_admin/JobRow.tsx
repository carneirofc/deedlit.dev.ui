"use client";

import { z } from "zod";

import { ACTIVE_JOB_STATUSES } from "./constants";
import { jobStatusColor } from "./helpers";
import { PipelineStaircase } from "./PipelineStaircase";
import { JobDetailSchema, JobSummarySchema } from "./schemas";

const JobRowDetailPropsSchema = z.object({
  job: JobSummarySchema,
  detail: JobDetailSchema.nullable(),
});
type JobRowDetailProps = z.infer<typeof JobRowDetailPropsSchema>;

function JobRowDetail({ job, detail }: JobRowDetailProps) {
  return (
    <div className="border-t border-ui-border/40 px-3 py-2 text-ui-2xs text-ui-ink-muted">
      <div className="grid gap-1 sm:grid-cols-2">
        <span>created: {job.createdAt}</span>
        <span>started: {job.startedAt ?? "—"}</span>
        <span>finished: {job.finishedAt ?? "—"}</span>
        <span>job id: {job.id}</span>
      </div>
      {job.errorMessage && <p className="mt-1 text-rose-500">error: {job.errorMessage}</p>}
      <PipelineStaircase job={job} />
      {detail && detail.job.id === job.id && detail.failedFiles.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-ui-ink">Failed files ({detail.failedFiles.length})</p>
          <ul className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {detail.failedFiles.map((f) => (
              <li key={f.filePath} className="truncate">
                <span className="text-ui-ink">{f.filePath}</span>
                {f.error ? ` — ${f.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const JobRowPropsSchema = z.object({
  job: JobSummarySchema,
  isOpen: z.boolean(),
  toggleExpanded: z.custom<(jobId: string) => void>(),
  cancelJob: z.custom<(jobId: string) => void>(),
  detail: JobDetailSchema.nullable(),
});
type JobRowProps = z.infer<typeof JobRowPropsSchema>;

export function JobRow({ job, isOpen, toggleExpanded, cancelJob, detail }: JobRowProps) {
  const pct = job.totalFiles > 0 ? Math.round((job.processedFiles / job.totalFiles) * 100) : 0;
  const active = ACTIVE_JOB_STATUSES.has(job.status);
  return (
    <div className="rounded-lg border border-ui-border/50 bg-ui-bg">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => toggleExpanded(job.id)}
          data-testid={`job-row-${job.id}`}
        >
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-ui-2xs font-medium ${jobStatusColor(job.status)}`}
          >
            {job.status}
          </span>
          <span className="min-w-0 flex-1 truncate text-ui-xs text-ui-ink">{job.folderPath ?? "—"}</span>
          {active && job.stage && (
            <span
              className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-ui-2xs font-medium text-sky-500"
              title="active pipeline stage — the microservice working now"
              data-testid={`job-stage-${job.id}`}
            >
              {job.stage}
            </span>
          )}
          <span className="shrink-0 text-ui-2xs text-ui-ink-muted">
            {job.processedFiles}/{job.totalFiles} ({pct}%)
            {job.failedFiles > 0 ? ` · ${job.failedFiles} err` : ""}
          </span>
        </button>
        {active && (
          <button
            className="shrink-0 rounded-md border border-rose-500/40 px-2 py-1 text-ui-2xs text-rose-500 transition hover:bg-rose-500/10"
            onClick={() => cancelJob(job.id)}
            data-testid={`job-cancel-${job.id}`}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mx-3 mb-2 h-1 overflow-hidden rounded-full bg-ui-bg-soft">
        <div className="h-full rounded-full bg-accent-cyan transition-all" style={{ width: `${pct}%` }} />
      </div>

      {isOpen && <JobRowDetail job={job} detail={detail} />}
    </div>
  );
}
