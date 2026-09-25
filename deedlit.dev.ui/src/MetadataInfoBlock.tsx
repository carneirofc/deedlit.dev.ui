"use client";

import { forwardRef, type ReactNode } from "react";
import { z } from "zod";

import { cn } from "./utils";

export const MetadataInfoBlockPropsSchema = z.object({
  children: z.custom<ReactNode>(),
  className: z.string().optional(),
  testId: z.string().optional(),
});
export type MetadataInfoBlockProps = z.infer<typeof MetadataInfoBlockPropsSchema>;

/**
 * A subtle info block for displaying metadata source details.
 */
const MetadataInfoBlock = forwardRef<HTMLElement, MetadataInfoBlockProps>(function MetadataInfoBlock(
  { children, className, testId },
  ref,
) {
  return (
    <section
      ref={ref}
      data-testid={testId}
      className={cn(
        "rounded-lg bg-ui-bg-code px-2 py-2 text-ui-xs text-ui-ink-secondary",
        className,
      )}
    >
      {children}
    </section>
  );
});

MetadataInfoBlock.displayName = "MetadataInfoBlock";

export default MetadataInfoBlock;
