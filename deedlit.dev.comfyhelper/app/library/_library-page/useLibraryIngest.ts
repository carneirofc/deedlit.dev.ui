"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

import { JobSummarySchema, type JobSummary } from "./schemas";

const JobsResponseSchema = z.object({ jobs: z.array(JobSummarySchema).optional() });

/** Ingest-job polling (independent of saved settings) + the folder-ingest
 * form. System health lives on its own page (/admin/health). Ingest failures
 * surface through the same error banner as search (`setError`). */
export function useLibraryIngest(setError: (message: string | null) => void) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [showIngest, setShowIngest] = useState(false);

  useEffect(() => {
    if (!showIngest) return;
    const ac = new AbortController();
    const pollJobs = () =>
      fetch("/api/library/jobs", { signal: ac.signal })
        .then((r) => r.json())
        .then((j) => {
          const parsed = JobsResponseSchema.safeParse(j);
          if (parsed.success && parsed.data.jobs) setJobs(parsed.data.jobs);
        })
        .catch(() => {});
    pollJobs();
    const id = setInterval(pollJobs, 3000);
    return () => { clearInterval(id); ac.abort(); };
  }, [showIngest]);

  const startIngest = async () => {
    if (!folderPath.trim()) return;
    try {
      const r = await fetch("/api/library/ingest/folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderPath: folderPath.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Ingest failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    }
  };

  return { jobs, folderPath, setFolderPath, showIngest, setShowIngest, startIngest };
}
