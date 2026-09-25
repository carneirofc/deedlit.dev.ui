"use client";

import { z } from "zod";

import { LightboxFilmstrip } from "./LightboxFilmstrip";
import { LightboxHeader } from "./LightboxHeader";
import { LightboxBody, LightboxNotesSlot } from "./LightboxOverlays";
import { LightboxPropsSchema } from "./schemas";
import { isLightboxAtEnd, isLightboxAtStart } from "./useLightboxNavigation";
import type { useLightboxState } from "./useLightboxState";

const LightboxSectionsPropsSchema = z.object({
  lightboxProps: LightboxPropsSchema,
  // `rootRef` is consumed directly by the `Lightbox` component (its `ref={}`
  // must stay a bare identifier — react-hooks/refs flags dot-chained ref
  // access), so it's omitted here.
  state: z.custom<Omit<ReturnType<typeof useLightboxState>, "rootRef">>(),
});
type LightboxSectionsProps = z.infer<typeof LightboxSectionsPropsSchema>;

function LightboxHeaderSection({ lightboxProps, state }: LightboxSectionsProps) {
  const { items, fullResolution, hasMore, onClose, onSimilar, onToggleFullResolution, onRating, onCreateNote, onDelete, fetchNotes } = lightboxProps;
  const { playing, setPlaying, notesOpen, setNotesOpen, detailsOpen, setDetailsOpen, nav, notesState, del, chrome } = state;
  const current = nav.current;
  if (!current) return null;

  return (
    <>
      <LightboxHeader
        current={current}
        index={nav.index}
        total={items.length}
        hasMore={hasMore}
        playing={playing}
        setPlaying={setPlaying}
        isFullscreen={chrome.isFullscreen}
        toggleFullscreen={chrome.toggleFullscreen}
        fullResolution={fullResolution}
        onToggleFullResolution={onToggleFullResolution}
        onSimilar={onSimilar}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onRating={onRating}
        fetchNotes={fetchNotes}
        notesOpen={notesOpen}
        setNotesOpen={setNotesOpen}
        notesCount={notesState.notes.length}
        onDelete={onDelete}
        confirmingDelete={del.confirmingDelete}
        setConfirmingDelete={del.setConfirmingDelete}
        deleting={del.deleting}
        handleDelete={del.handleDelete}
        onClose={onClose}
      />

      <LightboxNotesSlot
        notesOpen={notesOpen}
        current={current}
        notes={notesState.notes}
        notesLoading={notesState.notesLoading}
        noteDraft={notesState.noteDraft}
        setNoteDraft={notesState.setNoteDraft}
        noteSaving={notesState.noteSaving}
        setNoteSaving={notesState.setNoteSaving}
        setNotes={notesState.setNotes}
        fetchNotes={fetchNotes}
        onCreateNote={onCreateNote}
      />
    </>
  );
}

function LightboxBodySection({ lightboxProps, state }: LightboxSectionsProps) {
  const { items, fullResolution, slideshow, hasMore, loadingMore, onLoadMore, onClose } = lightboxProps;
  const { stripRef, nav, imageLoad, details, detailsOpen } = state;
  const current = nav.current;
  if (!current) return null;

  return (
    <>
      <LightboxBody
        current={current}
        fullResolution={fullResolution}
        imgLoaded={imageLoad.imgLoaded}
        setImgLoaded={imageLoad.setImgLoaded}
        imgError={imageLoad.imgError}
        setImgError={imageLoad.setImgError}
        atStart={isLightboxAtStart(nav.index, slideshow.loop)}
        atEnd={isLightboxAtEnd(nav.index, items.length, slideshow.loop, hasMore)}
        go={nav.go}
        onClose={onClose}
        detailsOpen={detailsOpen}
        detailLoading={details.detailLoading}
        detailError={details.detailError}
        detail={details.detail}
      />

      <LightboxFilmstrip
        items={items}
        index={nav.index}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        setCurrentId={nav.setCurrentId}
        stripRef={stripRef}
      />
    </>
  );
}

/** The full Lightbox body once `current` is known: header, notes, stage +
 * details, filmstrip. Split out of the `Lightbox` component itself purely to
 * keep that component under the function-size limit. */
export function LightboxSections(props: LightboxSectionsProps) {
  if (!props.state.nav.current) return null;
  return (
    <>
      <LightboxHeaderSection {...props} />
      <LightboxBodySection {...props} />
    </>
  );
}
