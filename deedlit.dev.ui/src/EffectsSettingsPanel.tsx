"use client";

import { forwardRef, type ReactNode, useId } from "react";

import Checkbox from "./Checkbox";
import { useEffectsSettings } from "./EffectsSettings";
import {
  areEffectsSettingsEqual,
  type CursorStyle,
  type EffectsIntensity,
  type EffectsSettings,
  type ReducedMotionPreference
} from "./lib/effects-settings";
import OutlineButton from "./OutlineButton";
import SectionLabel from "./SectionLabel";
import SegmentedControl, { type SegmentedControlOption } from "./SegmentedControl";
import SurfacePanel, { type SurfacePanelProps } from "./SurfacePanel";
import { cn } from "./utils";

export interface EffectsSettingsPanelProps extends Omit<SurfacePanelProps, "children" | "title"> {
  /** Panel heading. @default "Interaction effects" */
  title?: ReactNode;
  /** Hide the live preview block. */
  hidePreview?: boolean;
  testId?: string;
}

const CURSOR_OPTIONS: SegmentedControlOption<CursorStyle>[] = [
  { value: "pointer", label: "Pointer", tooltip: "Hand cursor on buttons and controls" },
  { value: "system", label: "System", tooltip: "Operating-system default arrow" }
];

const MOTION_OPTIONS: SegmentedControlOption<ReducedMotionPreference>[] = [
  { value: "system", label: "System", tooltip: "Follow the operating-system setting" },
  { value: "reduce", label: "Reduce", tooltip: "No lift, press or enter animations" },
  { value: "full", label: "Full", tooltip: "Always animate" }
];

const INTENSITY_OPTIONS: SegmentedControlOption<EffectsIntensity>[] = [
  { value: "subtle", label: "Subtle" },
  { value: "normal", label: "Normal" },
  { value: "strong", label: "Strong" }
];

const LEGEND_CLASS = "mb-1 text-ui-2xs font-medium text-[color:var(--ui-ink-subtle)]";

function describe(settings: EffectsSettings, motion: string): string {
  const hover = settings.hoverEffects ? "Hover effects on" : "Hover effects off";
  const cursor = settings.cursorStyle === "pointer" ? "pointer cursor" : "system cursor";
  return `${hover}, ${cursor}, ${motion}, ${settings.intensity} intensity.`;
}

/**
 * User-facing controls for the interaction-effects settings, with a live
 * preview. Reads and writes through `useEffectsSettings()`, so it must be
 * rendered inside `EffectsSettingsProvider`.
 */
const EffectsSettingsPanel = forwardRef<HTMLDivElement, EffectsSettingsPanelProps>(
  function EffectsSettingsPanelImpl(
    { title = "Interaction effects", hidePreview = false, testId, className, ...props },
    ref
  ) {
    const {
      settings,
      defaults,
      effectiveMotion,
      systemPrefersReducedMotion,
      updateSettings,
      resetSettings
    } = useEffectsSettings();
    const id = useId();
    const isDefault = areEffectsSettingsEqual(settings, defaults);

    const motionSummary =
      settings.reducedMotion === "system"
        ? `motion ${effectiveMotion === "reduce" ? "reduced" : "full"} (following system)`
        : `motion ${effectiveMotion === "reduce" ? "reduced" : "full"}`;

    return (
      <SurfacePanel
        ref={ref}
        data-testid={testId}
        padding="lg"
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-3">
          <SectionLabel id={`${id}-title`}>{title}</SectionLabel>
          <OutlineButton
            variant="ghost"
            controlSize="xs"
            onClick={resetSettings}
            disabled={isDefault}
            data-testid={testId ? `${testId}-reset` : undefined}
          >
            Reset to defaults
          </OutlineButton>
        </div>

        <Checkbox
          label="Hover effects (lift, shadow and glow)"
          checked={settings.hoverEffects}
          onChange={(event) => updateSettings({ hoverEffects: event.target.checked })}
          data-testid={testId ? `${testId}-hover` : undefined}
        />

        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND_CLASS}>Cursor on controls</legend>
          <SegmentedControl
            value={settings.cursorStyle}
            options={CURSOR_OPTIONS}
            onValueChange={(cursorStyle) => updateSettings({ cursorStyle })}
          />
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND_CLASS}>Motion</legend>
          <SegmentedControl
            value={settings.reducedMotion}
            options={MOTION_OPTIONS}
            onValueChange={(reducedMotion) => updateSettings({ reducedMotion })}
          />
          <p className="mt-1 text-ui-2xs text-[color:var(--ui-ink-subtle)]">
            Your system {systemPrefersReducedMotion ? "asks for" : "does not ask for"} reduced
            motion.
          </p>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className={LEGEND_CLASS}>Intensity</legend>
          <SegmentedControl
            value={settings.intensity}
            options={INTENSITY_OPTIONS}
            onValueChange={(intensity) => updateSettings({ intensity })}
          />
        </fieldset>

        {hidePreview ? null : (
          <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-2">
            <SectionLabel id={`${id}-preview`}>Preview</SectionLabel>
            <SurfacePanel
              tone="soft"
              spotlight={true}
              className="flex flex-wrap items-center gap-2"
              data-testid={testId ? `${testId}-preview` : undefined}
            >
              <OutlineButton variant="accent">Accent</OutlineButton>
              <OutlineButton>Neutral</OutlineButton>
              <OutlineButton disabled={true}>Disabled</OutlineButton>
            </SurfacePanel>
            <p aria-live="polite" className="text-ui-2xs text-[color:var(--ui-ink-subtle)]">
              {describe(settings, motionSummary)}
            </p>
          </section>
        )}
      </SurfacePanel>
    );
  }
);

EffectsSettingsPanel.displayName = "EffectsSettingsPanel";

export default EffectsSettingsPanel;
