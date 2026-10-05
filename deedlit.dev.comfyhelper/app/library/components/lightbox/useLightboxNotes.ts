import { useEffect, useState } from "react";

import type { LightboxItem, LightboxNote } from "./schemas";

/** Notes panel state: loads notes when the panel is open, resets on navigation. */
export function useLightboxNotes(
  current: LightboxItem | undefined,
  notesOpen: boolean,
  fetchNotes?: (imageId: string) => Promise<LightboxNote[]>,
) {
  const [notes, setNotes] = useState<LightboxNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (!notesOpen || !fetchNotes || !current) return;
    let alive = true;
    // Data-fetching effect: marking the loading state synchronously before the
    // async call is the sanctioned fetch-in-effect pattern (not derived state).
    setNotesLoading(true);
    fetchNotes(current.imageId)
      .then((n) => { if (alive) setNotes(n); })
      .catch(() => {})
      .finally(() => { if (alive) setNotesLoading(false); });
    return () => { alive = false; };
  }, [notesOpen, current?.imageId, fetchNotes]);

  // Reset notes on navigating to a new image (stale data from the old one).
  // Derived during render to avoid a stale-notes flash from an effect.
  const [prevNotesKey, setPrevNotesKey] = useState(current?.imageId ?? null);
  if ((current?.imageId ?? null) !== prevNotesKey) {
    setPrevNotesKey(current?.imageId ?? null);
    setNotes([]);
    setNoteDraft("");
  }

  return { notes, setNotes, notesLoading, noteDraft, setNoteDraft, noteSaving, setNoteSaving };
}
