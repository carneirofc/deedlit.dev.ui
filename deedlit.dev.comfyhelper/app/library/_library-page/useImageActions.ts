"use client";

import { useCallback } from "react";
import { z } from "zod";

import { LibraryNoteSchema } from "./schemas";
import type { ResultsState } from "./useLibraryResults";

const NotesResponseSchema = z.array(LibraryNoteSchema);

/** Single-image actions surfaced from the lightbox: rating (mirrors the grid
 * row so the card updates without a refetch) and the notes panel. */
export function useImageActions(rs: ResultsState) {
  const rateImage = useCallback(async (imageId: string, rating: number | null) => {
    try {
      const res = await fetch(`/api/library/images/${encodeURIComponent(imageId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) rs.setResults((prev) => prev.map((r) => (r.imageId === imageId ? { ...r, rating } : r)));
    } catch {
      // silent — non-critical
    }
  }, [rs]);

  const fetchNotesForImage = useCallback(async (imageId: string) => {
    try {
      const r = await fetch(`/api/library/notes/by-image/${encodeURIComponent(imageId)}`);
      if (!r.ok) return [];
      const parsed = NotesResponseSchema.safeParse(await r.json());
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, []);

  const createNoteForImage = useCallback(async (imageId: string, text: string) => {
    await fetch("/api/library/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: text, blocks: {}, imageRefs: [imageId] }),
    });
  }, []);

  return { rateImage, fetchNotesForImage, createNoteForImage };
}
