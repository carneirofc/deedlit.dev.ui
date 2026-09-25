"use client";

import type { LightboxNotesPanelProps } from "./schemas";

function NotesList({ notesLoading, notes }: Pick<LightboxNotesPanelProps, "notesLoading" | "notes">) {
  if (notesLoading) return <p className="text-ui-xs text-ui-ink-muted">Loading notes…</p>;
  if (notes.length === 0) return <p className="text-ui-xs text-ui-ink-muted">No notes yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {notes.map((n) => (
        <li key={n.id} className="rounded-lg border border-ui-border/40 bg-ui-bg/60 px-3 py-2">
          <p className="text-ui-xs text-ui-ink">{n.title ?? "(empty note)"}</p>
          {n.created_at && (
            <p className="mt-0.5 text-ui-2xs text-ui-ink-muted/60">{new Date(n.created_at).toLocaleString()}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The note draft input + add button, and the submit flow shared by Enter and
 * the Add button. */
function NoteComposer({
  current,
  noteDraft,
  setNoteDraft,
  noteSaving,
  setNoteSaving,
  setNotes,
  fetchNotes,
  onCreateNote,
}: LightboxNotesPanelProps) {
  if (!onCreateNote) return null;

  const submit = async () => {
    if (!noteDraft.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      await onCreateNote(current.imageId, noteDraft.trim());
      setNoteDraft("");
      setNotes(await fetchNotes(current.imageId));
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div className="flex gap-2 pt-1">
      <input
        className="flex-1 rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-1.5 text-ui-xs outline-none focus:border-accent-cyan"
        placeholder="Add a note…"
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        data-testid="lightbox-note-input"
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        disabled={noteSaving}
      />
      <button
        className="rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-1.5 text-ui-xs font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50"
        disabled={!noteDraft.trim() || noteSaving}
        data-testid="lightbox-note-add"
        onClick={() => void submit()}
      >
        {noteSaving ? "…" : "Add"}
      </button>
    </div>
  );
}

export function LightboxNotesPanel(props: LightboxNotesPanelProps) {
  return (
    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto border-b border-ui-border/40 bg-ui-bg/70 px-4 py-3 backdrop-blur-sm">
      <NotesList notesLoading={props.notesLoading} notes={props.notes} />
      <NoteComposer {...props} />
    </div>
  );
}
