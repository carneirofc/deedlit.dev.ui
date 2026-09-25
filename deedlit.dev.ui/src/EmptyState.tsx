"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { z } from "zod";

import { cn } from "./utils";

export const EmptyStateToneSchema = z.enum(["default", "subtle"]);
export type EmptyStateTone = z.infer<typeof EmptyStateToneSchema>;

export const emptyStateVariants = cva("text-ui-sm text-[color:var(--ui-ink-subtle)]", {
  variants: {
    tone: {
      default: "rounded-xl border border-dashed border-ui-soft p-4",
      subtle: "",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export const EmptyStateOwnPropsSchema = z.object({
  children: z.custom<ReactNode>(),
  testId: z.string().optional(),
});
export type EmptyStateProps = z.infer<typeof EmptyStateOwnPropsSchema> &
  HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof emptyStateVariants>;

const EmptyState = forwardRef<HTMLParagraphElement, EmptyStateProps>(
  function EmptyState({ children, tone, testId, className, ...props }, ref) {
    return (
      <p
        ref={ref}
        id={testId}
        data-testid={testId}
        data-slot="empty-state"
        className={cn(emptyStateVariants({ tone }), className)}
        {...props}
      >
        {children}
      </p>
    );
  },
);

EmptyState.displayName = "EmptyState";

export default EmptyState;
