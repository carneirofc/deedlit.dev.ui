"use client";

import { LightboxDetailPanel } from "./LightboxDetailPanel";
import { LightboxNotesPanel } from "./LightboxNotesPanel";
import { LightboxStage } from "./LightboxStage";
import type { LightboxBodyProps, LightboxDetailsSlotProps, LightboxNotesSlotProps } from "./schemas";

/** Renders the notes panel only once it's open and notes are supported —
 * keeps that branch out of the main Lightbox render. */
export function LightboxNotesSlot({ notesOpen, fetchNotes, ...rest }: LightboxNotesSlotProps) {
  if (!notesOpen || !fetchNotes) return null;
  return <LightboxNotesPanel {...rest} fetchNotes={fetchNotes} />;
}

/** Renders the inline details aside only once it's open — keeps that branch
 * (plus its loading/error/content states) out of the main Lightbox render. */
export function LightboxDetailsSlot({ detailsOpen, detailLoading, detailError, detail, imageId }: LightboxDetailsSlotProps) {
  if (!detailsOpen) return null;
  return (
    <aside className="flex w-[min(20rem,80vw)] shrink-0 flex-col gap-3 overflow-x-hidden overflow-y-auto border-l border-ui-border/40 bg-ui-bg/85 p-4 backdrop-blur-sm sm:w-1/2">
      {detailLoading && <p className="text-ui-xs text-ui-ink-muted">Loading…</p>}
      {detailError && !detailLoading && (
        <p className="text-ui-xs text-rose-400">Couldn&apos;t load details for this image.</p>
      )}
      {detail && <LightboxDetailPanel detail={detail} imageId={imageId} />}
    </aside>
  );
}

/** The stage (main image + nav) plus the inline details aside beside it. */
export function LightboxBody({
  current,
  fullResolution,
  imgLoaded,
  setImgLoaded,
  imgError,
  setImgError,
  atStart,
  atEnd,
  go,
  onClose,
  detailsOpen,
  detailLoading,
  detailError,
  detail,
}: LightboxBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <LightboxStage
        current={current}
        fullResolution={fullResolution}
        imgLoaded={imgLoaded}
        setImgLoaded={setImgLoaded}
        imgError={imgError}
        setImgError={setImgError}
        atStart={atStart}
        atEnd={atEnd}
        go={go}
        onClose={onClose}
      />
      <LightboxDetailsSlot
        detailsOpen={detailsOpen}
        detailLoading={detailLoading}
        detailError={detailError}
        detail={detail}
        imageId={current.imageId}
      />
    </div>
  );
}
