import { useCallback, useEffect, useState } from "react";

import type { CompactResult, Graph, ImageDetail } from "@/lib/library/schemas";
import type { LibrarySettings } from "@/lib/store/settings";

import type { ImageDetailNote, RelatedTag } from "./schemas";

/** Loads the image detail record — independent of settings so the page renders
 * immediately. Cancels the fetch if the user navigates away before it lands. */
export function useImageDetail(imageId: string) {
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const res = await fetch(`/api/library/images/${imageId}`, { signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Not found");
      setDetail(json);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [imageId]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return { detail, setDetail, error };
}

function fetchSimilarImages(
  imageId: string,
  limit: number,
  minScore: number,
  signal: AbortSignal,
) {
  return fetch("/api/library/search/similar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageId, limit, minScore }),
    signal,
  })
    .then((r) => r.json())
    .then((j) => (j.results ?? []) as CompactResult[]);
}

/** Similar images (suggestions) — fetched once requested, automatically when
 * autoLoadSuggestions is on, otherwise after the user clicks the button. The
 * fetch only ever runs while `active`; the returned list is derived back to
 * empty (rather than reset via effect) whenever it isn't. */
export function useSimilarImages(
  imageId: string,
  hydrated: boolean,
  settings: LibrarySettings,
  suggestRequested: boolean,
) {
  const [fetched, setFetched] = useState<CompactResult[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const active = hydrated && settings.showSimilar && suggestRequested && settings.similarCount > 0;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const ac = new AbortController();
    // Data-fetching effect: marking the loading state synchronously before the
    // async call is the sanctioned fetch-in-effect pattern (not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuggestLoading(true);
    fetchSimilarImages(imageId, settings.similarCount, settings.similarMinScore, ac.signal)
      .then((results) => {
        if (!cancelled) setFetched(results);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSuggestLoading(false);
      });
    // Cancel the in-flight request on unmount / dep change (navigation) so a
    // slow similarity query never hangs after the user leaves.
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [active, imageId, settings.similarCount, settings.similarMinScore]);

  return { similar: active ? fetched : [], suggestLoading };
}

/** Relationship graph for the current image. */
export function useRelationshipGraph(imageId: string, hydrated: boolean, settings: LibrarySettings) {
  const [fetched, setFetched] = useState<Graph | null>(null);
  const active = hydrated && settings.showRelationshipGraph;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const ac = new AbortController();
    fetch(`/api/library/images/${imageId}/graph?depth=${settings.graphDepth}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setFetched(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [active, imageId, settings.graphDepth]);

  return active ? fetched : null;
}

/** Related tags — co-occurring tags for this image's most prominent tag. */
export function useRelatedTags(detail: ImageDetail | null, hydrated: boolean, settings: LibrarySettings) {
  const [fetched, setFetched] = useState<RelatedTag[]>([]);
  const seed = detail && detail.tags.length > 0 ? detail.tags[0].normalizedName || detail.tags[0].name : null;
  const active = hydrated && settings.showRelatedTags && settings.relatedTagsCount > 0 && seed != null;

  useEffect(() => {
    if (!active || seed == null) return;
    let cancelled = false;
    const ac = new AbortController();
    fetch(`/api/library/tags/${encodeURIComponent(seed)}/related?limit=${settings.relatedTagsCount}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setFetched(Array.isArray(j.related) ? j.related : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [active, seed, settings.relatedTagsCount]);

  return active ? fetched : [];
}

/** Notes attached to this image, plus a draft-add flow. */
export function useImageNotes(imageId: string) {
  const [notes, setNotes] = useState<ImageDetailNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    setNotesLoading(true);
    fetch(`/api/library/notes/by-image/${encodeURIComponent(imageId)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => { if (alive) setNotes(Array.isArray(j) ? j : []); })
      .catch(() => {})
      .finally(() => { if (alive) setNotesLoading(false); });
    return () => { alive = false; ac.abort(); };
  }, [imageId]);

  const addNote = useCallback(async () => {
    const text = noteDraft.trim();
    if (!text || noteSaving) return;
    setNoteSaving(true);
    try {
      const res = await fetch("/api/library/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: text, blocks: {}, imageRefs: [imageId] }),
      });
      if (res.ok) {
        setNoteDraft("");
        const r2 = await fetch(`/api/library/notes/by-image/${encodeURIComponent(imageId)}`);
        if (r2.ok) {
          const j = await r2.json();
          setNotes(Array.isArray(j) ? j : []);
        }
      }
    } finally {
      setNoteSaving(false);
    }
  }, [imageId, noteDraft, noteSaving]);

  return { notes, notesLoading, noteDraft, setNoteDraft, noteSaving, addNote };
}
