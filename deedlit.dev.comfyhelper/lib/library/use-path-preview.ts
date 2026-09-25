"use client";

import { z } from "zod";
import { useEffect, useState } from "react";

import { isImageFile } from "@/lib/library/paths";

/**
 * Live validation/preview for an ingestion-source path. Debounces the typed
 * path and lists it through the `/api/library/fs/browse` proxy (which reaches
 * the ingest host's filesystem). Surfaces whether the path is a real directory
 * and how many images / sub-folders sit directly inside it — so a bad path is
 * caught before "Start"/"Add" instead of failing the dispatched job.
 *
 * The image/sub-folder counts are for THIS folder only (the listing is one
 * level deep); a recursive scan will find more. Labelled as such in the UI.
 */

const FsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
});
type FsEntry = z.infer<typeof FsEntrySchema>;

const FsBrowseResponseSchema = z.object({
  path: z.string().optional(),
  entries: z.array(FsEntrySchema).optional(),
  error: z.string().optional(),
});

const PathPreviewIdleSchema = z.object({ state: z.literal("idle") });
const PathPreviewCheckingSchema = z.object({ state: z.literal("checking") });
const PathPreviewValidSchema = z.object({
  state: z.literal("valid"),
  /** Absolute path as resolved by the ingest host. */
  resolvedPath: z.string(),
  /** Image files directly in this folder (non-recursive). */
  imageCount: z.number(),
  /** Sub-folders directly in this folder. */
  subdirCount: z.number(),
});
const PathPreviewInvalidSchema = z.object({ state: z.literal("invalid"), error: z.string() });

export const PathPreviewSchema = z.discriminatedUnion("state", [
  PathPreviewIdleSchema,
  PathPreviewCheckingSchema,
  PathPreviewValidSchema,
  PathPreviewInvalidSchema,
]);
export type PathPreview = z.infer<typeof PathPreviewSchema>;

export const UsePathPreviewOptionsSchema = z.object({
  enabled: z.boolean().optional(),
  debounceMs: z.number().optional(),
});
export type UsePathPreviewOptions = z.infer<typeof UsePathPreviewOptionsSchema>;

async function fetchPathPreview(
  trimmed: string,
  signal: AbortSignal,
): Promise<PathPreview> {
  const res = await fetch(`/api/library/fs/browse?path=${encodeURIComponent(trimmed)}`, { signal });
  const parsed = FsBrowseResponseSchema.safeParse(await res.json().catch(() => ({})));
  const json = parsed.success ? parsed.data : {};

  if (!res.ok) {
    return { state: "invalid", error: json.error ?? "Cannot read this folder." };
  }

  const entries: FsEntry[] = json.entries ?? [];
  return {
    state: "valid",
    resolvedPath: json.path ?? trimmed,
    imageCount: entries.filter((e) => !e.isDirectory && isImageFile(e.name)).length,
    subdirCount: entries.filter((e) => e.isDirectory).length,
  };
}

export function usePathPreview(path: string, opts: UsePathPreviewOptions = {}): PathPreview {
  const { enabled = true, debounceMs = 400 } = opts;
  const [preview, setPreview] = useState<PathPreview>({ state: "idle" });

  useEffect(() => {
    const trimmed = path.trim();
    // Nothing to check — leave the last result in state; the consumer hides it
    // for an empty field. (Setting state synchronously here would cascade.)
    if (!enabled || !trimmed) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreview({ state: "checking" });
      try {
        const result = await fetchPathPreview(trimmed, controller.signal);
        if (!cancelled) setPreview(result);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setPreview({ state: "invalid", error: "Filesystem service unreachable." });
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, enabled, debounceMs]);

  return preview;
}
