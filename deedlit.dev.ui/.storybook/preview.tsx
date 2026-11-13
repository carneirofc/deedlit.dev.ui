import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import { EffectsSettingsProvider, useEffectsSettings } from "../src/EffectsSettings";
import { parseEffectsSettings } from "../src/lib/effects-settings";
import "./preview.css";

type ThemeName = "light" | "dark";

/** Apply the selected theme the same way the app does: a `data-theme` attribute
 *  on the document element, which flips the CSS-variable design tokens. */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as ThemeName) ?? "light";

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    return () => {
      root.removeAttribute("data-theme");
    };
  }, [theme]);

  return <Story />;
};

/** Push the toolbar's effects choices into the provider whenever they change. */
function SyncEffectsToolbar({ globals }: { globals: Record<string, unknown> }) {
  const { updateSettings } = useEffectsSettings();
  const { effectsHover, effectsCursor, effectsMotion, effectsIntensity } = globals;
  useEffect(() => {
    updateSettings(
      parseEffectsSettings({
        hoverEffects: effectsHover !== "off",
        cursorStyle: effectsCursor,
        reducedMotion: effectsMotion,
        intensity: effectsIntensity
      })
    );
  }, [updateSettings, effectsHover, effectsCursor, effectsMotion, effectsIntensity]);
  return null;
}

/** Wrap every story in the effects provider, exactly as an app layout would.
 *  A separate storage key keeps the Storybook sandbox out of the real one. */
const withEffects: Decorator = (Story, context) => (
  <EffectsSettingsProvider storageKey="carneirofc-ui:storybook:effects:v1">
    <SyncEffectsToolbar globals={context.globals} />
    <Story />
  </EffectsSettingsProvider>
);

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      // 'todo' surfaces a11y violations in the panel without failing the build.
      test: "todo"
    }
  },
  initialGlobals: {
    theme: "light",
    effectsHover: "on",
    effectsCursor: "pointer",
    effectsMotion: "system",
    effectsIntensity: "normal"
  },
  globalTypes: {
    theme: {
      description: "Design-system theme",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" }
        ],
        dynamicTitle: true
      }
    },
    effectsHover: {
      description: "Effects: decorative hover (data-ui-hover)",
      toolbar: {
        title: "Hover fx",
        icon: "lightning",
        items: [
          { value: "on", title: "Hover effects on" },
          { value: "off", title: "Hover effects off" }
        ],
        dynamicTitle: true
      }
    },
    effectsCursor: {
      description: "Effects: cursor on controls (data-ui-cursor)",
      toolbar: {
        title: "Cursor",
        icon: "pointerhand",
        items: [
          { value: "pointer", title: "Pointer cursor" },
          { value: "system", title: "System cursor" }
        ],
        dynamicTitle: true
      }
    },
    effectsMotion: {
      description: "Effects: motion (data-ui-motion)",
      toolbar: {
        title: "Motion",
        icon: "transfer",
        items: [
          { value: "system", title: "Motion: system" },
          { value: "reduce", title: "Motion: reduce" },
          { value: "full", title: "Motion: full" }
        ],
        dynamicTitle: true
      }
    },
    effectsIntensity: {
      description: "Effects: intensity (data-ui-intensity)",
      toolbar: {
        title: "Intensity",
        icon: "graphbar",
        items: [
          { value: "subtle", title: "Subtle" },
          { value: "normal", title: "Normal" },
          { value: "strong", title: "Strong" }
        ],
        dynamicTitle: true
      }
    }
  },
  decorators: [withEffects, withTheme]
};

export default preview;
