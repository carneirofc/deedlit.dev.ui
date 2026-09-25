"use client";

import { SAFETY_CLASSES, SAFETY_LABEL } from "@/lib/store/settings";

import { Row, Section, NumberSlider, Toggle, cls } from "./primitives";
import type { SafetyChipsProps, SettingsSectionProps } from "./schemas";

function SafetyChips({ defaultSafety, onToggle }: SafetyChipsProps) {
  return (
    <div className="flex gap-1.5" data-testid="default-safety">
      {SAFETY_CLASSES.map((c) => {
        const on = defaultSafety.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(c)}
            data-testid={`settings-default-safety-${c}`}
            className={`rounded-full border px-2.5 py-1 text-ui-2xs font-medium transition ${
              on
                ? "border-accent-cyan bg-accent-cyan/15 text-accent-cyan"
                : "border-ui-border/60 text-ui-ink-muted hover:text-ui-ink"
            }`}
          >
            {SAFETY_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}

export function SearchDefaultsSection({ settings, binders: { bool, slide, toggleDefaultSafety } }: SettingsSectionProps) {
  return (
    <Section title="Search defaults" hint="Initial filter values the browse page opens with.">
      <Row
        label="Minimum rating"
        control={
          <select
            className={cls.select}
            value={settings.defaultMinRating}
            onChange={(e) => slide("defaultMinRating").onChange(Number(e.target.value))}
            data-testid="settings-default-min-rating-select"
            aria-label="Minimum rating"
          >
            <option value={0}>Any</option>
            <option value={1}>★+</option>
            <option value={2}>★★+</option>
            <option value={3}>★★★+</option>
            <option value={4}>★★★★+</option>
            <option value={5}>★★★★★</option>
          </select>
        }
      />
      <Row
        label="Favorites only"
        control={<Toggle {...bool("defaultFavoritesOnly")} testId="settings-toggle-default-favorites-only" />}
      />
      <Row
        label="Content safety"
        hint="Which safety classes the grid shows by default. All on = no filter; turn one off (e.g. Explicit) to hide it everywhere until you re-enable it."
        control={<SafetyChips defaultSafety={settings.defaultSafety} onToggle={toggleDefaultSafety} />}
      />
      <Row
        label="Minimum match score"
        hint="Default threshold for semantic / similar / by-image search."
        control={
          <NumberSlider
            {...slide("defaultMinScore")}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            testId="settings-slider-default-min-score"
            label="Minimum match score"
          />
        }
      />
    </Section>
  );
}
