import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { useActivity } from "@/lib/store/activity";

import { JobDetailSchema, JobSummarySchema, type JobDetail, type JobSummary } from "./schemas";

const JobsResponseSchema = z.object({ jobs: z.array(JobSummarySchema).optional() });

function useJobsPolling() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);

  const refreshJobs = useCallback(() => {
    fetch("/api/library/jobs")
      .then((r) => r.json())
      .then((raw: unknown) => {
        const parsed = JobsResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.jobs) setJobs(parsed.data.jobs);
      })
      .catch(() => {});
  }, []);

  // Initial load + polling. (The status board self-polls its own health.)
  useEffect(() => {
    refreshJobs();
    const jobsId = setInterval(refreshJobs, 3000);
    return () => clearInterval(jobsId);
  }, [refreshJobs]);

  return { jobs, refreshJobs };
}

function useExpandedJobDetail(expanded: string | null, jobs: JobSummary[]) {
  const [detail, setDetail] = useState<JobDetail | null>(null);

  // Load detail for the expanded job (and keep it fresh while jobs poll).
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    fetch(`/api/library/jobs/${expanded}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const parsed = JobDetailSchema.safeParse(raw);
        if (!cancelled && parsed.success) setDetail(parsed.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [expanded, jobs]);

  return { detail, setDetail };
}

export function useJobsBoard(onError: (message: string | null) => void) {
  const { fetchJson } = useActivity();
  const { jobs, refreshJobs } = useJobsPolling();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { detail, setDetail } = useExpandedJobDetail(expanded, jobs);

  // Reset the previous job's detail immediately on toggle (avoids a stale
  // flash before the effect above re-fetches for the newly expanded job).
  const toggleExpanded = (jobId: string) => {
    setExpanded((prev) => (prev === jobId ? null : jobId));
    setDetail(null);
  };

  const cancelJob = async (jobId: string) => {
    try {
      await fetchJson(`Cancel job ${jobId.slice(0, 8)}`, `/api/library/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      refreshJobs();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  return { jobs, expanded, toggleExpanded, detail, refreshJobs, cancelJob };
}
