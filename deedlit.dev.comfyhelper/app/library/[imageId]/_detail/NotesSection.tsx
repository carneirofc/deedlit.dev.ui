import { z } from "zod";

import { panel } from "./styles";
import type { ImageDetailNote } from "./schemas";

const NotesSectionPropsSchema = z.object({
  notes: z.array(z.custom<ImageDetailNote>()),
  notesLoading: z.boolean(),
  noteDraft: z.string(),
  onDraftChange: z.custom<(value: string) => void>(),
  noteSaving: z.boolean(),
  onAddNote: z.custom<() => void>(),
});
type NotesSectionProps = z.infer<typeof NotesSectionPropsSchema>;

/** Notes / comments section: list of existing notes plus a single-line add
 * form. */
export function NotesSection({
  notes,
  notesLoading,
  noteDraft,
  onDraftChange,
  noteSaving,
  onAddNote,
}: NotesSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-3 text-ui-lg font-semibold text-ui-ink-title">Notes</h2>
      {notesLoading ? (
        <p className="text-ui-xs text-ui-ink-muted">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="mb-3 text-ui-xs text-ui-ink-muted">No notes yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-ui-border/40 bg-ui-bg/60 px-3 py-2">
              <p className="text-ui-xs text-ui-ink">{n.title ?? "(empty)"}</p>
              {n.created_at && (
                <p className="mt-0.5 text-ui-2xs text-ui-ink-muted/60">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-xs outline-none focus:border-accent-cyan"
          placeholder="Add a note…"
          value={noteDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onAddNote(); }}
          disabled={noteSaving}
          data-testid="image-detail-note-input"
        />
        <button
          className="rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-xs font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50"
          onClick={onAddNote}
          disabled={!noteDraft.trim() || noteSaving}
          data-testid="image-detail-note-add"
        >
          {noteSaving ? "…" : "Add"}
        </button>
      </div>
    </section>
  );
}
