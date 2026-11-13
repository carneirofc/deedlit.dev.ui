// Run with `pnpm --filter @carneirofc/ui test` (Node's built-in runner; Node
// strips the TypeScript types itself, so there is no test dependency).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  areEffectsSettingsEqual,
  DEFAULT_EFFECTS_SETTINGS,
  EFFECTS_SETTINGS_STORAGE_KEY,
  type EffectsSettings,
  effectsDataAttributes,
  parseEffectsSettings,
  resolveEffectiveMotion,
  serializeEffectsSettings
} from "./effects-settings.ts";

const custom: EffectsSettings = {
  hoverEffects: false,
  cursorStyle: "system",
  reducedMotion: "reduce",
  intensity: "strong"
};

describe("parseEffectsSettings", () => {
  it("returns the defaults for missing values", () => {
    assert.deepEqual(parseEffectsSettings(null), DEFAULT_EFFECTS_SETTINGS);
    assert.deepEqual(parseEffectsSettings(undefined), DEFAULT_EFFECTS_SETTINGS);
    assert.deepEqual(parseEffectsSettings(""), DEFAULT_EFFECTS_SETTINGS);
  });

  it("returns the defaults for corrupt JSON and non-objects", () => {
    assert.deepEqual(parseEffectsSettings("{not json"), DEFAULT_EFFECTS_SETTINGS);
    assert.deepEqual(parseEffectsSettings("42"), DEFAULT_EFFECTS_SETTINGS);
    assert.deepEqual(parseEffectsSettings('"strong"'), DEFAULT_EFFECTS_SETTINGS);
    assert.deepEqual(parseEffectsSettings("[1,2]"), DEFAULT_EFFECTS_SETTINGS);
  });

  it("reads a full valid record from a JSON string or an object", () => {
    assert.deepEqual(parseEffectsSettings(JSON.stringify(custom)), custom);
    assert.deepEqual(parseEffectsSettings(custom), custom);
  });

  it("keeps valid fields and defaults invalid ones individually", () => {
    const parsed = parseEffectsSettings(
      JSON.stringify({ hoverEffects: "no", cursorStyle: "system", intensity: "extreme" })
    );
    assert.deepEqual(parsed, { ...DEFAULT_EFFECTS_SETTINGS, cursorStyle: "system" });
  });

  it("ignores unknown fields", () => {
    const parsed = parseEffectsSettings({ ...custom, theme: "dark" });
    assert.deepEqual(parsed, custom);
  });

  it("falls back to caller-supplied defaults", () => {
    assert.deepEqual(parseEffectsSettings("garbage", custom), custom);
    assert.deepEqual(parseEffectsSettings({ intensity: "subtle" }, custom), {
      ...custom,
      intensity: "subtle"
    });
  });
});

describe("serializeEffectsSettings", () => {
  it("round-trips through parse", () => {
    assert.deepEqual(parseEffectsSettings(serializeEffectsSettings(custom)), custom);
  });

  it("writes only the known fields", () => {
    const extra = { ...custom, junk: 1 } as EffectsSettings;
    assert.deepEqual(Object.keys(JSON.parse(serializeEffectsSettings(extra))), [
      "hoverEffects",
      "cursorStyle",
      "reducedMotion",
      "intensity"
    ]);
  });
});

describe("resolveEffectiveMotion", () => {
  it("follows the OS setting for system", () => {
    assert.equal(resolveEffectiveMotion("system", true), "reduce");
    assert.equal(resolveEffectiveMotion("system", false), "full");
  });

  it("lets an explicit preference override the OS setting", () => {
    assert.equal(resolveEffectiveMotion("reduce", false), "reduce");
    assert.equal(resolveEffectiveMotion("full", true), "full");
  });
});

describe("effectsDataAttributes", () => {
  it("maps settings onto the data-ui-* contract", () => {
    assert.deepEqual(effectsDataAttributes(custom), {
      "data-ui-hover": "off",
      "data-ui-cursor": "system",
      "data-ui-motion": "reduce",
      "data-ui-intensity": "strong"
    });
    assert.equal(effectsDataAttributes(DEFAULT_EFFECTS_SETTINGS)["data-ui-hover"], "on");
  });
});

describe("misc", () => {
  it("uses a namespaced, versioned storage key", () => {
    assert.equal(EFFECTS_SETTINGS_STORAGE_KEY, "carneirofc-ui:effects:v1");
  });

  it("compares settings field by field", () => {
    assert.ok(areEffectsSettingsEqual(custom, { ...custom }));
    assert.ok(!areEffectsSettingsEqual(custom, DEFAULT_EFFECTS_SETTINGS));
  });
});
