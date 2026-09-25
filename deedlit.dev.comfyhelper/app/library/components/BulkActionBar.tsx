"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";

import { TagSelect } from "@carneirofc/ui";

import type { ExportKind } from "@/lib/library/bulk-export";

type SafetyClass = "sfw" | "nsfw" | "explicit";
const SAFETY_CLASSES: SafetyClass[] = ["sfw", "nsfw", "explicit"];
const SAFETY_LABEL: Record<SafetyClass, string> = {
  sfw: "SFW",
  nsfw: "NSFW",
  explicit: "Explicit",
};

/** Which bulk action is mid-flight (drives the busy/disabled state). */
export type BulkBusy = "favorite" | "rating" | "safety" | "tags" | "export" | "move" | "delete" | null;

const btn =
  "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50";

const BulkActionBarPropsSchema = z.object({
  selectedCount: z.number(),
  totalCount: z.number(),
  busy: z.custom<BulkBusy>(),
  confirmingDelete: z.boolean(),
  onSelectAll: z.custom<() => void>(),
  onClear: z.custom<() => void>(),
  onFavorite: z.custom<(value: boolean) => void>(),
  /** Set a 0–5 rating; 0 clears the rating. */
  onRating: z.custom<(value: number) => void>(),
  onSafety: z.custom<(value: SafetyClass) => void>(),
  onAddTags: z.custom<(tags: string[]) => void>(),
  onRemoveTags: z.custom<(tags: string[]) => void>(),
  onExport: z.custom<(kind: ExportKind) => void>(),
  onMove: z.custom<(targetFolder: string) => void>(),
  onRequestDelete: z.custom<() => void>(),
  onConfirmDelete: z.custom<() => void>(),
  onCancelDelete: z.custom<() => void>(),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
});
type BulkActionBarProps = z.infer<typeof BulkActionBarPropsSchema>;

type MenuKey = "rating" | "safety" | "tags" | "export" | "move";

/**
 * The select-mode action bar: bulk metadata edits (favorite / rating / safety /
 * tags) + export + un-index over the current selection. Edits fan the per-image
 * PATCH route out client-side (see lib/library/bulk-patch); this component owns
 * only its menu/popover UI state and delegates the actual work to the page.
 */
function useBulkActionMenuState(rootRef: React.RefObject<HTMLDivElement | null>) {
  // Single open menu at a time; click-away closes it.
  const [menu, setMenu] = useState<MenuKey | null>(null);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [moveDraft, setMoveDraft] = useState("");

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu, rootRef]);

  const toggle = (key: MenuKey) => setMenu((m) => (m === key ? null : key));

  return { menu, setMenu, tagDraft, setTagDraft, moveDraft, setMoveDraft, toggle };
}

const BulkActionMenusPropsSchema = z.object({
  disabled: z.boolean(),
  busy: z.custom<BulkBusy>(),
  menuState: z.custom<ReturnType<typeof useBulkActionMenuState>>(),
  onRating: z.custom<(value: number) => void>(),
  onSafety: z.custom<(value: SafetyClass) => void>(),
  onAddTags: z.custom<(tags: string[]) => void>(),
  onRemoveTags: z.custom<(tags: string[]) => void>(),
  onExport: z.custom<(kind: ExportKind) => void>(),
  onMove: z.custom<(targetFolder: string) => void>(),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
});
type BulkActionMenusProps = z.infer<typeof BulkActionMenusPropsSchema>;

function BulkActionMenus({ disabled, busy, menuState: m, onRating, onSafety, onAddTags, onRemoveTags, onExport, onMove, fetchTagSuggestions }: BulkActionMenusProps) {
  return (
    <>
      <RatingMenu
        open={m.menu === "rating"}
        onToggle={() => m.toggle("rating")}
        disabled={disabled}
        busy={busy === "rating"}
        onRating={(n) => { onRating(n); m.setMenu(null); }}
      />

      <SafetyMenu
        open={m.menu === "safety"}
        onToggle={() => m.toggle("safety")}
        disabled={disabled}
        busy={busy === "safety"}
        onSafety={(c) => { onSafety(c); m.setMenu(null); }}
      />

      <TagsMenu
        open={m.menu === "tags"}
        onToggle={() => m.toggle("tags")}
        disabled={disabled}
        busy={busy === "tags"}
        tagDraft={m.tagDraft}
        setTagDraft={m.setTagDraft}
        fetchTagSuggestions={fetchTagSuggestions}
        onAddTags={(tags) => { onAddTags(tags); m.setTagDraft([]); m.setMenu(null); }}
        onRemoveTags={(tags) => { onRemoveTags(tags); m.setTagDraft([]); m.setMenu(null); }}
      />

      <ExportMenu
        open={m.menu === "export"}
        onToggle={() => m.toggle("export")}
        disabled={disabled}
        busy={busy === "export"}
        onExport={(kind) => { onExport(kind); m.setMenu(null); }}
      />

      <MoveMenu
        open={m.menu === "move"}
        onToggle={() => m.toggle("move")}
        disabled={disabled}
        busy={busy === "move"}
        moveDraft={m.moveDraft}
        setMoveDraft={m.setMoveDraft}
        onMove={(folder) => { onMove(folder); m.setMoveDraft(""); m.setMenu(null); }}
      />
    </>
  );
}

export function BulkActionBar({
  selectedCount, totalCount, busy, confirmingDelete, onSelectAll, onClear, onFavorite,
  onRating, onSafety, onAddTags, onRemoveTags, onExport, onMove,
  onRequestDelete, onConfirmDelete, onCancelDelete, fetchTagSuggestions,
}: BulkActionBarProps) {
  const none = selectedCount === 0;
  const anyBusy = busy !== null;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuState = useBulkActionMenuState(rootRef);

  return (
    <div
      ref={rootRef}
      className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent-cyan/40 bg-ui-bg-soft/90 px-3 py-2 backdrop-blur-sm"
    >
      <span className="text-ui-sm font-medium text-ui-ink">{selectedCount} selected</span>
      <button className={btn} onClick={onSelectAll} disabled={selectedCount === totalCount} data-testid="bulk-action-select-all">
        Select all
      </button>
      <button className={btn} onClick={onClear} disabled={none} data-testid="bulk-action-clear-selection">
        Clear
      </button>

      <div className="flex-1" />

      <FavoriteButtons busy={busy} disabled={none || anyBusy} onFavorite={onFavorite} />

      <BulkActionMenus
        disabled={none || anyBusy}
        busy={busy}
        menuState={menuState}
        onRating={onRating}
        onSafety={onSafety}
        onAddTags={onAddTags}
        onRemoveTags={onRemoveTags}
        onExport={onExport}
        onMove={onMove}
        fetchTagSuggestions={fetchTagSuggestions}
      />

      <DeleteControls
        confirmingDelete={confirmingDelete}
        selectedCount={selectedCount}
        disabled={none || anyBusy}
        busy={busy}
        onRequestDelete={onRequestDelete}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={onCancelDelete}
      />
    </div>
  );
}

const FavoriteButtonsPropsSchema = z.object({
  busy: z.custom<BulkBusy>(),
  disabled: z.boolean(),
  onFavorite: z.custom<(value: boolean) => void>(),
});
type FavoriteButtonsProps = z.infer<typeof FavoriteButtonsPropsSchema>;

function FavoriteButtons({ busy, disabled, onFavorite }: FavoriteButtonsProps) {
  return (
    <>
      <button
        className={`${btn} flex items-center gap-1.5`}
        onClick={() => onFavorite(true)}
        disabled={disabled}
        title="Mark selected as favorite"
        data-testid="bulk-action-favorite"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
        {busy === "favorite" ? "…" : "Favorite"}
      </button>
      <button
        className={btn}
        onClick={() => onFavorite(false)}
        disabled={disabled}
        title="Remove favorite from selected"
        data-testid="bulk-action-unfavorite"
      >
        Unfavorite
      </button>
    </>
  );
}

const MenuToggleablePropsSchema = z.object({
  open: z.boolean(),
  onToggle: z.custom<() => void>(),
  disabled: z.boolean(),
  busy: z.boolean(),
});

const RatingMenuPropsSchema = MenuToggleablePropsSchema.extend({
  onRating: z.custom<(value: number) => void>(),
});
type RatingMenuProps = z.infer<typeof RatingMenuPropsSchema>;

function RatingMenu({ open, onToggle, disabled, busy, onRating }: RatingMenuProps) {
  return (
    <Menu label="Rating" open={open} onToggle={onToggle} disabled={disabled} busy={busy} testId="bulk-action-rating-toggle">
      {[5, 4, 3, 2, 1].map((n) => (
        <MenuItem key={n} onClick={() => onRating(n)} testId={`bulk-action-rating-set-${n}`}>
          {"★".repeat(n)}
          <span className="text-ui-ink-muted">{"☆".repeat(5 - n)}</span>
        </MenuItem>
      ))}
      <MenuItem onClick={() => onRating(0)} testId="bulk-action-rating-clear">Clear rating</MenuItem>
    </Menu>
  );
}

const SafetyMenuPropsSchema = MenuToggleablePropsSchema.extend({
  onSafety: z.custom<(value: SafetyClass) => void>(),
});
type SafetyMenuProps = z.infer<typeof SafetyMenuPropsSchema>;

function SafetyMenu({ open, onToggle, disabled, busy, onSafety }: SafetyMenuProps) {
  return (
    <Menu label="Safety" open={open} onToggle={onToggle} disabled={disabled} busy={busy} testId="bulk-action-safety-toggle">
      {SAFETY_CLASSES.map((c) => (
        <MenuItem key={c} onClick={() => onSafety(c)} testId={`bulk-action-safety-set-${c}`}>
          {SAFETY_LABEL[c]}
        </MenuItem>
      ))}
    </Menu>
  );
}

const TagsMenuPropsSchema = MenuToggleablePropsSchema.extend({
  tagDraft: z.array(z.string()),
  setTagDraft: z.custom<(tags: string[]) => void>(),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
  onAddTags: z.custom<(tags: string[]) => void>(),
  onRemoveTags: z.custom<(tags: string[]) => void>(),
});
type TagsMenuProps = z.infer<typeof TagsMenuPropsSchema>;

function TagsMenu({ open, onToggle, disabled, busy, tagDraft, setTagDraft, fetchTagSuggestions, onAddTags, onRemoveTags }: TagsMenuProps) {
  return (
    <Menu label="Tags" open={open} onToggle={onToggle} disabled={disabled} busy={busy} width="w-72" testId="bulk-action-tags-toggle">
      <div className="flex flex-col gap-2 p-2">
        <TagSelect
          value={tagDraft}
          onChange={setTagDraft}
          fetchSuggestions={fetchTagSuggestions}
          placeholder="type tags to add or remove…"
          variant="include"
          testId="bulk-action-tags-select"
        />
        <div className="flex gap-2">
          <button
            className={`${btn} flex-1`}
            disabled={tagDraft.length === 0}
            onClick={() => onAddTags(tagDraft)}
            data-testid="bulk-action-tags-add"
          >
            Add to selected
          </button>
          <button
            className={`${btn} flex-1`}
            disabled={tagDraft.length === 0}
            onClick={() => onRemoveTags(tagDraft)}
            data-testid="bulk-action-tags-remove"
          >
            Remove
          </button>
        </div>
      </div>
    </Menu>
  );
}

const ExportMenuPropsSchema = MenuToggleablePropsSchema.extend({
  onExport: z.custom<(kind: ExportKind) => void>(),
});
type ExportMenuProps = z.infer<typeof ExportMenuPropsSchema>;

function ExportMenu({ open, onToggle, disabled, busy, onExport }: ExportMenuProps) {
  return (
    <Menu label={busy ? "Exporting…" : "Export"} open={open} onToggle={onToggle} disabled={disabled} busy={busy} width="w-60" testId="bulk-action-export-toggle">
      <MenuLabel>Complete record</MenuLabel>
      <MenuItem onClick={() => onExport("complete-json")} testId="bulk-action-export-complete-json">JSON (.json)</MenuItem>
      <MenuItem onClick={() => onExport("complete-jsonl")} testId="bulk-action-export-complete-jsonl">JSON Lines (.jsonl)</MenuItem>
      <MenuLabel>Simple · id · sha · path · basics</MenuLabel>
      <MenuItem onClick={() => onExport("simple-csv")} testId="bulk-action-export-simple-csv">CSV (.csv)</MenuItem>
      <MenuItem onClick={() => onExport("simple-json")} testId="bulk-action-export-simple-json">JSON (.json)</MenuItem>
      <MenuItem onClick={() => onExport("simple-jsonl")} testId="bulk-action-export-simple-jsonl">JSON Lines (.jsonl)</MenuItem>
    </Menu>
  );
}

const MoveMenuPropsSchema = MenuToggleablePropsSchema.extend({
  moveDraft: z.string(),
  setMoveDraft: z.custom<(v: string) => void>(),
  onMove: z.custom<(targetFolder: string) => void>(),
});
type MoveMenuProps = z.infer<typeof MoveMenuPropsSchema>;

function MoveMenu({ open, onToggle, disabled, busy, moveDraft, setMoveDraft, onMove }: MoveMenuProps) {
  const submit = () => {
    if (!moveDraft.trim()) return;
    onMove(moveDraft.trim());
  };
  return (
    <Menu label={busy ? "Moving…" : "Move"} open={open} onToggle={onToggle} disabled={disabled} busy={busy} width="w-72" testId="bulk-action-move-toggle">
      <div className="flex flex-col gap-2 p-2">
        <p className="text-ui-2xs text-ui-ink-muted">Target folder (absolute path). Files are moved on disk; re-ingest the folder to update catalog paths.</p>
        <input
          className="w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan"
          placeholder="/path/to/target/folder"
          value={moveDraft}
          onChange={(e) => setMoveDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          data-testid="bulk-action-move-input"
        />
        <button className={btn} disabled={!moveDraft.trim()} onClick={submit} data-testid="bulk-action-move-submit">
          Move selected
        </button>
      </div>
    </Menu>
  );
}

const DeleteControlsPropsSchema = z.object({
  confirmingDelete: z.boolean(),
  selectedCount: z.number(),
  disabled: z.boolean(),
  busy: z.custom<BulkBusy>(),
  onRequestDelete: z.custom<() => void>(),
  onConfirmDelete: z.custom<() => void>(),
  onCancelDelete: z.custom<() => void>(),
});
type DeleteControlsProps = z.infer<typeof DeleteControlsPropsSchema>;

function DeleteControls({ confirmingDelete, selectedCount, disabled, busy, onRequestDelete, onConfirmDelete, onCancelDelete }: DeleteControlsProps) {
  if (!confirmingDelete) {
    return (
      <button
        onClick={onRequestDelete}
        disabled={disabled}
        className="rounded-lg border border-rose-500/60 px-3 py-2 text-ui-sm font-medium text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-50"
        data-testid="bulk-action-delete-request"
      >
        Delete
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ui-xs text-ui-ink-muted">
        Remove {selectedCount} image{selectedCount === 1 ? "" : "s"} from the library? Originals on disk are kept.
      </span>
      <button
        onClick={onConfirmDelete}
        disabled={busy === "delete"}
        className="rounded-lg bg-rose-500/90 px-3 py-2 text-ui-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
        data-testid="bulk-action-delete-confirm"
      >
        {busy === "delete" ? "Removing…" : "Remove"}
      </button>
      <button onClick={onCancelDelete} disabled={busy === "delete"} className={btn} data-testid="bulk-action-delete-cancel">
        Cancel
      </button>
    </div>
  );
}

const MenuPropsSchema = z.object({
  label: z.string(),
  open: z.boolean(),
  onToggle: z.custom<() => void>(),
  disabled: z.boolean().optional(),
  busy: z.boolean().optional(),
  width: z.string().optional(),
  children: z.custom<ReactNode>(),
  testId: z.string().optional(),
});
type MenuProps = z.infer<typeof MenuPropsSchema>;

/** A dropdown button + popover panel. */
function Menu({ label, open, onToggle, disabled, busy, width = "w-44", children, testId }: MenuProps) {
  return (
    <div className="relative">
      <button
        className={`${btn} flex items-center gap-1.5`}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid={testId}
      >
        {label}
        <svg viewBox="0 0 24 24" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && !busy && (
        <div className={`absolute right-0 z-30 mt-1 ${width} overflow-hidden rounded-lg border border-ui-border/70 bg-ui-bg-soft shadow-lg`} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

const MenuLabelPropsSchema = z.object({ children: z.custom<ReactNode>() });
type MenuLabelProps = z.infer<typeof MenuLabelPropsSchema>;

/** A non-interactive section heading inside a Menu popover. */
function MenuLabel({ children }: MenuLabelProps) {
  return (
    <p className="border-b border-ui-border/40 bg-ui-bg/40 px-3 py-1.5 text-ui-2xs font-semibold uppercase tracking-wide text-ui-ink-muted first:rounded-t-lg">
      {children}
    </p>
  );
}

const MenuItemPropsSchema = z.object({
  onClick: z.custom<() => void>(),
  children: z.custom<ReactNode>(),
  testId: z.string().optional(),
});
type MenuItemProps = z.infer<typeof MenuItemPropsSchema>;

function MenuItem({ onClick, children, testId }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-1 px-3 py-2 text-left text-ui-sm text-ui-ink transition hover:bg-accent-cyan/10"
      data-testid={testId}
    >
      {children}
    </button>
  );
}
