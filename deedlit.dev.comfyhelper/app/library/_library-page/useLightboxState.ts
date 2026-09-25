"use client";

import { useCallback, useEffect, useState } from "react";

/** Fullscreen viewer open/index/autoplay state. */
export function useLightboxState(lightboxOpenRef: React.RefObject<boolean>) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxAutoPlay, setLightboxAutoPlay] = useState(false);

  // Live mirror so the freshness poll can tell the viewer is open without
  // taking lightboxIndex as a dep (it changes on every slideshow step — that
  // would restart the poll interval each frame). Never auto-prepend under an
  // open viewer: it would shift the indices out from under the current slide.
  useEffect(() => {
    lightboxOpenRef.current = lightboxIndex !== null;
  }, [lightboxIndex, lightboxOpenRef]);

  const openLightbox = useCallback((index: number, autoplay = false) => {
    setLightboxAutoPlay(autoplay);
    setLightboxIndex(index);
  }, []);

  return { lightboxIndex, setLightboxIndex, lightboxAutoPlay, openLightbox };
}
