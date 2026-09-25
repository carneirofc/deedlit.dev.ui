import { useRef, useState } from "react";

import type { LightboxProps } from "./schemas";
import { useLightboxChrome } from "./useLightboxChrome";
import { useLightboxDelete } from "./useLightboxDelete";
import { useLightboxDetails } from "./useLightboxDetails";
import { useLightboxImageLoad } from "./useLightboxImageLoad";
import { useLightboxCurrentChangeReport, useLightboxFilmstripScroll, useLightboxKeyboard } from "./useLightboxKeyboard";
import { useLightboxNavigation } from "./useLightboxNavigation";
import { useLightboxNotes } from "./useLightboxNotes";

/** Composes every Lightbox hook into one call so the component itself only
 * has to destructure + render. */
export function useLightboxState(props: LightboxProps) {
  const {
    items, initialIndex, fullResolution, slideshow, autoPlay = false,
    hasMore, loadingMore, onLoadMore, onClose, onCurrentChange, fetchNotes, onDelete,
  } = props;

  const [playing, setPlaying] = useState(autoPlay);
  const stripRef = useRef<HTMLDivElement>(null);
  // Root element for the native Fullscreen API + whether we're currently in it.
  const rootRef = useRef<HTMLDivElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const nav = useLightboxNavigation(items, initialIndex, hasMore, loadingMore, slideshow, onLoadMore, playing, setPlaying);
  const imageLoad = useLightboxImageLoad(nav.current, nav.index, items, fullResolution);
  const notesState = useLightboxNotes(nav.current, notesOpen, fetchNotes);
  const details = useLightboxDetails(nav.current, detailsOpen);
  const del = useLightboxDelete(nav.current, nav.live, onClose, nav.setCurrentId, onDelete);
  const chrome = useLightboxChrome(rootRef);

  useLightboxCurrentChangeReport(nav.current, onCurrentChange);
  useLightboxFilmstripScroll(stripRef, nav.index);
  useLightboxKeyboard(nav.go, nav.goToIndex, onClose, chrome.toggleFullscreen, setPlaying, nav.live);

  return {
    playing, setPlaying, stripRef, rootRef, notesOpen, setNotesOpen, detailsOpen, setDetailsOpen,
    nav, imageLoad, notesState, details, del, chrome,
  };
}
