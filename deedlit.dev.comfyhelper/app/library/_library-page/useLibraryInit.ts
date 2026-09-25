"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";

import type { LibrarySettings } from "@/lib/store/settings";

import { MAX_RESTORE_PAGES } from "./constants";
import { csv } from "./constants";
import type { BrowseMode, FilterSnapshot } from "./schemas";
import type { AuxFilterControls, FilterControls } from "./useLibraryFilters";

const DoFetchSchema = z.custom<(append: boolean, overrides?: Partial<FilterSnapshot>) => Promise<void>>();

const InitParamsSchema = z.object({
  hydrated: z.boolean(),
  settings: z.custom<LibrarySettings>(),
  filters: z.custom<FilterControls>(),
  aux: z.custom<AuxFilterControls>(),
  pendingViewRef: z.custom<React.RefObject<string | null>>(),
  doFetch: DoFetchSchema,
});
type InitParams = z.infer<typeof InitParamsSchema>;

function readInitFromUrl(settings: LibrarySettings) {
  const sp = new URLSearchParams(window.location.search);
  const qpTags = csv(sp.get("tags") ?? "");
  const qpQuery = sp.get("q") ?? "";
  const qpMode = sp.get("mode");
  const view = sp.get("view");
  const wantImage = qpMode === "image" || (!qpMode && settings.defaultMode === "image");
  const initialMode: BrowseMode = wantImage ? "image" : "browse";
  // Restore how deep the user had paged (`?page=N`) so the address returns to
  // the same accumulated window. Capped — a cold restore costs N sequential
  // page fetches. By-image can't be restored (its file isn't in the URL).
  const wantPages = wantImage
    ? 1
    : Math.min(Math.max(1, Math.floor(Number(sp.get("page")) || 1)), MAX_RESTORE_PAGES);
  return { qpTags, qpQuery, wantImage, initialMode, wantPages, view };
}

/** First search — wait for saved settings so pagination / filter defaults
 * apply, and honour ?tags= / ?q= / ?mode= deep links (e.g. a related-tag
 * click on the image viewer), then re-page up to a restored `?page=N` depth. */
export function useLibraryInit({ hydrated, settings, filters, aux, pendingViewRef, doFetch }: InitParams) {
  const didInit = useRef(false);
  useEffect(() => {
    if (!hydrated || didInit.current) return;
    didInit.current = true;

    const { qpTags, qpQuery, wantImage, initialMode, wantPages, view } = readInitFromUrl(settings);
    pendingViewRef.current = view; // opened once results land (useConsumeViewUrl)

    if (qpTags.length) filters.setTags(qpTags);
    if (qpQuery) filters.setQuery(qpQuery);
    if (wantImage) aux.setShowImageSearch(true);
    aux.setMode(initialMode);
    filters.setFavorites(settings.defaultFavoritesOnly);
    filters.setMinRating(settings.defaultMinRating);
    filters.setMinScore(settings.defaultMinScore);
    filters.setSafety(settings.defaultSafety);
    filters.setLimit(settings.pageSize);
    // State setters above don't reach filtersRef before this runs, so pass the
    // full snapshot as overrides — to the initial load AND every restore page.
    const overrides = {
      mode: initialMode, tags: qpTags, query: qpQuery,
      favorites: settings.defaultFavoritesOnly, minRating: settings.defaultMinRating,
      minScore: settings.defaultMinScore, safety: settings.defaultSafety, limit: settings.pageSize,
      similarRef: null, imageFile: null,
    };
    void (async () => {
      await doFetch(false, overrides);
      // Re-page up to the saved depth. Each step consumes a prefetched page
      // when one is warm, so the restore mostly skips the network after the
      // first.
      for (let i = 1; i < wantPages; i++) await doFetch(true, overrides);
    })();
  }, [hydrated, settings, filters, aux, pendingViewRef, doFetch]);
}
