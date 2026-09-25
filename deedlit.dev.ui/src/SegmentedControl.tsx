"use client";

import { forwardRef, type ForwardedRef, type ReactElement, type ReactNode } from "react";
import { z } from "zod";

import OutlineButton from "./OutlineButton";
import { cn } from "./utils";

// Generic (over TValue) prop shapes: the `value`/`options`/`onValueChange`
// fields depend on a caller-supplied type parameter, so they are intersected
// in via `Record<...>` rather than a zod schema (zod schemas cannot be
// generic over a caller-supplied type parameter).
export const SegmentedControlOptionBaseSchema = z.object({
  label: z.custom<ReactNode>(),
  testId: z.string().optional(),
  disabled: z.boolean().optional(),
  tooltip: z.string().optional(),
  ariaLabel: z.string().optional(),
  title: z.string().optional(),
  className: z.string().optional(),
});
export type SegmentedControlOption<TValue extends string = string> = z.infer<
  typeof SegmentedControlOptionBaseSchema
> &
  Record<"value", TValue>;

export const SegmentedControlOwnPropsSchema = z.object({
  className: z.string().optional(),
  optionClassName: z.string().optional(),
  activeOptionClassName: z.string().optional(),
  inactiveOptionClassName: z.string().optional(),
});
export type SegmentedControlProps<TValue extends string = string> = z.infer<
  typeof SegmentedControlOwnPropsSchema
> &
  Record<"value", TValue> &
  Record<"options", Array<SegmentedControlOption<TValue>>> &
  Record<"onValueChange", (value: TValue) => void>;

const DEFAULT_ACTIVE_OPTION_CLASS =
  "border-ui-active bg-[color:var(--ui-bg-active)] text-[color:var(--ui-ink-highlight)]";

const DEFAULT_INACTIVE_OPTION_CLASS =
  "border-transparent bg-transparent text-[color:var(--ui-ink-secondary)] hover:bg-[color:var(--ui-bg-soft)]";

function SegmentedControlFn<TValue extends string = string>(
  {
    value,
    options,
    onValueChange,
    className,
    optionClassName,
    activeOptionClassName = DEFAULT_ACTIVE_OPTION_CLASS,
    inactiveOptionClassName = DEFAULT_INACTIVE_OPTION_CLASS,
  }: SegmentedControlProps<TValue>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex gap-1 rounded-lg border border-(--ui-border-soft) bg-panel/90 p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const inferredOptionLabel = typeof option.label === "string" ? option.label : undefined;
        const optionTooltip = option.tooltip ?? option.title ?? inferredOptionLabel;
        const optionAriaLabel = option.ariaLabel ?? inferredOptionLabel ?? optionTooltip;

        return (
          <OutlineButton
            key={option.value}
            data-testid={option.testId}
            tooltip={optionTooltip}
            aria-label={optionAriaLabel}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              "rounded-md px-2 py-0.5 text-ui-2xs",
              optionClassName,
              isActive ? activeOptionClassName : inactiveOptionClassName,
              option.className,
            )}
          >
            {option.label}
          </OutlineButton>
        );
      })}
    </div>
  );
}

type SegmentedControlWithRefProps<TValue extends string = string> = SegmentedControlProps<TValue> &
  Partial<Record<"ref", ForwardedRef<HTMLDivElement>>>;

const SegmentedControl = forwardRef(SegmentedControlFn) as <TValue extends string = string>(
  props: SegmentedControlWithRefProps<TValue>,
) => ReactElement;

export const ComponentWithDisplayNameSchema = z.object({ displayName: z.string().optional() });
export type ComponentWithDisplayName = z.infer<typeof ComponentWithDisplayNameSchema>;
(SegmentedControl as ComponentWithDisplayName).displayName = "SegmentedControl";

export default SegmentedControl;