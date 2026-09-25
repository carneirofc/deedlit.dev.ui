"use client";

import { z } from "zod";

import { cls } from "./constants";
import { JobRow } from "./JobRow";
import { JobDetailSchema, JobSummarySchema } from "./schemas";

const JobsPanelPropsSchema = z.object({
  jobs: z.array(JobSummarySchema),
  expanded: z.string().nullable(),
  toggleExpanded: z.custom<(jobId: string) => void>(),
  detail: JobDetailSchema.nullable(),
  refreshJobs: z.custom<() => void>(),
  cancelJob: z.custom<(jobId: string) => void>(),
});
type JobsPanelProps = z.infer<typeof JobsPanelPropsSchema>;

export function JobsPanel({ jobs, expanded, toggleExpanded, detail, refreshJobs, cancelJob }: JobsPanelProps) {
  return (
    <section className={cls.card} data-testid="jobs-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">
          Ingestion jobs
          <span className="ml-2 text-ui-2xs text-ui-ink-muted">live · 3s</span>
        </h2>
        <button className={cls.btn} onClick={refreshJobs} data-testid="jobs-refresh">
          Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-ui-sm text-ui-ink-muted">No jobs yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {jobs.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              isOpen={expanded === j.id}
              toggleExpanded={toggleExpanded}
              cancelJob={cancelJob}
              detail={detail}
            />
          ))}
        </div>
      )}
    </section>
  );
}
