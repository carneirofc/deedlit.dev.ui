import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { z } from "zod";

import { fetchCatalogPage } from "./fetchCatalogPage";
import { CatalogFiltersSchema, PAGE_SIZE, type CatalogImage } from "./schemas";

const UseCatalogFetchParamsSchema = z.object({
  filtersRef: z.custom<RefObject<z.infer<typeof CatalogFiltersSchema>>>(),
  onError: z.custom<(message: string) => void>(),
});
type UseCatalogFetchParams = z.infer<typeof UseCatalogFetchParamsSchema>;

/** Paged catalog fetch. Filters are read from a ref (not a dependency) so
 * `fetchPage` doesn't get re-created on every keystroke. */
export function useCatalogFetch({ filtersRef, onError }: UseCatalogFetchParams) {
  const [images, setImages] = useState<CatalogImage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);
  // Active list request, so a new filter/page supersedes the previous one and a
  // navigation away aborts whatever is still in flight (no hanging fetch).
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const offset = reset ? 0 : pageRef.current * PAGE_SIZE;
      fetchAbortRef.current?.abort();
      const ac = new AbortController();
      fetchAbortRef.current = ac;
      setLoadingMore(true);
      try {
        const batch = await fetchCatalogPage({ filters: filtersRef.current, offset, signal: ac.signal });
        setHasMore(batch.length === PAGE_SIZE);
        if (reset) {
          pageRef.current = 1;
          setImages(batch);
        } else {
          pageRef.current += 1;
          setImages((prev) => [...prev, ...batch]);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        onError(e instanceof Error ? e.message : "Load failed");
      } finally {
        // Only the current request clears the spinner (a superseded one already
        // aborted, so its finally must not flip loading off under the new fetch).
        if (fetchAbortRef.current === ac) setLoadingMore(false);
      }
    },
    [onError, filtersRef],
  );

  // Abort the in-flight list request on unmount (navigation away).
  useEffect(() => () => fetchAbortRef.current?.abort(), []);

  const load = useCallback(() => fetchPage(true), [fetchPage]);
  const loadMore = useCallback(() => fetchPage(false), [fetchPage]);

  return { images, setImages, hasMore, loadingMore, load, loadMore };
}
