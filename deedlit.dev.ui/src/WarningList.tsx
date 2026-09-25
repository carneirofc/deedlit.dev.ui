"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { z } from "zod";

import { cn, SPACING_PATTERNS } from "./utils";

export const WarningListOwnPropsSchema = z.object({
  warnings: z.array(z.string()),
  testId: z.string().optional(),
  entryTestId: z.string().optional(),
});
export type WarningListProps = z.infer<typeof WarningListOwnPropsSchema> & HTMLAttributes<HTMLDivElement>;

const WarningList = forwardRef<HTMLDivElement, WarningListProps>(function WarningList(
  { warnings, testId, entryTestId, className, ...props },
  ref,
) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={testId}
      data-testid={testId}
      role="alert"
      {...props}
      className={cn(
        "rounded-xl border border-warn-edge bg-warn text-ui-sm text-warn-ink",
        SPACING_PATTERNS.controlMd,
        className,
      )}
    >
      {warnings.map((warning) => (
        <p key={warning} data-testid={entryTestId ?? (testId ? `${testId}-entry` : undefined)}>
          {warning}
        </p>
      ))}
    </div>
  );
});

WarningList.displayName = "WarningList";

export default WarningList;

