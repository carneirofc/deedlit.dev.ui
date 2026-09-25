"use client";

import { z } from "zod";

import { PIPELINE_STAGES } from "./constants";
import { JobSummarySchema } from "./schemas";

const PipelineStaircasePropsSchema = z.object({
  job: JobSummarySchema,
});
type PipelineStaircaseProps = z.infer<typeof PipelineStaircasePropsSchema>;

// Per-stage staircase: how far each microservice has carried this job's files
// (which service is the bottleneck / where failures stall).
export function PipelineStaircase({ job }: PipelineStaircaseProps) {
  if (Object.keys(job.stageCounts).length === 0) return null;
  return (
    <div className="mt-2" data-testid={`job-stages-${job.id}`}>
      <p className="font-medium text-ui-ink">Pipeline stages</p>
      <div className="mt-1 flex flex-col gap-0.5">
        {PIPELINE_STAGES.filter((s) => s in job.stageCounts).map((s) => {
          const reached = job.stageCounts[s] ?? 0;
          const w = job.totalFiles > 0 ? Math.round((reached / job.totalFiles) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-ui-ink">{s}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ui-bg-soft">
                <div className="h-full rounded-full bg-accent-cyan/70" style={{ width: `${w}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums">
                {reached}/{job.totalFiles}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
