import { useState } from "react";

/** Decide whether to auto-fetch suggestions for this image: on when
 * autoLoadSuggestions is set, otherwise off until the user clicks the button.
 * Resets on navigation (derived during render, not via effect, so there's no
 * stale-value flash between the image change and the reset taking effect). */
export function useImageDetailSuggestRequested(imageId: string, hydrated: boolean, autoLoad: boolean) {
  const resetKey = hydrated ? `${imageId}:${autoLoad}` : null;
  const [value, setValue] = useState(autoLoad);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  if (resetKey !== null && resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setValue(autoLoad);
  }

  return { value, setValue };
}
