"use client";

import { z } from "zod";

import { GraphFilterPanel } from "@/app/library/components/GraphFilterPanel";
import { GraphScopeSchema, type Safety } from "@/lib/library/schemas";

import { SAFETY_CLASSES } from "./schemas";
import { SAFETY_LABEL } from "./constants-safety";

const EssentialFiltersPropsSchema = z.object({
  favorites: z.boolean(),
  onFavoritesChange: z.custom<(value: boolean) => void>(),
  minRating: z.number(),
  onMinRatingChange: z.custom<(value: number) => void>(),
  safety: z.array(z.custom<Safety>()),
  onSafetyChange: z.custom<(value: Safety[]) => void>(),
  graphScope: GraphScopeSchema.nullable(),
  onGraphScopeChange: z.custom<(scope: z.infer<typeof GraphScopeSchema> | null) => void>(),
  relatedImageId: z.string().optional(),
});
type EssentialFiltersProps = z.infer<typeof EssentialFiltersPropsSchema>;

/** Favorites + minimum rating + content-safety multi-select, plus the graph
 * (Neo4j) relationship filter. The always-visible essentials row of the
 * filter panel. */
export function EssentialFilters(props: EssentialFiltersProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-ui-xs text-ui-ink">
          <input
            data-testid="library-filter-favorites-checkbox"
            type="checkbox"
            checked={props.favorites}
            onChange={(e) => props.onFavoritesChange(e.target.checked)}
            className="rounded"
          />
          Favorites only
        </label>
        <select
          data-testid="library-filter-min-rating-select"
          className="rounded-lg border border-ui-border/70 bg-ui-bg px-2 py-2 text-ui-xs outline-none focus:border-accent-cyan"
          value={props.minRating}
          onChange={(e) => props.onMinRatingChange(Number(e.target.value))}
          aria-label="Minimum rating"
        >
          <option value={0}>Any rating</option>
          <option value={1}>★+</option>
          <option value={2}>★★+</option>
          <option value={3}>★★★+</option>
          <option value={4}>★★★★+</option>
          <option value={5}>★★★★★</option>
        </select>

        <span className="text-ui-2xs font-medium uppercase tracking-wide text-ui-ink-muted">Safety</span>
        {SAFETY_CLASSES.map((c) => {
          const on = props.safety.includes(c);
          return (
            <button
              key={c}
              type="button"
              data-testid={`library-filter-safety-${c}`}
              aria-pressed={on}
              onClick={() => props.onSafetyChange(on ? props.safety.filter((x) => x !== c) : [...props.safety, c])}
              className={`rounded-full border px-2.5 py-1 text-ui-2xs font-medium transition ${
                on ? "border-accent-cyan bg-accent-cyan/15 text-accent-cyan" : "border-ui-border/60 text-ui-ink-muted hover:text-ui-ink"
              }`}
            >
              {SAFETY_LABEL[c]}
            </button>
          );
        })}
      </div>

      <GraphFilterPanel value={props.graphScope} relatedImageId={props.relatedImageId} onChange={props.onGraphScopeChange} />
    </>
  );
}
