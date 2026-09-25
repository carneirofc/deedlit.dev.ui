"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { z } from "zod";

import { cn } from "./utils";

export const SectionLabelOwnPropsSchema = z.object({
  children: z.custom<ReactNode>(),
});
export type SectionLabelProps = z.infer<typeof SectionLabelOwnPropsSchema> & HTMLAttributes<HTMLParagraphElement>;

/**
 * Uppercase small-caps section label used as a divider heading inside panels.
 *
 * ```tsx
 * <SectionLabel>Positive Prompt</SectionLabel>
 * ```
 */
const SectionLabel = forwardRef<HTMLParagraphElement, SectionLabelProps>(
  function SectionLabel({ children, className, ...props }, ref) {
    return (
      <p
        ref={ref}
        className={cn(
          "text-ui-xs font-semibold uppercase tracking-wide text-[color:var(--ui-ink-secondary)]",
          className,
        )}
        {...props}
      >
        {children}
      </p>
    );
  },
);

SectionLabel.displayName = "SectionLabel";

export default SectionLabel;
