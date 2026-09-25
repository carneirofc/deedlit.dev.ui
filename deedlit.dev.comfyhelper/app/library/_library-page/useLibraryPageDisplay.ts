"use client";

import { useRef } from "react";

import type { LibraryPageControls } from "./useLibraryPageState";
import type { useLibraryPageFetch } from "./useLibraryPageFetch";
import { useLibrarySort } from "./useLibrarySort";
import { useLibraryGrouping } from "./useLibraryGrouping";
import { useConsumeViewUrl, useInfiniteScroll } from "./useLibraryUrlSync";
import { useFreshnessPoll } from "./useLibraryFreshness";

type Fetch = ReturnType<typeof useLibraryPageFetch>;

/** Sort/grouping derivation over the loaded results, plus the effects that
 * keep the grid fresh: infinite scroll, the `?view=` deep-link consumer, and
 * the freshness poll. */
export function useLibraryPageDisplay(c: LibraryPageControls, fetch: Fetch) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sort = useLibrarySort({
    mode: c.aux.mode, query: c.filters.query, results: c.resultsState.results,
    sortMode: c.settings.sortMode, setSortMode: (m) => c.setKey("sortMode", m), doFetch: fetch.doFetch,
  });
  const grouping = sort.browsePath && c.settings.groupBy === "folder";
  const groupingState = useLibraryGrouping(grouping, sort.displayResults);

  useConsumeViewUrl({
    pendingViewRef: c.urlSync.pendingViewRef, galleryItems: groupingState.galleryItems,
    openLightbox: c.lightbox.openLightbox, loading: c.resultsState.loading, hasMore: c.resultsState.hasMore,
  });
  useInfiniteScroll({
    sentinelRef, enabled: c.settings.infiniteScroll, hasMore: c.resultsState.hasMore,
    loading: c.resultsState.loading, loadMore: fetch.loadMore,
  });
  useFreshnessPoll({
    browsePath: sort.browsePath, tags: c.filters.tags, excludeTags: c.filters.excludeTags,
    favorites: c.filters.favorites, minRating: c.filters.minRating, safety: c.filters.safety,
    pathFilter: c.filters.pathFilter, sortMode: c.settings.sortMode, newestIdRef: c.freshness.newestIdRef,
    lightboxOpenRef: c.freshness.lightboxOpenRef, setHasNew: c.freshness.setHasNew,
    setResults: c.resultsState.setResults, invalidatePrefetchPages: fetch.invalidatePrefetchPages,
  });

  return { sentinelRef, sort, grouping, groupingState };
}
