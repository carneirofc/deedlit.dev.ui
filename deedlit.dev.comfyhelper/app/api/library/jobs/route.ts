import { handleRoute, jsonOk } from "@/lib/library/http";
import { listJobs } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** First non-null string among several candidate (possibly camelCase/snake_case) fields. */
function firstStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = strOrNull(v);
    if (s !== null) return s;
  }
  return null;
}

/** First numeric value among several candidate fields (defaults to 0). */
function firstNum(...vals: unknown[]): number {
  for (const v of vals) {
    if (typeof v === "number") return v;
  }
  return 0;
}

/** Coerce an opaque value into a `{ stage: count }` map (drops non-numeric). */
function stageCounts(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Normalize one opaque ingest job into the fields the UI renders. */
function normalizeJob(j: Awaited<ReturnType<typeof listJobs>>[number]) {
  return {
    id: firstStr(j.id, j.job_id) ?? "",
    folderPath: firstStr(j.folderPath, j.folder_path),
    status: firstStr(j.status) ?? "unknown",
    totalFiles: firstNum(j.totalFiles, j.total_files),
    processedFiles: firstNum(j.processedFiles, j.processed_files),
    failedFiles: firstNum(j.failedFiles, j.failed_files),
    errorMessage: firstStr(j.errorMessage, j.error_message),
    startedAt: firstStr(j.startedAt, j.started_at),
    finishedAt: firstStr(j.finishedAt, j.finished_at),
    createdAt: firstStr(j.createdAt, j.created_at) ?? "",
    // Live pipeline stage + per-stage staircase (which service is active now).
    stage: firstStr(j.currentStage, j.current_stage, j.stage),
    stageCounts: stageCounts(j.stageCounts ?? j.stage_counts),
  };
}

/**
 * List ingest/maintenance jobs for the dashboard. Proxies the gateway GET /jobs
 * (-> deedlit.ingest) and normalizes each opaque job into the fields the UI
 * renders, tolerating shape drift from the ingest service.
 */
export async function GET() {
  return handleRoute(async () => {
    const raw = await listJobs();
    const jobs = raw.map(normalizeJob);
    return jsonOk({ jobs });
  });
}
