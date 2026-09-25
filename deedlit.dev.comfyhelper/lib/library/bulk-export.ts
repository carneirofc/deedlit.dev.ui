import { z } from "zod";
/**
 * Bulk export — POST the selected ids to `/api/library/export` (which fans the
 * gateway detail reads out server-side) and download the returned canonical
 * catalog records as a JSON file. Mirrors bulk-delete in spirit: one user
 * action over a selection, tolerant of partial failure (the route reports which
 * ids resolved and which did not).
 */

import { CatalogImageSchema, type CatalogImage } from "@/lib/api-client";

/**
 * The chosen export flavour. `complete-*` dump the full canonical catalog record
 * (round-trips against the contract); `simple-*` keep only the basic, human-
 * scannable fields — enough to identify and locate an image. CSV is simple-only
 * (the full record is too nested to flatten into a table sensibly).
 */
export const ExportKindSchema = z.enum([
  "complete-json",
  "complete-jsonl",
  "simple-json",
  "simple-jsonl",
  "simple-csv",
]);
export type ExportKind = z.infer<typeof ExportKindSchema>;

export const BulkExportErrorSchema = z.object({
  id: z.string(),
  error: z.string(),
});
export type BulkExportError = z.infer<typeof BulkExportErrorSchema>;

export const BulkExportResultSchema = z.object({
  exportedAt: z.string(),
  /** How many ids were requested. */
  requested: z.number(),
  /** How many records actually resolved (`images.length`). */
  count: z.number(),
  images: z.array(CatalogImageSchema),
  /** Ids that could not be exported, with the surfaced reason. */
  errors: z.array(BulkExportErrorSchema),
});
export type BulkExportResult = z.infer<typeof BulkExportResultSchema>;

const BulkExportResponseSchema = BulkExportResultSchema.partial().extend({
  error: z.string().optional(),
});

function normalizeBulkExportResult(
  body: z.infer<typeof BulkExportResponseSchema>,
  requestedIds: string[],
): BulkExportResult {
  return {
    exportedAt: body.exportedAt ?? new Date().toISOString(),
    requested: body.requested ?? requestedIds.length,
    count: body.count ?? body.images?.length ?? 0,
    images: body.images ?? [],
    errors: body.errors ?? [],
  };
}

export async function exportImages(ids: string[], signal?: AbortSignal): Promise<BulkExportResult> {
  const res = await fetch("/api/library/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
    signal,
  });
  const parsed = BulkExportResponseSchema.safeParse(await res.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};
  if (!res.ok) throw new Error(body.error ?? `Export failed (HTTP ${res.status})`);
  return normalizeBulkExportResult(body, ids);
}

/**
 * The basic, human-scannable subset kept in a "simple" export: enough to
 * identify (id / sha256), locate (file path + name) and triage (dimensions,
 * rating, favorite, safety, source tool, tags, date) an image — without the
 * full canonical record's prompts, params, workflow JSON and references.
 */
export const SimpleExportRecordSchema = z.object({
  /** Catalog id — the sha256 (kept under `id` too for convenience). */
  id: z.string(),
  sha256: z.string(),
  filePath: z.string().nullable(),
  filename: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  safety: z.string().nullable(),
  sourceTool: z.string().nullable(),
  createdAt: z.string().nullable(),
  tags: z.array(z.string()),
});
export type SimpleExportRecord = z.infer<typeof SimpleExportRecordSchema>;

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// The contract spells it `filepath`; tolerate a camelCase forward too. Both are
// caught by the catalog schema's `.catchall(unknown())`, so narrow defensively.
function resolveExportFilePath(image: CatalogImage): string | null {
  return asNullableString(image.filepath) ?? asNullableString(image.filePath);
}

/** Project a full canonical catalog record down to the simple export subset. */
export function toSimpleRecord(image: CatalogImage): SimpleExportRecord {
  const filePath = resolveExportFilePath(image);
  return {
    id: image.sha256,
    sha256: image.sha256,
    filePath,
    filename: filePath ? (filePath.split(/[\\/]/).pop() ?? null) : null,
    width: image.width ?? null,
    height: image.height ?? null,
    rating: image.rating ?? null,
    favorite: image.favorite ?? false,
    safety: asNullableString(image.safety),
    sourceTool: image.sourceTool ?? null,
    createdAt: image.created_at ?? null,
    tags: image.tags ?? [],
  };
}

/** Trigger a client-side download of `text` as a file with the given mime type. */
export function downloadText(text: string, filename: string, type = "text/plain"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a client-side download of `data` as a pretty-printed JSON file. */
export function downloadJson(data: unknown, filename: string): void {
  downloadText(JSON.stringify(data, null, 2), filename, "application/json");
}

/**
 * Trigger a download of `images` as JSON Lines (one record per line, NDJSON) —
 * a stream-friendly form of the same canonical catalog records, handy for
 * piping into jq / bulk re-import. Carries the records only (no export wrapper).
 */
export function downloadJsonl(images: unknown[], filename: string): void {
  const text = images.map((img) => JSON.stringify(img)).join("\n") + "\n";
  downloadText(text, filename, "application/x-ndjson");
}

/**
 * Trigger a download of `rows` as CSV. Columns are the keys of the first row;
 * array cells join on "; "; values with commas/quotes/newlines are quoted with
 * RFC-4180 doubling. Meant for the flat simple-export records — a spreadsheet-
 * friendly table of the basics.
 */
export function downloadCsv(rows: readonly object[], filename: string): void {
  if (rows.length === 0) {
    downloadText("", filename, "text/csv");
    return;
  }
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown): string => {
    const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => cell((r as Record<string, unknown>)[h])).join(",")),
  ];
  downloadText(lines.join("\n") + "\n", filename, "text/csv");
}
