import { useRef, useState } from "react";
import { z } from "zod";

import { fetchFullImage } from "./imageApi";
import { editFrom, type CatalogImage, type EditState } from "./schemas";

const UseImageSelectionParamsSchema = z.object({
  onError: z.custom<(message: string) => void>(),
  onNotice: z.custom<(message: string) => void>(),
});
type UseImageSelectionParams = z.infer<typeof UseImageSelectionParamsSchema>;

/** Selected-image + editor-field state, including the on-demand full-record
 * fetch (the browse list omits the heavy fields). */
export function useImageSelection({ onError, onNotice }: UseImageSelectionParams) {
  const [selected, setSelected] = useState<CatalogImage | null>(null);
  // The sha currently open in the editor — tracked in a ref so the async
  // full-record fetch in `select` can tell whether the user has since moved on
  // before its response lands (avoids a stale detail clobbering a newer pick).
  const selectedShaRef = useRef<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  // Transient "Copied" state for the source-file path copy button.
  const [pathCopied, setPathCopied] = useState(false);

  const clearSelection = () => {
    setSelected(null);
    setEdit(null);
  };

  const select = async (img: CatalogImage) => {
    // Show the lightweight list row immediately so the editor is responsive.
    setSelected(img);
    setEdit(editFrom(img));
    onNotice("");
    onError("");
    selectedShaRef.current = img.sha256;

    try {
      const full = await fetchFullImage(img.sha256);
      // Ignore the response if the user has since opened a different image.
      if (selectedShaRef.current !== img.sha256) return;
      setSelected((cur) => (cur && cur.sha256 === img.sha256 ? { ...cur, ...full } : cur));
      setEdit(editFrom({ ...img, ...full }));
    } catch (e) {
      // Non-fatal: the light fields still render; only the raw-JSON panels stay
      // empty and the negative field falls back to the (absent) list value.
      if (selectedShaRef.current === img.sha256) {
        onError(e instanceof Error ? e.message : "Failed to load full record.");
      }
    }
  };

  return { selected, setSelected, edit, setEdit, pathCopied, setPathCopied, select, clearSelection };
}
