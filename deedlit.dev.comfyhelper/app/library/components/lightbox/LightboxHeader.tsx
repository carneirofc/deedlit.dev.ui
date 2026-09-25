"use client";

import Link from "next/link";

import { ctrlBtnClass, pillBtnClass } from "@/lib/ui/buttonStyles";

import type {
  LightboxDeleteControlProps,
  LightboxHeaderInfoProps,
  LightboxHeaderProps,
  LightboxRatingStarsProps,
} from "./schemas";

const ctrlBtn = ctrlBtnClass;
const pillBtn = pillBtnClass;

function LightboxHeaderInfo({ index, total, hasMore, summary }: LightboxHeaderInfoProps) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-3 pt-1">
      <span className="shrink-0 rounded-lg bg-ui-bg/60 px-2 py-1 text-ui-xs font-medium tabular-nums text-ui-ink-muted">
        {index + 1} / {total}
        {hasMore ? "+" : ""}
      </span>
      <p className="hidden min-w-0 truncate text-ui-sm text-ui-ink-muted lg:block">{summary}</p>
    </div>
  );
}

function LightboxRatingStars({ imageId, rating, onRating }: LightboxRatingStarsProps) {
  return (
    <div className="flex h-9 items-center gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onRating(imageId, rating === n ? null : n)}
          className={`text-base leading-none transition ${
            n <= (rating ?? 0) ? "text-amber-400 hover:text-amber-300" : "text-ui-ink-muted/30 hover:text-amber-400/70"
          }`}
          title={`${n}★${rating === n ? " — click to clear" : ""}`}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          data-testid={`lightbox-rate-star-${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function LightboxDeleteControl({
  confirmingDelete,
  deleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: LightboxDeleteControlProps) {
  if (!confirmingDelete) {
    return (
      <button
        type="button"
        onClick={onRequestDelete}
        className={`${ctrlBtn} hover:border-rose-500/70 hover:text-rose-400`}
        aria-label="Delete image"
        title="Delete this image from the library"
        data-testid="lightbox-delete-request"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onConfirmDelete}
        disabled={deleting}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-rose-500/90 px-3 text-ui-2xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
        title="Remove this image from the library (original kept on disk)"
        data-testid="lightbox-delete-confirm"
      >
        {deleting ? "Removing…" : "Delete?"}
      </button>
      <button
        type="button"
        onClick={onCancelDelete}
        disabled={deleting}
        className={ctrlBtn}
        aria-label="Cancel delete"
        title="Cancel"
        data-testid="lightbox-delete-cancel"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function LightboxDeleteSlot({
  onDelete,
  confirmingDelete,
  setConfirmingDelete,
  deleting,
  handleDelete,
}: Pick<LightboxHeaderProps, "onDelete" | "confirmingDelete" | "setConfirmingDelete" | "deleting" | "handleDelete">) {
  if (!onDelete) return null;
  return (
    <LightboxDeleteControl
      confirmingDelete={confirmingDelete}
      deleting={deleting}
      onRequestDelete={() => setConfirmingDelete(true)}
      onCancelDelete={() => setConfirmingDelete(false)}
      onConfirmDelete={() => void handleDelete()}
    />
  );
}

function LightboxPlayFullscreenButtons({
  playing,
  setPlaying,
  isFullscreen,
  toggleFullscreen,
}: Pick<LightboxHeaderProps, "playing" | "setPlaying" | "isFullscreen" | "toggleFullscreen">) {
  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className={`${ctrlBtn} ${playing ? "border-accent-cyan text-accent-cyan" : ""}`}
        aria-pressed={playing}
        aria-label={playing ? "Pause slideshow" : "Play slideshow"}
        title={playing ? "Pause slideshow (Space)" : "Play slideshow (Space)"}
        data-testid="lightbox-toggle-slideshow"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={toggleFullscreen}
        className={`${ctrlBtn} ${isFullscreen ? "border-accent-cyan text-accent-cyan" : ""}`}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
        data-testid="lightbox-toggle-fullscreen"
      >
        {isFullscreen ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 3v3a3 3 0 0 1-3 3H3M21 9h-3a3 3 0 0 1-3-3V3M3 15h3a3 3 0 0 1 3 3v3M15 21v-3a3 3 0 0 1 3-3h3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M16 21h3a2 2 0 0 0 2-2v-3M8 21H5a2 2 0 0 1-2-2v-3" />
          </svg>
        )}
      </button>
    </>
  );
}

function LightboxToggleButtons({
  fullResolution,
  onToggleFullResolution,
  onSimilar,
  current,
}: Pick<LightboxHeaderProps, "fullResolution" | "onToggleFullResolution" | "onSimilar" | "current">) {
  return (
    <>
      {onToggleFullResolution && (
        <button
          type="button"
          onClick={onToggleFullResolution}
          className={`${pillBtn} font-semibold ${fullResolution ? "border-accent-cyan text-accent-cyan" : ""}`}
          aria-pressed={fullResolution}
          title={fullResolution ? "Showing HD original — switch to thumbnail" : "Showing thumbnail — switch to HD original"}
          data-testid="lightbox-toggle-resolution"
        >
          HD
        </button>
      )}

      {onSimilar && (
        <button
          type="button"
          onClick={() => onSimilar(current)}
          className={pillBtn}
          title="Find similar images"
          data-testid="lightbox-find-similar"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Similar
        </button>
      )}
    </>
  );
}

function LightboxDetailsLinks({
  current,
  detailsOpen,
  setDetailsOpen,
}: Pick<LightboxHeaderProps, "current" | "detailsOpen" | "setDetailsOpen">) {
  return (
    <>
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className={`${pillBtn} ${detailsOpen ? "border-accent-cyan text-accent-cyan" : ""}`}
        aria-pressed={detailsOpen}
        title="Toggle details panel"
        data-testid="lightbox-toggle-details"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Details
      </button>
      <Link
        href={`/library/${current.imageId}`}
        prefetch={false}
        className={`${ctrlBtn} text-ui-2xs`}
        aria-label="Open full details page"
        title="Open full details page"
        data-testid="lightbox-open-details-page"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </Link>
    </>
  );
}

function LightboxViewControls(
  props: Pick<
    LightboxHeaderProps,
    "fullResolution" | "onToggleFullResolution" | "onSimilar" | "current" | "detailsOpen" | "setDetailsOpen"
  >,
) {
  return (
    <>
      <LightboxToggleButtons {...props} />
      <LightboxDetailsLinks {...props} />
    </>
  );
}

function LightboxNotesToggle({
  fetchNotes,
  notesOpen,
  setNotesOpen,
  notesCount,
}: Pick<LightboxHeaderProps, "fetchNotes" | "notesOpen" | "setNotesOpen" | "notesCount">) {
  if (!fetchNotes) return null;
  return (
    <button
      type="button"
      onClick={() => setNotesOpen((v) => !v)}
      className={`${pillBtn} ${notesOpen ? "border-accent-cyan text-accent-cyan" : ""}`}
      aria-pressed={notesOpen}
      title="Toggle notes panel"
      data-testid="lightbox-toggle-notes"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
      Notes{notesCount > 0 ? ` (${notesCount})` : ""}
    </button>
  );
}

export function LightboxHeader(props: LightboxHeaderProps) {
  const { current, index, total, hasMore, onRating, onDelete, onClose } = props;
  return (
    <header className="flex items-start justify-between gap-3 px-3 py-2.5 sm:px-4">
      <LightboxHeaderInfo index={index} total={total} hasMore={hasMore} summary={current.summary} />

      {/* Controls wrap onto a second row on narrow screens instead of squishing. */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <LightboxPlayFullscreenButtons {...props} />
        <LightboxViewControls {...props} />

        {onRating && <LightboxRatingStars imageId={current.imageId} rating={current.rating} onRating={onRating} />}

        <LightboxNotesToggle {...props} />

        <LightboxDeleteSlot {...props} />

        <button
          type="button"
          onClick={onClose}
          className={ctrlBtn}
          aria-label="Close"
          title="Close (Esc)"
          data-testid="lightbox-close"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
