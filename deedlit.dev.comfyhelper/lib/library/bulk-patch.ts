/**
 * Bulk metadata edit — fans the per-image PATCH route
 * (`PATCH /api/library/images/{id}`) out over a list of per-image bodies with
 * bounded concurrency. That route proxies the gateway PATCH /images/{sha}
 * (catalog truth: rating / favorite / tags / safety), so a bulk edit is just N
 * calls to the same already-tested endpoint — no bulk backend to keep in sync.
 *
 * Bodies are per-id (not one shared body) so tag add/remove can be expressed as
 * a computed final tag list per image (the catalog PATCH replaces the whole tag
 * set). The returned promise never rejects: every id's outcome is collected so a
 * partial failure still reports which images changed (the caller updates those
 * grid rows) and which did not.
 */

import { z } from "zod";
import { ImagePatchBodySchema } from "@/lib/api-client";

export const BulkPatchFailureSchema = z.object({
  id: z.string(),
  error: z.string(),
});
export type BulkPatchFailure = z.infer<typeof BulkPatchFailureSchema>;

export const BulkPatchOutcomeSchema = z.object({
  /** Ids whose catalog record was updated. */
  updated: z.array(z.string()),
  /** Ids that could not be updated, with the surfaced reason. */
  failed: z.array(BulkPatchFailureSchema),
});
export type BulkPatchOutcome = z.infer<typeof BulkPatchOutcomeSchema>;

export const BulkPatchOptionsSchema = z.object({
  /** Max in-flight patches. Clamped to >= 1. Default 4. */
  concurrency: z.number().optional(),
  signal: z.custom<AbortSignal>().optional(),
});
export type BulkPatchOptions = z.infer<typeof BulkPatchOptionsSchema>;

export const BulkPatchRequestSchema = z.object({
  id: z.string(),
  body: ImagePatchBodySchema,
});
export type BulkPatchRequest = z.infer<typeof BulkPatchRequestSchema>;

const PatchErrorResponseSchema = z.object({
  error: z.string().optional(),
});

async function patchOne(
  p: BulkPatchRequest,
  signal: AbortSignal | undefined,
  updated: string[],
  failed: BulkPatchFailure[],
): Promise<void> {
  try {
    const res = await fetch(`/api/library/images/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p.body),
      signal,
    });
    if (res.ok) {
      updated.push(p.id);
      return;
    }
    const parsed = PatchErrorResponseSchema.safeParse(await res.json().catch(() => ({})));
    const error = (parsed.success ? parsed.data.error : undefined) ?? `HTTP ${res.status}`;
    failed.push({ id: p.id, error });
  } catch (e) {
    failed.push({ id: p.id, error: e instanceof Error ? e.message : "Request failed" });
  }
}

export async function patchImages(
  patches: BulkPatchRequest[],
  opts: BulkPatchOptions = {},
): Promise<BulkPatchOutcome> {
  const updated: string[] = [];
  const failed: BulkPatchFailure[] = [];
  const queue = [...patches];

  // Each worker drains the shared queue; `shift()` is synchronous so no id is
  // patched twice.
  const worker = async (): Promise<void> => {
    for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
      await patchOne(p, opts.signal, updated, failed);
    }
  };
  const lanes = Math.min(Math.max(1, opts.concurrency ?? 4), patches.length || 1);
  await Promise.all(Array.from({ length: lanes }, worker));

  return { updated, failed };
}
