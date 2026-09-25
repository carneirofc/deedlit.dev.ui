import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { LightboxItem, LightboxLive } from "./schemas";

/** Report the displayed image to the parent (URL sync) — only when it changes,
 * not on every slideshow-timer render, so we don't thrash history state. */
export function useLightboxCurrentChangeReport(
  current: LightboxItem | undefined,
  onCurrentChange?: (item: LightboxItem) => void,
) {
  const onCurrentChangeRef = useRef(onCurrentChange);
  useEffect(() => {
    onCurrentChangeRef.current = onCurrentChange;
  });
  useEffect(() => {
    if (current) onCurrentChangeRef.current?.(current);
  }, [current?.imageId]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Keep the active filmstrip thumbnail scrolled into view. */
export function useLightboxFilmstripScroll(stripRef: React.RefObject<HTMLDivElement | null>, index: number) {
  useEffect(() => {
    stripRef.current
      ?.querySelector(`[data-idx="${index}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index, stripRef]);
}

function handleLightboxEscape(onClose: () => void) {
  // In fullscreen, let the browser reclaim Esc to exit it; only close the
  // viewer on a second Esc once we're back to the windowed overlay.
  if (document.fullscreenElement) return;
  onClose();
}

function lightboxKeyActions(
  go: (dir: 1 | -1) => void,
  goToIndex: (i: number) => void,
  onClose: () => void,
  toggleFullscreen: () => void,
  setPlaying: Dispatch<SetStateAction<boolean>>,
  live: React.RefObject<LightboxLive>,
): Record<string, () => void> {
  return {
    ArrowRight: () => go(1),
    ArrowLeft: () => go(-1),
    " ": () => setPlaying((p) => !p),
    Home: () => goToIndex(0),
    End: () => goToIndex(live.current.items.length - 1),
    f: toggleFullscreen,
    F: toggleFullscreen,
    Escape: () => handleLightboxEscape(onClose),
  };
}

function handleLightboxKey(
  e: KeyboardEvent,
  go: (dir: 1 | -1) => void,
  goToIndex: (i: number) => void,
  onClose: () => void,
  toggleFullscreen: () => void,
  setPlaying: Dispatch<SetStateAction<boolean>>,
  live: React.RefObject<LightboxLive>,
) {
  const action = lightboxKeyActions(go, goToIndex, onClose, toggleFullscreen, setPlaying, live)[e.key];
  if (!action) return;
  if (e.key !== "Escape") e.preventDefault();
  action();
}

/** Keyboard shortcuts: ← / → navigate, Space toggles the slideshow, Home / End
 * jump to the ends, "f" toggles fullscreen, Esc closes (once out of fullscreen). */
export function useLightboxKeyboard(
  go: (dir: 1 | -1) => void,
  goToIndex: (i: number) => void,
  onClose: () => void,
  toggleFullscreen: () => void,
  setPlaying: Dispatch<SetStateAction<boolean>>,
  live: React.RefObject<LightboxLive>,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      handleLightboxKey(e, go, goToIndex, onClose, toggleFullscreen, setPlaying, live);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, goToIndex, onClose, toggleFullscreen, setPlaying, live]);
}
