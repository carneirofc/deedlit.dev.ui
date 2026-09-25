"use client";

import { forwardRef } from "react";
import { z } from "zod";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "./Dialog";
import OutlineButton from "./OutlineButton";
import { cn, SPACING_PATTERNS, BORDER_PATTERNS } from "./utils";

export const ConfirmationDialogDataSchema = z.object({
  title: z.string(),
  details: z.array(z.string()),
  outcomes: z.array(z.string()),
  confirmLabel: z.string().optional(),
  cancelLabel: z.string().optional(),
});
export type ConfirmationDialogData = z.infer<typeof ConfirmationDialogDataSchema>;

export const ConfirmationDialogPropsSchema = z.object({
  dialog: ConfirmationDialogDataSchema,
  onClose: z.custom<(accepted: boolean) => void>(),
  className: z.string().optional(),
  overlayClassName: z.string().optional(),
  testIdPrefix: z.string().optional(),
});
export type ConfirmationDialogProps = z.infer<typeof ConfirmationDialogPropsSchema>;

export const ConfirmationDialogListPropsSchema = z.object({
  heading: z.string(),
  lines: z.array(z.string()),
  itemClassName: z.string(),
  keyPrefix: z.string(),
});
export type ConfirmationDialogListProps = z.infer<typeof ConfirmationDialogListPropsSchema>;

function ConfirmationDialogList({ heading, lines, itemClassName, keyPrefix }: ConfirmationDialogListProps) {
  return (
    <section>
      <p className="ui-text-label-sm text-ui-ink-subtle">{heading}</p>
      <ul className="mt-2 space-y-1">
        {lines.map((line, index) => (
          <li key={`${keyPrefix}:${index}`} className={cn("rounded-md", itemClassName, SPACING_PATTERNS.controlXs)}>
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

export const ConfirmationDialogFooterPropsSchema = z.object({
  dialog: ConfirmationDialogDataSchema,
  onClose: z.custom<(accepted: boolean) => void>(),
  testIdPrefix: z.string(),
});
export type ConfirmationDialogFooterProps = z.infer<typeof ConfirmationDialogFooterPropsSchema>;

function ConfirmationDialogFooter({ dialog, onClose, testIdPrefix }: ConfirmationDialogFooterProps) {
  return (
    <div className={cn("flex items-center justify-end gap-2", BORDER_PATTERNS.topFaint, SPACING_PATTERNS.dialogSection)}>
      <DialogClose asChild>
        <OutlineButton data-testid={`${testIdPrefix}-cancel-button`} controlSize="md">
          {dialog.cancelLabel ?? "Cancel"}
        </OutlineButton>
      </DialogClose>
      <OutlineButton
        autoFocus
        data-testid={`${testIdPrefix}-accept-button`}
        onClick={() => onClose(true)}
        variant="accent"
        controlSize="md"
      >
        {dialog.confirmLabel ?? "Confirm"}
      </OutlineButton>
    </div>
  );
}

/**
 * Confirmation dialog driven by a `dialog` data object. Built on the accessible
 * {@link Dialog} primitives, so it traps focus, restores focus on close, makes
 * the background inert, and dismisses on `Escape`/backdrop — invoking
 * `onClose(false)`. Mount it only while a confirmation is pending.
 */
const ConfirmationDialog = forwardRef<HTMLDivElement, ConfirmationDialogProps>(function ConfirmationDialog({
  dialog,
  onClose,
  className,
  overlayClassName,
  testIdPrefix = "confirmation-dialog",
}, ref) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose(false);
      }}
    >
      <DialogContent
        ref={ref}
        id={testIdPrefix}
        data-testid={testIdPrefix}
        size="lg"
        showCloseButton={false}
        overlayClassName={cn("ui-anim-overlay z-120 bg-ui-overlay-soft", overlayClassName)}
        aria-describedby={undefined}
        className={cn("max-w-180", className)}
      >
        <div className={cn(BORDER_PATTERNS.bottomFaint, SPACING_PATTERNS.dialogSection)}>
          <p className="text-ui-sm font-semibold uppercase tracking-[0.08em] text-ui-ink-subtle">
            Confirm Action
          </p>
          <DialogTitle className="mt-1 text-ui-lg">{dialog.title}</DialogTitle>
        </div>

        <div className={cn("max-h-[min(62dvh,36rem)] space-y-4 overflow-y-auto text-ui-sm text-ui-ink-accent", SPACING_PATTERNS.dialogSection)}>
          <ConfirmationDialogList
            heading="Details"
            lines={dialog.details}
            itemClassName="bg-ui-bg-muted"
            keyPrefix="detail"
          />

          <ConfirmationDialogList
            heading="If You Accept"
            lines={dialog.outcomes}
            itemClassName="bg-ui-bg-info"
            keyPrefix="outcome"
          />
        </div>

        <ConfirmationDialogFooter dialog={dialog} onClose={onClose} testIdPrefix={testIdPrefix} />
      </DialogContent>
    </Dialog>
  );
});

ConfirmationDialog.displayName = "ConfirmationDialog";

export default ConfirmationDialog;
