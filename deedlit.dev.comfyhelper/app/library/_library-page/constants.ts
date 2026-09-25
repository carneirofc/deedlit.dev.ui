import type { SortMode } from "@/lib/store/settings";

// How many pages to warm in the background beyond what's rendered, so "load
// more" / infinite scroll lands instantly. The offset-paged paths prefetch
// (browse / search / similar); by-image is single-page.
export const PREFETCH_AHEAD = 2;
// Upper bound on the cold restore from `?page=N` — it costs up to N sequential
// page fetches, so cap it however deep the address claims the user had paged.
export const MAX_RESTORE_PAGES = 20;

// How many of the most-used tags to surface as one-click filter chips before
// the "+N more" expander reveals the rest of the catalog.
export const TAG_CHIP_PREVIEW = 40;

export const SORT_LABEL: Record<SortMode, string> = {
  relevance: "Relevance",
  // Ingested = catalog import date; Created = source-file creation date. They
  // diverge when old images are bulk-imported long after they were made.
  newest: "Ingested · newest",
  oldest: "Ingested · oldest",
  created_desc: "Created · newest",
  created_asc: "Created · oldest",
  rating_desc: "Rating ↓",
  rating_asc: "Rating ↑",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
};

// Sort options offered per context. The vector-search path is relevance-ranked
// and its results carry no date/filename, so only relevance + rating (a
// client-side reorder of the loaded window) make sense there; browse offers
// the full server-side set.
export const BROWSE_SORTS: SortMode[] = ["newest", "oldest", "created_desc", "created_asc", "rating_desc", "rating_asc", "name_asc", "name_desc"];
export const SEARCH_SORTS: SortMode[] = ["relevance", "rating_desc", "rating_asc"];

export const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  input: "w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  btnActive: "border-accent-cyan text-accent-cyan",
  label: "flex flex-col gap-1 text-ui-2xs font-medium uppercase tracking-wide text-ui-ink-muted",
};

export function csv(value: string): string[] {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}
