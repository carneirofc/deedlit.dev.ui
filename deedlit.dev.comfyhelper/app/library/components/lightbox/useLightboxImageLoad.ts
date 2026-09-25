import { useEffect, useState } from "react";

import type { LightboxItem } from "./schemas";

function bigSrc(item: LightboxItem, full: boolean): string {
  return full
    ? `/api/library/images/${item.imageId}/file`
    : `/api/library/images/${item.imageId}/thumbnail`;
}

/** Loaded/error state for the main viewer image, reset whenever it changes; also
 * preloads the neighbouring images so stepping / the slideshow feels instant. */
export function useLightboxImageLoad(
  current: LightboxItem | undefined,
  index: number,
  items: LightboxItem[],
  fullResolution: boolean,
) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset the load state whenever the displayed image changes. Derived during
  // render (rather than in an effect) so there's no stale-state flash between
  // the image swap and the reset taking effect.
  const resetKey = `${current?.imageId ?? ""}:${fullResolution}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setImgLoaded(false);
    setImgError(false);
  }

  useEffect(() => {
    [index + 1, index - 1].forEach((i) => {
      const it = items[i];
      if (it) {
        const im = new window.Image();
        im.src = bigSrc(it, fullResolution);
      }
    });
  }, [index, items, fullResolution]);

  return { imgLoaded, setImgLoaded, imgError, setImgError };
}

export { bigSrc };
