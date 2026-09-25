"use client";

import { z } from "zod";

import { TagSelect } from "@carneirofc/ui";

import { TAG_CHIP_PREVIEW } from "./constants";

const TagFiltersPropsSchema = z.object({
  tags: z.array(z.string()),
  onTagsChange: z.custom<(next: string[]) => void>(),
  onCommitTags: z.custom<(next: string[]) => void>(),
  allTags: z.array(z.string()),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
  showAllTagChips: z.boolean(),
  onToggleShowAllTagChips: z.custom<() => void>(),
});
type TagFiltersProps = z.infer<typeof TagFiltersPropsSchema>;

function PopularTagChips(props: TagFiltersProps) {
  if (props.allTags.length === 0) return null;
  const visible = props.showAllTagChips ? props.allTags : props.allTags.slice(0, TAG_CHIP_PREVIEW);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui-2xs font-medium uppercase tracking-wide text-ui-ink-muted">Popular tags</span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((t) => {
          const on = props.tags.some((x) => x.toLowerCase() === t.toLowerCase());
          return (
            <button
              key={t}
              type="button"
              data-testid={`library-tag-chip-${t}`}
              aria-pressed={on}
              onClick={() => {
                const next = on ? props.tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...props.tags, t];
                props.onTagsChange(next);
                props.onCommitTags(next);
              }}
              className={`rounded-full border px-2.5 py-1 text-ui-2xs font-medium transition ${
                on ? "border-accent-cyan bg-accent-cyan/15 text-accent-cyan" : "border-ui-border/60 text-ui-ink-muted hover:border-accent-cyan/60 hover:text-ui-ink"
              }`}
            >
              {t}
            </button>
          );
        })}
        {props.allTags.length > TAG_CHIP_PREVIEW && (
          <button
            type="button"
            data-testid="library-tag-chips-expand"
            onClick={props.onToggleShowAllTagChips}
            className="rounded-full px-2.5 py-1 text-ui-2xs font-medium text-accent-cyan/80 transition hover:text-accent-cyan"
          >
            {props.showAllTagChips ? "show less" : `+${props.allTags.length - TAG_CHIP_PREVIEW} more`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Primary tag filter: shows the whole tag catalog to pick from (ranked
 * most-used first); typing just narrows the list. Adding/removing a chip
 * re-searches instantly. Falls back to live prefix type-ahead until the
 * catalog has loaded. Renders the always-visible "popular tags" chip cloud
 * beneath it. */
export function TagFilters(props: TagFiltersProps) {
  return (
    <>
      <TagSelect
        value={props.tags}
        onChange={props.onTagsChange}
        onCommit={props.onCommitTags}
        suggestions={props.allTags}
        fetchSuggestions={props.allTags.length ? undefined : props.fetchTagSuggestions}
        maxSuggestions={500}
        placeholder="filter by tag — pick from the list, or type to narrow…"
        variant="include"
      />
      <PopularTagChips {...props} />
    </>
  );
}
