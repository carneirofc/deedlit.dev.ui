"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { ChevronRightIcon, DocumentIcon, FolderIcon } from "./Icons";
import OutlineButton from "./OutlineButton";

export const FsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
});
export type FsEntry = z.infer<typeof FsEntrySchema>;

export const FsRootSchema = z.object({
  label: z.string(),
  path: z.string(),
});
export type FsRoot = z.infer<typeof FsRootSchema>;

export const FsBrowseResultSchema = z.object({
  path: z.string().nullable(),
  parent: z.string().nullable(),
  separator: z.string(),
  entries: z.array(FsEntrySchema),
  roots: z.array(FsRootSchema),
});
export type FsBrowseResult = z.infer<typeof FsBrowseResultSchema>;

/** Default endpoint that resolves a server-side filesystem listing. */
export const DEFAULT_FS_BROWSE_ENDPOINT = "/api/library/fs/browse";

export const DirectoryPickerPropsSchema = z.object({
  open: z.boolean(),
  /** Folder to open at first; falls back to the roots view when empty/invalid. */
  initialPath: z.string().optional(),
  title: z.string().optional(),
  onClose: z.custom<() => void>(),
  onSelect: z.custom<(path: string) => void>(),
  /**
   * Endpoint that returns an {@link FsBrowseResult}. Called as
   * `${browseEndpoint}?path=<encoded>`; called with no query for the roots view.
   * Defaults to {@link DEFAULT_FS_BROWSE_ENDPOINT}.
   */
  browseEndpoint: z.string().optional(),
});
export type DirectoryPickerProps = z.infer<typeof DirectoryPickerPropsSchema>;

/** State + browse logic shared between the path bar, roots bar, and listing. */
function useDirectoryBrowse(open: boolean, initialPath: string | undefined, browseEndpoint: string) {
  const [data, setData] = useState<FsBrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const browse = useCallback(
    async (target: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const qs = target ? `?path=${encodeURIComponent(target)}` : "";
        const res = await fetch(`${browseEndpoint}${qs}`);
        const json: unknown = await res.json();
        if (!res.ok) {
          const message = z.object({ error: z.string().optional() }).safeParse(json).data?.error;
          throw new Error(message ?? "Unable to read folder.");
        }
        const result = FsBrowseResultSchema.parse(json);
        // On success replace the view; on failure we keep the previous listing
        // (typically the roots view) so the picker stays navigable.
        setData(result);
        setManual(result.path ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to read folder.");
      } finally {
        setLoading(false);
      }
    },
    [browseEndpoint],
  );

  // On open: load the roots view first (always succeeds, populates drive
  // shortcuts), then try to descend into the current value if there is one.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      await browse(null);
      if (!cancelled && initialPath && initialPath.trim()) {
        await browse(initialPath.trim());
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when the modal opens.
  }, [open]);

  return { data, loading, error, manual, setManual, browse };
}

export const PathBarPropsSchema = z.object({
  data: FsBrowseResultSchema.nullable(),
  loading: z.boolean(),
  manual: z.string(),
  onManualChange: z.custom<(value: string) => void>(),
  onBrowse: z.custom<(target: string | null) => void>(),
});
type PathBarProps = z.infer<typeof PathBarPropsSchema>;

function PathBar({ data, loading, manual, onManualChange, onBrowse }: PathBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <OutlineButton
        controlSize="sm"
        onClick={() => onBrowse(data?.parent ?? null)}
        disabled={loading || !data?.path}
        tooltip="Up one level"
        data-testid="directory-picker-up"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
        Up
      </OutlineButton>
      <input
        className="cyber-input min-w-[12rem] flex-1 rounded-lg px-3 py-2 font-mono text-ui-xs outline-none"
        value={manual}
        onChange={(event) => onManualChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onBrowse(manual.trim() || null);
        }}
        placeholder="Type or paste a folder path…"
        spellCheck={false}
        data-testid="directory-picker-path"
      />
      <OutlineButton
        controlSize="sm"
        onClick={() => onBrowse(manual.trim() || null)}
        disabled={loading}
        data-testid="directory-picker-go"
      >
        Go
      </OutlineButton>
    </div>
  );
}

export const RootsBarPropsSchema = z.object({
  roots: z.array(FsRootSchema),
  onBrowse: z.custom<(target: string | null) => void>(),
});
type RootsBarProps = z.infer<typeof RootsBarPropsSchema>;

function RootsBar({ roots, onBrowse }: RootsBarProps) {
  if (roots.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {roots.map((root) => (
        <button
          key={root.path}
          type="button"
          onClick={() => onBrowse(root.path)}
          data-testid={`directory-picker-root-${root.path}`}
          className="rounded-full border border-ui-border bg-ui-bg-soft px-2.5 py-1 font-mono text-ui-2xs text-ui-ink-muted transition hover:border-accent-cyan hover:text-accent-cyan"
        >
          {root.label}
        </button>
      ))}
    </div>
  );
}

export const EntryListPropsSchema = z.object({
  data: FsBrowseResultSchema.nullable(),
  loading: z.boolean(),
  error: z.string().nullable(),
  onBrowse: z.custom<(target: string | null) => void>(),
});
type EntryListProps = z.infer<typeof EntryListPropsSchema>;

function EntryList({ data, loading, error, onBrowse }: EntryListProps) {
  return (
    <div className="mt-3 h-72 overflow-auto rounded-xl border border-ui-border bg-ui-bg/40 custom-scrollbar">
      {loading && !data ? (
        <p className="p-4 text-ui-sm text-ui-ink-muted">Loading…</p>
      ) : error ? (
        <p className="p-4 text-ui-sm text-error-ink">{error}</p>
      ) : !data || data.entries.length === 0 ? (
        <p className="p-4 text-ui-sm text-ui-ink-muted">This folder is empty.</p>
      ) : (
        <ul className="divide-y divide-ui-border/50">
          {data.entries.map((entry) =>
            entry.isDirectory ? (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => onBrowse(entry.path)}
                  data-testid={`directory-picker-entry-${entry.path}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-ui-sm text-ui-ink transition hover:bg-accent-cyan/10"
                >
                  <FolderIcon className="h-4 w-4 text-accent-cyan" />
                  <span className="truncate">{entry.name}</span>
                  <ChevronRightIcon className="ml-auto h-4 w-4 text-ui-ink-faint" />
                </button>
              </li>
            ) : (
              <li key={entry.path} className="flex items-center gap-2 px-3 py-2 text-ui-sm text-ui-ink-faint">
                <DocumentIcon className="h-4 w-4" />
                <span className="truncate">{entry.name}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Modal that browses the server filesystem (via `browseEndpoint`) and returns
 * the absolute path of a chosen folder. Navigate into the target folder, then
 * confirm with "Select this folder".
 */
export function DirectoryPicker({
  open,
  initialPath,
  title = "Select a folder",
  onClose,
  onSelect,
  browseEndpoint = DEFAULT_FS_BROWSE_ENDPOINT,
}: DirectoryPickerProps) {
  const { data, loading, error, manual, setManual, browse } = useDirectoryBrowse(open, initialPath, browseEndpoint);
  const current = data?.path ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent size="lg" data-testid="directory-picker">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Browse the server filesystem and choose a folder.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <PathBar data={data} loading={loading} manual={manual} onManualChange={setManual} onBrowse={browse} />
          <RootsBar roots={data?.roots ?? []} onBrowse={browse} />
          <EntryList data={data} loading={loading} error={error} onBrowse={browse} />
        </DialogBody>

        <DialogFooter className="justify-between gap-3">
          <span
            className="min-w-0 flex-1 truncate font-mono text-ui-xs text-ui-ink-muted"
            title={current ?? undefined}
          >
            {current ?? "No folder selected"}
          </span>
          <div className="flex shrink-0 gap-2">
            <OutlineButton variant="ghost" onClick={onClose} data-testid="directory-picker-cancel">
              Cancel
            </OutlineButton>
            <OutlineButton
              variant="accent"
              disabled={!current}
              onClick={() => current && onSelect(current)}
              data-testid="directory-picker-select"
            >
              Select this folder
            </OutlineButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DirectoryPicker;
