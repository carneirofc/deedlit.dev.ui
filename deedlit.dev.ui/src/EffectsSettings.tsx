"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";

import {
  DEFAULT_EFFECTS_SETTINGS,
  EFFECTS_DATA_ATTRIBUTES,
  EFFECTS_SETTINGS_STORAGE_KEY,
  type EffectiveMotion,
  type EffectsSettings,
  effectsDataAttributes,
  parseEffectsSettings,
  resolveEffectiveMotion,
  serializeEffectsSettings
} from "./lib/effects-settings";

export type EffectsSettingsUpdate =
  | Partial<EffectsSettings>
  | ((previous: EffectsSettings) => Partial<EffectsSettings>);

export interface EffectsSettingsContextValue {
  /** The user's choices (what is persisted). */
  settings: EffectsSettings;
  /** The defaults this provider resets to. */
  defaults: EffectsSettings;
  /** `reducedMotion` resolved against `prefers-reduced-motion`. */
  effectiveMotion: EffectiveMotion;
  /** Whether the OS currently asks for reduced motion. */
  systemPrefersReducedMotion: boolean;
  /** `true` once the stored settings have been read (always `false` on the server). */
  hydrated: boolean;
  /** Merge a partial update (or the result of an updater) into the settings. */
  updateSettings: (update: EffectsSettingsUpdate) => void;
  resetSettings: () => void;
}

export interface EffectsSettingsProviderProps {
  children: ReactNode;
  /**
   * Starting values before anything is stored, and what "reset" returns to.
   * Read once on mount.
   */
  defaultSettings?: Partial<EffectsSettings>;
  /** Override the storage key (e.g. to keep a sandbox separate). */
  storageKey?: string;
}

const EffectsSettingsContext = createContext<EffectsSettingsContextValue | null>(null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function readServerReducedMotion(): boolean {
  return false;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be disabled (privacy mode, sandboxed iframes).
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota or disabled storage: the settings still apply for this session.
  }
}

/**
 * Holds the user's interaction-effects settings, persists them to
 * `localStorage` and mirrors them onto `<html>` as `data-ui-hover`,
 * `data-ui-cursor`, `data-ui-motion` and `data-ui-intensity`, which
 * `styles.css` reads. Components need no props for this.
 *
 * SSR-safe: nothing touches `window` during render. The server (and the
 * first client render) uses the defaults; stored values apply after mount.
 *
 * Place it once near the root, e.g. in a Next.js `app/layout.tsx`:
 *
 * ```tsx
 * <html lang="en">
 *   <body>
 *     <EffectsSettingsProvider>{children}</EffectsSettingsProvider>
 *   </body>
 * </html>
 * ```
 */
export function EffectsSettingsProvider({
  children,
  defaultSettings,
  storageKey = EFFECTS_SETTINGS_STORAGE_KEY
}: EffectsSettingsProviderProps) {
  const [defaults] = useState(() =>
    parseEffectsSettings(defaultSettings ?? {}, DEFAULT_EFFECTS_SETTINGS)
  );
  const [settings, setSettings] = useState<EffectsSettings>(defaults);
  const [hydrated, setHydrated] = useState(false);

  const systemPrefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    readServerReducedMotion
  );

  // Load the stored settings once, then follow writes from other tabs.
  useEffect(() => {
    setSettings(parseEffectsSettings(readStored(storageKey), defaults));
    setHydrated(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setSettings(parseEffectsSettings(event.newValue, defaults));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, defaults]);

  // Persist only after the stored value was read, so defaults never clobber it.
  useEffect(() => {
    if (hydrated) {
      writeStored(storageKey, serializeEffectsSettings(settings));
    }
  }, [hydrated, settings, storageKey]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(effectsDataAttributes(settings))) {
      root.setAttribute(name, value);
    }
  }, [settings]);

  // Unmounting hands control back to the stylesheet defaults.
  useEffect(
    () => () => {
      const root = document.documentElement;
      for (const name of Object.values(EFFECTS_DATA_ATTRIBUTES)) {
        root.removeAttribute(name);
      }
    },
    []
  );

  const updateSettings = useCallback((update: EffectsSettingsUpdate) => {
    setSettings((previous) => {
      const patch = typeof update === "function" ? update(previous) : update;
      return parseEffectsSettings({ ...previous, ...patch }, previous);
    });
  }, []);

  const resetSettings = useCallback(() => setSettings(defaults), [defaults]);

  const value = useMemo<EffectsSettingsContextValue>(
    () => ({
      settings,
      defaults,
      effectiveMotion: resolveEffectiveMotion(settings.reducedMotion, systemPrefersReducedMotion),
      systemPrefersReducedMotion,
      hydrated,
      updateSettings,
      resetSettings
    }),
    [settings, defaults, systemPrefersReducedMotion, hydrated, updateSettings, resetSettings]
  );

  return (
    <EffectsSettingsContext.Provider value={value}>{children}</EffectsSettingsContext.Provider>
  );
}

/**
 * Read and change the effects settings. Must be used inside
 * `EffectsSettingsProvider`.
 */
export function useEffectsSettings(): EffectsSettingsContextValue {
  const context = useContext(EffectsSettingsContext);
  if (!context) {
    throw new Error("useEffectsSettings must be used inside <EffectsSettingsProvider>.");
  }
  return context;
}

export { EffectsSettingsContext };
