"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { CompactResult } from "@/lib/library/schemas";

import { fetchLibraryPage } from "./fetchLibraryPage";
import type { FetchPageResult, FilterSnapshot } from "./schemas";
import { usePrefetchBuffer } from "./usePrefetchBuffer";

/** Result rows + the loading/paging state that drives them. `resultsRef`
 * mirrors `results` synchronously so doFetch can dedupe an appended page
 * against what's on screen WITHOUT taking `results` as a dependency (that
 * would churn its identity and every effect keyed on it). */
export function useResultsState() {
  const [results, setResults] = useState<CompactResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const resultsRef = useRef<CompactResult[]>([]);
  useEffect(() => { resultsRef.current = results; });
  const pageRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { results, setResults, hasMore, setHasMore, resultsRef, pageRef, loading, setLoading, error, setError };
}
export type ResultsState = ReturnType<typeof useResultsState>;

/** Stable ref for the current filter snapshot — lets doFetch() always read
 * fresh state even when called from callbacks that close over an older render. */
export function useFilterSnapshotRef(current: FilterSnapshot) {
  const filtersRef = useRef(current);
  useEffect(() => { filtersRef.current = current; });
  return filtersRef;
}

async function resolvePage(
  s: FilterSnapshot,
  append: boolean,
  pageRef: React.RefObject<number>,
  prefetch: ReturnType<typeof usePrefetchBuffer>,
  signal: AbortSignal,
): Promise<FetchPageResult> {
  const buffered = append ? prefetch.takePrefetched(s, pageRef.current) : null;
  if (buffered) return { note: undefined, ...buffered };
  return fetchLibraryPage(s, append ? pageRef.current * s.limit : 0, signal);
}

function applyAppendedPage(rs: ResultsState, fresh: CompactResult[], more: boolean) {
  rs.pageRef.current += 1;
  // Drop any id already on screen. Offset paging can re-emit a boundary row
  // when the underlying set shifts between page fetches (an ingest lands
  // mid-scroll); a repeated id would collide as a React key.
  const seen = new Set(rs.resultsRef.current.map((r) => r.imageId));
  const novel = fresh.filter((r) => !seen.has(r.imageId));
  if (novel.length) rs.setResults((prev) => [...prev, ...novel]);
  // A full page that dedupes to nothing means the offset shifted onto rows
  // already loaded — no forward progress. Treat it as the end, or the scroll
  // observer / lightbox auto-load re-fire against the same boundary forever.
  rs.setHasMore(novel.length > 0 && more);
}

function applyFreshPage(
  rs: ResultsState,
  fresh: CompactResult[],
  more: boolean,
  newestIdRef: React.RefObject<string | null>,
) {
  rs.pageRef.current = 1;
  rs.setResults(fresh);
  // Baseline the freshness poll so it only fires for images that arrive AFTER
  // this load — no redundant probe on the next poll tick.
  newestIdRef.current = fresh[0]?.imageId ?? null;
  rs.setHasMore(more);
}

/** Params shared by every doFetch call — kept in one bag to stay under the
 * hook-signature line budget. */
const DoFetchParamsSchema = z.object({
  filtersRef: z.custom<React.RefObject<FilterSnapshot>>(),
  resultsState: z.custom<ResultsState>(),
  newestIdRef: z.custom<React.RefObject<string | null>>(),
  syncPageUrl: z.custom<(page: number) => void>(),
  setImageNote: z.custom<(note: string | null) => void>(),
  onFreshSearch: z.custom<() => void>(),
});
type DoFetchParams = z.infer<typeof DoFetchParamsSchema>;

function beginFetch(fetchController: React.RefObject<AbortController | null>, fetchGen: React.RefObject<number>) {
  fetchController.current?.abort();
  const gen = ++fetchGen.current;
  const controller = new AbortController();
  fetchController.current = controller;
  return { gen, controller };
}

function resetForEmptyImageQuery(rs: ResultsState, syncPageUrl: (page: number) => void) {
  rs.setResults([]);
  rs.setHasMore(false);
  rs.setLoading(false);
  syncPageUrl(1);
}

function handleDoFetchError(e: unknown, gen: number, fetchGen: React.RefObject<number>, rs: ResultsState) {
  if (e instanceof Error && e.name === "AbortError") return; // superseded, not a real error
  if (fetchGen.current !== gen) return; // superseded while awaiting
  rs.setError(e instanceof Error ? e.message : "Search failed");
}

// Cancel everything in flight when the page unmounts: the active grid fetch
// AND every warmed background prefetch, so a slow search never hangs holding
// a connection after we've left the library.
function useAbortOnUnmount(fetchController: React.RefObject<AbortController | null>, prefetch: ReturnType<typeof usePrefetchBuffer>) {
  useEffect(() => {
    return () => {
      fetchController.current?.abort();
      prefetch.prefetchRef.current.controllers.forEach((c) => c.abort());
    };
  }, [fetchController, prefetch]);
}

/** One page fetch for the active filters, appended or fresh. Cancels any
 * in-flight request and tracks a generation counter so a call superseded
 * mid-flight discards its result instead of clobbering a newer one. */
export function useDoFetch({ filtersRef, resultsState: rs, newestIdRef, syncPageUrl, setImageNote, onFreshSearch }: DoFetchParams) {
  const fetchGen = useRef(0);
  const fetchController = useRef<AbortController | null>(null);
  const prefetch = usePrefetchBuffer(rs.pageRef);

  const doFetch = useCallback(
    async (append: boolean, overrides?: Partial<FilterSnapshot>) => {
      const s = { ...filtersRef.current, ...overrides };
      const { gen, controller } = beginFetch(fetchController, fetchGen);

      if (!append) {
        onFreshSearch();
        prefetch.resetPrefetch(s); // new filter set — discard warmed pages
      }
      if (s.mode === "image" && !s.imageFile) {
        resetForEmptyImageQuery(rs, syncPageUrl);
        return;
      }

      rs.setLoading(true);
      rs.setError(null);
      try {
        const { fresh, more, note } = await resolvePage(s, append, rs.pageRef, prefetch, controller.signal);
        if (note !== undefined) setImageNote(note);
        if (fetchGen.current !== gen) return; // superseded while awaiting

        if (append) applyAppendedPage(rs, fresh, more);
        else applyFreshPage(rs, fresh, more, newestIdRef);

        syncPageUrl(rs.pageRef.current);
        prefetch.schedulePrefetch(s);
      } catch (e) {
        handleDoFetchError(e, gen, fetchGen, rs);
      } finally {
        if (fetchGen.current === gen) rs.setLoading(false);
      }
    },
    [filtersRef, rs, newestIdRef, syncPageUrl, setImageNote, onFreshSearch, prefetch],
  );

  useAbortOnUnmount(fetchController, prefetch);

  return { doFetch, invalidatePrefetchPages: prefetch.invalidatePrefetchPages };
}
