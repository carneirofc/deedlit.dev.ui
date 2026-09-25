"use client";

import { z } from "zod";

import { TagSelect } from "@carneirofc/ui";

import { cls } from "./constants";

const AdvancedFiltersPropsSchema = z.object({
  show: z.boolean(),
  onToggle: z.custom<() => void>(),
  pathFilter: z.string(),
  onPathFilterChange: z.custom<(value: string) => void>(),
  onCommitPathFilter: z.custom<(value: string) => void>(),
  excludeTags: z.array(z.string()),
  onExcludeTagsChange: z.custom<(next: string[]) => void>(),
  onCommitExcludeTags: z.custom<(next: string[]) => void>(),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
  modelFamily: z.string(),
  onModelFamilyChange: z.custom<(value: string) => void>(),
  onSearch: z.custom<() => void>(),
  checkpoint: z.string(),
  onCheckpointChange: z.custom<(value: string) => void>(),
  loras: z.string(),
  onLorasChange: z.custom<(value: string) => void>(),
  sourceTool: z.string(),
  onSourceToolChange: z.custom<(value: string) => void>(),
  limit: z.number(),
  onLimitChange: z.custom<(value: number) => void>(),
  minScore: z.number(),
  onMinScoreChange: z.custom<(value: number) => void>(),
});
type AdvancedFiltersProps = z.infer<typeof AdvancedFiltersPropsSchema>;

const AdvancedTogglePropsSchema = z.object({
  show: z.boolean(),
  onToggle: z.custom<() => void>(),
});
type AdvancedToggleProps = z.infer<typeof AdvancedTogglePropsSchema>;

function AdvancedToggle({ show, onToggle }: AdvancedToggleProps) {
  return (
    <button
      data-testid="library-advanced-filters-toggle"
      className="flex items-center gap-1.5 self-start text-ui-xs font-medium text-ui-ink-muted transition hover:text-ui-ink"
      onClick={onToggle}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 transition-transform ${show ? "rotate-90" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
      Advanced filters
    </button>
  );
}

const AdvancedFiltersPathSectionPropsSchema = z.object({
  pathFilter: z.string(),
  onPathFilterChange: z.custom<(value: string) => void>(),
  onCommitPathFilter: z.custom<(value: string) => void>(),
  excludeTags: z.array(z.string()),
  onExcludeTagsChange: z.custom<(next: string[]) => void>(),
  onCommitExcludeTags: z.custom<(next: string[]) => void>(),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
});
type AdvancedFiltersPathSectionProps = z.infer<typeof AdvancedFiltersPathSectionPropsSchema>;

function AdvancedFiltersPathSection(props: AdvancedFiltersPathSectionProps) {
  return (
    <>
      <label className={`${cls.label} col-span-full`}>
        Path contains
        <input
          data-testid="library-filter-path-input"
          className={cls.input}
          placeholder="folder or filename fragment — e.g. 2024/portraits or _upscaled"
          value={props.pathFilter}
          onChange={(e) => props.onPathFilterChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && props.onCommitPathFilter(e.currentTarget.value)}
        />
        <span className="text-ui-2xs normal-case tracking-normal text-ui-ink-muted/70">
          matches the on-disk image path (any separator); applies to plain browsing
        </span>
      </label>
      <label className={cls.label}>
        Exclude tags
        <TagSelect
          value={props.excludeTags}
          onChange={props.onExcludeTagsChange}
          onCommit={props.onCommitExcludeTags}
          fetchSuggestions={props.fetchTagSuggestions}
          maxSuggestions={50}
          placeholder="tags to hide…"
          variant="exclude"
        />
      </label>
    </>
  );
}

const AdvancedFiltersModelSectionPropsSchema = z.object({
  modelFamily: z.string(),
  onModelFamilyChange: z.custom<(value: string) => void>(),
  onSearch: z.custom<() => void>(),
  checkpoint: z.string(),
  onCheckpointChange: z.custom<(value: string) => void>(),
  loras: z.string(),
  onLorasChange: z.custom<(value: string) => void>(),
  sourceTool: z.string(),
  onSourceToolChange: z.custom<(value: string) => void>(),
});
type AdvancedFiltersModelSectionProps = z.infer<typeof AdvancedFiltersModelSectionPropsSchema>;

function AdvancedFiltersModelSection(props: AdvancedFiltersModelSectionProps) {
  return (
    <>
      <label className={cls.label}>
        Model family
        <input
          data-testid="library-filter-model-family-input"
          className={cls.input}
          placeholder="sdxl, pony, flux…"
          value={props.modelFamily}
          onChange={(e) => props.onModelFamilyChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && props.onSearch()}
        />
      </label>
      <label className={cls.label}>
        Checkpoint
        <input
          data-testid="library-filter-checkpoint-input"
          className={cls.input}
          placeholder="checkpoint name…"
          value={props.checkpoint}
          onChange={(e) => props.onCheckpointChange(e.target.value)}
        />
      </label>
      <label className={cls.label}>
        LoRAs
        <input
          data-testid="library-filter-loras-input"
          className={cls.input}
          placeholder="comma-separated"
          value={props.loras}
          onChange={(e) => props.onLorasChange(e.target.value)}
        />
      </label>
      <label className={cls.label}>
        Source tool
        <input
          data-testid="library-filter-source-tool-input"
          className={cls.input}
          placeholder="comfyui, a1111…"
          value={props.sourceTool}
          onChange={(e) => props.onSourceToolChange(e.target.value)}
        />
      </label>
    </>
  );
}

const AdvancedFiltersRangeSectionPropsSchema = z.object({
  limit: z.number(),
  onLimitChange: z.custom<(value: number) => void>(),
  minScore: z.number(),
  onMinScoreChange: z.custom<(value: number) => void>(),
});
type AdvancedFiltersRangeSectionProps = z.infer<typeof AdvancedFiltersRangeSectionPropsSchema>;

function AdvancedFiltersRangeSection(props: AdvancedFiltersRangeSectionProps) {
  return (
    <>
      <label className={cls.label}>
        Results: {props.limit}
        <input
          data-testid="library-filter-limit-range"
          type="range"
          min={10}
          max={200}
          step={10}
          value={props.limit}
          onChange={(e) => props.onLimitChange(Number(e.target.value))}
          className="accent-accent-cyan"
        />
      </label>
      <label className={cls.label}>
        Min similarity: {props.minScore.toFixed(2)}
        <input
          data-testid="library-filter-min-score-range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={props.minScore}
          onChange={(e) => props.onMinScoreChange(Number(e.target.value))}
          className="accent-accent-cyan"
        />
        <span className="text-ui-2xs normal-case tracking-normal text-ui-ink-muted/70">applies to similar / by-image</span>
      </label>
    </>
  );
}

/** The "Advanced filters" panel: path/model/checkpoint/LoRA/source-tool +
 * result-count and similarity-threshold sliders, behind an expand toggle. */
export function AdvancedFilters(props: AdvancedFiltersProps) {
  return (
    <>
      <AdvancedToggle show={props.show} onToggle={props.onToggle} />
      {props.show && (
        <div className="grid gap-3 rounded-lg border border-ui-border/40 bg-ui-bg/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <p className="col-span-full text-ui-2xs text-ui-ink-muted/70">
            Tags, rating, favorite, safety & path filter plain browsing too. Model, checkpoint, LoRA & source-tool apply when a
            text or image search is active.
          </p>
          <AdvancedFiltersPathSection
            pathFilter={props.pathFilter}
            onPathFilterChange={props.onPathFilterChange}
            onCommitPathFilter={props.onCommitPathFilter}
            excludeTags={props.excludeTags}
            onExcludeTagsChange={props.onExcludeTagsChange}
            onCommitExcludeTags={props.onCommitExcludeTags}
            fetchTagSuggestions={props.fetchTagSuggestions}
          />
          <AdvancedFiltersModelSection
            modelFamily={props.modelFamily}
            onModelFamilyChange={props.onModelFamilyChange}
            onSearch={props.onSearch}
            checkpoint={props.checkpoint}
            onCheckpointChange={props.onCheckpointChange}
            loras={props.loras}
            onLorasChange={props.onLorasChange}
            sourceTool={props.sourceTool}
            onSourceToolChange={props.onSourceToolChange}
          />
          <AdvancedFiltersRangeSection
            limit={props.limit}
            onLimitChange={props.onLimitChange}
            minScore={props.minScore}
            onMinScoreChange={props.onMinScoreChange}
          />
        </div>
      )}
    </>
  );
}
