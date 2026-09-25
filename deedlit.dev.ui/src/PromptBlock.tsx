"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { z } from "zod";

import CopyButton from "./CopyButton";
import SectionLabel from "./SectionLabel";

export const PromptBlockToneSchema = z.enum(["positive", "negative", "neutral"]);
export type PromptBlockTone = z.infer<typeof PromptBlockToneSchema>;

export const promptBlockTextVariants = cva(
  "mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg p-2 text-ui-xs text-[color:var(--ui-ink-primary)]",
  {
    variants: {
      tone: {
        positive: "bg-success",
        negative: "bg-error",
        neutral: "bg-[color:var(--ui-bg-soft)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export const PromptBlockOwnPropsSchema = z.object({
  /** Section heading displayed above the prompt text. */
  label: z.custom<ReactNode>(),
  /** The prompt text. */
  children: z.custom<ReactNode>(),
  /** Visual tone controlling the background colour of the text area. */
  tone: PromptBlockToneSchema.optional(),
  /** Whether the copy button shows "Copied" state. */
  copied: z.boolean().optional(),
  /** Called when the copy button is clicked. */
  onCopy: z.custom<() => void>().optional(),
  testId: z.string().optional(),
});
export type PromptBlockProps = z.infer<typeof PromptBlockOwnPropsSchema> &
  Omit<HTMLAttributes<HTMLElement>, "children">;

/**
 * Labelled prompt display block with a copy button.
 *
 * ```tsx
 * <PromptBlock label="Positive Prompt" tone="positive" copied={copied} onCopy={handleCopy}>
 *   {text}
 * </PromptBlock>
 * ```
 */
const PromptBlock = forwardRef<HTMLElement, PromptBlockProps>(
  function PromptBlock({ label, children, tone = "neutral", copied, onCopy, className, testId, ...props }, ref) {
    return (
      <section ref={ref} data-testid={testId} className={className} {...props}>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{label}</SectionLabel>
          {onCopy && (
            <CopyButton
              copied={copied}
              onClick={onCopy}
              data-testid={testId ? `${testId}-copy` : undefined}
            />
          )}
        </div>
        <pre className={promptBlockTextVariants({ tone })}>
          {children}
        </pre>
      </section>
    );
  },
);

PromptBlock.displayName = "PromptBlock";

export default PromptBlock;
