import { useState } from "react";
import { z } from "zod";

import { patchImage } from "./imageApi";
import { editFrom, type CatalogImage, type EditState } from "./schemas";

const UseImageActionsParamsSchema = z.object({
  selected: z.custom<CatalogImage | null>(),
  edit: z.custom<EditState | null>(),
  setSelected: z.custom<(image: CatalogImage) => void>(),
  setEdit: z.custom<(edit: EditState) => void>(),
  onError: z.custom<(message: string) => void>(),
  onNotice: z.custom<(message: string) => void>(),
  refreshList: z.custom<() => void>(),
});
type UseImageActionsParams = z.infer<typeof UseImageActionsParamsSchema>;

/** Saves the curated fields for the selected image. */
export function useImageActions({ selected, edit, setSelected, setEdit, onError, onNotice, refreshList }: UseImageActionsParams) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!selected || !edit) return;
    setBusy(true);
    onError("");
    try {
      const updated = await patchImage(selected.sha256, edit);
      onNotice("Saved.");
      setSelected(updated);
      setEdit(editFrom(updated));
      refreshList();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return { busy, save };
}
