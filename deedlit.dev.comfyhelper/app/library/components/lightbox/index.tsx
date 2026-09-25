"use client";

import { LightboxSections } from "./LightboxSections";
import type { LightboxProps } from "./schemas";
import { useLightboxState } from "./useLightboxState";

export type { LightboxItem, SlideshowSettings } from "./schemas";

/**
 * Fullscreen image viewer that pages through the current result list.
 *
 * Keyboard: ← / → navigate, Space toggles the slideshow, Home / End jump to the
 * ends, Esc closes. As you approach the end of the loaded results (and there are
 * more) it transparently pulls the next page so a long list never dead-ends.
 */
export function Lightbox(props: LightboxProps) {
  const { rootRef, ...state } = useLightboxState(props);
  const { current } = state.nav;
  if (!current) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-100 flex flex-col bg-ui-bg-deep/95 backdrop-blur-md"
    >
      <LightboxSections lightboxProps={props} state={state} />
    </div>
  );
}
