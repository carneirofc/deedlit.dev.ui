import { z } from "zod";

import { deleteImageEverywhere, runImageAction } from "./imageApi";
import type { CatalogImage } from "./schemas";

const UseImageOpsParamsSchema = z.object({
  selected: z.custom<CatalogImage | null>(),
  clearSelection: z.custom<() => void>(),
  onError: z.custom<(message: string) => void>(),
  onNotice: z.custom<(message: string) => void>(),
  refreshList: z.custom<() => void>(),
});
type UseImageOpsParams = z.infer<typeof UseImageOpsParamsSchema>;

/** Re-index / re-label / delete-everywhere ops on the selected image. */
export function useImageOps({ selected, clearSelection, onError, onNotice, refreshList }: UseImageOpsParams) {
  const act = async (kind: "reindex" | "relabel") => {
    if (!selected) return;
    onError("");
    try {
      await runImageAction(selected.sha256, kind);
      onNotice(`${kind === "reindex" ? "Re-index" : "Re-label"} task enqueued.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : `${kind} failed`);
    }
  };

  const deleteEverywhere = async () => {
    if (!selected) return;
    const typed = window.prompt(
      `Type the sha256 to DELETE this image's index (catalog + search + graph; not the file on disk):\n${selected.sha256}`,
    );
    if (typed !== selected.sha256) return;
    onError("");
    try {
      await deleteImageEverywhere(selected.sha256);
      onNotice("Deleted everywhere.");
      clearSelection();
      refreshList();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return { act, deleteEverywhere };
}
