import { useMemo } from "react";

import {
  DEFAULT_SETTINGS,
  type LibrarySettings,
  type SafetyClass,
} from "@/lib/store/settings";

/** Convenience binders so each settings row reads/writes a single key. */
export function useSettingsBinders(
  settings: LibrarySettings,
  setKey: <K extends keyof LibrarySettings>(key: K, value: LibrarySettings[K]) => void,
) {
  const bool = (k: keyof LibrarySettings) => ({
    checked: settings[k] as boolean,
    onChange: (v: boolean) => setKey(k, v as never),
  });
  const seg = <T extends string>(k: keyof LibrarySettings) => ({
    value: settings[k] as T,
    onChange: (v: T) => setKey(k, v as never),
  });
  const slide = (k: keyof LibrarySettings) => ({
    value: settings[k] as number,
    onChange: (v: number) => setKey(k, v as never),
  });

  // Toggle one content-safety class in/out of the default-shown set.
  const toggleDefaultSafety = (c: SafetyClass) => {
    const cur = settings.defaultSafety;
    setKey("defaultSafety", cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  };

  return { bool, seg, slide, toggleDefaultSafety };
}

/** Whether `settings` differs from `DEFAULT_SETTINGS` (drives the reset button). */
export function useSettingsDirty(settings: LibrarySettings): boolean {
  return useMemo(
    () =>
      (Object.keys(DEFAULT_SETTINGS) as Array<keyof LibrarySettings>).some((k) => {
        const a = settings[k];
        const b = DEFAULT_SETTINGS[k];
        // Array settings (e.g. defaultSafety) compare by content, order-insensitive —
        // a reference compare would read as perpetually dirty after hydration.
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) return true;
          const sa = [...a].sort();
          const sb = [...b].sort();
          return sa.some((v, i) => v !== sb[i]);
        }
        return a !== b;
      }),
    [settings],
  );
}
