"use client";

import { useCallback, useState } from "react";

import type { BulkBusy } from "@/app/library/components/BulkActionBar";
import type { ImagePatchBody } from "@/lib/api-client";
import { deleteImages, type BulkDeleteOutcome } from "@/lib/library/bulk-delete";
import { moveImages } from "@/lib/library/bulk-move";
import { exportImages, toSimpleRecord, downloadCsv, downloadJson, downloadJsonl, type ExportKind } from "@/lib/library/bulk-export";
import { patchImages } from "@/lib/library/bulk-patch";
import type { CompactResult, Safety } from "@/lib/library/schemas";

import { SAFETY_LABEL } from "./constants-safety";
import type { ResultsState } from "./useLibraryResults";

/** Selection + confirm/busy/notice state for the bulk-action bar. */
export function useSelectionState() {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<BulkBusy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  return { selectMode, setSelectMode, selected, setSelected, confirmingBulk, setConfirmingBulk, bulkBusy, setBulkBusy, notice, setNotice };
}
export type SelectionState = ReturnType<typeof useSelectionState>;

function useSelectionToggles(sel: SelectionState) {
  const toggleSelect = useCallback((id: string) => {
    sel.setSelectMode(true);
    sel.setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [sel]);

  const clearSelection = useCallback(() => {
    sel.setSelected(new Set());
    sel.setConfirmingBulk(false);
  }, [sel]);

  const exitSelectMode = useCallback(() => {
    sel.setSelectMode(false);
    sel.setSelected(new Set());
    sel.setConfirmingBulk(false);
  }, [sel]);

  return { toggleSelect, clearSelection, exitSelectMode };
}

// Apply a batch delete result to the grid + selection: prune whatever
// actually went away, and surface a partial-failure reason (or exit select
// mode outright on a clean sweep).
function applyBulkDeleteResult(
  rs: ResultsState,
  sel: SelectionState,
  exitSelectMode: () => void,
  ids: string[],
  { deleted, failed }: BulkDeleteOutcome,
) {
  if (deleted.length > 0) {
    const gone = new Set(deleted);
    rs.setResults((prev) => prev.filter((r) => !gone.has(r.imageId)));
    sel.setSelected((prev) => {
      const next = new Set(prev);
      for (const id of gone) next.delete(id);
      return next;
    });
  }
  if (failed.length > 0) {
    rs.setError(`Deleted ${deleted.length}/${ids.length}. ${failed.length} failed: ${failed[0].error}`);
    sel.setConfirmingBulk(false);
  } else {
    exitSelectMode();
  }
}

// Un-index every selected image in ONE batch call (a few DB round-trips, not
// N×3). Whatever actually went away is pruned from the grid even on a partial
// failure; the rest stay selected with the reason surfaced.
function useDeleteActions(rs: ResultsState, sel: SelectionState, exitSelectMode: () => void) {
  const deleteSelected = useCallback(async () => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    sel.setBulkBusy("delete");
    rs.setError(null);
    sel.setNotice(null);
    try {
      const result = await deleteImages(ids);
      applyBulkDeleteResult(rs, sel, exitSelectMode, ids, result);
    } finally {
      sel.setBulkBusy(null);
    }
  }, [sel, rs, exitSelectMode]);

  // Delete a single image (from the lightbox). Reuses the batch un-index path
  // with a one-id list; on success the row leaves the grid and any selection.
  // Throws on failure so the viewer keeps the image on screen and surfaces why.
  const deleteOne = useCallback(async (imageId: string) => {
    rs.setError(null);
    const { deleted, failed } = await deleteImages([imageId]);
    if (deleted.length > 0) {
      rs.setResults((prev) => prev.filter((r) => r.imageId !== imageId));
      sel.setSelected((prev) => {
        if (!prev.has(imageId)) return prev;
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      return;
    }
    const reason = failed[0]?.error ?? "Delete failed";
    rs.setError(`Delete failed: ${reason}`);
    throw new Error(reason);
  }, [rs, sel]);

  return { deleteSelected, deleteOne };
}

// Fan a metadata edit out over the selected rows. `build` produces the PATCH
// body per row (so tag add/remove can compute a per-image final list); `patch`
// mirrors that change onto the loaded grid row so the cards update without a
// refetch. Partial failures surface inline; the rest still apply.
function useApplyBulk(rs: ResultsState, sel: SelectionState) {
  return useCallback(
    async (
      kind: Exclude<NonNullable<BulkBusy>, "export" | "delete">,
      build: (r: CompactResult) => ImagePatchBody,
      patch: (r: CompactResult) => CompactResult,
      summary: (ok: number, total: number) => string,
    ) => {
      const rows = rs.results.filter((r) => sel.selected.has(r.imageId));
      if (rows.length === 0) return;
      sel.setBulkBusy(kind);
      rs.setError(null);
      sel.setNotice(null);
      try {
        const { updated, failed } = await patchImages(rows.map((r) => ({ id: r.imageId, body: build(r) })));
        if (updated.length > 0) {
          const ok = new Set(updated);
          rs.setResults((prev) => prev.map((r) => (ok.has(r.imageId) ? patch(r) : r)));
        }
        if (failed.length > 0) {
          rs.setError(`${summary(updated.length, rows.length)} ${failed.length} failed: ${failed[0].error}`);
        } else {
          sel.setNotice(summary(updated.length, rows.length));
        }
      } catch (e) {
        rs.setError(e instanceof Error ? e.message : "Bulk action failed");
      } finally {
        sel.setBulkBusy(null);
      }
    },
    [rs, sel],
  );
}

function useBulkFieldActions(applyBulk: ReturnType<typeof useApplyBulk>) {
  const bulkFavorite = useCallback(
    (fav: boolean) =>
      applyBulk("favorite", () => ({ favorite: fav }), (r) => r, (ok, total) => `${fav ? "Favorited" : "Unfavorited"} ${ok}/${total}.`),
    [applyBulk],
  );

  const bulkRating = useCallback(
    (rating: number) => {
      const value = rating === 0 ? null : rating;
      return applyBulk(
        "rating",
        () => ({ rating: value }),
        (r) => ({ ...r, rating: value }),
        (ok, total) => `${value === null ? "Cleared rating on" : `Set ${rating}★ on`} ${ok}/${total}.`,
      );
    },
    [applyBulk],
  );

  const bulkSafety = useCallback(
    (value: Safety) =>
      applyBulk("safety", () => ({ safety: value }), (r) => ({ ...r, safety: value }), (ok, total) => `Set ${SAFETY_LABEL[value]} on ${ok}/${total}.`),
    [applyBulk],
  );

  const bulkAddTags = useCallback(
    (add: string[]) => {
      const merge = (r: CompactResult) => Array.from(new Set([...r.tags, ...add]));
      return applyBulk("tags", (r) => ({ tags: merge(r) }), (r) => ({ ...r, tags: merge(r) }), (ok, total) => `Added ${add.length} tag${add.length === 1 ? "" : "s"} to ${ok}/${total}.`);
    },
    [applyBulk],
  );

  const bulkRemoveTags = useCallback(
    (remove: string[]) => {
      const rm = new Set(remove);
      const strip = (r: CompactResult) => r.tags.filter((t) => !rm.has(t));
      return applyBulk("tags", (r) => ({ tags: strip(r) }), (r) => ({ ...r, tags: strip(r) }), (ok, total) => `Removed ${remove.length} tag${remove.length === 1 ? "" : "s"} from ${ok}/${total}.`);
    },
    [applyBulk],
  );

  return { bulkFavorite, bulkRating, bulkSafety, bulkAddTags, bulkRemoveTags };
}

// Export every selected image's catalog record. The server route fans the
// gateway detail reads out and reports partial failures, which surface inline;
// whatever resolved still downloads. `complete-*` dump the full canonical
// record; `simple-*` project it to the basics (id · sha · path · …) and add a
// spreadsheet-friendly CSV.
function useExportAndMove(rs: ResultsState, sel: SelectionState) {
  const exportSelected = useCallback(async (kind: ExportKind) => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    sel.setBulkBusy("export");
    rs.setError(null);
    sel.setNotice(null);
    try {
      const result = await exportImages(ids);
      if (result.count > 0) downloadExport(kind, result);
      const label = kind.startsWith("simple") ? "simple" : "complete";
      if (result.errors.length > 0) {
        rs.setError(`Exported ${result.count}/${ids.length}. ${result.errors.length} failed: ${result.errors[0].error}`);
      } else {
        sel.setNotice(`Exported ${result.count} image${result.count === 1 ? "" : "s"} (${label}).`);
      }
    } catch (e) {
      rs.setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      sel.setBulkBusy(null);
    }
  }, [sel, rs]);

  const bulkMove = useCallback(async (targetFolder: string) => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    sel.setBulkBusy("move");
    rs.setError(null);
    sel.setNotice(null);
    try {
      const { moved, failed } = await moveImages(ids, targetFolder);
      if (moved.length > 0) sel.setNotice(`Moved ${moved.length}/${ids.length} file${moved.length === 1 ? "" : "s"} to ${targetFolder}.`);
      if (failed.length > 0) rs.setError(`Moved ${moved.length}/${ids.length}. ${failed.length} failed: ${failed[0].error}`);
    } catch (e) {
      rs.setError(e instanceof Error ? e.message : "Move failed");
    } finally {
      sel.setBulkBusy(null);
    }
  }, [sel, rs]);

  return { exportSelected, bulkMove };
}

function downloadExport(kind: ExportKind, result: Awaited<ReturnType<typeof exportImages>>) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = `deedlit-export-${result.count}-images-${stamp}`;
  const simple = () => result.images.map(toSimpleRecord);
  switch (kind) {
    // Complete JSON keeps the export wrapper (meta + errors); JSONL is the
    // bare records, one per line.
    case "complete-json":
      downloadJson(result, `${base}.json`);
      break;
    case "complete-jsonl":
      downloadJsonl(result.images, `${base}.jsonl`);
      break;
    case "simple-json":
      downloadJson({ exportedAt: result.exportedAt, count: result.count, images: simple() }, `${base}-simple.json`);
      break;
    case "simple-jsonl":
      downloadJsonl(simple(), `${base}-simple.jsonl`);
      break;
    case "simple-csv":
      downloadCsv(simple(), `${base}-simple.csv`);
      break;
  }
}

/** Selection + every bulk action available from BulkActionBar / the lightbox. */
export function useLibrarySelection(rs: ResultsState) {
  const sel = useSelectionState();
  const { toggleSelect, clearSelection, exitSelectMode } = useSelectionToggles(sel);
  const { deleteSelected, deleteOne } = useDeleteActions(rs, sel, exitSelectMode);
  const applyBulk = useApplyBulk(rs, sel);
  const fieldActions = useBulkFieldActions(applyBulk);
  const { exportSelected, bulkMove } = useExportAndMove(rs, sel);

  return {
    ...sel, toggleSelect, clearSelection, exitSelectMode,
    deleteSelected, deleteOne, exportSelected, bulkMove,
    ...fieldActions,
  };
}
export type LibrarySelection = ReturnType<typeof useLibrarySelection>;
