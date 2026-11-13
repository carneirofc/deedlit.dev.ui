import type { Meta, StoryObj } from "@storybook/react-vite";

import EffectsSettingsPanel from "./EffectsSettingsPanel";

/**
 * Controls for the interaction-effects settings. Every story is wrapped in
 * `EffectsSettingsProvider` by the global decorator, so changes here flip the
 * `data-ui-*` attributes on `<html>` exactly as in an app (the toolbar's
 * effects menus drive the same provider).
 */
const meta = {
  title: "Components/EffectsSettingsPanel",
  component: EffectsSettingsPanel,
  tags: ["autodocs"],
  args: { className: "w-[22rem]", testId: "effects-panel" }
} satisfies Meta<typeof EffectsSettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutPreview: Story = {
  args: { hidePreview: true, title: "Effects" }
};
