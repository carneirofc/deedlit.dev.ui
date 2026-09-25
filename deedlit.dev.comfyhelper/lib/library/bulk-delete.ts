import { z } from "zod";

/**
 * Bulk image deletion — un-indexes a list of images in ONE batch call to
 * `POST /api/library/images/batch-delete`, which proxies the gateway batch
 * endpoint (catalog record + search vector + graph node per id — NOT the source
 * file on disk). The gateway does a single batch op per store, so deleting N
 * images is a handful of DB round-trips, not N×3.
 *
 * The returned promise never rejects: a transport / non-2xx error maps every id
 * to `failed` (so the caller can surface it), while a success splits the ids into
 * the ones that went away and any the server reports as not-deleted. A `missing`
 * id (already absent) counts as deleted — the goal state is "no longer in the
 * library", which an already-gone image satisfies.
 */

export const BulkDeleteFailureSchema = z.object({
  id: z.string(),
  error: z.string(),
});
export type BulkDeleteFailure = z.infer<typeof BulkDeleteFailureSchema>;

export const BulkDeleteOutcomeSchema = z.object({
  /** Ids that are no longer in the library (deleted now, or already gone). */
  deleted: z.array(z.string()),
  /** Ids that could not be removed, with the surfaced reason. */
  failed: z.array(BulkDeleteFailureSchema),
});
export type BulkDeleteOutcome = z.infer<typeof BulkDeleteOutcomeSchema>;

export const BulkDeleteOptionsSchema = z.object({
  signal: z.custom<AbortSignal>().optional(),
});
export type BulkDeleteOptions = z.infer<typeof BulkDeleteOptionsSchema>;

const DeleteErrorResponseSchema = z.object({
  error: z.string().optional(),
});

const BatchDeleteResponseSchema = z.object({
  deleted: z.array(z.string()).optional(),
  missing: z.array(z.string()).optional(),
});

export async function deleteImages(
  ids: string[],
  opts: BulkDeleteOptions = {},
): Promise<BulkDeleteOutcome> {
  if (ids.length === 0) return { deleted: [], failed: [] };

  const fail = (error: string): BulkDeleteOutcome => ({
    deleted: [],
    failed: ids.map((id) => ({ id, error })),
  });

  try {
    const res = await fetch("/api/library/images/batch-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const parsed = DeleteErrorResponseSchema.safeParse(await res.json().catch(() => ({})));
      const error = (parsed.success ? parsed.data.error : undefined) ?? `HTTP ${res.status}`;
      return fail(error);
    }
    const j = BatchDeleteResponseSchema.parse(await res.json());
    // `missing` (already absent) satisfies the goal state, so count it as deleted.
    const deleted = [...(j.deleted ?? []), ...(j.missing ?? [])];
    const gone = new Set(deleted);
    const failed = ids
      .filter((id) => !gone.has(id))
      .map((id) => ({ id, error: "not deleted" }));
    return { deleted, failed };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Request failed");
  }
}
