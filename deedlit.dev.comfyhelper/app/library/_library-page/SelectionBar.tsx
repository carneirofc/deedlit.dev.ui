"use client";

import { z } from "zod";

import { BulkActionBar } from "@/app/library/components/BulkActionBar";

import type { LibrarySelection } from "./useLibrarySelection";

const SelectionBarPropsSchema = z.object({
  show: z.boolean(),
  totalCount: z.number(),
  selection: z.custom<LibrarySelection>(),
  onSelectAllIds: z.custom<() => string[]>(),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
});
type SelectionBarProps = z.infer<typeof SelectionBarPropsSchema>;

/** The select-mode bulk-action bar + its transient success notice. Hidden
 * outside select mode or with no results to act on. */
export function SelectionBar({ show, totalCount, selection: s, onSelectAllIds, fetchTagSuggestions }: SelectionBarProps) {
  if (!show) return null;
  return (
    <div className="flex flex-col gap-1">
      <BulkActionBar
        selectedCount={s.selected.size}
        totalCount={totalCount}
        busy={s.bulkBusy}
        confirmingDelete={s.confirmingBulk}
        onSelectAll={() => s.setSelected(new Set(onSelectAllIds()))}
        onClear={s.clearSelection}
        onFavorite={s.bulkFavorite}
        onRating={s.bulkRating}
        onSafety={s.bulkSafety}
        onAddTags={s.bulkAddTags}
        onRemoveTags={s.bulkRemoveTags}
        onExport={s.exportSelected}
        onMove={s.bulkMove}
        onRequestDelete={() => s.setConfirmingBulk(true)}
        onConfirmDelete={s.deleteSelected}
        onCancelDelete={() => s.setConfirmingBulk(false)}
        fetchTagSuggestions={fetchTagSuggestions}
      />
      {s.notice && <p className="px-1 text-ui-xs text-emerald-500">{s.notice}</p>}
    </div>
  );
}
