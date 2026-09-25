"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { z } from "zod";

import OutlineButton from "./OutlineButton";
import { CopyIcon } from "./Icons";
import { cn } from "./utils";

export const CopyButtonOwnPropsSchema = z.object({
  /** Label shown when idle. @default "Copy" */
  label: z.custom<ReactNode>().optional(),
  /** Label shown after a successful copy. @default "Copied" */
  copiedLabel: z.custom<ReactNode>().optional(),
  /** Whether the copy action has just completed (drives label swap). */
  copied: z.boolean().optional(),
});
export type CopyButtonProps = z.infer<typeof CopyButtonOwnPropsSchema> &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * Small outline button with a clipboard copy icon.
 *
 * ```tsx
 * <CopyButton copied={copied} onClick={handleCopy} />
 * ```
 */
const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  function CopyButton(
    { label = "Copy", copiedLabel = "Copied", copied, className, ...props },
    ref,
  ) {
    return (
      <OutlineButton
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-[color:var(--ui-border-strong)] bg-[color:var(--ui-bg)] px-2 py-1 text-ui-xs font-medium text-[color:var(--ui-ink-secondary)] transition hover:bg-[color:var(--ui-bg-soft)]",
          className,
        )}
        {...props}
      >
        <CopyIcon size="h-3.5 w-3.5" />
        {copied ? copiedLabel : label}
      </OutlineButton>
    );
  },
);

CopyButton.displayName = "CopyButton";

export default CopyButton;
