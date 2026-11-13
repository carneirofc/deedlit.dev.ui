"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { useSpotlight } from "./lib/use-spotlight";
import { cn, SPACING_PATTERNS } from "./utils";

interface SpotlightProp {
  /** Pointer-follow glow on hover (`.ui-spotlight`); follows the effects settings. */
  spotlight?: boolean;
}

export type CyberPanelProps = ComponentPropsWithoutRef<"section"> & SpotlightProp;
export type CyberSubpanelProps = ComponentPropsWithoutRef<"div"> & SpotlightProp;

export const CyberPanel = forwardRef<HTMLElement, CyberPanelProps>(function CyberPanel(
  { className, spotlight = false, onPointerMove, ...props },
  ref
) {
  const trackSpotlight = useSpotlight(onPointerMove);
  return (
    <section
      ref={ref}
      className={cn(
        "cyber-panel rounded-[28px]",
        SPACING_PATTERNS.panelLarge,
        spotlight && "ui-spotlight",
        className
      )}
      onPointerMove={spotlight ? trackSpotlight : onPointerMove}
      {...props}
    />
  );
});

CyberPanel.displayName = "CyberPanel";

export const CyberSubpanel = forwardRef<HTMLDivElement, CyberSubpanelProps>(function CyberSubpanel(
  { className, spotlight = false, onPointerMove, ...props },
  ref
) {
  const trackSpotlight = useSpotlight(onPointerMove);
  return (
    <div
      ref={ref}
      className={cn(
        "cyber-subpanel rounded-2xl",
        SPACING_PATTERNS.panelStandard,
        spotlight && "ui-spotlight",
        className
      )}
      onPointerMove={spotlight ? trackSpotlight : onPointerMove}
      {...props}
    />
  );
});

CyberSubpanel.displayName = "CyberSubpanel";
