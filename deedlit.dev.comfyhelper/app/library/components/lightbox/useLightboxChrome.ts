import { useCallback, useEffect, useState } from "react";

/** Native fullscreen (fills the physical screen for a slideshow) + body-scroll
 * lock while the viewer is mounted. */
export function useLightboxChrome(rootRef: React.RefObject<HTMLDivElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, [rootRef]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Leave fullscreen when the viewer unmounts so the page isn't left zoomed.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.();
    };
  }, []);

  return { isFullscreen, toggleFullscreen };
}
