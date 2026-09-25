"use client";

import { useMemo } from "react";
import { z } from "zod";

import type { CompactResult } from "@/lib/library/schemas";
import type { SortMode } from "@/lib/store/settings";

import { BROWSE_SORTS, SEARCH_SORTS } from "./constants";
import { isBrowsePath } from "./fetchLibraryPage";
import { BrowseModeSchema, type FilterSnapshot } from "./schemas";

const DoFetchSchema = z.custom<(append: boolean, overrides?: Partial<FilterSnapshot>) => void>();

const SortParamsSchema = z.object({
  mode: BrowseModeSchema,
  query: z.string(),
  results: z.array(z.custom<CompactResult>()),
  sortMode: z.custom<SortMode>(),
  setSortMode: z.custom<(next: SortMode) => void>(),
  doFetch: DoFetchSchema,
});
type SortParams = z.infer<typeof SortParamsSchema>;

// The vector path can't sort by date/name (its rows lack them), so honour a
// rating sort by reordering the loaded window client-side. Browse is already
// ordered by the server, so it passes through untouched. The grid AND the
// lightbox both read `displayResults` so their indices stay in lockstep.
export function useLibrarySort({ mode, query, results, sortMode, setSortMode, doFetch }: SortParams) {
  const browsePath = isBrowsePath(mode, query);
  const sortOptions = browsePath ? BROWSE_SORTS : SEARCH_SORTS;
  const sortValue: SortMode = sortOptions.includes(sortMode) ? sortMode : sortOptions[0];

  const displayResults = useMemo(() => {
    if (browsePath || (sortValue !== "rating_desc" && sortValue !== "rating_asc")) return results;
    const dir = sortValue === "rating_desc" ? -1 : 1;
    const nullVal = dir === -1 ? -Infinity : Infinity;
    return [...results].sort((a, b) => ((a.rating ?? nullVal) - (b.rating ?? nullVal)) * dir);
  }, [results, browsePath, sortValue]);

  const changeSort = (next: SortMode) => {
    setSortMode(next);
    // Browse ordering lives on the server, so a change must re-page from the
    // top; the vector path only needs the client reorder above.
    if (browsePath) doFetch(false, { sort: next });
  };

  return { browsePath, sortOptions, sortValue, displayResults, changeSort };
}
