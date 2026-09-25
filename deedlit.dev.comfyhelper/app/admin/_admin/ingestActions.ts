import type { Dispatch, SetStateAction } from "react";

import { z } from "zod";

import { normalizePath, splitPaths } from "@/lib/library/paths";
import type { useActivity } from "@/lib/store/activity";

import { IngestOptionsSchema, type IngestDispatchResponse } from "./schemas";

type FetchJson = ReturnType<typeof useActivity>["fetchJson"];
type TrackJob = ReturnType<typeof useActivity>["trackJob"];

const IngestDepsSchema = z.object({
  fetchJson: z.custom<FetchJson>(),
  trackJob: z.custom<TrackJob>(),
  options: IngestOptionsSchema,
  setIngestBusy: z.custom<Dispatch<SetStateAction<boolean>>>(),
  onError: z.custom<(message: string | null) => void>(),
  onNotice: z.custom<(message: string | null) => void>(),
  refreshJobs: z.custom<() => void>(),
});
type IngestDeps = z.infer<typeof IngestDepsSchema>;

// Dispatch one folder ingest and hand the job to the global activity poller so
// its progress shows in the dock from any page. Returns the dispatched job id.
async function dispatchIngest(
  deps: Pick<IngestDeps, "fetchJson" | "trackJob" | "options">,
  path: string,
): Promise<string | null | undefined> {
  const { fetchJson, trackJob, options } = deps;
  const name = path.split(/[\\/]/).pop() || path;
  const j = await fetchJson<IngestDispatchResponse>(
    `Ingest ${name}`,
    "/api/library/ingest/folder",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folderPath: path, ...options }),
    },
  );
  trackJob(`Ingest ${name}`, j.job_id);
  return j.job_id;
}

export async function startIngestMultiple(deps: IngestDeps, multiText: string): Promise<void> {
  const { setIngestBusy, onError, onNotice, refreshJobs } = deps;
  const paths = splitPaths(multiText);
  if (paths.length === 0) {
    onError("Enter one folder path per line.");
    return;
  }
  setIngestBusy(true);
  onError(null);
  onNotice(null);
  let started = 0;
  const errors: string[] = [];
  for (const path of paths) {
    try {
      await dispatchIngest(deps, path);
      started++;
    } catch (e) {
      errors.push(`${path}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  setIngestBusy(false);
  if (started > 0) onNotice(`Started ${started} ingestion job${started === 1 ? "" : "s"}.`);
  if (errors.length) onError(errors.join(" · "));
  refreshJobs();
}

export async function startIngestSingle(
  deps: IngestDeps,
  folderPath: string,
  multiMode: boolean,
  multiText: string,
): Promise<void> {
  if (multiMode) return startIngestMultiple(deps, multiText);
  const { setIngestBusy, onError, onNotice, refreshJobs } = deps;
  const path = normalizePath(folderPath);
  if (!path) {
    onError("Folder path is required.");
    return;
  }
  setIngestBusy(true);
  onError(null);
  onNotice(null);
  try {
    const jobId = await dispatchIngest(deps, path);
    onNotice(`Ingestion started — job ${jobId}`);
    refreshJobs();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Ingest failed");
  } finally {
    setIngestBusy(false);
  }
}
