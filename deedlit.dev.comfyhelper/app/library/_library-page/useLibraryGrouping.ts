"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { CompactResult } from "@/lib/library/schemas";

import type { GroupSection } from "./schemas";

const DirectoriesResponseSchema = z.object({
  directories: z.array(z.object({ directory: z.string(), image_count: z.number() })).optional(),
});

// True per-folder totals (the whole library, not just the loaded page) for the
// section headers. Fetched when grouping is on; failures leave the map empty
// (headers then show only the loaded count).
function useDirTotals(grouping: boolean) {
  const [dirTotals, setDirTotals] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!grouping) return;
    let alive = true;
    const ac = new AbortController();
    fetch("/api/library/directories", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { directories: [] }))
      .then((j) => {
        if (!alive) return;
        const parsed = DirectoriesResponseSchema.safeParse(j);
        const m = new Map<string, number>();
        for (const d of parsed.success ? (parsed.data.directories ?? []) : []) m.set(d.directory, d.image_count);
        setDirTotals(m);
      })
      .catch(() => { /* quiet — headers fall back to the loaded count */ });
    return () => { alive = false; ac.abort(); };
  }, [grouping]);
  return dirTotals;
}

// Groups the loaded browse results into collapsible per-folder sections. Only
// the filter-only browse path carries a `directory` (the vector path's hits
// don't), so grouping is gated to `browsePath && groupBy === "folder"`.
function useGroupSections(grouping: boolean, displayResults: CompactResult[]): GroupSection[] {
  return useMemo(() => {
    if (!grouping) return [];
    const map = new Map<string, CompactResult[]>();
    for (const r of displayResults) {
      const key = r.directory ?? "";
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    let offset = 0;
    return Array.from(map, ([key, items]) => {
      const startOffset = offset;
      offset += items.length;
      return { key, items, startOffset };
    });
  }, [grouping, displayResults]);
}

/** Folder-grouping state for the results grid: sections in first-appearance
 * order, the flattened list backing the lightbox/keyboard nav, live per-folder
 * totals, and which sections are collapsed. */
export function useLibraryGrouping(grouping: boolean, displayResults: CompactResult[]) {
  const groupSections = useGroupSections(grouping, displayResults);
  // Flat list backing the lightbox + keyboard nav. When grouped it is the
  // sections concatenated in display order (so a global index addresses the
  // same card the grid shows); otherwise it is displayResults unchanged.
  const galleryItems = useMemo(
    () => (grouping ? groupSections.flatMap((g) => g.items) : displayResults),
    [grouping, groupSections, displayResults],
  );
  const dirTotals = useDirTotals(grouping);

  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const toggleDir = useCallback((key: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { groupSections, galleryItems, dirTotals, collapsedDirs, toggleDir };
}
