"use client";

import { z } from "zod";

const ErrorBannerPropsSchema = z.object({ error: z.string().nullable() });
type ErrorBannerProps = z.infer<typeof ErrorBannerPropsSchema>;

export function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;
  return <p className="text-ui-sm text-rose-500">{error}</p>;
}

const FreshnessBannerPropsSchema = z.object({
  hasNew: z.boolean(),
  onRefresh: z.custom<() => void>(),
});
type FreshnessBannerProps = z.infer<typeof FreshnessBannerPropsSchema>;

/** Newer images landed while browsing; reload from the top. */
export function FreshnessBanner({ hasNew, onRefresh }: FreshnessBannerProps) {
  if (!hasNew) return null;
  return (
    <button
      data-testid="library-freshness-refresh"
      onClick={onRefresh}
      className="sticky top-2 z-20 mx-auto flex items-center gap-2 rounded-full border border-accent-cyan/50 bg-accent-cyan/15 px-4 py-1.5 text-ui-xs font-medium text-accent-cyan shadow-sm backdrop-blur-sm transition hover:bg-accent-cyan/25"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-9-9" />
        <path d="M21 3v6h-6" />
      </svg>
      New images available — refresh
    </button>
  );
}

const EmptyStatePropsSchema = z.object({
  show: z.boolean(),
  imagePanelOpen: z.boolean(),
});
type EmptyStateProps = z.infer<typeof EmptyStatePropsSchema>;

export function EmptyState({ show, imagePanelOpen }: EmptyStateProps) {
  if (!show) return null;
  return (
    <p className="text-ui-sm text-ui-ink-muted">
      {imagePanelOpen
        ? "Paste, drop, or choose an image above to search by visual similarity."
        : "No images found. Ingest a folder below to get started."}
    </p>
  );
}

const LoadMoreControlPropsSchema = z.object({
  hasMore: z.boolean(),
  loading: z.boolean(),
  onLoadMore: z.custom<() => void>(),
  sentinelRef: z.custom<React.RefObject<HTMLDivElement | null>>(),
});
type LoadMoreControlProps = z.infer<typeof LoadMoreControlPropsSchema>;

/** Infinite-scroll sentinel + always-visible "Load more" button. The sentinel
 * only auto-loads when infinite scroll is on; the button is always shown so
 * the user can force the next page when a short grid never scrolls far
 * enough to trip the observer. */
export function LoadMoreControl({ hasMore, loading, onLoadMore, sentinelRef }: LoadMoreControlProps) {
  if (!hasMore) return null;
  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
      <div className="flex justify-center pt-2">
        <button
          className="rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50"
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      </div>
    </>
  );
}
