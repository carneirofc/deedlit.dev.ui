import { z } from "zod";

import { CopyButton } from "@carneirofc/ui";

import { cls, sourcePath, type CatalogImage } from "./schemas";

const DbImageHeaderPropsSchema = z.object({
  selected: z.custom<CatalogImage>(),
  pathCopied: z.boolean(),
  onCopyPath: z.custom<() => void>(),
  onReindex: z.custom<() => void>(),
  onRelabel: z.custom<() => void>(),
  onDeleteEverywhere: z.custom<() => void>(),
});
type DbImageHeaderProps = z.infer<typeof DbImageHeaderPropsSchema>;

/** Thumbnail, per-image ops, and the originating filesystem path — the only
 * trace back to the source file on disk since the cross-service id is the
 * opaque sha256. */
export function DbImageHeader({
  selected,
  pathCopied,
  onCopyPath,
  onReindex,
  onRelabel,
  onDeleteEverywhere,
}: DbImageHeaderProps) {
  const path = sourcePath(selected);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/library/images/${selected.sha256}/thumbnail`}
        alt={selected.prompt ?? ""}
        className="max-h-72 w-full rounded-lg border border-ui-border/50 bg-ui-bg-soft object-contain"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-ui-2xs text-ui-ink-muted">{selected.sha256}</span>
        <div className="flex shrink-0 flex-wrap gap-1">
          <button className={cls.btn} onClick={onReindex} data-testid="db-reindex">
            Re-index
          </button>
          <button className={cls.btn} onClick={onRelabel} data-testid="db-relabel">
            Re-label
          </button>
          <button className={cls.danger} onClick={onDeleteEverywhere} data-testid="db-delete">
            Delete everywhere
          </button>
        </div>
      </div>

      {path && (
        <div className="rounded-lg border border-ui-border/40 bg-ui-bg p-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-ui-2xs font-medium uppercase tracking-wide text-ui-ink-muted">Source file</span>
            <CopyButton copied={pathCopied} aria-label="Copy source file path" onClick={onCopyPath} />
          </div>
          <p className="break-all font-mono text-ui-2xs text-ui-ink" title={path} data-testid="db-filepath">
            {path}
          </p>
        </div>
      )}
    </>
  );
}
