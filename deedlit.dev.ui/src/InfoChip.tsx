"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { z } from "zod";

import { cn, SPACING_PATTERNS } from "./utils";

export const InfoChipOwnPropsSchema = z.object({
  children: z.custom<ReactNode>(),
  testId: z.string().optional(),
  "data-testid": z.string().optional(),
});
export type InfoChipProps = z.infer<typeof InfoChipOwnPropsSchema> & HTMLAttributes<HTMLSpanElement>;

const InfoChip = forwardRef<HTMLSpanElement, InfoChipProps>(function InfoChip(
  { children, testId, className, "data-testid": dataTestId, ...props },
  ref,
) {
  const resolvedTestId = testId ?? dataTestId;

  return (
    <span
      ref={ref}
      data-testid={resolvedTestId}
      {...props}
      className={cn("cyber-chip rounded-full", SPACING_PATTERNS.chipStandard, className)}
    >
      {children}
    </span>
  );
});

InfoChip.displayName = "InfoChip";

export default InfoChip;
