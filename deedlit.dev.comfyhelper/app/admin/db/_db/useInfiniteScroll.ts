import { useEffect, type RefObject } from "react";
import { z } from "zod";

const UseInfiniteScrollParamsSchema = z.object({
  hasMore: z.boolean(),
  loadingMore: z.boolean(),
  loadMore: z.custom<() => void>(),
  listScrollRef: z.custom<RefObject<HTMLDivElement | null>>(),
  sentinelRef: z.custom<RefObject<HTMLDivElement | null>>(),
});
type UseInfiniteScrollParams = z.infer<typeof UseInfiniteScrollParamsSchema>;

/** Pulls the next page as the sentinel nears the bottom of the scrollable list
 * (root = the list container, not the viewport). */
export function useInfiniteScroll({ hasMore, loadingMore, loadMore, listScrollRef, sentinelRef }: UseInfiniteScrollParams) {
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) loadMore();
      },
      { root: listScrollRef.current, rootMargin: "400px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasMore, loadingMore, loadMore, listScrollRef, sentinelRef]);
}
