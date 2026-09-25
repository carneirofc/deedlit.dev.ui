"use client";

import type { ReactNode } from "react";

import { z } from "zod";

import { cn } from "./utils";

export const CompareTrayItemSchema = z.object({
  id: z.string(),
  thumbnailUrl: z.string(),
  alt: z.string().optional(),
});
export type CompareTrayItem = z.infer<typeof CompareTrayItemSchema>;

export const CompareActionOptsSchema = z.object({
  className: z.string(),
  disabled: z.boolean(),
  count: z.number(),
});
export type CompareActionOpts = z.infer<typeof CompareActionOptsSchema>;

export const CompareTrayBarPropsSchema = z.object({
  items: z.array(CompareTrayItemSchema),
  /** Total comparison slots; empty slots render as dashed placeholders. */
  max: z.number(),
  onRemove: z.custom<(id: string) => void>(),
  onClear: z.custom<() => void>(),
  /** Leading caption (hidden on narrow screens). */
  label: z.string().optional(),
  /** Minimum items before the compare action is enabled. */
  minToCompare: z.number().optional(),
  clearLabel: z.string().optional(),
  removeLabel: z.string().optional(),
  className: z.string().optional(),
  /**
   * Renders the primary compare action. Receives the recommended `className`,
   * `disabled` state, and current `count` so the app can supply a router `Link`
   * (or a plain anchor / button) without the lib depending on a router.
   */
  renderCompareAction: z.custom<(opts: CompareActionOpts) => ReactNode>(),
});
export type CompareTrayBarProps = z.infer<typeof CompareTrayBarPropsSchema>;

const COMPARE_ACTION_BASE = "rounded-lg px-3 py-2 text-ui-xs font-medium transition";
const COMPARE_ACTION_ENABLED = "bg-accent-cyan text-ui-bg-deep hover:opacity-90";
const COMPARE_ACTION_DISABLED = "pointer-events-none border border-ui-border/50 text-ui-ink-muted opacity-50";

export const CompareTrayThumbnailPropsSchema = z.object({
  item: CompareTrayItemSchema,
  removeLabel: z.string(),
  onRemove: z.custom<(id: string) => void>(),
});
export type CompareTrayThumbnailProps = z.infer<typeof CompareTrayThumbnailPropsSchema>;

function CompareTrayThumbnail({ item, removeLabel, onRemove }: CompareTrayThumbnailProps) {
  return (
    <div className="group relative" data-testid={`compare-tray-item-${item.id}`}>
      <img
        src={item.thumbnailUrl}
        alt={item.alt ?? ""}
        className="h-11 w-11 rounded-lg border border-ui-border/60 object-cover"
      />
      <button
        onClick={() => onRemove(item.id)}
        className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-ui-border/70 bg-ui-bg text-ui-2xs text-ui-ink-muted transition hover:text-rose-500"
        aria-label={removeLabel}
        data-testid={`compare-tray-remove-${item.id}`}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Floating selection tray: shows queued items as thumbnails with quick-remove,
 * a clear button, and a primary compare action. Presentational — the app owns
 * the tray store and the navigation target (via `renderCompareAction`).
 */
export function CompareTrayBar({
  items,
  max,
  onRemove,
  onClear,
  label = "Compare",
  minToCompare = 2,
  clearLabel = "Clear",
  removeLabel = "Remove from comparison",
  className,
  renderCompareAction,
}: CompareTrayBarProps) {
  if (items.length === 0) return null;

  const disabled = items.length < minToCompare;
  const actionClassName = cn(
    COMPARE_ACTION_BASE,
    disabled ? COMPARE_ACTION_DISABLED : COMPARE_ACTION_ENABLED,
  );

  return (
    <div
      data-testid="compare-tray"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-20 z-70 flex justify-center px-3 md:bottom-4",
        className,
      )}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-ui-border/70 bg-ui-bg/95 p-2.5 shadow-panel-lg backdrop-blur-xl">
        {label ? <span className="hidden px-1 text-ui-xs text-ui-ink-muted sm:block">{label}</span> : null}
        <div className="flex items-center gap-1.5">
          {items.map((item) => (
            <CompareTrayThumbnail key={item.id} item={item} removeLabel={removeLabel} onRemove={onRemove} />
          ))}
          {Array.from({ length: Math.max(0, max - items.length) }).map((_, i) => (
            <div
              key={`slot-${i}`}
              className="h-11 w-11 rounded-lg border border-dashed border-ui-border/50"
              aria-hidden="true"
            />
          ))}
        </div>
        <button
          onClick={onClear}
          className="rounded-lg border border-ui-border/70 px-2.5 py-2 text-ui-xs text-ui-ink-muted transition hover:text-ui-ink"
          data-testid="compare-tray-clear"
        >
          {clearLabel}
        </button>
        {renderCompareAction({ className: actionClassName, disabled, count: items.length })}
      </div>
    </div>
  );
}
