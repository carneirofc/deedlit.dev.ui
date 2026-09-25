"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

const MAX = 4;
const STORAGE_KEY = "comfyhelper-compare-tray";

const StoredIdsSchema = z
  .array(z.unknown())
  .transform((values) => values.filter((x): x is string => typeof x === "string").slice(0, MAX));

const CompareTrayValueSchema = z.object({
  ids: z.array(z.string()),
  has: z.custom<(id: string) => boolean>(),
  add: z.custom<(id: string) => void>(),
  remove: z.custom<(id: string) => void>(),
  toggle: z.custom<(id: string) => void>(),
  clear: z.custom<() => void>(),
  isFull: z.boolean(),
  max: z.number(),
});
type CompareTrayValue = z.infer<typeof CompareTrayValueSchema>;

const CompareTrayContext = createContext<CompareTrayValue | null>(null);

const CompareTrayProviderPropsSchema = z.object({
  children: z.custom<ReactNode>(),
});
type CompareTrayProviderProps = z.infer<typeof CompareTrayProviderPropsSchema>;

/**
 * Holds the set of images queued for side-by-side comparison.  Persisted to
 * sessionStorage so the selection survives navigation between library pages.
 */
export function CompareTrayProvider({ children }: CompareTrayProviderProps) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = StoredIdsSchema.safeParse(JSON.parse(raw));
        // Syncing React state from an external system (sessionStorage) on
        // mount, not state derived from props/state — the sanctioned effect
        // pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.success) setIds(parsed.data);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // ignore quota / disabled storage
    }
  }, [ids]);

  const add = useCallback(
    (id: string) => setIds((p) => (p.includes(id) || p.length >= MAX ? p : [...p, id])),
    [],
  );
  const remove = useCallback((id: string) => setIds((p) => p.filter((x) => x !== id)), []);
  const toggle = useCallback(
    (id: string) =>
      setIds((p) =>
        p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id],
      ),
    [],
  );
  const clear = useCallback(() => setIds([]), []);

  const value = useMemo<CompareTrayValue>(
    () => ({
      ids,
      has: (id: string) => ids.includes(id),
      add,
      remove,
      toggle,
      clear,
      isFull: ids.length >= MAX,
      max: MAX,
    }),
    [ids, add, remove, toggle, clear],
  );

  return <CompareTrayContext.Provider value={value}>{children}</CompareTrayContext.Provider>;
}

export function useCompareTray(): CompareTrayValue {
  const ctx = useContext(CompareTrayContext);
  if (!ctx) throw new Error("useCompareTray must be used within CompareTrayProvider");
  return ctx;
}
