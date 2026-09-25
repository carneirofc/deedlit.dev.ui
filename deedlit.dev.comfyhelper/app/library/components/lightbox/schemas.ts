import { z } from "zod";

export const ImageDetailSchema = z.object({
  id: z.string(),
  filename: z.string(),
  filePath: z.string(),
  prompt: z.string().nullable(),
  negativePrompt: z.string().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  model: z.string().nullable(),
  checkpoint: z.string().nullable(),
  modelFamily: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sourceTool: z.string().nullable(),
  tags: z.array(z.object({ name: z.string(), normalizedName: z.string(), source: z.string().nullable().optional() })),
  loras: z.array(z.object({ name: z.string(), weight: z.number().nullable() })),
  generationParams: z.record(z.string(), z.unknown()).nullable(),
  descriptions: z.array(z.object({ id: z.string(), description: z.string(), provider: z.string().nullable() })),
});
export type ImageDetail = z.infer<typeof ImageDetailSchema>;

/** Minimal shape the lightbox needs from a search result. */
export const LightboxItemSchema = z.object({
  imageId: z.string(),
  thumbnailUrl: z.string(),
  summary: z.string(),
  score: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
});
export type LightboxItem = z.infer<typeof LightboxItemSchema>;

export const LightboxNoteSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type LightboxNote = z.infer<typeof LightboxNoteSchema>;

export const SlideshowSettingsSchema = z.object({
  /** Seconds between auto-advances. */
  interval: z.number(),
  loop: z.boolean(),
  shuffle: z.boolean(),
});
export type SlideshowSettings = z.infer<typeof SlideshowSettingsSchema>;

export const LightboxPropsSchema = z.object({
  items: z.array(LightboxItemSchema),
  initialIndex: z.number(),
  /** Stream the full-resolution original instead of the thumbnail. */
  fullResolution: z.boolean(),
  slideshow: SlideshowSettingsSchema,
  /** Start the slideshow playing as soon as the viewer opens. */
  autoPlay: z.boolean().optional(),
  /** More results can be loaded (drives auto-load near the end of the strip). */
  hasMore: z.boolean(),
  loadingMore: z.boolean(),
  onLoadMore: z.custom<() => void>(),
  onClose: z.custom<() => void>(),
  onSimilar: z.custom<(item: LightboxItem) => void>().optional(),
  onToggleFullResolution: z.custom<() => void>().optional(),
  /** Fires whenever the displayed image changes — drives URL sync. */
  onCurrentChange: z.custom<(item: LightboxItem) => void>().optional(),
  /** Called when user rates the current image (null clears the rating). */
  onRating: z.custom<(imageId: string, rating: number | null) => void>().optional(),
  /** Fetch notes for a given imageId. */
  fetchNotes: z.custom<(imageId: string) => Promise<LightboxNote[]>>().optional(),
  /** Create a plain-text note attached to an image. */
  onCreateNote: z.custom<(imageId: string, text: string) => Promise<void>>().optional(),
  /** Un-index the current image (catalog + search + graph; original kept on
   * disk). Resolves once it's gone so the viewer can advance off it. */
  onDelete: z.custom<(imageId: string) => Promise<void>>().optional(),
});
export type LightboxProps = z.infer<typeof LightboxPropsSchema>;

export const LightboxLiveSchema = z.object({
  index: z.number(),
  items: z.array(LightboxItemSchema),
  hasMore: z.boolean(),
  slideshow: SlideshowSettingsSchema,
  currentId: z.string().nullable(),
});
export type LightboxLive = z.infer<typeof LightboxLiveSchema>;

// ---------------------------------------------------------------------------
// Header — top control bar
// ---------------------------------------------------------------------------

export const LightboxHeaderInfoPropsSchema = z.object({
  index: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
  summary: z.string(),
});
export type LightboxHeaderInfoProps = z.infer<typeof LightboxHeaderInfoPropsSchema>;

export const LightboxRatingStarsPropsSchema = z.object({
  imageId: z.string(),
  rating: z.number().nullable().optional(),
  onRating: z.custom<(imageId: string, rating: number | null) => void>(),
});
export type LightboxRatingStarsProps = z.infer<typeof LightboxRatingStarsPropsSchema>;

export const LightboxDeleteControlPropsSchema = z.object({
  confirmingDelete: z.boolean(),
  deleting: z.boolean(),
  onRequestDelete: z.custom<() => void>(),
  onCancelDelete: z.custom<() => void>(),
  onConfirmDelete: z.custom<() => void>(),
});
export type LightboxDeleteControlProps = z.infer<typeof LightboxDeleteControlPropsSchema>;

export const LightboxHeaderPropsSchema = z.object({
  current: LightboxItemSchema,
  index: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
  playing: z.boolean(),
  setPlaying: z.custom<(update: boolean | ((p: boolean) => boolean)) => void>(),
  isFullscreen: z.boolean(),
  toggleFullscreen: z.custom<() => void>(),
  fullResolution: z.boolean(),
  onToggleFullResolution: z.custom<() => void>().optional(),
  onSimilar: z.custom<(item: LightboxItem) => void>().optional(),
  detailsOpen: z.boolean(),
  setDetailsOpen: z.custom<(update: boolean | ((v: boolean) => boolean)) => void>(),
  onRating: z.custom<(imageId: string, rating: number | null) => void>().optional(),
  fetchNotes: z.custom<(imageId: string) => Promise<LightboxNote[]>>().optional(),
  notesOpen: z.boolean(),
  setNotesOpen: z.custom<(update: boolean | ((v: boolean) => boolean)) => void>(),
  notesCount: z.number(),
  onDelete: z.custom<(imageId: string) => Promise<void>>().optional(),
  confirmingDelete: z.boolean(),
  setConfirmingDelete: z.custom<(update: boolean | ((v: boolean) => boolean)) => void>(),
  deleting: z.boolean(),
  handleDelete: z.custom<() => Promise<void>>(),
  onClose: z.custom<() => void>(),
});
export type LightboxHeaderProps = z.infer<typeof LightboxHeaderPropsSchema>;

// ---------------------------------------------------------------------------
// Notes panel
// ---------------------------------------------------------------------------

export const LightboxNotesPanelPropsSchema = z.object({
  current: LightboxItemSchema,
  notes: z.array(LightboxNoteSchema),
  notesLoading: z.boolean(),
  noteDraft: z.string(),
  setNoteDraft: z.custom<(v: string) => void>(),
  noteSaving: z.boolean(),
  setNoteSaving: z.custom<(v: boolean) => void>(),
  setNotes: z.custom<(notes: LightboxNote[]) => void>(),
  fetchNotes: z.custom<(imageId: string) => Promise<LightboxNote[]>>(),
  onCreateNote: z.custom<(imageId: string, text: string) => Promise<void>>().optional(),
});
export type LightboxNotesPanelProps = z.infer<typeof LightboxNotesPanelPropsSchema>;

export const LightboxNotesSlotPropsSchema = LightboxNotesPanelPropsSchema.extend({
  notesOpen: z.boolean(),
  fetchNotes: z.custom<(imageId: string) => Promise<LightboxNote[]>>().optional(),
});
export type LightboxNotesSlotProps = z.infer<typeof LightboxNotesSlotPropsSchema>;

export const LightboxBodyPropsSchema = z.object({
  current: LightboxItemSchema,
  fullResolution: z.boolean(),
  imgLoaded: z.boolean(),
  setImgLoaded: z.custom<(v: boolean) => void>(),
  imgError: z.boolean(),
  setImgError: z.custom<(v: boolean) => void>(),
  atStart: z.boolean(),
  atEnd: z.boolean(),
  go: z.custom<(dir: 1 | -1) => void>(),
  onClose: z.custom<() => void>(),
  detailsOpen: z.boolean(),
  detailLoading: z.boolean(),
  detailError: z.boolean(),
  detail: z.custom<ImageDetail>().nullable(),
});
export type LightboxBodyProps = z.infer<typeof LightboxBodyPropsSchema>;

export const LightboxDetailsSlotPropsSchema = z.object({
  detailsOpen: z.boolean(),
  detailLoading: z.boolean(),
  detailError: z.boolean(),
  detail: z.custom<ImageDetail>().nullable(),
  imageId: z.string(),
});
export type LightboxDetailsSlotProps = z.infer<typeof LightboxDetailsSlotPropsSchema>;

// ---------------------------------------------------------------------------
// Stage — main image area
// ---------------------------------------------------------------------------

export const StageBadgesPropsSchema = z.object({
  fullResolution: z.boolean(),
  score: z.number().nullable().optional(),
});
export type StageBadgesProps = z.infer<typeof StageBadgesPropsSchema>;

export const TouchPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type TouchPoint = z.infer<typeof TouchPointSchema>;

export const LightboxStagePropsSchema = z.object({
  current: LightboxItemSchema,
  fullResolution: z.boolean(),
  imgLoaded: z.boolean(),
  setImgLoaded: z.custom<(v: boolean) => void>(),
  imgError: z.boolean(),
  setImgError: z.custom<(v: boolean) => void>(),
  atStart: z.boolean(),
  atEnd: z.boolean(),
  go: z.custom<(dir: 1 | -1) => void>(),
  onClose: z.custom<() => void>(),
});
export type LightboxStageProps = z.infer<typeof LightboxStagePropsSchema>;

// ---------------------------------------------------------------------------
// Filmstrip
// ---------------------------------------------------------------------------

export const LightboxFilmstripPropsSchema = z.object({
  items: z.array(LightboxItemSchema),
  index: z.number(),
  hasMore: z.boolean(),
  loadingMore: z.boolean(),
  onLoadMore: z.custom<() => void>(),
  setCurrentId: z.custom<(id: string) => void>(),
  stripRef: z.custom<React.RefObject<HTMLDivElement | null>>(),
});
export type LightboxFilmstripProps = z.infer<typeof LightboxFilmstripPropsSchema>;
