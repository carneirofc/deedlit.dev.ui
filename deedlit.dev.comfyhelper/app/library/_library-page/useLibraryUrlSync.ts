"use client";

import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

import type { CompactResult } from "@/lib/library/schemas";

/** Deep link: a `?view=<imageId>` in the address opens the viewer on that
 * image once results load, so a copied URL returns to the same picture.
 * `syncViewUrl` keeps the param in lockstep with the open/closed viewer
 * (replaceState — no router churn). */
export function useViewUrlSync() {
  const pendingViewRef = useRef<string | null>(null);

  const syncViewUrl = useCallback((item: Pick<CompactResult, "imageId"> | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (item) url.searchParams.set("view", item.imageId);
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return { pendingViewRef, syncViewUrl };
}

/** Consume a `?view=` deep link: once results are in, open the viewer on the
 * matching image. The window grows page-by-page during a `?page=N` restore,
 * so keep looking as it fills; only give up (one shot) once everything is
 * loaded and it still isn't here — we don't chase pages beyond the restored
 * depth. */
const ConsumeViewUrlParamsSchema = z.object({
  pendingViewRef: z.custom<React.RefObject<string | null>>(),
  galleryItems: z.array(z.custom<CompactResult>()),
  openLightbox: z.custom<(index: number) => void>(),
  loading: z.boolean(),
  hasMore: z.boolean(),
});
type ConsumeViewUrlParams = z.infer<typeof ConsumeViewUrlParamsSchema>;

export function useConsumeViewUrl(params: ConsumeViewUrlParams) {
  const { pendingViewRef, galleryItems, openLightbox, loading, hasMore } = params;
  useEffect(() => {
    const want = pendingViewRef.current;
    if (!want || galleryItems.length === 0) return;
    const i = galleryItems.findIndex((r) => r.imageId === want);
    if (i !== -1) {
      pendingViewRef.current = null;
      openLightbox(i);
    } else if (!loading && !hasMore) {
      pendingViewRef.current = null; // fully loaded and absent — abandon
    }
  }, [pendingViewRef, galleryItems, openLightbox, loading, hasMore]);
}

// Pagination depth in the address: `?page=N` records how many pages are
// currently stacked in the grid, so a copied / refreshed URL re-pages to the
// same accumulated window. Page 1 is the bare state, so it drops the param.
export function usePageUrlSync() {
  return useCallback((page: number) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", url);
  }, []);
}

/** Infinite scroll: prefetch the next page well before the sentinel is
 * visible. The lookahead scales with viewport height (~1.5 screens) so on
 * tall/ultrawide displays the next page lands before the user ever reaches
 * the end of the grid. */
const InfiniteScrollParamsSchema = z.object({
  sentinelRef: z.custom<React.RefObject<HTMLDivElement | null>>(),
  enabled: z.boolean(),
  hasMore: z.boolean(),
  loading: z.boolean(),
  loadMore: z.custom<() => void>(),
});
type InfiniteScrollParams = z.infer<typeof InfiniteScrollParamsSchema>;

export function useInfiniteScroll(params: InfiniteScrollParams) {
  const { sentinelRef, enabled, hasMore, loading, loadMore } = params;
  useEffect(() => {
    if (!enabled || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const lookahead = Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 1.5);
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) loadMore();
      },
      { rootMargin: `${lookahead}px 0px` },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [sentinelRef, enabled, hasMore, loading, loadMore]);
}
