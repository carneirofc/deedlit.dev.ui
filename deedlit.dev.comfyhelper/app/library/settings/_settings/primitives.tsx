"use client";

import type {
  InfoRowProps,
  NumberSliderProps,
  RowProps,
  SectionProps,
  SegmentedProps,
  ToggleProps,
} from "./schemas";

// ---------------------------------------------------------------------------
// Style tokens (matches app/library + app/admin conventions).
// ---------------------------------------------------------------------------

export const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  select:
    "rounded-lg border border-ui-border/70 bg-ui-bg px-2.5 py-1.5 text-ui-xs outline-none focus:border-accent-cyan",
};

// ---------------------------------------------------------------------------
// Reusable settings rows — each binds to one LibrarySettings key.
// ---------------------------------------------------------------------------

export function Section({ title, hint, children }: SectionProps) {
  return (
    <section className={cls.card}>
      <header className="mb-3">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">{title}</h2>
        {hint && <p className="text-ui-2xs text-ui-ink-muted">{hint}</p>}
      </header>
      <div className="flex flex-col divide-y divide-ui-border/40">{children}</div>
    </section>
  );
}

export function Row({ label, hint, control }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-ui-sm text-ui-ink">{label}</p>
        {hint && <p className="text-ui-2xs text-ui-ink-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function InfoRow({ label, value, hint }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-ui-sm text-ui-ink">{label}</p>
        {hint && <p className="text-ui-2xs text-ui-ink-muted">{hint}</p>}
      </div>
      <span className="shrink-0 rounded-md border border-ui-border/60 bg-ui-bg px-2 py-1 text-ui-2xs text-ui-ink-muted">
        {value}
      </span>
    </div>
  );
}

export function Toggle({ checked, onChange, testId, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked ? "border-accent-cyan bg-accent-cyan/30" : "border-ui-border/70 bg-ui-bg"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
          checked ? "left-[1.375rem] bg-accent-cyan" : "left-0.5 bg-ui-ink-muted"
        }`}
        style={{ height: "1.125rem", width: "1.125rem" }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  testIdPrefix,
}: SegmentedProps<T>) {
  return (
    <div className="flex gap-1 rounded-lg border border-ui-border/60 bg-ui-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          data-testid={testIdPrefix ? `${testIdPrefix}-${o.value}` : undefined}
          className={`rounded-md px-2.5 py-1 text-ui-xs font-medium transition ${
            value === o.value
              ? "bg-accent-cyan/15 text-accent-cyan"
              : "text-ui-ink-muted hover:text-ui-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumberSlider({
  value,
  min,
  max,
  step,
  format,
  onChange,
  testId,
  label,
}: NumberSliderProps) {
  return (
    <div className="flex w-44 items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId}
        aria-label={label}
        className="flex-1 accent-accent-cyan"
      />
      <span className="w-10 text-right text-ui-xs tabular-nums text-ui-ink">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
