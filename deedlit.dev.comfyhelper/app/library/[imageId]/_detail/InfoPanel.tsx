import { z } from "zod";

import { CopyButton } from "@carneirofc/ui";

import type { ImageDetail } from "@/lib/library/schemas";

import { panel } from "./styles";

const RatingStarsPropsSchema = z.object({
  rating: z.number().nullable(),
  busy: z.boolean(),
  onRate: z.custom<(rating: number | null) => void>(),
});
type RatingStarsProps = z.infer<typeof RatingStarsPropsSchema>;

function RatingStars({ rating, busy, onRate }: RatingStarsProps) {
  return (
    <div className="mt-2 flex items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onRate(rating === n ? null : n)}
          disabled={busy}
          className={`text-xl leading-none transition disabled:opacity-50 ${
            n <= (rating ?? 0)
              ? "text-amber-400 hover:text-amber-300"
              : "text-ui-ink-muted/30 hover:text-amber-400/70"
          }`}
          title={`${n}★${rating === n ? " — click to clear" : ""}`}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          data-testid={`image-detail-rate-star-${n}`}
        >
          ★
        </button>
      ))}
      {rating != null && (
        <button
          type="button"
          onClick={() => onRate(null)}
          disabled={busy}
          className="ml-1 text-ui-2xs text-ui-ink-muted/60 transition hover:text-rose-400 disabled:opacity-50"
          aria-label="Clear rating"
          title="Clear rating"
          data-testid="image-detail-clear-rating"
        >
          ✕
        </button>
      )}
    </div>
  );
}

const RemoveControlPropsSchema = z.object({
  confirming: z.boolean(),
  deleting: z.boolean(),
  onStart: z.custom<() => void>(),
  onConfirm: z.custom<() => void>(),
  onCancel: z.custom<() => void>(),
});
type RemoveControlProps = z.infer<typeof RemoveControlPropsSchema>;

function RemoveControl({ confirming, deleting, onStart, onConfirm, onCancel }: RemoveControlProps) {
  if (!confirming) {
    return (
      <button
        onClick={onStart}
        className="text-ui-xs text-rose-400 transition hover:text-rose-300"
        data-testid="image-detail-remove-start"
      >
        Remove from library
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ui-2xs text-ui-ink-muted">
        Remove this image&rsquo;s catalog record, search vector and graph
        links? The original file on disk is not deleted.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="rounded-lg bg-rose-500/90 px-2.5 py-1 text-ui-xs font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
          data-testid="image-detail-remove-confirm"
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
        <button
          onClick={onCancel}
          disabled={deleting}
          className="rounded-lg border border-ui-border/70 px-2.5 py-1 text-ui-xs transition hover:bg-ui-bg-soft disabled:opacity-60"
          data-testid="image-detail-remove-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const InfoPanelPropsSchema = z.object({
  detail: z.custom<ImageDetail>(),
  ratingBusy: z.boolean(),
  onRate: z.custom<(rating: number | null) => void>(),
  onToggleFavorite: z.custom<() => void>(),
  pathCopied: z.boolean(),
  onCopyPath: z.custom<() => void>(),
  confirmingDelete: z.boolean(),
  setConfirmingDelete: z.custom<(v: boolean) => void>(),
  deleting: z.boolean(),
  onRemove: z.custom<() => void>(),
});
type InfoPanelProps = z.infer<typeof InfoPanelPropsSchema>;

/** Filename/favorite header, star rating, core metadata, source path, and the
 * two-step "remove from library" control. */
export function InfoPanel({
  detail,
  ratingBusy,
  onRate,
  onToggleFavorite,
  pathCopied,
  onCopyPath,
  confirmingDelete,
  setConfirmingDelete,
  deleting,
  onRemove,
}: InfoPanelProps) {
  return (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <h1 className="truncate text-ui-lg font-semibold text-ui-ink-title">{detail.filename}</h1>
        <button onClick={onToggleFavorite} className="text-ui-xl" aria-label="favorite" data-testid="image-detail-favorite-toggle">
          {detail.favorite ? "★" : "☆"}
        </button>
      </div>

      <RatingStars rating={detail.rating} busy={ratingBusy} onRate={onRate} />

      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-ui-xs text-ui-ink-muted">
        <dt>Model</dt><dd className="break-words text-ui-ink">{detail.model ?? "—"}</dd>
        <dt>Family</dt><dd className="break-words text-ui-ink">{detail.modelFamily ?? "—"}</dd>
        <dt>Source</dt><dd className="break-words text-ui-ink">{detail.sourceTool ?? "—"}</dd>
        <dt>Size</dt><dd className="break-words text-ui-ink">{detail.width}×{detail.height}</dd>
      </dl>

      {/* Originating filesystem path, captured at ingest. The image's id is
          the opaque sha256, so this is the only way back to the source file
          on disk — surface it in full (and copyable), never truncated away. */}
      {detail.filePath && (
        <div className="mt-3 border-t border-ui-border/40 pt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-ui-2xs font-medium uppercase tracking-wide text-ui-ink-muted">
              Source file
            </p>
            <CopyButton
              copied={pathCopied}
              onClick={onCopyPath}
              aria-label="Copy source file path"
              data-testid="image-detail-copy-path"
            />
          </div>
          <p className="break-all font-mono text-ui-2xs text-ui-ink" title={detail.filePath}>
            {detail.filePath}
          </p>
        </div>
      )}

      <div className="mt-3 border-t border-ui-border/40 pt-3">
        <RemoveControl
          confirming={confirmingDelete}
          deleting={deleting}
          onStart={() => setConfirmingDelete(true)}
          onConfirm={onRemove}
          onCancel={() => setConfirmingDelete(false)}
        />
      </div>
    </div>
  );
}
