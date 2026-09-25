"use client";

import type { LightboxFilmstripProps } from "./schemas";

const STRIP_HALF = 40;
const STRIP_STRIDE = 64; // w-14 (56px) + gap-2 (8px)

/**
 * Windowed filmstrip: only a band of thumbnails around the active index is
 * mounted; the rest collapse into left/right spacers that hold the scroll
 * width. A deep result set (hundreds/thousands of rows) otherwise mounted an
 * <img> per item here — that froze the viewer. The active thumb is always
 * inside the band, so the scrollIntoView centring still finds it.
 */
export function LightboxFilmstrip({
  items,
  index,
  hasMore,
  loadingMore,
  onLoadMore,
  setCurrentId,
  stripRef,
}: LightboxFilmstripProps) {
  const stripStart = Math.max(0, index - STRIP_HALF);
  const stripEnd = Math.min(items.length, index + STRIP_HALF);
  const stripLead = stripStart * STRIP_STRIDE;
  const stripTail = (items.length - stripEnd) * STRIP_STRIDE;

  return (
    <div
      ref={stripRef}
      className="flex shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden border-t border-ui-border/40 bg-ui-bg/40 px-3 py-2.5"
    >
      {stripLead > 0 && <div aria-hidden="true" className="shrink-0" style={{ width: stripLead }} />}
      {items.slice(stripStart, stripEnd).map((it, j) => {
        const i = stripStart + j;
        return (
          <button
            key={it.imageId}
            data-idx={i}
            type="button"
            onClick={() => setCurrentId(it.imageId)}
            aria-label={`Go to image ${i + 1}`}
            aria-current={i === index}
            data-testid={`lightbox-filmstrip-thumb-${it.imageId}`}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border transition ${
              i === index ? "border-accent-cyan ring-2 ring-accent-cyan/40" : "border-ui-border/50 opacity-70 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        );
      })}
      {stripTail > 0 && <div aria-hidden="true" className="shrink-0" style={{ width: stripTail }} />}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-dashed border-ui-border/60 text-ui-2xs text-ui-ink-muted transition hover:border-accent-cyan hover:text-accent-cyan disabled:opacity-50"
          data-testid="lightbox-filmstrip-load-more"
        >
          {loadingMore ? "…" : "More"}
        </button>
      )}
    </div>
  );
}
