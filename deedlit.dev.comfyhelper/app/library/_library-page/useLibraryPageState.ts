"use client";

import { useSettings } from "@/lib/store/settings";

import { useFreshnessBaseline } from "./useLibraryFreshness";
import { useAuxFilterControls, useFilterControls, useTagCatalog } from "./useLibraryFilters";
import { useResultsState } from "./useLibraryResults";
import { useLibraryIngest } from "./useLibraryIngest";
import { useLibrarySelection } from "./useLibrarySelection";
import { useImageActions } from "./useImageActions";
import { useLightboxState } from "./useLightboxState";
import { useViewUrlSync, usePageUrlSync } from "./useLibraryUrlSync";

/** Every independent piece of page state: settings, filter controls, results,
 * selection, the lightbox, freshness baseline, URL sync helpers, and the
 * ingest panel. Composed here so the page component itself stays a thin
 * orchestrator over `useLibraryPageFetch` / `useLibraryPageDisplay`. */
export function useLibraryPageControls() {
  const { settings, hydrated, setKey } = useSettings();
  const filters = useFilterControls(settings);
  const aux = useAuxFilterControls();
  const tagCatalog = useTagCatalog();
  const resultsState = useResultsState();
  const freshness = useFreshnessBaseline();
  const urlSync = useViewUrlSync();
  const syncPageUrl = usePageUrlSync();
  const selection = useLibrarySelection(resultsState);
  const lightbox = useLightboxState(freshness.lightboxOpenRef);
  const ingest = useLibraryIngest(resultsState.setError);
  const imageActions = useImageActions(resultsState);

  return {
    settings, hydrated, setKey, filters, aux, tagCatalog, resultsState,
    freshness, urlSync, syncPageUrl, selection, lightbox, ingest, imageActions,
  };
}
export type LibraryPageControls = ReturnType<typeof useLibraryPageControls>;
