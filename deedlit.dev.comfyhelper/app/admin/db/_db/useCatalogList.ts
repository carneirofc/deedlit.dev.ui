import { useEffect, useRef, useState } from "react";

import { useCatalogFetch } from "./useCatalogFetch";
import { useInfiniteScroll } from "./useInfiniteScroll";

/**
 * Catalog browse list: filters, paging, and infinite scroll. Filters live in a
 * ref so the fetch callback reads the current values without re-creating
 * itself (which would re-arm the intersection observer on every keystroke).
 */
export function useCatalogList(onError: (message: string) => void) {
  const [tag, setTag] = useState("");
  const [safety, setSafety] = useState("");
  const [favorite, setFavorite] = useState(false);
  // Separator-insensitive substring match on the on-disk file path. Committed on
  // Enter / Apply (not per keystroke) so a long path doesn't re-query each char.
  const [path, setPath] = useState("");

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef({ tag, safety, favorite, path });
  useEffect(() => {
    filtersRef.current = { tag, safety, favorite, path };
  });

  const { images, setImages, hasMore, loadingMore, load, loadMore } = useCatalogFetch({ filtersRef, onError });

  // Re-query from the top whenever a filter changes (mirrors the prior auto-load).
  // `path` is intentionally excluded — it's committed via Apply/Enter, not live.
  useEffect(() => {
    load();
  }, [tag, safety, favorite, load]);

  useInfiniteScroll({ hasMore, loadingMore, loadMore, listScrollRef, sentinelRef });

  return {
    tag,
    setTag,
    safety,
    setSafety,
    favorite,
    setFavorite,
    path,
    setPath,
    images,
    setImages,
    hasMore,
    loadingMore,
    listScrollRef,
    sentinelRef,
    load,
    loadMore,
  };
}
