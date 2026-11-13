import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Common spacing patterns used across components.
 * These constants help maintain consistency and reduce duplication.
 */
export const SPACING_PATTERNS = {
  /** Standard control padding - md size (inputs, buttons, table cells) */
  controlMd: "px-3 py-2",

  /** Standard control padding - sm size (inputs, buttons) */
  controlSm: "px-2.5 py-1.5",

  /** Compact control padding - xs size (tight spaces, badges) */
  controlXs: "px-2 py-1",

  /** Modal/Dialog section padding */
  dialogSection: "px-5 py-4",

  /** Modal/Dialog section padding - responsive */
  dialogSectionResponsive: "px-4 py-3 sm:px-5",

  /** Panel padding - standard (CyberSubpanel) */
  panelStandard: "p-4",

  /** Panel padding - large (CyberPanel) */
  panelLarge: "px-4 py-5 sm:px-5 sm:py-6",

  /** Chip/badge padding */
  chipStandard: "px-3 py-1",

  /** Badge padding with extra horizontal space */
  badgeStandard: "px-2.5 py-1"
} as const;

/**
 * Common layout patterns used across components.
 * These constants help maintain consistency for flex layouts.
 */
export const LAYOUT_PATTERNS = {
  /** Flex row with centered items and space between */
  flexCenterBetween: "flex items-center justify-between",

  /** Flex row with centered items and space between (with gap-2) */
  flexCenterBetweenGap2: "flex items-center justify-between gap-2",

  /** Flex row with centered items and space between (with gap-3) */
  flexCenterBetweenGap3: "flex items-center justify-between gap-3",

  /** Flex row with centered items and start alignment */
  flexCenterStart: "flex items-center justify-start",

  /** Flex row with centered items and start alignment (with gap-2) */
  flexCenterStartGap2: "flex items-center justify-start gap-2",

  /** Flex row with start items and space between */
  flexStartBetween: "flex items-start justify-between",

  /** Flex row with start items and space between (with gap-3) */
  flexStartBetweenGap3: "flex items-start justify-between gap-3"
} as const;

/**
 * Common border patterns combining border width and color.
 */
export const BORDER_PATTERNS = {
  /** Top border with faint color - for footers/dividers */
  topFaint: "border-t border-ui-faint",

  /** Bottom border with faint color - for headers/dividers */
  bottomFaint: "border-b border-ui-faint",

  /** Standard border - default UI border */
  standard: "border border-ui",

  /** Modal/dialog border */
  modal: "border border-ui-modal",

  /** Active state border */
  active: "border border-ui-active"
} as const;

/**
 * Shared interaction recipes. The motion itself lives in `styles/styles.css`
 * (`.ui-interactive`, `.ui-lift`, `.ui-press`), gated by the effects
 * settings attributes on `<html>`; these strings only compose it.
 */
export const INTERACTION_PATTERNS = {
  /** Visible keyboard focus ring in the theme's focus colour. */
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ui-bg)]",

  /** Focus ring drawn inside the box, for full-bleed rows and triggers. */
  focusRingInset:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ui-ring-focus)]",

  /** Raised control: transition + hover lift/shadow + press scale. */
  lift: "ui-interactive ui-lift",

  /** Flat control (tabs, segments, chips, list rows): transition + press scale. */
  press: "ui-interactive ui-press",

  /** Pointer cursor that honours `data-ui-cursor` on non-button elements. */
  cursor: "cursor-(--ui-cursor-interactive)"
} as const;
