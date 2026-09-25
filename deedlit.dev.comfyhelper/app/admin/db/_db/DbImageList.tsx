import type { RefObject } from "react";
import { z } from "zod";

import { DbBulkBar } from "./DbBulkBar";
import { DbImageListHeader } from "./DbImageListHeader";
import { DbImageRow } from "./DbImageRow";
import { cls, type CatalogImage } from "./schemas";

const DbImageListPropsSchema = z.object({
  images: z.custom<CatalogImage[]>(),
  hasMore: z.boolean(),
  loadingMore: z.boolean(),
  selectedSha: z.string().optional(),
  picked: z.custom<Set<string>>(),
  onTogglePick: z.custom<(sha256: string) => void>(),
  onPickAllLoaded: z.custom<() => void>(),
  onSelect: z.custom<(image: CatalogImage) => void>(),
  confirmingBulk: z.boolean(),
  onRequestBulkExclude: z.custom<() => void>(),
  bulkBusy: z.boolean(),
  onExcludeSelected: z.custom<() => void>(),
  onCancelBulk: z.custom<() => void>(),
  onClearPicked: z.custom<() => void>(),
  listScrollRef: z.custom<RefObject<HTMLDivElement | null>>(),
  sentinelRef: z.custom<RefObject<HTMLDivElement | null>>(),
});
type DbImageListProps = z.infer<typeof DbImageListPropsSchema>;

export function DbImageList({
  images,
  hasMore,
  loadingMore,
  selectedSha,
  picked,
  onTogglePick,
  onPickAllLoaded,
  onSelect,
  confirmingBulk,
  onRequestBulkExclude,
  bulkBusy,
  onExcludeSelected,
  onCancelBulk,
  onClearPicked,
  listScrollRef,
  sentinelRef,
}: DbImageListProps) {
  return (
    <section className={`${cls.card} min-w-0`} data-testid="db-list">
      <DbImageListHeader
        count={images.length}
        hasMore={hasMore}
        pickedCount={picked.size}
        onClearPicked={onClearPicked}
        onPickAllLoaded={onPickAllLoaded}
      />

      {picked.size > 0 && (
        <DbBulkBar
          count={picked.size}
          confirming={confirmingBulk}
          busy={bulkBusy}
          onConfirm={onExcludeSelected}
          onExclude={onRequestBulkExclude}
          onCancel={onCancelBulk}
        />
      )}
      <div ref={listScrollRef} className="flex max-h-[70vh] min-w-0 flex-col gap-1 overflow-y-auto">
        {images.map((img) => (
          <DbImageRow
            key={img.sha256}
            image={img}
            isSelected={selectedSha === img.sha256}
            isPicked={picked.has(img.sha256)}
            onTogglePick={onTogglePick}
            onSelect={onSelect}
          />
        ))}
        {images.length === 0 && !loadingMore && <p className="text-ui-sm text-ui-ink-muted">No images.</p>}
        {/* Infinite-scroll trigger + loading indicator (inside the scroll box). */}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        {loadingMore && <p className="py-2 text-center text-ui-2xs text-ui-ink-muted">Loading…</p>}
      </div>
    </section>
  );
}
