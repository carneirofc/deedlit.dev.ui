import { z } from "zod";

import { DbImageEditMeta } from "./DbImageEditMeta";
import { DbImageEditText } from "./DbImageEditText";
import { DbImageHeader } from "./DbImageHeader";
import { DbImageJsonPanels } from "./DbImageJsonPanels";
import { cls, sourcePath, type CatalogImage, type EditState } from "./schemas";

const DbImageDetailPropsSchema = z.object({
  selected: z.custom<CatalogImage | null>(),
  edit: z.custom<EditState | null>(),
  onEditChange: z.custom<(edit: EditState) => void>(),
  busy: z.boolean(),
  pathCopied: z.boolean(),
  onCopiedChange: z.custom<(copied: boolean) => void>(),
  onSave: z.custom<() => void>(),
  onReindex: z.custom<() => void>(),
  onRelabel: z.custom<() => void>(),
  onDeleteEverywhere: z.custom<() => void>(),
});
type DbImageDetailProps = z.infer<typeof DbImageDetailPropsSchema>;

function copyPath(selected: CatalogImage, onCopiedChange: (copied: boolean) => void) {
  navigator.clipboard
    ?.writeText(sourcePath(selected))
    .then(() => {
      onCopiedChange(true);
      setTimeout(() => onCopiedChange(false), 1500);
    })
    .catch(() => {});
}

export function DbImageDetail({
  selected,
  edit,
  onEditChange,
  busy,
  pathCopied,
  onCopiedChange,
  onSave,
  onReindex,
  onRelabel,
  onDeleteEverywhere,
}: DbImageDetailProps) {
  return (
    <section className={`${cls.card} min-w-0`} data-testid="db-detail">
      {!selected || !edit ? (
        <p className="text-ui-sm text-ui-ink-muted">Select an image to inspect and edit.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <DbImageHeader
            selected={selected}
            pathCopied={pathCopied}
            onCopyPath={() => copyPath(selected, onCopiedChange)}
            onReindex={onReindex}
            onRelabel={onRelabel}
            onDeleteEverywhere={onDeleteEverywhere}
          />
          <DbImageEditText edit={edit} onChange={onEditChange} />
          <DbImageEditMeta edit={edit} onChange={onEditChange} busy={busy} onSave={onSave} />
          {/* Raw JSON inspector */}
          <DbImageJsonPanels selected={selected} />
        </div>
      )}
    </section>
  );
}
