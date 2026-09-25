"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { z } from "zod";

import OutlineButton from "./OutlineButton";
import { cn, LAYOUT_PATTERNS } from "./utils";

export const PaginationOwnPropsSchema = z.object({
  page: z.number(),
  totalPages: z.number(),
  onPrevPage: z.custom<() => void>(),
  onNextPage: z.custom<() => void>(),
  disabled: z.boolean().optional(),
  prevLabel: z.string().optional(),
  nextLabel: z.string().optional(),
  testIdPrefix: z.string().optional(),
});
export type PaginationProps = z.infer<typeof PaginationOwnPropsSchema> &
  Omit<HTMLAttributes<HTMLDivElement>, "children">;

const Pagination = forwardRef<HTMLDivElement, PaginationProps>(
  function Pagination(
    {
      page,
      totalPages,
      onPrevPage,
      onNextPage,
      disabled = false,
      prevLabel = "Previous",
      nextLabel = "Next",
      testIdPrefix,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(LAYOUT_PATTERNS.flexCenterBetweenGap2, className)}
        {...props}
      >
        <OutlineButton
          onClick={onPrevPage}
          disabled={page <= 1 || disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-prev-page-button` : undefined}
        >
          {prevLabel}
        </OutlineButton>
        <p className="text-ui-xs text-[color:var(--ui-ink-subtle)]">
          Page {page} of {totalPages}
        </p>
        <OutlineButton
          onClick={onNextPage}
          disabled={page >= totalPages || disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-next-page-button` : undefined}
        >
          {nextLabel}
        </OutlineButton>
      </div>
    );
  },
);

Pagination.displayName = "Pagination";

export default Pagination;
