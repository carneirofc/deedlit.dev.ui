import { z } from "zod";

import { cls, SAFETY, type EditState } from "./schemas";

const DbImageEditMetaPropsSchema = z.object({
  edit: z.custom<EditState>(),
  onChange: z.custom<(edit: EditState) => void>(),
  busy: z.boolean(),
  onSave: z.custom<() => void>(),
});
type DbImageEditMetaProps = z.infer<typeof DbImageEditMetaPropsSchema>;

export function DbImageEditMeta({ edit, onChange, busy, onSave }: DbImageEditMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-ui-xs text-ui-ink-muted">
        safety
        <select
          className={`${cls.input} mt-1`}
          value={edit.safety}
          onChange={(e) => onChange({ ...edit, safety: e.target.value })}
          data-testid="db-edit-safety"
        >
          {SAFETY.map((s) => (
            <option key={s} value={s}>
              {s || "(unset)"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-ui-xs text-ui-ink-muted">
        rating
        <input
          type="number"
          min={0}
          max={5}
          className={`${cls.input} mt-1 w-20`}
          value={edit.rating}
          onChange={(e) => onChange({ ...edit, rating: e.target.value })}
          data-testid="db-edit-rating"
        />
      </label>
      <label className="mt-4 flex items-center gap-1.5 text-ui-xs text-ui-ink">
        <input
          type="checkbox"
          checked={edit.favorite}
          onChange={(e) => onChange({ ...edit, favorite: e.target.checked })}
          data-testid="db-edit-favorite"
        />
        favorite
      </label>
      <button className={`${cls.btn} mt-4`} onClick={onSave} disabled={busy} data-testid="db-save">
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
