"use client";

import { z } from "zod";

import { cls } from "./constants";
import { MissingFileSchema, MissingFilesResultSchema, MissingStateSchema } from "./schemas";

const MissingFilesPanelPropsSchema = z.object({
  missingState: MissingStateSchema,
  missing: MissingFilesResultSchema.nullable(),
  missingError: z.string().nullable(),
  missingNotice: z.string().nullable(),
  selectedMissing: z.custom<Set<string>>(),
  deletingMissing: z.boolean(),
  scanMissingFiles: z.custom<() => void>(),
  toggleMissing: z.custom<(sha256: string) => void>(),
  toggleAllMissing: z.custom<() => void>(),
  deleteSelectedMissing: z.custom<() => void>(),
});
type MissingFilesPanelProps = z.infer<typeof MissingFilesPanelPropsSchema>;

const MissingFileRowPropsSchema = z.object({
  file: MissingFileSchema,
  selected: z.boolean(),
  toggleMissing: z.custom<(sha256: string) => void>(),
});
type MissingFileRowProps = z.infer<typeof MissingFileRowPropsSchema>;

function MissingFileRow({ file, selected, toggleMissing }: MissingFileRowProps) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-ui-bg-soft/60">
        <input
          type="checkbox"
          className="mt-0.5 rounded"
          checked={selected}
          onChange={() => toggleMissing(file.sha256)}
          data-testid={`missing-row-${file.sha256}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui-xs text-ui-ink" title={file.filepath}>
            {file.filepath}
          </span>
          <span className="block truncate font-mono text-ui-2xs text-ui-ink-muted">
            {file.sha256.slice(0, 16)}…
          </span>
        </span>
      </label>
    </li>
  );
}

const MissingFilesListPropsSchema = z.object({
  missingFiles: z.array(MissingFileSchema),
  selectedMissing: z.custom<Set<string>>(),
  deletingMissing: z.boolean(),
  toggleMissing: z.custom<(sha256: string) => void>(),
  toggleAllMissing: z.custom<() => void>(),
  deleteSelectedMissing: z.custom<() => void>(),
});
type MissingFilesListProps = z.infer<typeof MissingFilesListPropsSchema>;

function MissingFilesList({
  missingFiles,
  selectedMissing,
  deletingMissing,
  toggleMissing,
  toggleAllMissing,
  deleteSelectedMissing,
}: MissingFilesListProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-ui-xs text-ui-ink">
          <input
            type="checkbox"
            className="rounded"
            checked={selectedMissing.size === missingFiles.length && missingFiles.length > 0}
            onChange={toggleAllMissing}
            data-testid="missing-select-all"
          />
          Select all ({selectedMissing.size}/{missingFiles.length})
        </label>
        <button
          className={`${cls.btn} border-rose-500/50 text-rose-500 hover:bg-rose-500/10`}
          onClick={deleteSelectedMissing}
          disabled={deletingMissing || selectedMissing.size === 0}
          data-testid="missing-delete-selected"
        >
          {deletingMissing
            ? "Cleaning up…"
            : `Delete ${selectedMissing.size} selected entr${selectedMissing.size === 1 ? "y" : "ies"}`}
        </button>
      </div>

      <ul className="flex max-h-96 flex-col gap-0.5 overflow-y-auto rounded-lg border border-ui-border/50 bg-ui-bg p-2">
        {missingFiles.map((m) => (
          <MissingFileRow
            key={m.sha256}
            file={m}
            selected={selectedMissing.has(m.sha256)}
            toggleMissing={toggleMissing}
          />
        ))}
      </ul>
    </>
  );
}

const MissingFilesResultsPropsSchema = z.object({
  missing: MissingFilesResultSchema,
  selectedMissing: z.custom<Set<string>>(),
  deletingMissing: z.boolean(),
  toggleMissing: z.custom<(sha256: string) => void>(),
  toggleAllMissing: z.custom<() => void>(),
  deleteSelectedMissing: z.custom<() => void>(),
});
type MissingFilesResultsProps = z.infer<typeof MissingFilesResultsPropsSchema>;

function MissingFilesResults({
  missing,
  selectedMissing,
  deletingMissing,
  toggleMissing,
  toggleAllMissing,
  deleteSelectedMissing,
}: MissingFilesResultsProps) {
  return (
    <div className="mt-2 flex flex-col gap-3" data-testid="missing-results">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-2xs text-ui-ink-muted">
        <span>
          Checked <span className="tabular-nums text-ui-ink">{missing.checked}</span> · found{" "}
          <span className="tabular-nums text-ui-ink">{missing.missingCount}</span> missing
        </span>
        {missing.truncated && (
          <span className="text-amber-500">
            showing first {missing.missing.length} — re-scan after cleanup for the rest
          </span>
        )}
      </div>

      {missing.missing.length === 0 ? (
        <p className="text-ui-sm text-emerald-500" data-testid="missing-empty">
          No missing files — every cataloged image still has its source on disk.
        </p>
      ) : (
        <MissingFilesList
          missingFiles={missing.missing}
          selectedMissing={selectedMissing}
          deletingMissing={deletingMissing}
          toggleMissing={toggleMissing}
          toggleAllMissing={toggleAllMissing}
          deleteSelectedMissing={deleteSelectedMissing}
        />
      )}
    </div>
  );
}

export function MissingFilesPanel({
  missingState,
  missing,
  missingError,
  missingNotice,
  selectedMissing,
  deletingMissing,
  scanMissingFiles,
  toggleMissing,
  toggleAllMissing,
  deleteSelectedMissing,
}: MissingFilesPanelProps) {
  return (
    <section className={cls.card} data-testid="missing-files-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-ui-sm font-semibold text-ui-ink-title">Missing files</h2>
          <p className="text-ui-2xs text-ui-ink-muted">
            Find cataloged images whose source file vanished from disk, then un-index the stale entries.
          </p>
        </div>
        <button
          className={cls.btn}
          onClick={scanMissingFiles}
          disabled={missingState === "scanning"}
          data-testid="missing-scan"
        >
          {missingState === "scanning" ? "Scanning…" : "Scan for missing files"}
        </button>
      </div>

      {missingError && (
        <p className="text-ui-sm text-rose-500" data-testid="missing-error">
          {missingError}
        </p>
      )}
      {missingNotice && (
        <p className="text-ui-sm text-emerald-500" data-testid="missing-notice">
          {missingNotice}
        </p>
      )}

      {missing && (
        <MissingFilesResults
          missing={missing}
          selectedMissing={selectedMissing}
          deletingMissing={deletingMissing}
          toggleMissing={toggleMissing}
          toggleAllMissing={toggleAllMissing}
          deleteSelectedMissing={deleteSelectedMissing}
        />
      )}
    </section>
  );
}
