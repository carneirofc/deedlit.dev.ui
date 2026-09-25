"use client";

import { z } from "zod";

import { Gallery, type GalleryItemContext } from "@carneirofc/ui";

import type { CompactResult } from "@/lib/library/schemas";
import { pillBtnClass } from "@/lib/ui/buttonStyles";
import { gridColumnsClass, masonryColumnsClass } from "@/lib/store/settings";
import type { GridDensity, ViewMode } from "@/lib/store/settings";

import { CardMeta } from "./ResultCardMeta";
import type { GroupSection } from "./schemas";

const ResultGalleryPropsSchema = z.object({
  items: z.array(z.custom<CompactResult>()),
  baseOffset: z.number(),
  viewMode: z.custom<ViewMode>(),
  gridDensity: z.custom<GridDensity>(),
  limit: z.number(),
  showCardMeta: z.boolean(),
  showScores: z.boolean(),
  selectMode: z.boolean(),
  isSelected: z.custom<(id: string) => boolean>(),
  onToggleSelect: z.custom<(id: string) => void>(),
  onOpen: z.custom<(index: number) => void>(),
  onFindSimilar: z.custom<(id: string, thumbUrl: string, summary: string) => void>(),
});
type ResultGalleryProps = z.infer<typeof ResultGalleryPropsSchema>;

function ResultMedia(r: CompactResult, ctx: GalleryItemContext, limit: number) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={r.gridUrl ?? r.thumbnailUrl}
      alt={r.summary}
      // Native lazy-loading is unreliable across a client-side route transition:
      // the browser's viewport-distance check can run before the new page's
      // layout has settled and never fires again. Eager-load the first fetched
      // page and keep native lazy loading for rows pulled in later via scroll.
      loading={ctx.index < limit ? "eager" : "lazy"}
      decoding="async"
      className={
        ctx.viewMode === "list"
          ? "h-16 w-16 rounded-lg object-cover sm:h-20 sm:w-20"
          : ctx.viewMode === "masonry"
            ? "w-full object-cover"
            : "aspect-square w-full object-cover"
      }
    />
  );
}

function ResultListMeta(r: CompactResult, ctx: GalleryItemContext, showCardMeta: boolean, showScores: boolean) {
  return (
    <>
      <a
        data-testid={`library-image-card-link-${r.imageId}`}
        href={`/library/${r.imageId}`}
        onClick={(e) => {
          if (ctx.selectMode) {
            e.preventDefault();
            ctx.open();
            return;
          }
          // Ctrl/Cmd+click selects (mirrors the media click); other modified /
          // middle clicks open the detail page normally.
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            ctx.toggleSelect();
            return;
          }
          if (e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          ctx.open();
        }}
        className={`block ${ctx.selectMode ? "cursor-pointer" : "cursor-zoom-in"}`}
      >
        <p className="line-clamp-2 text-ui-sm text-ui-ink">{r.summary}</p>
      </a>
      {showCardMeta && <CardMeta r={r} showScores={showScores} />}
    </>
  );
}

function ResultMeta(r: CompactResult, ctx: GalleryItemContext, showCardMeta: boolean, showScores: boolean) {
  if (ctx.viewMode === "list") return ResultListMeta(r, ctx, showCardMeta, showScores);
  if (!showCardMeta) return null;
  return (
    <div className="p-2">
      <p className="line-clamp-2 text-ui-xs text-ui-ink">{r.summary}</p>
      <CardMeta r={r} showScores={showScores} />
    </div>
  );
}

function SimilarOverlayButton(r: CompactResult, onFindSimilar: ResultGalleryProps["onFindSimilar"]) {
  return (
    <button
      data-testid={`library-image-card-similar-${r.imageId}`}
      onClick={() => onFindSimilar(r.imageId, r.thumbnailUrl, r.summary)}
      className={pillBtnClass}
      title="Find similar images"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      Similar
    </button>
  );
}

/** One result grid, rendered once for the flat list or once per folder
 * section; `baseOffset` maps a section-local card index back to the global
 * gallery index so the lightbox/slideshow open the right image. */
export function ResultGallery(props: ResultGalleryProps) {
  const { items, baseOffset, viewMode, gridDensity, limit, showCardMeta, showScores, selectMode, isSelected, onToggleSelect, onOpen, onFindSimilar } = props;
  return (
    <Gallery
      items={items}
      getKey={(r) => r.imageId}
      viewMode={viewMode}
      windowing={{ pageSize: Math.max(1, limit), pages: 5 }}
      gridClassName={`grid ${gridColumnsClass(gridDensity)} gap-3`}
      masonryClassName={`${masonryColumnsClass(gridDensity)} gap-3`}
      cardClassName={
        viewMode === "list"
          ? "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-2 transition hover:border-accent-cyan"
          : "overflow-hidden rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 transition hover:border-accent-cyan"
      }
      mediaClassName={selectMode ? "cursor-pointer" : "cursor-zoom-in"}
      getHref={(r) => `/library/${r.imageId}`}
      onOpen={(i) => onOpen(baseOffset + i)}
      selectMode={selectMode}
      isSelected={(r) => isSelected(r.imageId)}
      onToggleSelect={(r) => onToggleSelect(r.imageId)}
      selectOnCtrlClick
      renderMedia={(r, ctx) => ResultMedia(r, ctx, limit)}
      renderMeta={(r, ctx) => ResultMeta(r, ctx, showCardMeta, showScores)}
      renderOverlay={(r) => SimilarOverlayButton(r, onFindSimilar)}
    />
  );
}

const ResultsGroupPropsSchema = z.object({
  section: z.custom<GroupSection>(),
  collapsed: z.boolean(),
  total: z.number().optional(),
  onToggle: z.custom<() => void>(),
});
type ResultsGroupProps = z.infer<typeof ResultsGroupPropsSchema>;

function ResultsGroupHeader({ section, collapsed, total, onToggle }: ResultsGroupProps) {
  const label = section.key || "No directory";
  return (
    <button
      data-testid={`library-group-toggle-${section.key}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-ui-border/50 bg-ui-bg-soft/40 px-3 py-2 text-left transition hover:border-accent-cyan/60"
      title={label}
    >
      <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 text-ui-ink-muted transition-transform ${collapsed ? "" : "rotate-90"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ui-ink-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-ui-sm font-medium text-ui-ink">{label}</span>
      <span className="shrink-0 rounded-full bg-ui-bg px-2 py-0.5 text-ui-2xs text-ui-ink-muted">
        {total != null && total !== section.items.length ? `${section.items.length} of ${total}` : section.items.length}
      </span>
    </button>
  );
}

const GroupedResultsPropsSchema = z.object({
  sections: z.array(z.custom<GroupSection>()),
  collapsedDirs: z.custom<Set<string>>(),
  dirTotals: z.custom<Map<string, number>>(),
  onToggleDir: z.custom<(key: string) => void>(),
  galleryProps: z.custom<Omit<ResultGalleryProps, "items" | "baseOffset">>(),
});
type GroupedResultsProps = z.infer<typeof GroupedResultsPropsSchema>;

/** Folder-grouped variant of the results grid: one collapsible section per
 * source directory. */
export function GroupedResults({ sections, collapsedDirs, dirTotals, onToggleDir, galleryProps }: GroupedResultsProps) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((g) => {
        const collapsed = collapsedDirs.has(g.key);
        return (
          <section key={g.key || "__none"} className="flex min-w-0 flex-col gap-2">
            <ResultsGroupHeader section={g} collapsed={collapsed} total={dirTotals.get(g.key)} onToggle={() => onToggleDir(g.key)} />
            {!collapsed && <ResultGallery {...galleryProps} items={g.items} baseOffset={g.startOffset} />}
          </section>
        );
      })}
    </div>
  );
}

const LibraryResultsGridPropsSchema = z.object({
  show: z.boolean(),
  grouping: z.boolean(),
  sections: z.array(z.custom<GroupSection>()),
  collapsedDirs: z.custom<Set<string>>(),
  dirTotals: z.custom<Map<string, number>>(),
  onToggleDir: z.custom<(key: string) => void>(),
  displayResults: z.array(z.custom<CompactResult>()),
  galleryProps: z.custom<Omit<ResultGalleryProps, "items" | "baseOffset">>(),
});
type LibraryResultsGridProps = z.infer<typeof LibraryResultsGridPropsSchema>;

/** The results area: nothing while empty, one flat gallery in the default
 * layout, or folder-grouped sections when grouping is on. */
export function LibraryResultsGrid(props: LibraryResultsGridProps) {
  if (!props.show) return null;
  if (props.grouping) {
    return (
      <GroupedResults
        sections={props.sections}
        collapsedDirs={props.collapsedDirs}
        dirTotals={props.dirTotals}
        onToggleDir={props.onToggleDir}
        galleryProps={props.galleryProps}
      />
    );
  }
  return <ResultGallery {...props.galleryProps} items={props.displayResults} baseOffset={0} />;
}
