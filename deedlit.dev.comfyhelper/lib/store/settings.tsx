"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

const STORAGE_KEY = "comfyhelper-library-settings";

const BrowseModeSchema = z.enum(["browse", "semantic", "image"]);
export type BrowseMode = z.infer<typeof BrowseModeSchema>;

const ViewModeSchema = z.enum(["grid", "list", "masonry"]);
export type ViewMode = z.infer<typeof ViewModeSchema>;

const GridDensitySchema = z.enum(["compact", "comfortable", "spacious"]);
export type GridDensity = z.infer<typeof GridDensitySchema>;

const ImageFitSchema = z.enum(["contain", "cover"]);
export type ImageFit = z.infer<typeof ImageFitSchema>;

/** How browse results are sectioned. `none` = one flat grid; `folder` = split
 *  into collapsible sections by source directory (browse path only). */
const GroupByModeSchema = z.enum(["none", "folder"]);
export type GroupByMode = z.infer<typeof GroupByModeSchema>;

/** AI content-safety class. Mirrors the catalog/labelagent `safety` enum. */
const SafetyClassSchema = z.enum(["sfw", "nsfw", "explicit"]);
export type SafetyClass = z.infer<typeof SafetyClassSchema>;
export const SAFETY_CLASSES: readonly SafetyClass[] = SafetyClassSchema.options;
export const SAFETY_LABEL: Record<SafetyClass, string> = {
  sfw: "SFW",
  nsfw: "NSFW",
  explicit: "Explicit",
};

/**
 * Result ordering. `relevance` is the vector-search ranking (only meaningful
 * when there is a text/image query); the rest are server-side catalog sorts used
 * by the filter-only browse grid. Mirrors the catalog `sort` enum + relevance.
 */
const SortModeSchema = z.enum([
  "relevance",
  "newest",
  "oldest",
  "created_desc",
  "created_asc",
  "rating_desc",
  "rating_asc",
  "name_asc",
  "name_desc",
]);
export type SortMode = z.infer<typeof SortModeSchema>;

export const SORT_MODES: readonly SortMode[] = SortModeSchema.options;

/**
 * User-tunable preferences for the image library UI.  Persisted to
 * localStorage (survives across sessions) and consumed by the browse page,
 * the image viewer, and the suggestion / related-item panels.
 */
export const LibrarySettingsSchema = z.object({
  // --- Browsing & pagination ---
  /** Results fetched per page / "load more" step. */
  pageSize: z.number(),
  /** Which search tab the browse page opens on. */
  defaultMode: BrowseModeSchema,
  /** Auto-load the next page when the grid bottom scrolls into view. */
  infiniteScroll: z.boolean(),
  /** How result cards are laid out. */
  viewMode: ViewModeSchema,
  /** Result ordering. Defaults to newest-first for browse; relevance is applied
   * automatically when a text/image query is active. */
  sortMode: SortModeSchema,
  /** Split browse results into collapsible sections by source directory.
   * `none` = one flat grid (default). Only applies on the filter-only browse
   * path; the vector-search results have no directory to group by. */
  groupBy: GroupByModeSchema,
  /** Card size / column count for grid & masonry views. */
  gridDensity: GridDensitySchema,
  /** Show the similarity-score chip on cards. */
  showScores: z.boolean(),
  /** Show summary / model / rating metadata under each card. */
  showCardMeta: z.boolean(),

  // --- Image viewer (detail page) ---
  /** Fit the main viewer image inside its box (contain) or fill it (cover). */
  viewerImageFit: ImageFitSchema,
  /** Load the full-resolution original instead of the thumbnail in the viewer. */
  viewerFullResolution: z.boolean(),
  showPrompt: z.boolean(),
  /** Show the AI-generated description panel on the detail page. */
  showDescription: z.boolean(),
  showGenerationParams: z.boolean(),
  showRelationshipGraph: z.boolean(),
  /** Relationship-graph hop depth (1–3). */
  graphDepth: z.number(),

  // --- Suggestions & related items ---
  showSimilar: z.boolean(),
  /** Number of "similar images" suggestions on the viewer. */
  similarCount: z.number(),
  /** Drop suggestions below this similarity score (0 = keep all). */
  similarMinScore: z.number(),
  /** Fetch suggestions automatically on open vs. on demand. */
  autoLoadSuggestions: z.boolean(),
  showRelatedTags: z.boolean(),
  /** Number of co-occurring tags to surface in the related panel. */
  relatedTagsCount: z.number(),

  // --- Search defaults ---
  defaultMinRating: z.number(),
  defaultFavoritesOnly: z.boolean(),
  /** Default minimum score for semantic / similar / by-image searches. */
  defaultMinScore: z.number(),
  /**
   * Content-safety classes the browse/search grid shows by default. All three
   * (or none) selected = no filter (everything, incl. unclassified); a strict
   * subset hides the unlisted classes. Seeds the library page's safety chips.
   */
  defaultSafety: z.array(SafetyClassSchema),

  // --- Slideshow (fullscreen viewer) ---
  /** Seconds each image is shown before the slideshow auto-advances. */
  slideshowInterval: z.number(),
  /** Loop back to the first image after the last one. */
  slideshowLoop: z.boolean(),
  /** Advance to a random image instead of the next in order. */
  slideshowShuffle: z.boolean(),
});
export type LibrarySettings = z.infer<typeof LibrarySettingsSchema>;

export const DEFAULT_SETTINGS: LibrarySettings = {
  pageSize: 40,
  defaultMode: "browse",
  infiniteScroll: false,
  viewMode: "grid",
  sortMode: "newest",
  groupBy: "none",
  gridDensity: "comfortable",
  showScores: true,
  showCardMeta: true,

  viewerImageFit: "contain",
  viewerFullResolution: false,
  showPrompt: true,
  showDescription: true,
  showGenerationParams: true,
  showRelationshipGraph: true,
  graphDepth: 1,

  showSimilar: true,
  similarCount: 12,
  similarMinScore: 0,
  autoLoadSuggestions: true,
  showRelatedTags: true,
  relatedTagsCount: 12,

  defaultMinRating: 0,
  defaultFavoritesOnly: false,
  defaultMinScore: 0,
  defaultSafety: ["sfw", "nsfw", "explicit"],

  slideshowInterval: 5,
  slideshowLoop: true,
  slideshowShuffle: false,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// Field builders for the lenient, storage-parsing schema below: each one always
// succeeds (falling back to the matching DEFAULT_SETTINGS value), and number
// fields additionally clamp into their valid range.
const boolField = (fallback: boolean) => z.boolean().catch(fallback);
const numField = (min: number, max: number, fallback: number) =>
  z
    .number()
    .catch(fallback)
    .transform((value) => clamp(value, min, max));
// Sanitize a stored multi-select against the allowed set (drop junk, de-dupe);
// a non-array (or entirely-invalid array) falls back to the default.
const subsetField = <T extends string>(schema: z.ZodEnum<Record<string, T>>, fallback: readonly T[]) =>
  z
    .preprocess(
      (value) =>
        Array.isArray(value)
          ? Array.from(new Set(value.filter((x): x is T => schema.safeParse(x).success)))
          : value,
      z.array(schema),
    )
    .catch([...fallback]);

/**
 * Lenient counterpart of {@link LibrarySettingsSchema} used to parse a possibly
 * stale / partial stored blob: every field falls back to its default instead of
 * failing the whole parse, so adding a new setting never breaks an old
 * persisted payload. Unknown keys are dropped by the plain z.object() parse.
 */
const StoredLibrarySettingsSchema = z.object({
  pageSize: numField(10, 200, DEFAULT_SETTINGS.pageSize),
  defaultMode: BrowseModeSchema.catch(DEFAULT_SETTINGS.defaultMode),
  infiniteScroll: boolField(DEFAULT_SETTINGS.infiniteScroll),
  viewMode: ViewModeSchema.catch(DEFAULT_SETTINGS.viewMode),
  sortMode: SortModeSchema.catch(DEFAULT_SETTINGS.sortMode),
  groupBy: GroupByModeSchema.catch(DEFAULT_SETTINGS.groupBy),
  gridDensity: GridDensitySchema.catch(DEFAULT_SETTINGS.gridDensity),
  showScores: boolField(DEFAULT_SETTINGS.showScores),
  showCardMeta: boolField(DEFAULT_SETTINGS.showCardMeta),

  viewerImageFit: ImageFitSchema.catch(DEFAULT_SETTINGS.viewerImageFit),
  viewerFullResolution: boolField(DEFAULT_SETTINGS.viewerFullResolution),
  showPrompt: boolField(DEFAULT_SETTINGS.showPrompt),
  showDescription: boolField(DEFAULT_SETTINGS.showDescription),
  showGenerationParams: boolField(DEFAULT_SETTINGS.showGenerationParams),
  showRelationshipGraph: boolField(DEFAULT_SETTINGS.showRelationshipGraph),
  graphDepth: numField(1, 3, DEFAULT_SETTINGS.graphDepth),

  showSimilar: boolField(DEFAULT_SETTINGS.showSimilar),
  similarCount: numField(0, 48, DEFAULT_SETTINGS.similarCount),
  similarMinScore: numField(0, 1, DEFAULT_SETTINGS.similarMinScore),
  autoLoadSuggestions: boolField(DEFAULT_SETTINGS.autoLoadSuggestions),
  showRelatedTags: boolField(DEFAULT_SETTINGS.showRelatedTags),
  relatedTagsCount: numField(0, 40, DEFAULT_SETTINGS.relatedTagsCount),

  defaultMinRating: numField(0, 5, DEFAULT_SETTINGS.defaultMinRating),
  defaultFavoritesOnly: boolField(DEFAULT_SETTINGS.defaultFavoritesOnly),
  defaultMinScore: numField(0, 1, DEFAULT_SETTINGS.defaultMinScore),
  defaultSafety: subsetField(SafetyClassSchema, DEFAULT_SETTINGS.defaultSafety),

  slideshowInterval: numField(1, 60, DEFAULT_SETTINGS.slideshowInterval),
  slideshowLoop: boolField(DEFAULT_SETTINGS.slideshowLoop),
  slideshowShuffle: boolField(DEFAULT_SETTINGS.slideshowShuffle),
});

function mergeSettings(raw: unknown): LibrarySettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const parsed = StoredLibrarySettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
}

const SettingsValueSchema = z.object({
  settings: LibrarySettingsSchema,
  /** True once the stored payload has been read on the client. */
  hydrated: z.boolean(),
  setKey: z.custom<<K extends keyof LibrarySettings>(key: K, value: LibrarySettings[K]) => void>(),
  update: z.custom<(patch: Partial<LibrarySettings>) => void>(),
  reset: z.custom<() => void>(),
});
type SettingsValue = z.infer<typeof SettingsValueSchema>;

const SettingsContext = createContext<SettingsValue | null>(null);

const SettingsProviderPropsSchema = z.object({
  children: z.custom<ReactNode>(),
});
type SettingsProviderProps = z.infer<typeof SettingsProviderPropsSchema>;

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted settings once on the client to avoid a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Syncing React state from an external system (localStorage) on mount,
      // not state derived from props/state — the sanctioned effect pattern.
      if (raw) setSettings(mergeSettings(JSON.parse(raw)));
    } catch {
      // ignore malformed / unavailable storage
    }
    setHydrated(true);
  }, []);

  // Persist after hydration so we never clobber stored values with the defaults
  // written during the initial render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / disabled storage
    }
  }, [settings, hydrated]);

  const setKey = useCallback(
    <K extends keyof LibrarySettings>(key: K, value: LibrarySettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );
  const update = useCallback(
    (patch: Partial<LibrarySettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [],
  );
  const reset = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), []);

  const value = useMemo<SettingsValue>(
    () => ({ settings, hydrated, setKey, update, reset }),
    [settings, hydrated, setKey, update, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Layout helpers — shared between the browse page and any view that renders a
// result grid, so density is defined in exactly one place.
// ---------------------------------------------------------------------------

const GRID_COLUMNS: Record<GridDensity, string> = {
  compact:
    "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-10 4xl:grid-cols-12 5xl:grid-cols-14",
  comfortable:
    "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 4xl:grid-cols-10 5xl:grid-cols-12",
  spacious:
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-8",
};

const MASONRY_COLUMNS: Record<GridDensity, string> = {
  compact: "columns-3 sm:columns-4 lg:columns-6 xl:columns-7 2xl:columns-8 3xl:columns-10 4xl:columns-12 5xl:columns-14",
  comfortable: "columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 3xl:columns-8 4xl:columns-10 5xl:columns-12",
  spacious: "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 3xl:columns-6 4xl:columns-8",
};

export function gridColumnsClass(density: GridDensity): string {
  return GRID_COLUMNS[density];
}

export function masonryColumnsClass(density: GridDensity): string {
  return MASONRY_COLUMNS[density];
}
