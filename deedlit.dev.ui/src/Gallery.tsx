"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

import { cn } from "./utils";

export const GalleryViewModeSchema = z.enum(["grid", "masonry", "list"]);
export type GalleryViewMode = z.infer<typeof GalleryViewModeSchema>;

/** Tuning for the always-on sliding window (see {@link GalleryProps.windowing}).
 *  `pageSize` is the fetch-page row count and `pages` how many pages stay mounted
 *  (default 5 — the current page plus two each side); both are optional and only
 *  refine the window so it tracks the caller's real fetch pages. */
export const GalleryWindowingSchema = z.object({
  pageSize: z.number().optional(),
  pages: z.number().optional(),
});
export type GalleryWindowing = z.infer<typeof GalleryWindowingSchema>;

// The window is ALWAYS active: only a window of items around the viewport is
// mounted so a large gallery never jams the page (the rest are spacers that hold
// the scroll height). It no-ops on its own when there are fewer than a window's
// worth of items. These defaults apply when the caller passes no `windowing`.
const DEFAULT_WINDOW_PAGES = 5;
const DEFAULT_WINDOW_PAGE_SIZE = 60;

/** Per-item context handed to every render slot. */
export const GalleryItemContextSchema = z.object({
  index: z.number(),
  viewMode: GalleryViewModeSchema,
  selected: z.boolean(),
  selectMode: z.boolean(),
  /** Open this item — in select mode this toggles selection instead. */
  open: z.custom<() => void>(),
  /** Toggle this item's selection regardless of mode (for Ctrl/Cmd+click). */
  toggleSelect: z.custom<() => void>(),
});
export type GalleryItemContext = z.infer<typeof GalleryItemContextSchema>;

// Non-generic own props. The item-shaped fields (`items`, `getKey`, callbacks and
// render slots) depend on the caller-supplied `T`, so they are intersected in via
// `Record<...>` below rather than a zod schema (zod schemas cannot be generic
// over a caller-supplied type parameter).
export const GalleryOwnPropsSchema = z.object({
  viewMode: GalleryViewModeSchema.optional(),
  /** Container class for the grid view (apps own their column scheme / density). */
  gridClassName: z.string().optional(),
  /** Container class for the masonry view (e.g. CSS columns). */
  masonryClassName: z.string().optional(),
  /** Container class for the list view. */
  listClassName: z.string().optional(),
  /** Multi-select (optional). */
  selectMode: z.boolean().optional(),
  /**
   * When set, a Ctrl/Cmd+click on an item toggles its selection (instead of
   * opening it / following the link) even when not already in select mode — the
   * app is expected to enter select mode off the resulting onToggleSelect.
   */
  selectOnCtrlClick: z.boolean().optional(),
  /** Theming for the item wrapper; apps pass their own chrome (border/bg/padding). */
  cardClassName: z.string().optional(),
  /** Extra classes when an item is selected. */
  selectedClassName: z.string().optional(),
  /** Classes for the clickable media wrapper (e.g. cursor affordance). */
  mediaClassName: z.string().optional(),
  className: z.string().optional(),
  /** Optional tuning for the always-on sliding window. The window is built in
   *  (bounded DOM for large result sets) — this only refines its size so it
   *  tracks the caller's real fetch pages; omit it to use the defaults. */
  windowing: GalleryWindowingSchema.optional(),
});
export type GalleryProps<T> = z.infer<typeof GalleryOwnPropsSchema> &
  Record<"items", T[]> &
  /** Stable React key (and identity) per item. */
  Record<"getKey", (item: T) => string> &
  /** The thumbnail / image. */
  Record<"renderMedia", (item: T, ctx: GalleryItemContext) => ReactNode> &
  /** Primary (unmodified) click on an item's media. */
  Partial<Record<"onOpen", (index: number, item: T) => void>> &
  /** When set, the media is an anchor so modified/middle clicks open in a new tab. */
  Partial<Record<"getHref", (item: T) => string | undefined>> &
  Partial<Record<"isSelected", (item: T) => boolean>> &
  Partial<Record<"onToggleSelect", (item: T) => void>> &
  /** Caption / meta rendered after the media (grid/masonry) or beside it (list). */
  Partial<Record<"renderMeta", (item: T, ctx: GalleryItemContext) => ReactNode>> &
  /** Hover actions — top-right in grid/masonry, row-end in list. */
  Partial<Record<"renderOverlay", (item: T, ctx: GalleryItemContext) => ReactNode>>;

const DEFAULT_SELECTED = "border-accent-cyan ring-2 ring-accent-cyan";

/** Left-click opens; modified clicks (Ctrl/Cmd/Shift/Alt/middle) fall through. */
function isPlainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

export const SelectCheckPropsSchema = z.object({ checked: z.boolean() });
export type SelectCheckProps = z.infer<typeof SelectCheckPropsSchema>;

/** Checkbox overlay shown on each card/row while in select mode. */
function SelectCheck({ checked }: SelectCheckProps) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded border transition",
        checked
          ? "border-accent-cyan bg-accent-cyan text-ui-bg-deep"
          : "border-ui-border/80 bg-ui-bg/80 text-transparent backdrop-blur-sm",
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5 9-11" />
      </svg>
    </span>
  );
}

// ── Sliding window ──────────────────────────────────────────────────────

export const GalleryGeomSchema = z.object({ cols: z.number(), rowH: z.number() });
type GalleryGeom = z.infer<typeof GalleryGeomSchema>;

export const GalleryRangeSchema = z.object({ start: z.number(), end: z.number() });
type GalleryRange = z.infer<typeof GalleryRangeSchema>;

/**
 * Reads column count + per-row pixel stride from the mounted cards (which carry
 * their absolute index), and the index of the item currently at the top of the
 * viewport. Self-corrects for any column scheme / density and after a resize.
 */
function measureGeometry(cards: NodeListOf<HTMLElement>) {
  const rects = Array.from(cards, (c) => c.getBoundingClientRect());
  const first = rects[0];

  // Columns = the number of distinct left edges among the mounted cards (the
  // grid's column count; 1 for the list view). Rounded to swallow sub-pixel drift.
  const cols = Math.max(1, new Set(rects.map((r) => Math.round(r.left))).size);

  // Per-row vertical stride, averaged over every mounted row rather than read
  // from the first pair, so it stays exact for a uniform grid and robust when
  // rows differ in height. Clamped to >= 1 so a not-yet-laid-out grid can never
  // divide by zero and strand the window.
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const rowsMounted = Math.max(1, Math.ceil(rects.length / cols));
  const rowH = Math.max(1, (bottom - first.top) / rowsMounted);

  // The first mounted card sits at viewport-Y `first.top`, so `-first.top`
  // pixels of grid lie above the viewport — that many rows of stride gives the
  // first item on screen.
  const firstIdx = Number(cards[0].dataset.index) || 0;
  const rowsAbove = Math.round(-first.top / rowH);
  const viewportFirst = Math.max(0, firstIdx + rowsAbove * cols);

  return { cols, rowH, viewportFirst };
}

/**
 * Only a contiguous window of items around the viewport is mounted; everything
 * above/below is collapsed into a spacer that holds the scroll height. The
 * window keeps ~2 pages above and below whatever's on screen (5 pages total by
 * default), so paging arbitrarily deep never grows the DOM. It engages
 * automatically once there are more items than fit one window, and is a no-op
 * below that.
 *
 * Masonry flows column-major (CSS multi-column), so a contiguous index slice
 * does NOT map to a vertical band of the viewport the way it does for a
 * row-major grid/list — windowing it strands blank columns as you scroll. The
 * window keys off row-major geometry, so it only engages for grid/list; masonry
 * renders every item (its variable heights already keep the DOM modest).
 */
/** rAF-coalesced wrapper: many scroll / resize / mutation signals collapse to
 *  one measure per frame. */
function useRafScheduler(callback: () => void): () => void {
  const rafRef = useRef(0);
  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      callback();
    });
  }, [callback]);
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );
  return schedule;
}

/**
 * A new result set (or a head splice that changes the first item) re-anchors
 * the window to the top; otherwise re-derive it from scroll on mount, on
 * viewport resize, and — via a ResizeObserver on the grid — whenever the
 * grid's own height changes.
 */
function useWindowRangeEffects<T>(
  containerRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  items: T[],
  firstKey: string,
  prevFirstKeyRef: React.RefObject<string | null>,
  windowCount: number,
  viewMode: GalleryViewMode,
  recompute: () => void,
  scheduleRecompute: () => void,
  setRange: (range: GalleryRange) => void,
) {
  // Layout effect so the window + spacers are right before paint (no flash,
  // no premature load-more).
  useLayoutEffect(() => {
    if (!enabled) {
      // No state to reset here: winStart/winEnd downstream already bypass
      // `range` entirely while disabled, so a stale value has no effect.
      prevFirstKeyRef.current = firstKey;
      return;
    }
    if (firstKey !== prevFirstKeyRef.current) {
      prevFirstKeyRef.current = firstKey;
      setRange({ start: 0, end: Math.min(items.length, windowCount) });
      // A remount or head splice can commit with the page already scrolled down
      // (browser scroll restoration on nav). Re-derive from the real scroll next
      // frame so the window tracks the viewport instead of staying at the top
      // showing a blank spacer.
      scheduleRecompute();
      return;
    }
    recompute();
  }, [
    enabled,
    firstKey,
    items.length,
    windowCount,
    viewMode,
    recompute,
    scheduleRecompute,
    prevFirstKeyRef,
    setRange,
  ]);

  // The mount-time call honours a scroll position already in place at mount
  // (nav restore) even if no scroll event ever fires.
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    window.addEventListener("scroll", scheduleRecompute, { passive: true });
    window.addEventListener("resize", scheduleRecompute);
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleRecompute) : null;
    ro?.observe(el as Element);
    scheduleRecompute();
    return () => {
      window.removeEventListener("scroll", scheduleRecompute);
      window.removeEventListener("resize", scheduleRecompute);
      ro?.disconnect();
    };
  }, [enabled, scheduleRecompute, containerRef]);
}

function getWindowConfig(windowing: GalleryWindowing | undefined) {
  const windowPages = windowing?.pages ?? DEFAULT_WINDOW_PAGES;
  const pageSize = windowing?.pageSize ?? DEFAULT_WINDOW_PAGE_SIZE;
  return { windowCount: windowPages * pageSize, behindCount: Math.floor((windowPages - 1) / 2) * pageSize };
}

/** The slice of items to mount for the current window. */
function computeSlice<T>(enabled: boolean, range: GalleryRange, items: T[], windowCount: number) {
  const winStart = enabled ? range.start : 0;
  const winEnd = enabled
    ? range.end > range.start
      ? range.end
      : Math.min(items.length, windowCount)
    : items.length;
  return { winStart, winEnd, sliceItems: enabled ? items.slice(winStart, winEnd) : items };
}

/** Spacer heights for the collapsed remainder above/below the mounted slice. */
function computeSpacers(enabled: boolean, geom: GalleryGeom, winStart: number, winEnd: number, itemCount: number) {
  const topSpacer = enabled && geom.rowH > 0 ? Math.floor(winStart / geom.cols) * geom.rowH : 0;
  const bottomSpacer =
    enabled && geom.rowH > 0 ? Math.ceil(Math.max(0, itemCount - winEnd) / geom.cols) * geom.rowH : 0;
  return { topSpacer, bottomSpacer };
}

function useGalleryWindow<T>(
  items: T[],
  getKey: (item: T) => string,
  viewMode: GalleryViewMode,
  masonry: boolean,
  windowing: GalleryWindowing | undefined,
) {
  const { windowCount, behindCount } = getWindowConfig(windowing);
  const enabled = !masonry && items.length > windowCount;

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Live grid geometry (columns + per-row pixel stride) measured from the DOM, so
  // spacer heights stay exact without hard-coding any column scheme.
  const [geom, setGeom] = useState<GalleryGeom>({ cols: 1, rowH: 0 });
  const [range, setRange] = useState<GalleryRange>({ start: 0, end: 0 });
  const prevFirstKey = useRef<string | null>(null);
  const firstKey = items.length ? getKey(items[0]) : "";

  // Re-derive the window from the current scroll position.
  const recompute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (items.length <= windowCount) {
      setRange((prev) => (prev.start === 0 && prev.end === items.length ? prev : { start: 0, end: items.length }));
      return;
    }
    const cards = el.querySelectorAll<HTMLElement>("[data-gallery-item]");
    if (cards.length === 0) return;
    const { cols, rowH, viewportFirst } = measureGeometry(cards);
    setGeom({ cols, rowH });

    let start = viewportFirst - behindCount;
    start = Math.max(0, Math.min(start, items.length - windowCount));
    start -= start % cols; // align to a full row so the top spacer is exact
    const end = Math.min(items.length, start + windowCount);
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [items.length, windowCount, behindCount]);

  const scheduleRecompute = useRafScheduler(recompute);
  useWindowRangeEffects(
    containerRef,
    enabled,
    items,
    firstKey,
    prevFirstKey,
    windowCount,
    viewMode,
    recompute,
    scheduleRecompute,
    setRange,
  );

  // Before the first measure (range.end === 0) fall back to the leading window
  // so the first paint is never blank.
  const { winStart, winEnd, sliceItems } = computeSlice(enabled, range, items, windowCount);
  const { topSpacer, bottomSpacer } = computeSpacers(enabled, geom, winStart, winEnd, items.length);

  return { containerRef, winStart, sliceItems, topSpacer, bottomSpacer };
}

/** A spacer must span every column so it offsets the grid/masonry as one block
 *  rather than occupying a single cell. */
function renderSpacer(key: string, height: number, list: boolean, masonry: boolean): ReactNode {
  if (height <= 0) return null;
  return (
    <div
      key={key}
      aria-hidden="true"
      data-gallery-spacer=""
      style={list ? { height } : masonry ? { height, columnSpan: "all" } : { height, gridColumn: "1 / -1" }}
    />
  );
}

// ── Ctrl/Cmd "arm to select" affordance ─────────────────────────────────

/**
 * While `selectOnCtrlClick` is on and we're not already in select mode, a held
 * Ctrl/Cmd "arms" selection: the next click toggles select instead of opening.
 * Window blur clears it (a missed keyup loses the state).
 */
function useCtrlArm(selectOnCtrlClick: boolean, selectMode: boolean): boolean {
  const [ctrlDown, setCtrlDown] = useState(false);
  useEffect(() => {
    // No state to reset here: the returned `armed` value below already masks
    // `ctrlDown` under the same `selectOnCtrlClick && !selectMode` condition,
    // so a stale value has no observable effect while disabled.
    if (!selectOnCtrlClick || selectMode) return;
    const sync = (e: KeyboardEvent) => setCtrlDown(e.ctrlKey || e.metaKey);
    const clear = () => setCtrlDown(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
    };
  }, [selectOnCtrlClick, selectMode]);
  return selectOnCtrlClick && !selectMode && ctrlDown;
}

// ── Per-item rendering ───────────────────────────────────────────────────

function buildItemContext<T>(
  item: T,
  index: number,
  viewMode: GalleryViewMode,
  selected: boolean,
  selectMode: boolean,
  onOpen: ((index: number, item: T) => void) | undefined,
  onToggleSelect: ((item: T) => void) | undefined,
): GalleryItemContext {
  return {
    index,
    viewMode,
    selected,
    selectMode,
    open: () => (selectMode ? onToggleSelect?.(item) : onOpen?.(index, item)),
    toggleSelect: () => onToggleSelect?.(item),
  };
}

function isCtrlSelectClick(
  e: React.MouseEvent,
  selectOnCtrlClick: boolean,
  onToggleSelect: unknown,
): boolean {
  return selectOnCtrlClick && !!onToggleSelect && (e.ctrlKey || e.metaKey);
}

/** Ctrl/Cmd+click selects the item (the app enters select mode off this) rather
 *  than opening it or following the link in a new tab. */
function createMediaClickHandler<T>(
  item: T,
  index: number,
  href: string | undefined,
  selectMode: boolean,
  selectOnCtrlClick: boolean,
  onOpen: ((index: number, item: T) => void) | undefined,
  onToggleSelect: ((item: T) => void) | undefined,
): (e: React.MouseEvent) => void {
  return (e) => {
    if (selectMode || isCtrlSelectClick(e, selectOnCtrlClick, onToggleSelect)) {
      e.preventDefault();
      onToggleSelect?.(item);
      return;
    }
    if (href && !isPlainClick(e)) return; // let the browser open the link
    e.preventDefault();
    onOpen?.(index, item);
  };
}

export const GalleryListItemPropsSchema = z.object({
  itemKey: z.string(),
  index: z.number(),
  cardClassName: z.string().optional(),
  selected: z.boolean(),
  selectedClassName: z.string(),
  armed: z.boolean(),
  check: z.custom<ReactNode>(),
  armHint: z.custom<ReactNode>(),
  media: z.custom<ReactNode>(),
  meta: z.custom<ReactNode>(),
  overlay: z.custom<ReactNode>(),
});
export type GalleryListItemProps = z.infer<typeof GalleryListItemPropsSchema>;

function GalleryListItem({
  itemKey,
  index,
  cardClassName,
  selected,
  selectedClassName,
  armed,
  check,
  armHint,
  media,
  meta,
  overlay,
}: GalleryListItemProps) {
  return (
    <div
      data-gallery-item=""
      data-testid={`gallery-item-${itemKey}`}
      data-index={index}
      className={cn(
        "group flex items-center gap-3",
        cardClassName,
        selected && selectedClassName,
        armed && "ring-1 ring-accent-cyan/30 hover:ring-2 hover:ring-accent-cyan/70",
      )}
    >
      {check}
      {armHint}
      {media}
      {meta}
      {overlay}
    </div>
  );
}

export const GalleryGridItemPropsSchema = z.object({
  itemKey: z.string(),
  index: z.number(),
  masonry: z.boolean(),
  cardClassName: z.string().optional(),
  selected: z.boolean(),
  selectedClassName: z.string(),
  armed: z.boolean(),
  media: z.custom<ReactNode>(),
  check: z.custom<ReactNode>(),
  armHint: z.custom<ReactNode>(),
  overlay: z.custom<ReactNode>(),
  meta: z.custom<ReactNode>(),
});
export type GalleryGridItemProps = z.infer<typeof GalleryGridItemPropsSchema>;

function GalleryGridItem({
  itemKey,
  index,
  masonry,
  cardClassName,
  selected,
  selectedClassName,
  armed,
  media,
  check,
  armHint,
  overlay,
  meta,
}: GalleryGridItemProps) {
  return (
    <div
      data-gallery-item=""
      data-testid={`gallery-item-${itemKey}`}
      data-index={index}
      className={cn(
        "group relative",
        masonry && "mb-3 break-inside-avoid",
        cardClassName,
        selected && selectedClassName,
        armed && "ring-1 ring-accent-cyan/30 hover:ring-2 hover:ring-accent-cyan/70",
      )}
    >
      {media}
      {check}
      {armHint}
      {overlay && (
        <div className="pointer-events-none absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {overlay}
        </div>
      )}
      {meta}
    </div>
  );
}

// Generic (over T) item props: the item-shaped fields mirror GalleryProps<T>
// above, intersected in via `Record<...>` for the same reason (see comment
// on GalleryProps).
export const GalleryItemOwnPropsSchema = z.object({
  index: z.number(),
  itemKey: z.string(),
  viewMode: GalleryViewModeSchema,
  list: z.boolean(),
  masonry: z.boolean(),
  selectMode: z.boolean(),
  selected: z.boolean(),
  armed: z.boolean(),
  href: z.string().optional(),
  selectOnCtrlClick: z.boolean(),
  cardClassName: z.string().optional(),
  selectedClassName: z.string(),
  mediaClassName: z.string().optional(),
});
type GalleryItemProps<T> = z.infer<typeof GalleryItemOwnPropsSchema> &
  Record<"item", T> &
  Record<"renderMedia", (item: T, ctx: GalleryItemContext) => ReactNode> &
  Partial<Record<"onOpen", (index: number, item: T) => void>> &
  Partial<Record<"onToggleSelect", (item: T) => void>> &
  Partial<Record<"renderMeta", (item: T, ctx: GalleryItemContext) => ReactNode>> &
  Partial<Record<"renderOverlay", (item: T, ctx: GalleryItemContext) => ReactNode>>;

/** The clickable media wrapper — an anchor when `href` is set (so modified /
 *  middle clicks open in a new tab), a button otherwise. */
function renderItemMedia(
  href: string | undefined,
  onMediaClick: (e: React.MouseEvent) => void,
  armTitle: string | undefined,
  itemKey: string,
  mediaClass: string,
  mediaInner: ReactNode,
): ReactNode {
  const testId = `gallery-item-media-${itemKey}`;
  return href ? (
    <a href={href} onClick={onMediaClick} title={armTitle} data-testid={testId} className={mediaClass}>
      {mediaInner}
    </a>
  ) : (
    <button type="button" onClick={onMediaClick} title={armTitle} data-testid={testId} className={cn(mediaClass, "text-left")}>
      {mediaInner}
    </button>
  );
}

/** Unchecked select-check shown while armed, as a "this will select" cue. */
function renderArmHint(armed: boolean, list: boolean): ReactNode {
  if (!armed) return null;
  return (
    <span
      className={cn(
        "pointer-events-none z-10 opacity-70 transition-opacity group-hover:opacity-100",
        list ? "shrink-0" : "absolute left-1.5 top-1.5",
      )}
      aria-hidden="true"
    >
      <SelectCheck checked={false} />
    </span>
  );
}

function renderSelectToggle<T>(
  item: T,
  selected: boolean,
  list: boolean,
  itemKey: string,
  onToggleSelect: ((item: T) => void) | undefined,
): ReactNode {
  return (
    <button
      type="button"
      onClick={() => onToggleSelect?.(item)}
      aria-pressed={selected}
      aria-label={selected ? "Deselect" : "Select"}
      data-testid={`gallery-item-select-${itemKey}`}
      className={list ? "shrink-0" : "absolute left-1.5 top-1.5 z-10"}
    >
      <SelectCheck checked={selected} />
    </button>
  );
}

/** Builds the render-slot outputs shared by both the list and grid/masonry layouts. */
function buildGalleryItemVisuals<T>(props: GalleryItemProps<T>) {
  const {
    item,
    index,
    itemKey,
    viewMode,
    list,
    selectMode,
    selected,
    armed,
    href,
    selectOnCtrlClick,
    mediaClassName,
    onOpen,
    onToggleSelect,
    renderMedia,
    renderMeta,
    renderOverlay,
  } = props;

  const ctx = buildItemContext(item, index, viewMode, selected, selectMode, onOpen, onToggleSelect);
  const onMediaClick = createMediaClickHandler(item, index, href, selectMode, selectOnCtrlClick, onOpen, onToggleSelect);
  // When armed (Ctrl/Cmd held, not yet in select mode) advertise the click:
  // pointer cursor + a hover hint. `cursor-pointer` is last so twMerge wins over
  // the app's cursor-zoom-in.
  const armTitle = armed ? "Ctrl/Cmd-click to select" : undefined;
  const mediaClass = cn("block", list && "shrink-0", mediaClassName, armed && "cursor-pointer");
  const media = renderItemMedia(href, onMediaClick, armTitle, itemKey, mediaClass, renderMedia(item, ctx));
  const armHint = renderArmHint(armed, list);
  const check = selectMode ? renderSelectToggle(item, selected, list, itemKey, onToggleSelect) : null;
  const overlay = !selectMode && renderOverlay ? renderOverlay(item, ctx) : null;
  const meta = renderMeta ? renderMeta(item, ctx) : null;

  return { media, armHint, check, overlay, meta };
}

function GalleryItem<T>(props: GalleryItemProps<T>) {
  const { itemKey, index, list, masonry, cardClassName, selected, selectedClassName, armed } = props;
  const { media, armHint, check, overlay, meta } = buildGalleryItemVisuals(props);

  if (list) {
    return (
      <GalleryListItem
        itemKey={itemKey}
        index={index}
        cardClassName={cardClassName}
        selected={selected}
        selectedClassName={selectedClassName}
        armed={armed}
        check={check}
        armHint={armHint}
        media={media}
        meta={meta && <div className="min-w-0 flex-1">{meta}</div>}
        overlay={overlay && <div className="shrink-0">{overlay}</div>}
      />
    );
  }

  return (
    <GalleryGridItem
      itemKey={itemKey}
      index={index}
      masonry={masonry}
      cardClassName={cardClassName}
      selected={selected}
      selectedClassName={selectedClassName}
      armed={armed}
      media={media}
      check={check}
      armHint={armHint}
      overlay={overlay}
      meta={meta}
    />
  );
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Generic, presentation-only media grid. Owns layout (grid / masonry / list),
 * the selection checkbox + ring, and click semantics (open vs. toggle-select,
 * with modified clicks falling through to a real link when `getHref` is given).
 * Everything domain-specific — what the thumbnail, caption and hover actions
 * look like — is supplied by the caller through render slots, so the component
 * carries no app data shape and no framework image dependency.
 */
/** Resolves the caller-facing defaults so the component body only deals with
 *  fully-resolved values. */
function resolveGalleryProps<T>(props: GalleryProps<T>) {
  const {
    viewMode = "grid",
    gridClassName = "grid gap-3",
    masonryClassName = "gap-3",
    listClassName = "flex flex-col gap-2",
    selectMode = false,
    selectOnCtrlClick = false,
    selectedClassName = DEFAULT_SELECTED,
  } = props;
  const list = viewMode === "list";
  const masonry = viewMode === "masonry";
  return {
    ...props,
    viewMode,
    gridClassName,
    masonryClassName,
    listClassName,
    selectMode,
    selectOnCtrlClick,
    selectedClassName,
    list,
    masonry,
    containerClass: list ? listClassName : masonry ? masonryClassName : gridClassName,
  };
}

/** Renders the mounted slice of `<GalleryItem>`s for the current window. */
function renderGalleryItems<T>(
  resolved: ReturnType<typeof resolveGalleryProps<T>>,
  winStart: number,
  sliceItems: T[],
  armed: boolean,
): ReactNode {
  const {
    getKey,
    viewMode,
    list,
    masonry,
    selectMode,
    isSelected,
    onToggleSelect,
    getHref,
    selectOnCtrlClick,
    cardClassName,
    selectedClassName,
    mediaClassName,
    onOpen,
    renderMedia,
    renderMeta,
    renderOverlay,
  } = resolved;

  return sliceItems.map((item, i) => {
    const index = winStart + i;
    const itemKey = getKey(item);
    return (
      <GalleryItem
        key={itemKey}
        item={item}
        index={index}
        itemKey={itemKey}
        viewMode={viewMode}
        list={list}
        masonry={masonry}
        selectMode={selectMode}
        selected={isSelected?.(item) ?? false}
        armed={armed}
        href={getHref?.(item)}
        selectOnCtrlClick={selectOnCtrlClick}
        cardClassName={cardClassName}
        selectedClassName={selectedClassName}
        mediaClassName={mediaClassName}
        onOpen={onOpen}
        onToggleSelect={onToggleSelect}
        renderMedia={renderMedia}
        renderMeta={renderMeta}
        renderOverlay={renderOverlay}
      />
    );
  });
}

export function Gallery<T>(rawProps: GalleryProps<T>) {
  const resolved = resolveGalleryProps(rawProps);
  const { items, getKey, viewMode, selectOnCtrlClick, selectMode, className, windowing, list, masonry, containerClass } =
    resolved;

  const { containerRef, winStart, sliceItems, topSpacer, bottomSpacer } = useGalleryWindow(
    items,
    getKey,
    viewMode,
    masonry,
    windowing,
  );
  const armed = useCtrlArm(selectOnCtrlClick, selectMode);

  return (
    <div ref={containerRef} className={cn(containerClass, className)}>
      {renderSpacer("__top", topSpacer, list, masonry)}
      {renderGalleryItems(resolved, winStart, sliceItems, armed)}
      {renderSpacer("__bottom", bottomSpacer, list, masonry)}
    </div>
  );
}

export default Gallery;
