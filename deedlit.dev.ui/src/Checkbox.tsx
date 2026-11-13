import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "./utils";
export type CheckboxProps = ComponentPropsWithoutRef<"input"> & {
  label?: string;
};

// Hover/press feedback is keyed off the input (`peer-enabled:`), so a disabled
// checkbox shows the `not-allowed` cursor (from the base layer) without
// reacting to hover. The cursor itself comes from `label:has(> input)` in
// styles.css, which honours `data-ui-cursor`.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(props, ref) {
  const { label, id, className, disabled, ...rest } = props;
  return (
    <label
      className={cn(
        "group/cb inline-flex items-center gap-2 select-none",
        disabled && "opacity-50",
        className
      )}
    >
      <input
        {...rest}
        ref={ref}
        id={id}
        type="checkbox"
        disabled={disabled}
        className={cn("peer sr-only border-0")}
      />
      <span
        className={cn(
          "grid h-[1.2rem] w-[1.2rem] shrink-0 place-items-center rounded",
          "border border-(--ui-border-muted) bg-[color-mix(in_oklab,var(--surface-0)_92%,transparent)]",
          "ui-interactive",
          "peer-enabled:group-hover/cb:border-(--panel-border-strong)",
          "motion-safe:peer-enabled:group-active/cb:scale-(--ui-fx-press)",
          "peer-focus-visible:border-(--panel-border-strong) peer-focus-visible:shadow-[0_0_0_2px_color-mix(in_oklab,var(--accent-cyan)_22%,transparent)]",
          "peer-checked:border-(--panel-border-strong) peer-checked:bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent-cyan)_24%,var(--surface-1))_0%,color-mix(in_oklab,var(--accent-pink)_22%,var(--surface-1))_100%)]"
        )}
        aria-hidden="true"
      >
        <svg
          aria-hidden="true"
          className="h-3 w-3 opacity-0 transition-opacity duration-180 ease-in-out peer-checked:group-[]/cb:opacity-100 [input:checked~span>&]:opacity-100"
          viewBox="0 0 12 12"
          fill="none"
          stroke="var(--text-0)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5L5 9l4.5-6" />
        </svg>
      </span>
      {label && (
        <span className="ui-interactive text-ui-sm text-(--ui-ink) peer-enabled:group-hover/cb:text-(--ui-ink-hover)">
          {label}
        </span>
      )}
    </label>
  );
});

Checkbox.displayName = "Checkbox";
export default Checkbox;
