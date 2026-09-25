import { z } from "zod";

import { cls, SAFETY } from "./schemas";

const DbFiltersPropsSchema = z.object({
  tag: z.string(),
  onTagChange: z.custom<(value: string) => void>(),
  path: z.string(),
  onPathChange: z.custom<(value: string) => void>(),
  safety: z.string(),
  onSafetyChange: z.custom<(value: string) => void>(),
  favorite: z.boolean(),
  onFavoriteChange: z.custom<(value: boolean) => void>(),
  onApply: z.custom<() => void>(),
});
type DbFiltersProps = z.infer<typeof DbFiltersPropsSchema>;

export function DbFilters({
  tag,
  onTagChange,
  path,
  onPathChange,
  safety,
  onSafetyChange,
  favorite,
  onFavoriteChange,
  onApply,
}: DbFiltersProps) {
  return (
    <section className={cls.card} data-testid="db-filters">
      <div className="flex flex-wrap items-end gap-2">
        <input
          className={`${cls.input} max-w-[16rem]`}
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onApply()}
          placeholder="filter by tag"
          data-testid="db-tag"
        />
        <input
          className={`${cls.input} max-w-[18rem]`}
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onApply()}
          placeholder="filter by path (folder/filename fragment)"
          data-testid="db-path"
        />
        <select
          className={`${cls.input} max-w-[10rem]`}
          value={safety}
          onChange={(e) => onSafetyChange(e.target.value)}
          data-testid="db-safety"
        >
          {SAFETY.map((s) => (
            <option key={s} value={s}>
              {s || "any safety"}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-ui-xs text-ui-ink">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => onFavoriteChange(e.target.checked)}
            data-testid="db-favorite"
          />
          favorites only
        </label>
        <button className={cls.btn} onClick={onApply} data-testid="db-apply">
          Apply
        </button>
      </div>
    </section>
  );
}
