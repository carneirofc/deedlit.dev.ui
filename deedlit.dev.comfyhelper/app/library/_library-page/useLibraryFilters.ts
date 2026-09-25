"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import type { GraphScope } from "@/lib/library/schemas";
import type { LibrarySettings } from "@/lib/store/settings";

import { SAFETY_CLASSES, type BrowseMode, type SimilarRef } from "./schemas";

/** The core filter controls: text/tag/model filters plus the essentials row
 * (favorites, rating, safety) and the "advanced" panel toggle. Seeded from
 * saved settings (defaults until hydrated). */
export function useFilterControls(settings: LibrarySettings) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [modelFamily, setModelFamily] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [loras, setLoras] = useState("");
  const [sourceTool, setSourceTool] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [favorites, setFavorites] = useState(settings.defaultFavoritesOnly);
  const [minRating, setMinRating] = useState(settings.defaultMinRating);
  const [safety, setSafety] = useState(SAFETY_CLASSES);
  const [limit, setLimit] = useState(settings.pageSize);
  const [minScore, setMinScore] = useState(settings.defaultMinScore);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return {
    query, setQuery, tags, setTags, excludeTags, setExcludeTags,
    modelFamily, setModelFamily, checkpoint, setCheckpoint, loras, setLoras,
    sourceTool, setSourceTool, pathFilter, setPathFilter,
    favorites, setFavorites, minRating, setMinRating, safety, setSafety,
    limit, setLimit, minScore, setMinScore, showAdvanced, setShowAdvanced,
  };
}
export type FilterControls = ReturnType<typeof useFilterControls>;

/** Reverse-image search panel + graph filter + similar-to query + the popular
 * tag chip cloud's expand toggle. Kept apart from useFilterControls only to
 * stay under the function-size limit — both feed the same request builder. */
export function useAuxFilterControls() {
  const [mode, setMode] = useState<BrowseMode>("browse");
  const [showAllTagChips, setShowAllTagChips] = useState(false);
  const [similarRef, setSimilarRef] = useState<SimilarRef | null>(null);
  const [graphScope, setGraphScope] = useState<GraphScope | null>(null);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);

  return {
    mode, setMode, showAllTagChips, setShowAllTagChips, similarRef, setSimilarRef,
    graphScope, setGraphScope, showImageSearch, setShowImageSearch,
    imageFile, setImageFile, imagePreview, setImagePreview, imageNote, setImageNote,
  };
}
export type AuxFilterControls = ReturnType<typeof useAuxFilterControls>;

const TagsResponseSchema = z.object({ tags: z.array(z.string()).optional() });

/** Live, library-wide tag autocomplete (prefix-match, usage-ranked, served by
 * /api/library/tags) plus the whole-catalog list backing the primary filter's
 * "show all tags" picker (fetched once on mount). */
export function useTagCatalog() {
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    fetch("/api/library/tags?limit=2000", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((j) => {
        const parsed = TagsResponseSchema.safeParse(j);
        if (alive && parsed.success && parsed.data.tags) setAllTags(parsed.data.tags);
      })
      .catch(() => { /* quiet — aborted on unmount or the picker stays empty */ });
    return () => { alive = false; ac.abort(); };
  }, []);

  const fetchTagSuggestions = useCallback(async (q: string): Promise<string[]> => {
    try {
      const r = await fetch(`/api/library/tags?prefix=${encodeURIComponent(q)}&limit=50`);
      if (!r.ok) return [];
      const parsed = TagsResponseSchema.safeParse(await r.json());
      return parsed.success ? (parsed.data.tags ?? []) : [];
    } catch {
      return [];
    }
  }, []);

  return { allTags, fetchTagSuggestions };
}
