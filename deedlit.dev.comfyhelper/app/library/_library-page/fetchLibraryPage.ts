import { z } from "zod";

import type { CatalogSort } from "@/lib/library/schemas";

import { CompactResultSchema, type FetchPageResult, type FilterSnapshot } from "./schemas";
import { SAFETY_CLASSES } from "./schemas";

function csv(value: string): string[] {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

/** The catalog browse path is used only for filter-only browsing (no query). */
export function isBrowsePath(mode: FilterSnapshot["mode"], query: string): boolean {
  return mode === "browse" && query.trim() === "";
}

function listOrUndef<T>(arr: T[]): T[] | undefined {
  return arr.length ? arr : undefined;
}

function trimOrUndef(value: string): string | undefined {
  return value.trim() || undefined;
}

function safetyOrUndef(safety: FilterSnapshot["safety"]): FilterSnapshot["safety"] | undefined {
  const isSubset = safety.length > 0 && safety.length < SAFETY_CLASSES.length;
  return isSubset ? safety : undefined;
}

function buildFilters(s: FilterSnapshot) {
  return {
    tags: listOrUndef(s.tags),
    excludeTags: listOrUndef(s.excludeTags),
    modelFamily: trimOrUndef(s.modelFamily),
    checkpoint: trimOrUndef(s.checkpoint),
    loras: listOrUndef(csv(s.loras)),
    sourceTool: trimOrUndef(s.sourceTool),
    favorite: s.favorites || undefined,
    ratingGte: s.minRating > 0 ? s.minRating : undefined,
    safety: safetyOrUndef(s.safety),
  };
}

const SearchResponseSchema = z.object({
  results: z.array(CompactResultSchema).optional(),
  hasMore: z.boolean().optional(),
  error: z.string().optional(),
});

async function fetchSimilarPage(
  s: FilterSnapshot,
  filters: ReturnType<typeof buildFilters>,
  pageOffset: number,
  signal: AbortSignal,
): Promise<FetchPageResult> {
  const r = await fetch("/api/library/search/similar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageId: s.similarRef?.id, filters, limit: s.limit, offset: pageOffset,
      minScore: s.minScore, graphScope: s.graphScope ?? undefined,
    }),
    signal,
  });
  const j = SearchResponseSchema.parse(await r.json());
  if (!r.ok) throw new Error(j.error ?? "Similarity search failed");
  return { fresh: j.results ?? [], more: j.hasMore ?? false };
}

const ByImageResponseSchema = z.object({
  results: z.array(CompactResultSchema).optional(),
  error: z.string().optional(),
  semantic: z.boolean().optional(),
  provider: z.string().optional(),
});

async function fetchByImagePage(
  s: FilterSnapshot,
  filters: ReturnType<typeof buildFilters>,
  signal: AbortSignal,
): Promise<FetchPageResult> {
  const fd = new FormData();
  fd.append("file", s.imageFile as File);
  fd.append("options", JSON.stringify({ filters, limit: s.limit, minScore: s.minScore, graphScope: s.graphScope ?? undefined }));
  const r = await fetch("/api/library/search/by-image", { method: "POST", body: fd, signal });
  const j = ByImageResponseSchema.parse(await r.json());
  if (!r.ok) throw new Error(j.error ?? "Image search failed");
  const note = j.semantic
    ? `Visual similarity · ${j.provider}`
    : "Visual similarity · local color/layout features (CLIP not configured)";
  return { fresh: j.results ?? [], more: false, note };
}

async function fetchBrowsePage(
  s: FilterSnapshot,
  filters: ReturnType<typeof buildFilters>,
  pageOffset: number,
  signal: AbortSignal,
): Promise<FetchPageResult> {
  const browseSort: CatalogSort = s.sort === "relevance" ? "newest" : (s.sort as CatalogSort);
  const r = await fetch("/api/library/browse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tags: filters.tags, excludeTags: filters.excludeTags, favorite: filters.favorite,
      ratingGte: filters.ratingGte, safety: filters.safety, path: s.pathFilter.trim() || undefined,
      sort: browseSort, limit: s.limit, offset: pageOffset,
    }),
    signal,
  });
  const j = SearchResponseSchema.parse(await r.json());
  if (!r.ok) throw new Error(j.error ?? "Browse failed");
  const fresh = j.results ?? [];
  return { fresh, more: j.hasMore ?? fresh.length === s.limit };
}

async function fetchSearchPage(
  s: FilterSnapshot,
  filters: ReturnType<typeof buildFilters>,
  pageOffset: number,
  signal: AbortSignal,
): Promise<FetchPageResult> {
  const r = await fetch("/api/library/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: s.query || undefined, ...filters, graphScope: s.graphScope ?? undefined,
      limit: s.limit, offset: pageOffset,
    }),
    signal,
  });
  const j = SearchResponseSchema.parse(await r.json());
  if (!r.ok) throw new Error(j.error ?? "Search failed");
  const fresh = j.results ?? [];
  return { fresh, more: fresh.length === s.limit };
}

/** One page fetch for a filter snapshot at a given offset. Builds the right
 * request for the active path (similar / by-image / browse / search) — the
 * request shape lives in exactly one place. `note` is only produced by the
 * by-image path. */
export async function fetchLibraryPage(
  s: FilterSnapshot,
  pageOffset: number,
  signal: AbortSignal,
): Promise<FetchPageResult> {
  const filters = buildFilters(s);
  if (s.mode === "similar" && s.similarRef) return fetchSimilarPage(s, filters, pageOffset, signal);
  if (s.mode === "image" && s.imageFile) return fetchByImagePage(s, filters, signal);
  if (isBrowsePath(s.mode, s.query)) return fetchBrowsePage(s, filters, pageOffset, signal);
  return fetchSearchPage(s, filters, pageOffset, signal);
}
