"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { z } from "zod";

import { cn } from "./utils";

export const StatusBannerToneSchema = z.enum(["loading", "error"]);
export type StatusBannerTone = z.infer<typeof StatusBannerToneSchema>;

export const statusBannerVariants = cva("rounded-lg border px-2 py-2 text-ui-xs", {
  variants: {
    tone: {
      loading:
        "border-[color:var(--ui-border)] bg-[color:var(--ui-bg-soft)] text-[color:var(--ui-ink-secondary)]",
      error: "border-error-edge bg-error text-error-ink",
    },
  },
  defaultVariants: {
    tone: "loading",
  },
});

export const StatusBannerOwnPropsSchema = z.object({
  tone: StatusBannerToneSchema,
  children: z.custom<ReactNode>(),
});
export type StatusBannerProps = z.infer<typeof StatusBannerOwnPropsSchema> &
  HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof statusBannerVariants>;

/**
 * Compact inline status banner for loading / error states inside panels.
 *
 * ```tsx
 * {isLoading && <StatusBanner tone="loading">Loading metadata…</StatusBanner>}
 * {error     && <StatusBanner tone="error">{error}</StatusBanner>}
 * ```
 */
const StatusBanner = forwardRef<HTMLParagraphElement, StatusBannerProps>(
  function StatusBanner({ tone, children, className, ...props }, ref) {
    return (
      <p
        ref={ref}
        role={tone === "error" ? "alert" : "status"}
        data-slot="status-banner"
        className={cn(statusBannerVariants({ tone }), className)}
        {...props}
      >
        {children}
      </p>
    );
  },
);

StatusBanner.displayName = "StatusBanner";

export default StatusBanner;
