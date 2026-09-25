"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { cn } from "./utils";

export const TagSelectVariantSchema = z.enum(["include", "exclude"]);
export type TagSelectVariant = z.infer<typeof TagSelectVariantSchema>;

export const TagSelectPropsSchema = z.object({
  /** Currently selected tags (controlled). */
  value: z.array(z.string()),
  onChange: z.custom<(next: string[]) => void>(),
  /** Candidate tags to autocomplete against (e.g. tags on loaded results). */
  suggestions: z.array(z.string()).optional(),
  /**
   * Live, server-backed autocomplete. When provided, the dropdown is sourced by
   * calling this with the current draft (debounced) instead of `suggestions`, so
   * the type-ahead spans the whole tag catalog, not just loaded results. The
   * server is expected to prefix-match, so results are shown as-is (only
   * already-selected tags are removed).
   */
  fetchSuggestions: z.custom<(query: string) => Promise<string[]>>().optional(),
  placeholder: z.string().optional(),
  /** Accent: include filters glow cyan, exclude filters glow rose. */
  variant: TagSelectVariantSchema.optional(),
  /** Fired after the selection changes via the UI (add/remove) — e.g. to re-search. */
  onCommit: z.custom<(next: string[]) => void>().optional(),
  /**
   * Max options rendered in the dropdown. Defaults to 8 (a tight type-ahead).
   * Pass a large value with a full `suggestions` list to turn the control into a
   * "browse every tag" picker — the list scrolls and the input just narrows it.
   */
  maxSuggestions: z.number().optional(),
  /** Override the wrapper class. */
  className: z.string().optional(),
  /** Prefix for data-testid attributes on the input, chips, and suggestions. */
  testId: z.string().optional(),
});
export type TagSelectProps = z.infer<typeof TagSelectPropsSchema>;

const VARIANT = {
  include: {
    chip: "border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan",
    ring: "focus-within:border-accent-cyan",
  },
  exclude: {
    chip: "border-rose-500/50 bg-rose-500/15 text-rose-400",
    ring: "focus-within:border-rose-400",
  },
} as const;

function hasTag(value: string[], tag: string): boolean {
  return value.some((v) => v.toLowerCase() === tag.toLowerCase());
}

/** Live server-backed suggestions: debounce the draft and fetch while the
 *  dropdown is open. The latest result wins; a stale in-flight one is dropped. */
function useRemoteSuggestions(
  fetchSuggestions: ((query: string) => Promise<string[]>) | undefined,
  open: boolean,
  draft: string,
): string[] {
  const [remote, setRemote] = useState<string[]>([]);
  useEffect(() => {
    if (!fetchSuggestions || !open) return;
    let alive = true;
    const handle = setTimeout(() => {
      fetchSuggestions(draft.trim())
        .then((r) => {
          if (alive) setRemote(r);
        })
        .catch(() => {
          /* keep the previous list on a transient failure */
        });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [draft, open, fetchSuggestions]);
  return remote;
}

function filterSuggestions(
  pool: string[],
  fetchSuggestions: ((query: string) => Promise<string[]>) | undefined,
  value: string[],
  draft: string,
  maxSuggestions: number,
): string[] {
  const q = draft.trim().toLowerCase();
  const seen = new Set(value.map((v) => v.toLowerCase()));
  const out: string[] = [];
  for (const s of pool) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    // Local suggestions are substring-filtered here; remote ones are already
    // prefix-matched server-side, so they pass through (avoids mid-type flicker
    // while a debounced fetch catches up to the draft).
    if (!fetchSuggestions && q && !key.includes(q)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxSuggestions) break;
  }
  return out;
}

/** Owns all TagSelect state: draft text, dropdown open/active index, remote
 *  suggestions, and the add/remove/commit/keyboard behaviors. */
function useTagSelectState(props: TagSelectProps) {
  const { value, onChange, suggestions = [], fetchSuggestions, onCommit, maxSuggestions = 8 } = props;

  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const remote = useRemoteSuggestions(fetchSuggestions, open, draft);

  const filtered = useMemo(
    () => filterSuggestions(fetchSuggestions ? remote : suggestions, fetchSuggestions, value, draft, maxSuggestions),
    [suggestions, remote, fetchSuggestions, value, draft, maxSuggestions],
  );

  const commit = useCallback((next: string[]) => { onChange(next); onCommit?.(next); }, [onChange, onCommit]);

  const add = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag || hasTag(value, tag)) {
        setDraft("");
        return;
      }
      commit([...value, tag]);
      setDraft("");
      setActive(0);
    },
    [value, commit],
  );

  const remove = useCallback((tag: string) => commit(value.filter((v) => v !== tag)), [commit, value]);

  return { draft, setDraft, open, setOpen, active, setActive, filtered, add, remove };
}

export const TagSelectActionSchema = z.enum(["add-active", "add-draft", "remove-last", "nav-down", "nav-up", "close"]);
export type TagSelectAction = z.infer<typeof TagSelectActionSchema> | null;

function resolveEditKeyAction(key: string, draft: string, value: string[], filtered: string[], active: number): TagSelectAction {
  if (key === "Enter" || key === ",") return filtered[active] ? "add-active" : "add-draft";
  if (key === "Backspace") return draft === "" && value.length > 0 ? "remove-last" : null;
  return null;
}

function resolveNavKeyAction(key: string, filtered: string[]): TagSelectAction {
  if (key === "ArrowDown") return filtered.length ? "nav-down" : null;
  if (key === "ArrowUp") return filtered.length ? "nav-up" : null;
  if (key === "Escape") return "close";
  return null;
}

function resolveKeyAction(
  key: string,
  draft: string,
  value: string[],
  filtered: string[],
  active: number,
): TagSelectAction {
  return resolveEditKeyAction(key, draft, value, filtered, active) ?? resolveNavKeyAction(key, filtered);
}

export default function TagSelect(props: TagSelectProps) {
  const { value, placeholder = "add tag…", variant = "include", className, testId } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const styles = VARIANT[variant];
  const { draft, setDraft, open, setOpen, active, setActive, filtered, add, remove } = useTagSelectState(props);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const action = resolveKeyAction(e.key, draft, value, filtered, active);
    if (!action) return;
    e.preventDefault();
    if (action === "add-active") add(filtered[active]);
    else if (action === "add-draft") add(draft);
    else if (action === "remove-last") remove(value[value.length - 1]);
    else if (action === "nav-down") {
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (action === "nav-up") setActive((a) => Math.max(a - 1, 0));
    else if (action === "close") setOpen(false);
  };

  return (
    <div className={cn("relative", className)} data-testid={testId}>
      <TagChipsInput
        value={value}
        draft={draft}
        placeholder={placeholder}
        styles={styles}
        listId={listId}
        open={open}
        testId={testId}
        inputRef={inputRef}
        onRemove={remove}
        onDraftChange={(next) => {
          setDraft(next);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      <TagSuggestionList open={open} filtered={filtered} active={active} listId={listId} testId={testId} onSelect={add} onHover={setActive} />
    </div>
  );
}

export const TagChipsInputPropsSchema = z.object({
  value: z.array(z.string()),
  draft: z.string(),
  placeholder: z.string(),
  styles: z.custom<(typeof VARIANT)[TagSelectVariant]>(),
  listId: z.string(),
  open: z.boolean(),
  testId: z.string().optional(),
  inputRef: z.custom<React.RefObject<HTMLInputElement | null>>(),
  onRemove: z.custom<(tag: string) => void>(),
  onDraftChange: z.custom<(next: string) => void>(),
  onFocus: z.custom<() => void>(),
  onBlur: z.custom<() => void>(),
  onKeyDown: z.custom<(e: React.KeyboardEvent<HTMLInputElement>) => void>(),
});
type TagChipsInputProps = z.infer<typeof TagChipsInputPropsSchema>;

function TagChipsInput({
  value,
  draft,
  placeholder,
  styles,
  listId,
  open,
  testId,
  inputRef,
  onRemove,
  onDraftChange,
  onFocus,
  onBlur,
  onKeyDown,
}: TagChipsInputProps) {
  return (
    <div
      className={cn(
        "flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-lg border border-ui-border/70 bg-ui-bg px-2 py-1.5 text-ui-sm outline-none transition",
        styles.ring,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span key={tag} className={cn("flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-ui-2xs font-medium", styles.chip)}>
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(tag);
            }}
            aria-label={`Remove ${tag}`}
            data-testid={testId ? `${testId}-remove-${tag}` : undefined}
            className="opacity-70 transition hover:opacity-100"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        data-testid={testId ? `${testId}-input` : undefined}
        className="min-w-[6rem] flex-1 bg-transparent text-ui-sm outline-none placeholder:text-ui-ink-muted"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
    </div>
  );
}

export const TagSuggestionListPropsSchema = z.object({
  open: z.boolean(),
  filtered: z.array(z.string()),
  active: z.number(),
  listId: z.string(),
  testId: z.string().optional(),
  onSelect: z.custom<(tag: string) => void>(),
  onHover: z.custom<(index: number) => void>(),
});
type TagSuggestionListProps = z.infer<typeof TagSuggestionListPropsSchema>;

function TagSuggestionList({ open, filtered, active, listId, testId, onSelect, onHover }: TagSuggestionListProps) {
  if (!open || filtered.length === 0) return null;
  return (
    <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-ui-border/70 bg-ui-bg-soft p-1 shadow-lg">
      {filtered.map((s, i) => (
        <li key={s} role="option" aria-selected={i === active}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(s);
            }}
            onMouseEnter={() => onHover(i)}
            data-testid={testId ? `${testId}-suggestion-${s}` : undefined}
            className={cn(
              "w-full truncate rounded-md px-2 py-1 text-left text-ui-xs transition",
              i === active ? "bg-accent-cyan/15 text-accent-cyan" : "text-ui-ink hover:bg-ui-bg",
            )}
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
