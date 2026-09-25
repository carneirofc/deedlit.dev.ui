"use client";

import { useCallback, useRef } from "react";
import { z } from "zod";

import { fetchLibraryPage } from "./fetchLibraryPage";
import { FetchPageResultSchema, type FilterSnapshot } from "./schemas";
import { PREFETCH_AHEAD } from "./constants";

const PrefetchBufferSchema = z.object({
  sig: z.string(),
  pages: z.custom<Map<number, z.infer<typeof FetchPageResultSchema>>>(),
  inFlight: z.custom<Set<number>>(),
  controllers: z.array(z.custom<AbortController>()),
  // A fetched page came back short — no pages beyond it.
  exhausted: z.boolean(),
});
type PrefetchBuffer = z.infer<typeof PrefetchBufferSchema>;

function emptyBuffer(sig: string): PrefetchBuffer {
  return { sig, pages: new Map(), inFlight: new Set(), controllers: [], exhausted: false };
}

function prefetchSig(s: FilterSnapshot): string {
  return JSON.stringify({
    mode: s.mode, query: s.query, tags: s.tags, excludeTags: s.excludeTags,
    modelFamily: s.modelFamily, checkpoint: s.checkpoint, loras: s.loras, sourceTool: s.sourceTool,
    pathFilter: s.pathFilter, favorites: s.favorites, minRating: s.minRating, safety: s.safety,
    limit: s.limit, minScore: s.minScore, similar: s.similarRef?.id ?? null, image: !!s.imageFile,
    graphScope: s.graphScope, sort: s.sort,
  });
}

// by-image returns a single relevance-ranked window (no offset), so there are
// no further pages to warm. Similar now pages by rank offset like browse/search.
function paginates(s: FilterSnapshot): boolean {
  return !(s.mode === "image" && s.imageFile);
}

async function warmPrefetchPages(
  s: FilterSnapshot,
  prefetchRef: React.RefObject<PrefetchBuffer>,
  start: number,
) {
  const pf = prefetchRef.current;
  for (let i = 0; i < PREFETCH_AHEAD; i++) {
    const idx = start + i;
    if (pf.exhausted || pf.pages.has(idx) || pf.inFlight.has(idx)) continue;
    pf.inFlight.add(idx);
    const controller = new AbortController();
    pf.controllers.push(controller);
    try {
      const res = await fetchLibraryPage(s, idx * s.limit, controller.signal);
      if (prefetchRef.current !== pf) return; // filters changed mid-flight
      pf.pages.set(idx, { fresh: res.fresh, more: res.more });
      if (!res.more) pf.exhausted = true;
    } catch {
      // ignore — the page will just be fetched on demand
    } finally {
      pf.inFlight.delete(idx);
    }
  }
}

/** Warms up to PREFETCH_AHEAD pages beyond what's loaded, keyed by a signature
 * of the active filters: a filter change discards stale pages. Only the
 * offset-paged paths use it (see `paginates`). */
export function usePrefetchBuffer(pageRef: React.RefObject<number>) {
  const prefetchRef = useRef<PrefetchBuffer>(emptyBuffer(""));

  const resetPrefetch = useCallback((s: FilterSnapshot) => {
    prefetchRef.current.controllers.forEach((c) => c.abort());
    prefetchRef.current = emptyBuffer(prefetchSig(s));
  }, []);

  // Drop buffered pages but keep the signature — used when the freshness poll
  // splices new rows at the head and shifts every offset out from under them.
  const invalidatePrefetchPages = useCallback(() => {
    const pf = prefetchRef.current;
    pf.controllers.forEach((c) => c.abort());
    pf.pages.clear();
    pf.inFlight.clear();
    pf.controllers = [];
    pf.exhausted = false;
  }, []);

  // Pull a warmed page if it matches the current filters; consuming removes it
  // so a shifted offset can't re-serve it.
  const takePrefetched = useCallback((s: FilterSnapshot, pageIndex: number) => {
    const pf = prefetchRef.current;
    if (pf.sig !== prefetchSig(s)) return null;
    const hit = pf.pages.get(pageIndex);
    if (hit) pf.pages.delete(pageIndex);
    return hit ?? null;
  }, []);

  const schedulePrefetch = useCallback(
    (s: FilterSnapshot) => {
      if (!paginates(s)) return;
      const pf = prefetchRef.current;
      if (pf.sig !== prefetchSig(s) || pf.exhausted) return;
      void warmPrefetchPages(s, prefetchRef, pageRef.current);
    },
    [pageRef],
  );

  return { prefetchRef, resetPrefetch, invalidatePrefetchPages, takePrefetched, schedulePrefetch };
}
