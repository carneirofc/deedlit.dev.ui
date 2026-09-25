import { z } from "zod";

import { useImageActions } from "./useImageActions";
import { useImageOps } from "./useImageOps";
import { useImageSelection } from "./useImageSelection";

const UseImageEditorParamsSchema = z.object({
  onError: z.custom<(message: string) => void>(),
  onNotice: z.custom<(message: string) => void>(),
  refreshList: z.custom<() => void>(),
});
type UseImageEditorParams = z.infer<typeof UseImageEditorParamsSchema>;

/**
 * Selected-image editor state: fetching the full record, editing curated
 * fields, and the per-image ops (re-index / re-label / delete-everywhere).
 */
export function useImageEditor({ onError, onNotice, refreshList }: UseImageEditorParams) {
  const selection = useImageSelection({ onError, onNotice });
  const actions = useImageActions({
    selected: selection.selected,
    edit: selection.edit,
    setSelected: selection.setSelected,
    setEdit: selection.setEdit,
    onError,
    onNotice,
    refreshList,
  });
  const ops = useImageOps({
    selected: selection.selected,
    clearSelection: selection.clearSelection,
    onError,
    onNotice,
    refreshList,
  });

  return {
    selected: selection.selected,
    edit: selection.edit,
    setEdit: selection.setEdit,
    pathCopied: selection.pathCopied,
    setPathCopied: selection.setPathCopied,
    select: selection.select,
    clearSelection: selection.clearSelection,
    busy: actions.busy,
    save: actions.save,
    act: ops.act,
    deleteEverywhere: ops.deleteEverywhere,
  };
}
