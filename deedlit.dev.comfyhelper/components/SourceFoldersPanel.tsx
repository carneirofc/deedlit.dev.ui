"use client";
import { z } from "zod";

import { useCallback, useEffect, useState } from "react";

import { PathInput } from "@/components/PathInput";
import { isAlreadyConfigured, normalizePath, splitPaths } from "@/lib/library/paths";
import { useActivity } from "@/lib/store/activity";

// ---------------------------------------------------------------------------
// Types mirroring the gateway SourceFolder shape (see lib/api-client.ts). The
// panel speaks to the in-app /api/library/folders proxy routes, which forward
// to the gateway; the catalog owns the data.
// ---------------------------------------------------------------------------
const SourceFolderSchema = z.object({
  id: z.string(),
  path: z.string(),
  label: z.string().nullable(),
  enabled: z.boolean(),
  recursive: z.boolean(),
  scan_interval_seconds: z.number(),
  last_scan_at: z.string().nullable(),
  last_scan_status: z.string().nullable(),
  last_error: z.string().nullable(),
  image_count: z.number(),
  labeled_count: z.number(),
  unlabeled_count: z.number(),
});
type SourceFolder = z.infer<typeof SourceFolderSchema>;

const BulkResultSchema = z.object({
  path: z.string(),
  status: z.enum(["added", "exists", "error"]),
  error: z.string().optional(),
});
type BulkResult = z.infer<typeof BulkResultSchema>;

const ScanResponseSchema = z.object({
  job_id: z.string().nullable().optional(),
});

// Shared style tokens (matches app/admin/page.tsx conventions).
const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  input:
    "w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
};

function scanStatusColor(status: string | null): string {
  switch (status) {
    case "running":
    case "queued":
      return "bg-sky-500/15 text-sky-500";
    case "completed":
      return "bg-emerald-500/15 text-emerald-500";
    case "failed":
      return "bg-rose-500/15 text-rose-500";
    default:
      return "bg-ui-bg text-ui-ink-muted";
  }
}

/** Compact relative-time label ("3m ago"), or "never". */
function relTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Loads folders + the library-wide unlabeled count, polling every 3s. */
function useFoldersList() {
  const [folders, setFolders] = useState<SourceFolder[]>([]);
  const [unlabeled, setUnlabeled] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/library/folders")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.folders)) setFolders(j.folders as SourceFolder[]);
      })
      .catch(() => {});
    fetch("/api/library/labels/unlabeled")
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.unlabeled === "number") setUnlabeled(j.unlabeled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  return { folders, unlabeled, refresh };
}

/** POST one folder; resolves to the per-path outcome (never throws). */
async function postFolder(
  folders: SourceFolder[],
  path: string,
  label: string | null,
  intervalSeconds: number,
): Promise<BulkResult> {
  if (isAlreadyConfigured(path, folders.map((f) => f.path))) {
    return { path, status: "exists" };
  }
  try {
    const res = await fetch("/api/library/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, label, scan_interval_seconds: intervalSeconds }),
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({})))?.error ?? "Add failed";
      return { path, status: "error", error: msg };
    }
    return { path, status: "added" };
  } catch (e) {
    return { path, status: "error", error: e instanceof Error ? e.message : "Add failed" };
  }
}

/** Add/update/remove/scan actions against /api/library/folders. */
function useFolderActions(folders: SourceFolder[], refresh: () => void) {
  const { fetchJson, trackJob } = useActivity();
  const [error, setError] = useState<string | null>(null);

  const addFolder = (path: string, label: string | null, intervalSeconds: number) =>
    postFolder(folders, path, label, intervalSeconds);

  const patchFolder = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    try {
      const res = await fetch(`/api/library/folders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const removeFolder = async (id: string) => {
    setError(null);
    try {
      await fetch(`/api/library/folders/${id}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    }
  };

  const scanNow = async (folder: SourceFolder) => {
    const name = folder.label || folder.path.split(/[\\/]/).pop() || folder.path;
    try {
      const j = await fetchJson<z.infer<typeof ScanResponseSchema>>(
        `Scan ${name}`,
        `/api/library/folders/${folder.id}/scan`,
        { method: "POST" },
      );
      trackJob(`Scan ${name}`, j.job_id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    }
  };

  return { error, setError, postFolder: addFolder, patchFolder, removeFolder, scanNow };
}

const AddFolderFormPropsSchema = z.object({
  folders: z.array(SourceFolderSchema),
  postFolder: z.custom<(path: string, label: string | null, intervalSeconds: number) => Promise<BulkResult>>(),
  onError: z.custom<(message: string | null) => void>(),
  onAdded: z.custom<() => void>(),
});
type AddFolderFormProps = z.infer<typeof AddFolderFormPropsSchema>;

const AddSingleFolderArgsSchema = z.object({
  folders: z.array(SourceFolderSchema),
  postFolder: z.custom<(path: string, label: string | null, intervalSeconds: number) => Promise<BulkResult>>(),
  onError: z.custom<(message: string | null) => void>(),
  onAdded: z.custom<() => void>(),
  newPath: z.string(),
  newLabel: z.string(),
  intervalSeconds: z.number(),
  setAdding: z.custom<(v: boolean) => void>(),
  setNewPath: z.custom<(v: string) => void>(),
  setNewLabel: z.custom<(v: string) => void>(),
});

/** Submits the single-folder add form; resolves once done (never throws). */
async function submitSingleFolder(args: z.infer<typeof AddSingleFolderArgsSchema>) {
  const { folders, postFolder, onError, onAdded, newLabel, intervalSeconds, setAdding, setNewPath, setNewLabel } = args;
  const path = normalizePath(args.newPath);
  if (!path) {
    onError("A folder path is required.");
    return;
  }
  if (isAlreadyConfigured(path, folders.map((f) => f.path))) {
    onError("That folder is already configured.");
    return;
  }
  setAdding(true);
  onError(null);
  const result = await postFolder(path, newLabel.trim() || null, intervalSeconds);
  setAdding(false);
  if (result.status === "error") {
    onError(result.error ?? "Add failed");
    return;
  }
  setNewPath("");
  setNewLabel("");
  onAdded();
}

const AddMultiFoldersArgsSchema = z.object({
  postFolder: z.custom<(path: string, label: string | null, intervalSeconds: number) => Promise<BulkResult>>(),
  onError: z.custom<(message: string | null) => void>(),
  onAdded: z.custom<() => void>(),
  multiText: z.string(),
  intervalSeconds: z.number(),
  setAdding: z.custom<(v: boolean) => void>(),
  setMultiText: z.custom<(v: string) => void>(),
  setBulkResults: z.custom<(v: BulkResult[]) => void>(),
});

/** Submits the bulk (one-per-line) add form; resolves once done. */
async function submitMultiFolders(args: z.infer<typeof AddMultiFoldersArgsSchema>) {
  const { postFolder, onError, onAdded, intervalSeconds, setAdding, setMultiText, setBulkResults } = args;
  const paths = splitPaths(args.multiText);
  if (paths.length === 0) {
    onError("Enter one folder path per line.");
    return;
  }
  setAdding(true);
  onError(null);
  setBulkResults([]);
  const results: BulkResult[] = [];
  for (const path of paths) {
    results.push(await postFolder(path, null, intervalSeconds));
  }
  setAdding(false);
  setBulkResults(results);
  // Drop the lines that succeeded / were dupes; leave failures to retry.
  const failed = results.filter((r) => r.status === "error").map((r) => r.path);
  setMultiText(failed.join("\n"));
  onAdded();
}

/** Local form state + submit handlers for {@link AddFolderForm}. */
function useAddFolderForm({ folders, postFolder, onError, onAdded }: AddFolderFormProps) {
  const [newPath, setNewPath] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIntervalMin, setNewIntervalMin] = useState("15");
  const [adding, setAdding] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [multiText, setMultiText] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  // Add-form interval (minutes) → seconds; defaults to 15min on bad input.
  const intervalSeconds = (): number => {
    const minutes = Number(newIntervalMin);
    return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes * 60)) : 900;
  };

  const addFolder = () =>
    submitSingleFolder({
      folders,
      postFolder,
      onError,
      onAdded,
      newPath,
      newLabel,
      intervalSeconds: intervalSeconds(),
      setAdding,
      setNewPath,
      setNewLabel,
    });

  const addMultiple = () =>
    submitMultiFolders({
      postFolder,
      onError,
      onAdded,
      multiText,
      intervalSeconds: intervalSeconds(),
      setAdding,
      setMultiText,
      setBulkResults,
    });

  return {
    newPath,
    setNewPath,
    newLabel,
    setNewLabel,
    newIntervalMin,
    setNewIntervalMin,
    adding,
    multiMode,
    setMultiMode,
    multiText,
    setMultiText,
    bulkResults,
    setBulkResults,
    addFolder,
    addMultiple,
  };
}

const AddFolderModeTogglePropsSchema = z.object({
  multiMode: z.boolean(),
  onToggle: z.custom<() => void>(),
});
type AddFolderModeToggleProps = z.infer<typeof AddFolderModeTogglePropsSchema>;

function AddFolderModeToggle({ multiMode, onToggle }: AddFolderModeToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ui-2xs text-ui-ink-muted">
        {multiMode ? "One folder path per line." : "Add a folder to watch."}
      </span>
      <button
        type="button"
        className="text-ui-2xs text-accent-cyan hover:underline"
        onClick={onToggle}
        data-testid="folder-multi-toggle"
      >
        {multiMode ? "← Single folder" : "Add multiple +"}
      </button>
    </div>
  );
}

function AddFolderForm(props: AddFolderFormProps) {
  const { onError } = props;
  const {
    newPath,
    setNewPath,
    newLabel,
    setNewLabel,
    newIntervalMin,
    setNewIntervalMin,
    adding,
    multiMode,
    setMultiMode,
    multiText,
    setMultiText,
    bulkResults,
    setBulkResults,
    addFolder,
    addMultiple,
  } = useAddFolderForm(props);

  return (
    <div className="flex flex-col gap-2">
      <AddFolderModeToggle
        multiMode={multiMode}
        onToggle={() => {
          setMultiMode((m) => !m);
          setBulkResults([]);
          onError(null);
        }}
      />

      {multiMode ? (
        <MultiFolderInput
          multiText={multiText}
          onMultiTextChange={setMultiText}
          newIntervalMin={newIntervalMin}
          onIntervalChange={setNewIntervalMin}
          adding={adding}
          onAddAll={addMultiple}
          bulkResults={bulkResults}
        />
      ) : (
        <SingleFolderInput
          folders={props.folders}
          newPath={newPath}
          onPathChange={setNewPath}
          newLabel={newLabel}
          onLabelChange={setNewLabel}
          newIntervalMin={newIntervalMin}
          onIntervalChange={setNewIntervalMin}
          adding={adding}
          onAdd={addFolder}
        />
      )}
    </div>
  );
}

const MultiFolderInputPropsSchema = z.object({
  multiText: z.string(),
  onMultiTextChange: z.custom<(v: string) => void>(),
  newIntervalMin: z.string(),
  onIntervalChange: z.custom<(v: string) => void>(),
  adding: z.boolean(),
  onAddAll: z.custom<() => void>(),
  bulkResults: z.array(BulkResultSchema),
});
type MultiFolderInputProps = z.infer<typeof MultiFolderInputPropsSchema>;

function MultiFolderInput({
  multiText,
  onMultiTextChange,
  newIntervalMin,
  onIntervalChange,
  adding,
  onAddAll,
  bulkResults,
}: MultiFolderInputProps) {
  const pathCount = splitPaths(multiText).length;
  return (
    <>
      <textarea
        className={`${cls.input} min-h-[5rem] font-mono`}
        value={multiText}
        onChange={(e) => onMultiTextChange(e.target.value)}
        placeholder={"K:/comfyui/output\nK:/comfyui/output/upscaled\n/mnt/share/renders"}
        spellCheck={false}
        data-testid="folder-multi-input"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-ui-xs text-ui-ink-muted">
          every
          <input
            className={`${cls.input} w-16`}
            type="number"
            min={0}
            value={newIntervalMin}
            onChange={(e) => onIntervalChange(e.target.value)}
            data-testid="folder-interval-input"
          />
          min
        </label>
        <button className={cls.btn} onClick={onAddAll} disabled={adding} data-testid="folder-add-multiple">
          {adding ? "Adding…" : "Add all"}
        </button>
        <span className="text-ui-2xs text-ui-ink-muted">
          {pathCount} path{pathCount === 1 ? "" : "s"}
        </span>
      </div>
      {bulkResults.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-ui-2xs" data-testid="folder-bulk-results">
          {bulkResults.map((r) => (
            <li
              key={r.path}
              className={
                r.status === "added" ? "text-emerald-500" : r.status === "exists" ? "text-ui-ink-muted" : "text-rose-500"
              }
            >
              {r.status === "added" ? "✓" : r.status === "exists" ? "•" : "✗"}{" "}
              <span className="font-mono">{r.path}</span>
              {r.status === "exists" ? " — already configured" : ""}
              {r.status === "error" && r.error ? ` — ${r.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const SingleFolderInputPropsSchema = z.object({
  folders: z.array(SourceFolderSchema),
  newPath: z.string(),
  onPathChange: z.custom<(v: string) => void>(),
  newLabel: z.string(),
  onLabelChange: z.custom<(v: string) => void>(),
  newIntervalMin: z.string(),
  onIntervalChange: z.custom<(v: string) => void>(),
  adding: z.boolean(),
  onAdd: z.custom<() => void>(),
});
type SingleFolderInputProps = z.infer<typeof SingleFolderInputPropsSchema>;

function SingleFolderInput({
  folders,
  newPath,
  onPathChange,
  newLabel,
  onLabelChange,
  newIntervalMin,
  onIntervalChange,
  adding,
  onAdd,
}: SingleFolderInputProps) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <PathInput
        className="min-w-[14rem] flex-1"
        inputClassName={`${cls.input} flex-1`}
        buttonClassName={cls.btn}
        value={newPath}
        onChange={onPathChange}
        onEnter={onAdd}
        placeholder="K:/comfyui/.../ComfyUI/output"
        pickerTitle="Choose a folder to watch"
        inputTestId="folder-path-input"
        buttonTestId="folder-browse"
        showPreview
        knownPaths={folders.map((f) => f.path)}
      />
      <input
        className={`${cls.input} w-36`}
        value={newLabel}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="Label (optional)"
        data-testid="folder-label-input"
      />
      <label className="flex items-center gap-1.5 text-ui-xs text-ui-ink-muted">
        every
        <input
          className={`${cls.input} w-16`}
          type="number"
          min={0}
          value={newIntervalMin}
          onChange={(e) => onIntervalChange(e.target.value)}
          data-testid="folder-interval-input"
        />
        min
      </label>
      <button className={cls.btn} onClick={onAdd} disabled={adding} data-testid="folder-add">
        {adding ? "Adding…" : "Add folder"}
      </button>
    </div>
  );
}

const FolderRowPropsSchema = z.object({
  folder: SourceFolderSchema,
  intervalEdit: z.string().optional(),
  onIntervalEdit: z.custom<(value: string) => void>(),
  onCommitInterval: z.custom<() => void>(),
  onPatch: z.custom<(body: Record<string, unknown>) => void>(),
  onScan: z.custom<() => void>(),
  onRemove: z.custom<() => void>(),
});
type FolderRowProps = z.infer<typeof FolderRowPropsSchema>;

const FolderSummaryPropsSchema = z.object({
  folder: SourceFolderSchema,
});
type FolderSummaryProps = z.infer<typeof FolderSummaryPropsSchema>;

function FolderSummary({ folder: f }: FolderSummaryProps) {
  const coverage = f.image_count > 0 ? Math.round((f.labeled_count / f.image_count) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-ui-xs text-ui-ink" title={f.path}>
        {f.label ? <span className="font-medium">{f.label} · </span> : null}
        {f.path}
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-ui-2xs text-ui-ink-muted">
        <span className={`rounded-full px-1.5 py-0.5 font-medium ${scanStatusColor(f.last_scan_status)}`}>
          {f.last_scan_status ?? "—"}
        </span>
        <span>scanned {relTime(f.last_scan_at)}</span>
        <span>
          {f.image_count} img · {f.labeled_count} labeled ({coverage}%)
          {f.unlabeled_count > 0 ? ` · ${f.unlabeled_count} to label` : ""}
        </span>
      </p>
      {f.last_error && (
        <p className="mt-0.5 truncate text-ui-2xs text-rose-500" title={f.last_error}>
          error: {f.last_error}
        </p>
      )}
    </div>
  );
}

const FolderControlsPropsSchema = z.object({
  folder: SourceFolderSchema,
  intervalMin: z.string(),
  onIntervalEdit: z.custom<(value: string) => void>(),
  onCommitInterval: z.custom<() => void>(),
  onPatch: z.custom<(body: Record<string, unknown>) => void>(),
  onScan: z.custom<() => void>(),
  onRemove: z.custom<() => void>(),
});
type FolderControlsProps = z.infer<typeof FolderControlsPropsSchema>;

function FolderControls({ folder: f, intervalMin, onIntervalEdit, onCommitInterval, onPatch, onScan, onRemove }: FolderControlsProps) {
  return (
    <>
      <label className="flex cursor-pointer items-center gap-1 text-ui-2xs text-ui-ink">
        <input
          type="checkbox"
          checked={f.enabled}
          onChange={() => onPatch({ enabled: !f.enabled })}
          data-testid={`folder-enabled-${f.id}`}
        />
        auto-scan
      </label>
      <label className="flex cursor-pointer items-center gap-1 text-ui-2xs text-ui-ink">
        <input
          type="checkbox"
          checked={f.recursive}
          onChange={() => onPatch({ recursive: !f.recursive })}
          data-testid={`folder-recursive-${f.id}`}
        />
        recursive
      </label>
      <label className="flex items-center gap-1 text-ui-2xs text-ui-ink-muted">
        every
        <input
          className={`${cls.input} w-14 px-2 py-1`}
          type="number"
          min={0}
          value={intervalMin}
          onChange={(e) => onIntervalEdit(e.target.value)}
          onBlur={onCommitInterval}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitInterval();
          }}
          data-testid={`folder-interval-${f.id}`}
        />
        min
      </label>
      <button className={cls.btn} onClick={onScan} data-testid={`folder-scan-${f.id}`}>
        Scan now
      </button>
      <button
        className="rounded-md border border-rose-500/40 px-2 py-1 text-ui-2xs text-rose-500 transition hover:bg-rose-500/10"
        onClick={onRemove}
        data-testid={`folder-remove-${f.id}`}
      >
        Remove
      </button>
    </>
  );
}

function FolderRow({ folder: f, intervalEdit, onIntervalEdit, onCommitInterval, onPatch, onScan, onRemove }: FolderRowProps) {
  const intervalMin = intervalEdit ?? String(Math.round(f.scan_interval_seconds / 60));

  return (
    <div className="rounded-lg border border-ui-border/50 bg-ui-bg p-3" data-testid={`folder-row-${f.id}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FolderSummary folder={f} />
        <FolderControls
          folder={f}
          intervalMin={intervalMin}
          onIntervalEdit={onIntervalEdit}
          onCommitInterval={onCommitInterval}
          onPatch={onPatch}
          onScan={onScan}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

export function SourceFoldersPanel() {
  const { folders, unlabeled, refresh } = useFoldersList();
  const { error, setError, postFolder, patchFolder, removeFolder, scanNow } = useFolderActions(folders, refresh);
  const [intervalEdits, setIntervalEdits] = useState<Record<string, string>>({});

  const commitInterval = (folder: SourceFolder) => {
    const raw = intervalEdits[folder.id];
    if (raw === undefined) return;
    const minutes = Number(raw);
    setIntervalEdits((prev) => {
      const next = { ...prev };
      delete next[folder.id];
      return next;
    });
    if (!Number.isFinite(minutes)) return;
    const seconds = Math.max(0, Math.round(minutes * 60));
    if (seconds !== folder.scan_interval_seconds) {
      patchFolder(folder.id, { scan_interval_seconds: seconds });
    }
  };

  return (
    <section className={cls.card} data-testid="folders-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">
          Source folders
          <span className="ml-2 text-ui-2xs text-ui-ink-muted">live · 3s · auto-scan</span>
        </h2>
        {unlabeled !== null && (
          <span className="text-ui-2xs text-ui-ink-muted" data-testid="unlabeled-count">
            {unlabeled} image{unlabeled === 1 ? "" : "s"} unlabeled library-wide
          </span>
        )}
      </div>

      <AddFolderForm folders={folders} postFolder={postFolder} onError={setError} onAdded={refresh} />

      {error && (
        <p className="mt-2 text-ui-xs text-rose-500" data-testid="folders-error">
          {error}
        </p>
      )}

      {/* Folder list */}
      <div className="mt-3 flex flex-col gap-1">
        {folders.length === 0 ? (
          <p className="text-ui-sm text-ui-ink-muted">No folders configured yet.</p>
        ) : (
          folders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              intervalEdit={intervalEdits[f.id]}
              onIntervalEdit={(value) => setIntervalEdits((prev) => ({ ...prev, [f.id]: value }))}
              onCommitInterval={() => commitInterval(f)}
              onPatch={(body) => patchFolder(f.id, body)}
              onScan={() => scanNow(f)}
              onRemove={() => removeFolder(f.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default SourceFoldersPanel;
