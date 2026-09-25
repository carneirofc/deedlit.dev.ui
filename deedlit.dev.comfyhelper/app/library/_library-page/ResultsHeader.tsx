"use client";

import { z } from "zod";

import type { GroupByMode, SortMode, ViewMode } from "@/lib/store/settings";

import { SORT_LABEL } from "./constants";

const ResultsHeaderPropsSchema = z.object({
  resultCount: z.number(),
  hasMore: z.boolean(),
  selectMode: z.boolean(),
  onToggleSelectMode: z.custom<() => void>(),
  onStartSlideshow: z.custom<() => void>(),
  browsePath: z.boolean(),
  groupBy: z.custom<GroupByMode>(),
  onToggleGroupBy: z.custom<() => void>(),
  sortValue: z.custom<SortMode>(),
  sortOptions: z.array(z.custom<SortMode>()),
  onChangeSort: z.custom<(next: SortMode) => void>(),
  viewMode: z.custom<ViewMode>(),
  onChangeViewMode: z.custom<(next: ViewMode) => void>(),
});
type ResultsHeaderProps = z.infer<typeof ResultsHeaderPropsSchema>;

const VIEW_MODES: Array<[ViewMode, string]> = [
  ["grid", "Grid"],
  ["masonry", "Masonry"],
  ["list", "List"],
];

const SelectModeButtonPropsSchema = z.object({
  selectMode: z.boolean(),
  onToggle: z.custom<() => void>(),
  disabled: z.boolean(),
});
type SelectModeButtonProps = z.infer<typeof SelectModeButtonPropsSchema>;

function SelectModeButton({ selectMode, onToggle, disabled }: SelectModeButtonProps) {
  return (
    <button
      data-testid="library-select-mode-toggle"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selectMode}
      className={`flex items-center gap-1.5 rounded-lg border bg-ui-bg px-2.5 py-1.5 text-ui-2xs font-medium transition disabled:opacity-40 ${
        selectMode ? "border-accent-cyan text-accent-cyan" : "border-ui-border/60 text-ui-ink-muted hover:border-accent-cyan hover:text-accent-cyan"
      }`}
      title="Select multiple images for bulk actions (or Ctrl/Cmd+click a card)"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3 8-8" />
        <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
      </svg>
      {selectMode ? "Done" : "Select"}
    </button>
  );
}

const GroupByTogglePropsSchema = z.object({
  browsePath: z.boolean(),
  groupBy: z.custom<GroupByMode>(),
  onToggle: z.custom<() => void>(),
});
type GroupByToggleProps = z.infer<typeof GroupByTogglePropsSchema>;

function GroupByToggle({ browsePath, groupBy, onToggle }: GroupByToggleProps) {
  if (!browsePath) return null;
  return (
    <button
      data-testid="library-group-by-folder-toggle"
      onClick={onToggle}
      aria-pressed={groupBy === "folder"}
      className={`flex items-center gap-1.5 rounded-lg border bg-ui-bg px-2.5 py-1.5 text-ui-2xs font-medium transition ${
        groupBy === "folder" ? "border-accent-cyan text-accent-cyan" : "border-ui-border/60 text-ui-ink-muted hover:border-accent-cyan hover:text-accent-cyan"
      }`}
      title="Split results into collapsible sections by source directory"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      {groupBy === "folder" ? "Grouped" : "Group"}
    </button>
  );
}

const ViewModeTogglePropsSchema = z.object({
  viewMode: z.custom<ViewMode>(),
  onChange: z.custom<(v: ViewMode) => void>(),
});
type ViewModeToggleProps = z.infer<typeof ViewModeTogglePropsSchema>;

function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-ui-border/60 bg-ui-bg p-0.5" role="group" aria-label="Result layout">
      {VIEW_MODES.map(([v, label]) => (
        <button
          key={v}
          data-testid={`library-view-mode-${v}`}
          onClick={() => onChange(v)}
          aria-pressed={viewMode === v}
          className={`rounded-md px-2 py-1 text-ui-2xs font-medium transition ${
            viewMode === v ? "bg-accent-cyan/15 text-accent-cyan" : "text-ui-ink-muted hover:text-ui-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Result count title + the toolbar of grid-level actions: select mode,
 * slideshow, folder grouping, sort, and view mode. */
export function ResultsHeader(props: ResultsHeaderProps) {
  const { resultCount, hasMore, selectMode, onToggleSelectMode, onStartSlideshow } = props;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Image Library</h1>
        <p className="text-ui-sm text-ui-ink-muted">
          {resultCount > 0 ? `${resultCount}${hasMore ? "+" : ""} images` : "Browse, search & curate your generated images"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SelectModeButton selectMode={selectMode} onToggle={onToggleSelectMode} disabled={resultCount === 0} />
        <button
          data-testid="library-slideshow-start"
          onClick={onStartSlideshow}
          disabled={resultCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-ui-border/60 bg-ui-bg px-2.5 py-1.5 text-ui-2xs font-medium text-ui-ink-muted transition hover:border-accent-cyan hover:text-accent-cyan disabled:opacity-40"
          title="Play all results as a slideshow"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Slideshow
        </button>
        <GroupByToggle browsePath={props.browsePath} groupBy={props.groupBy} onToggle={props.onToggleGroupBy} />
        <label className="flex items-center gap-1.5 rounded-lg border border-ui-border/60 bg-ui-bg px-2 py-1 text-ui-2xs text-ui-ink-muted">
          <span className="hidden sm:inline">Sort</span>
          <select
            data-testid="library-sort-select"
            value={props.sortValue}
            onChange={(e) => props.onChangeSort(e.target.value as SortMode)}
            className="bg-transparent text-ui-2xs font-medium text-ui-ink outline-none"
            aria-label="Sort results"
          >
            {props.sortOptions.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <ViewModeToggle viewMode={props.viewMode} onChange={props.onChangeViewMode} />
      </div>
    </header>
  );
}
