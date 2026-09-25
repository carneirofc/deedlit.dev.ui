import { useState } from "react";
import { z } from "zod";

import { deleteImages, type BulkDeleteOutcome } from "@/lib/library/bulk-delete";

import type { CatalogImage } from "./schemas";

const UseBulkSelectionParamsSchema = z.object({
  images: z.custom<CatalogImage[]>(),
  setImages: z.custom<(update: (prev: CatalogImage[]) => CatalogImage[]) => void>(),
  selected: z.custom<CatalogImage | null>(),
  clearSelection: z.custom<() => void>(),
  onError: z.custom<(message: string) => void>(),
  onNotice: z.custom<(message: string) => void>(),
});
type UseBulkSelectionParams = z.infer<typeof UseBulkSelectionParamsSchema>;

const ApplyBulkOutcomeParamsSchema = z.object({
  outcome: z.custom<BulkDeleteOutcome>(),
  requested: z.number(),
  setImages: z.custom<(update: (prev: CatalogImage[]) => CatalogImage[]) => void>(),
  setPicked: z.custom<(update: (prev: Set<string>) => Set<string>) => void>(),
  selected: z.custom<CatalogImage | null>(),
  clearSelection: z.custom<() => void>(),
  onError: z.custom<(message: string) => void>(),
  onNotice: z.custom<(message: string) => void>(),
});
type ApplyBulkOutcomeParams = z.infer<typeof ApplyBulkOutcomeParamsSchema>;

/** Applies a batch-delete outcome to list/selection state. Whatever actually
 * went away is pruned even on a partial failure. Returns whether every id
 * succeeded (so the caller can decide whether to also clear `picked`). */
function applyBulkOutcome({
  outcome,
  requested,
  setImages,
  setPicked,
  selected,
  clearSelection,
  onError,
  onNotice,
}: ApplyBulkOutcomeParams): boolean {
  const { deleted, failed } = outcome;
  if (deleted.length > 0) {
    const gone = new Set(deleted);
    setImages((prev) => prev.filter((i) => !gone.has(i.sha256)));
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of gone) next.delete(id);
      return next;
    });
    if (selected && gone.has(selected.sha256)) clearSelection();
  }
  if (failed.length > 0) {
    onError(`Excluded ${deleted.length}/${requested}. ${failed.length} failed: ${failed[0].error}`);
    return false;
  }
  onNotice(`Excluded ${deleted.length} image${deleted.length === 1 ? "" : "s"} (un-indexed).`);
  return true;
}

/**
 * Bulk selection for exclusion (un-index many at once). Separate from the
 * single row open in the editor: a checkbox toggles a row into `picked`
 * without opening it.
 */
export function useBulkSelection({ images, setImages, selected, clearSelection, onError, onNotice }: UseBulkSelectionParams) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const togglePick = (sha256: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(sha256)) next.delete(sha256);
      else next.add(sha256);
      return next;
    });

  const pickAllLoaded = () => setPicked(new Set(images.map((i) => i.sha256)));
  const clearPicked = () => {
    setPicked(new Set());
    setConfirmingBulk(false);
  };

  // Un-index every picked image (catalog + search + graph; files stay on disk) in
  // ONE batch call (a few DB round-trips, not N×3).
  const excludeSelected = async () => {
    const ids = [...picked];
    if (ids.length === 0) return;
    setBulkBusy(true);
    onError("");
    onNotice("");
    try {
      const outcome = await deleteImages(ids);
      const allOk = applyBulkOutcome({ outcome, requested: ids.length, setImages, setPicked, selected, clearSelection, onError, onNotice });
      if (allOk) clearPicked();
      else setConfirmingBulk(false);
    } finally {
      setBulkBusy(false);
    }
  };

  return { picked, confirmingBulk, setConfirmingBulk, bulkBusy, togglePick, pickAllLoaded, clearPicked, excludeSelected };
}
