"use client";

import { type PointerEvent, type PointerEventHandler, useCallback } from "react";

/**
 * Pointer handler for the `.ui-spotlight` glow (styles.css): writes the
 * pointer position into `--ui-spot-x` / `--ui-spot-y` on the element. Whether
 * the glow shows, and how strong, is pure CSS (`data-ui-hover`,
 * `data-ui-motion`, `data-ui-intensity`), so this stays a two-property write.
 *
 * ```tsx
 * const onPointerMove = useSpotlight<HTMLDivElement>();
 * <div className="ui-spotlight" onPointerMove={onPointerMove} />
 * ```
 *
 * @param onPointerMove - Caller handler to run first (composition).
 */
export function useSpotlight<T extends HTMLElement>(
  onPointerMove?: PointerEventHandler<T>
): PointerEventHandler<T> {
  return useCallback(
    (event: PointerEvent<T>) => {
      onPointerMove?.(event);
      // Touch has no hover, so there is nothing to follow.
      if (event.pointerType === "touch") {
        return;
      }
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--ui-spot-x", `${event.clientX - rect.left}px`);
      element.style.setProperty("--ui-spot-y", `${event.clientY - rect.top}px`);
    },
    [onPointerMove]
  );
}
