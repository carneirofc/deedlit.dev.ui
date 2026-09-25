import type { CSSProperties } from "react";

export const panel = "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4";

export function gridCols(n: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` };
}
