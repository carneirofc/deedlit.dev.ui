"use client";

import { useCallback } from "react";

import type { FilterSnapshot } from "./schemas";
import type { LibraryPageControls } from "./useLibraryPageState";
import { useDoFetch, useFilterSnapshotRef } from "./useLibraryResults";
import { useLibraryInit } from "./useLibraryInit";
import { useLibraryQueryActions } from "./useLibraryQueryActions";

function buildFilterSnapshot(c: LibraryPageControls): FilterSnapshot {
  const { filters: f, aux, settings } = c;
  return {
    mode: aux.mode, query: f.query, tags: f.tags, excludeTags: f.excludeTags,
    modelFamily: f.modelFamily, checkpoint: f.checkpoint, loras: f.loras, sourceTool: f.sourceTool,
    pathFilter: f.pathFilter, favorites: f.favorites, minRating: f.minRating, safety: f.safety,
    limit: f.limit, minScore: f.minScore, similarRef: aux.similarRef, imageFile: aux.imageFile,
    graphScope: aux.graphScope, sort: settings.sortMode,
  };
}

// A fresh (non-append) search invalidates the open viewer (its indices no
// longer map) and any pending bulk selection (those ids may not be in the new
// set), and re-baselines the freshness poll.
function useFreshSearchReset(c: LibraryPageControls) {
  return useCallback(() => {
    c.lightbox.setLightboxIndex(null);
    c.urlSync.syncViewUrl(null);
    c.selection.setSelected(new Set());
    c.selection.setConfirmingBulk(false);
    c.freshness.reset();
  }, [c.lightbox, c.urlSync, c.selection, c.freshness]);
}

/** Wires the filter snapshot, doFetch, the query-switching actions (search /
 * similar / by-image), and the initial deep-link restore. */
export function useLibraryPageFetch(c: LibraryPageControls) {
  const filtersRef = useFilterSnapshotRef(buildFilterSnapshot(c));
  const onFreshSearch = useFreshSearchReset(c);
  const { doFetch, invalidatePrefetchPages } = useDoFetch({
    filtersRef, resultsState: c.resultsState, newestIdRef: c.freshness.newestIdRef,
    syncPageUrl: c.syncPageUrl, setImageNote: c.aux.setImageNote, onFreshSearch,
  });
  const queryActions = useLibraryQueryActions({ aux: c.aux, doFetch });
  useLibraryInit({ hydrated: c.hydrated, settings: c.settings, filters: c.filters, aux: c.aux, pendingViewRef: c.urlSync.pendingViewRef, doFetch });

  return { doFetch, invalidatePrefetchPages, ...queryActions };
}
