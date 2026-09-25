import { z } from "zod";

import { cls } from "./schemas";

const DbBulkBarPropsSchema = z.object({
  count: z.number(),
  confirming: z.boolean(),
  busy: z.boolean(),
  onConfirm: z.custom<() => void>(),
  onExclude: z.custom<() => void>(),
  onCancel: z.custom<() => void>(),
});
type DbBulkBarProps = z.infer<typeof DbBulkBarPropsSchema>;

/** Bulk-exclusion bar — un-index every picked image (catalog + search +
 * graph). The originals stay on disk. */
export function DbBulkBar({ count, confirming, busy, onConfirm, onExclude, onCancel }: DbBulkBarProps) {
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-ui-xs"
      data-testid="db-bulk-bar"
    >
      <span className="font-medium text-ui-ink">{count} selected</span>
      <div className="ml-auto flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-rose-500">Un-index {count}? (files stay on disk)</span>
            <button className={cls.danger} onClick={onConfirm} disabled={busy} data-testid="db-bulk-confirm">
              {busy ? "Excluding…" : "Confirm exclude"}
            </button>
            <button className={cls.btn} onClick={onCancel} disabled={busy} data-testid="db-bulk-cancel">
              Cancel
            </button>
          </>
        ) : (
          <button className={cls.danger} onClick={onExclude} data-testid="db-bulk-exclude">
            Exclude selected
          </button>
        )}
      </div>
    </div>
  );
}
