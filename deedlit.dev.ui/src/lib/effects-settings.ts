/**
 * Effects settings: the pure model behind `EffectsSettingsProvider`.
 *
 * No React and no DOM here, so it is safe to import during SSR and is unit
 * tested on its own (`effects-settings.test.ts`). The provider owns the side
 * effects: reading/writing `localStorage` and the `data-ui-*` attributes.
 */

/** Whether interactive elements show the pointer cursor or the OS default. */
export type CursorStyle = "pointer" | "system";

/**
 * Motion preference. `system` follows `prefers-reduced-motion`; `reduce` and
 * `full` override it in either direction.
 */
export type ReducedMotionPreference = "system" | "reduce" | "full";

/** Scales hover lift, press scale and glow strength. */
export type EffectsIntensity = "subtle" | "normal" | "strong";

/** The motion level actually in force once `system` is resolved. */
export type EffectiveMotion = "reduce" | "full";

export interface EffectsSettings {
  /** Decorative hover effects: lift, lift shadow, glow, image zoom. */
  hoverEffects: boolean;
  cursorStyle: CursorStyle;
  reducedMotion: ReducedMotionPreference;
  intensity: EffectsIntensity;
}

/**
 * `localStorage` key. Namespaced to the package and versioned: a future
 * incompatible shape gets `:v2` and simply starts from defaults.
 */
export const EFFECTS_SETTINGS_STORAGE_KEY = "carneirofc-ui:effects:v1";

export const CURSOR_STYLES: readonly CursorStyle[] = ["pointer", "system"];
export const REDUCED_MOTION_PREFERENCES: readonly ReducedMotionPreference[] = [
  "system",
  "reduce",
  "full"
];
export const EFFECTS_INTENSITIES: readonly EffectsIntensity[] = ["subtle", "normal", "strong"];

/** Matches what styles.css does when no `data-ui-*` attribute is present. */
export const DEFAULT_EFFECTS_SETTINGS: Readonly<EffectsSettings> = Object.freeze({
  hoverEffects: true,
  cursorStyle: "pointer",
  reducedMotion: "system",
  intensity: "normal"
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function decode(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Parse settings from storage (a JSON string) or any untrusted value. Never
 * throws: missing, corrupt or unknown fields fall back to `defaults` one
 * field at a time, so a partially valid record keeps its valid parts.
 */
export function parseEffectsSettings(
  raw: unknown,
  defaults: Readonly<EffectsSettings> = DEFAULT_EFFECTS_SETTINGS
): EffectsSettings {
  const value = decode(raw);
  const record = isRecord(value) ? value : {};
  return {
    hoverEffects:
      typeof record.hoverEffects === "boolean" ? record.hoverEffects : defaults.hoverEffects,
    cursorStyle: pick(record.cursorStyle, CURSOR_STYLES, defaults.cursorStyle),
    reducedMotion: pick(record.reducedMotion, REDUCED_MOTION_PREFERENCES, defaults.reducedMotion),
    intensity: pick(record.intensity, EFFECTS_INTENSITIES, defaults.intensity)
  };
}

/** Serialize for storage. Writes only the known fields, in a stable order. */
export function serializeEffectsSettings(settings: Readonly<EffectsSettings>): string {
  const normalized = parseEffectsSettings(settings);
  return JSON.stringify({
    hoverEffects: normalized.hoverEffects,
    cursorStyle: normalized.cursorStyle,
    reducedMotion: normalized.reducedMotion,
    intensity: normalized.intensity
  });
}

/** Resolve `system` against the OS `prefers-reduced-motion` value. */
export function resolveEffectiveMotion(
  preference: ReducedMotionPreference,
  systemPrefersReducedMotion: boolean
): EffectiveMotion {
  if (preference === "system") {
    return systemPrefersReducedMotion ? "reduce" : "full";
  }
  return preference;
}

export function areEffectsSettingsEqual(
  a: Readonly<EffectsSettings>,
  b: Readonly<EffectsSettings>
): boolean {
  return (
    a.hoverEffects === b.hoverEffects &&
    a.cursorStyle === b.cursorStyle &&
    a.reducedMotion === b.reducedMotion &&
    a.intensity === b.intensity
  );
}

/** The `data-ui-*` attribute names written on `<html>`. */
export const EFFECTS_DATA_ATTRIBUTES = {
  hoverEffects: "data-ui-hover",
  cursorStyle: "data-ui-cursor",
  reducedMotion: "data-ui-motion",
  intensity: "data-ui-intensity"
} as const;

/**
 * Attribute map for the given settings, e.g. to spread on an element or to
 * render on `<html>` server-side when the settings are known there.
 */
export function effectsDataAttributes(
  settings: Readonly<EffectsSettings>
): Record<(typeof EFFECTS_DATA_ATTRIBUTES)[keyof typeof EFFECTS_DATA_ATTRIBUTES], string> {
  return {
    [EFFECTS_DATA_ATTRIBUTES.hoverEffects]: settings.hoverEffects ? "on" : "off",
    [EFFECTS_DATA_ATTRIBUTES.cursorStyle]: settings.cursorStyle,
    [EFFECTS_DATA_ATTRIBUTES.reducedMotion]: settings.reducedMotion,
    [EFFECTS_DATA_ATTRIBUTES.intensity]: settings.intensity
  };
}
