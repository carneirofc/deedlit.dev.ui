import { z } from "zod";

import { cls, type EditState } from "./schemas";

const DbImageEditTextPropsSchema = z.object({
  edit: z.custom<EditState>(),
  onChange: z.custom<(edit: EditState) => void>(),
});
type DbImageEditTextProps = z.infer<typeof DbImageEditTextPropsSchema>;

export function DbImageEditText({ edit, onChange }: DbImageEditTextProps) {
  return (
    <>
      <label className="text-ui-xs text-ui-ink-muted">
        prompt
        <textarea
          className={`${cls.input} mt-1 h-20`}
          value={edit.prompt}
          onChange={(e) => onChange({ ...edit, prompt: e.target.value })}
          data-testid="db-edit-prompt"
        />
      </label>
      <label className="text-ui-xs text-ui-ink-muted">
        negative
        <textarea
          className={`${cls.input} mt-1 h-16`}
          value={edit.negative}
          onChange={(e) => onChange({ ...edit, negative: e.target.value })}
          data-testid="db-edit-negative"
        />
      </label>
      <label className="text-ui-xs text-ui-ink-muted">
        tags (comma-separated)
        <input
          className={`${cls.input} mt-1`}
          value={edit.tags}
          onChange={(e) => onChange({ ...edit, tags: e.target.value })}
          data-testid="db-edit-tags"
        />
      </label>
    </>
  );
}
