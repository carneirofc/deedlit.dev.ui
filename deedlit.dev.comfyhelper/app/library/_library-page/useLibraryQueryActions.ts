"use client";

import { useCallback, useEffect } from "react";
import { z } from "zod";

import type { AuxFilterControls } from "./useLibraryFilters";
import type { FilterSnapshot, SimilarRef } from "./schemas";

const DoFetchSchema = z.custom<(append: boolean, overrides?: Partial<FilterSnapshot>) => void>();

const QueryActionsParamsSchema = z.object({
  aux: z.custom<AuxFilterControls>(),
  doFetch: DoFetchSchema,
});
type QueryActionsParams = z.infer<typeof QueryActionsParamsSchema>;

function revokeAndSet(setImagePreview: AuxFilterControls["setImagePreview"], next: string | null) {
  setImagePreview((prev) => {
    if (prev) URL.revokeObjectURL(prev);
    return next;
  });
}

// Global clipboard paste while the image panel is open — paste a screenshot.
function useImagePasteListener(aux: AuxFilterControls, applyExternalImage: (file: File) => void) {
  useEffect(() => {
    if (!aux.showImageSearch && aux.mode !== "image") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        applyExternalImage(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [aux.showImageSearch, aux.mode, applyExternalImage]);
}

// Plain search / similar-to actions: each clears the other query modes and
// re-fetches from the top.
function useSearchActions({ aux, doFetch }: QueryActionsParams) {
  const search = useCallback(() => {
    aux.setSimilarRef(null);
    aux.setImageFile(null);
    aux.setImageNote(null);
    revokeAndSet(aux.setImagePreview, null);
    aux.setMode("browse");
    doFetch(false, { mode: "browse", similarRef: null, imageFile: null });
  }, [aux, doFetch]);

  const loadMore = useCallback(() => doFetch(true), [doFetch]);

  const findSimilar = useCallback(
    (id: string, thumbUrl: string, summary: string) => {
      const ref: SimilarRef = { id, thumbUrl, summary };
      aux.setSimilarRef(ref);
      aux.setMode("similar");
      doFetch(false, { mode: "similar", similarRef: ref });
    },
    [aux, doFetch],
  );

  const clearSimilar = useCallback(() => {
    aux.setSimilarRef(null);
    aux.setMode("browse");
    doFetch(false, { mode: "browse", similarRef: null });
  }, [aux, doFetch]);

  return { search, loadMore, findSimilar, clearSimilar };
}

// Reverse-image search actions: accept an external image (paste / drop /
// file pick) and immediately search, or drop it and return to text/filter
// browsing.
function useImageQueryActions({ aux, doFetch }: QueryActionsParams) {
  const applyExternalImage = useCallback(
    (file: File) => {
      aux.setImageFile(file);
      aux.setSimilarRef(null);
      revokeAndSet(aux.setImagePreview, URL.createObjectURL(file));
      aux.setMode("image");
      doFetch(false, { mode: "image", imageFile: file, similarRef: null });
    },
    [aux, doFetch],
  );

  const clearImage = useCallback(() => {
    aux.setImageFile(null);
    aux.setImageNote(null);
    revokeAndSet(aux.setImagePreview, null);
    aux.setMode("browse");
    doFetch(false, { mode: "browse", imageFile: null });
  }, [aux, doFetch]);

  useImagePasteListener(aux, applyExternalImage);

  return { applyExternalImage, clearImage };
}

/** Query-switching actions: plain search, similar-to, and reverse-image
 * search. Each clears the other query modes and re-fetches from the top. */
export function useLibraryQueryActions(params: QueryActionsParams) {
  const searchActions = useSearchActions(params);
  const imageActions = useImageQueryActions(params);
  return { ...searchActions, ...imageActions };
}
