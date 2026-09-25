"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { CompactResultSchema } from "@/lib/library/schemas";
import type { CompactResult, Safety } from "@/lib/library/schemas";
import type { SortMode } from "@/lib/store/settings";

import { SAFETY_CLASSES } from "./schemas";

const BrowseResponseSchema = z.object({ results: z.array(CompactResultSchema).optional() });

/** Baseline / clear the "newest seen" marker — called on lightbox open state
 * changes and whenever a fresh (non-append) search lands. */
export function useFreshnessBaseline() {
  const newestIdRef = useRef<string | null>(null);
  const lightboxOpenRef = useRef(false);
  const [hasNew, setHasNew] = useState(false);
  const reset = useCallback(() => {
    setHasNew(false);
    newestIdRef.current = null;
  }, []);
  return { newestIdRef, lightboxOpenRef, hasNew, setHasNew, reset };
}

const FreshnessParamsSchema = z.object({
  browsePath: z.boolean(),
  tags: z.array(z.string()),
  excludeTags: z.array(z.string()),
  favorites: z.boolean(),
  minRating: z.number(),
  safety: z.array(z.custom<Safety>()),
  pathFilter: z.string(),
  sortMode: z.custom<SortMode>(),
  newestIdRef: z.custom<React.RefObject<string | null>>(),
  lightboxOpenRef: z.custom<React.RefObject<boolean>>(),
  setHasNew: z.custom<(value: boolean) => void>(),
  setResults: z.custom<(updater: (prev: CompactResult[]) => CompactResult[]) => void>(),
  invalidatePrefetchPages: z.custom<() => void>(),
});
type FreshnessParams = z.infer<typeof FreshnessParamsSchema>;

function buildFreshnessBody(p: FreshnessParams, newestFirst: boolean) {
  const safetySubset = p.safety.length > 0 && p.safety.length < SAFETY_CLASSES.length ? p.safety : undefined;
  return {
    tags: p.tags.length ? p.tags : undefined,
    excludeTags: p.excludeTags.length ? p.excludeTags : undefined,
    favorite: p.favorites || undefined,
    ratingGte: p.minRating > 0 ? p.minRating : undefined,
    safety: safetySubset,
    path: p.pathFilter.trim() || undefined,
    sort: "newest" as const,
    // Pull a small window when we may splice (catch a short burst of
    // arrivals); a single row is enough just to detect change for the banner.
    limit: newestFirst ? 12 : 1,
    offset: 0,
  };
}

function applyFreshnessRows(p: FreshnessParams, rows: CompactResult[], newestFirst: boolean) {
  const topId = rows[0]?.imageId ?? null;
  if (!topId) return;
  if (p.newestIdRef.current === null) {
    p.newestIdRef.current = topId; // baseline whatever's at the head now
    return;
  }
  if (topId === p.newestIdRef.current) return; // nothing new

  const canSplice = newestFirst && !p.lightboxOpenRef.current && window.scrollY < 200;
  if (!canSplice) {
    p.setHasNew(true); // surface the banner; refresh re-pages from the top
    return;
  }
  p.setResults((prev) => {
    const seen = new Set(prev.map((row) => row.imageId));
    const incoming = rows.filter((row) => !seen.has(row.imageId));
    return incoming.length ? [...incoming, ...prev] : prev;
  });
  p.newestIdRef.current = topId;
  p.setHasNew(false);
  // Head rows shifted every deeper offset — drop warmed pages; the next
  // load-more re-fetches and re-warms from the new boundary.
  p.invalidatePrefetchPages();
}

/** While filter-only browsing, watch the newest catalog head for the current
 * filter set. Only runs on the browse path — search results are a
 * point-in-time ranking, not a live feed. When the grid is sorted
 * newest-first and the user is parked at the top with no viewer open, new
 * arrivals are spliced straight into the grid (no click); otherwise a gentle
 * "New images — refresh" banner appears instead. */
export function useFreshnessPoll(p: FreshnessParams) {
  useEffect(() => {
    if (!p.browsePath) {
      p.setHasNew(false);
      return;
    }
    const newestFirst = p.sortMode === "newest" || p.sortMode === "relevance";
    const body = buildFreshnessBody(p, newestFirst);
    let alive = true;
    const ac = new AbortController();
    const check = async () => {
      // Skip the network while the tab is hidden — the visibilitychange
      // handler below catches up the instant the user returns.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/library/browse", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal,
        });
        if (!r.ok || !alive) return;
        const parsed = BrowseResponseSchema.safeParse(await r.json());
        if (parsed.success) applyFreshnessRows(p, parsed.data.results ?? [], newestFirst);
      } catch {
        // transient — try again next tick
      }
    };
    const id = setInterval(check, 4000);
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      ac.abort();
    };
  }, [
    p.browsePath, p.tags, p.excludeTags, p.favorites, p.minRating, p.safety, p.pathFilter, p.sortMode,
    p.newestIdRef, p.lightboxOpenRef, p.setHasNew, p.setResults, p.invalidatePrefetchPages,
  ]);
}
