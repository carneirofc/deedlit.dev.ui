import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { LightboxItem, LightboxLive } from "./schemas";

/** Delete-confirmation flow: un-index the current image, then land on a
 * neighbour so the viewer keeps flowing. */
export function useLightboxDelete(
  current: LightboxItem | undefined,
  live: React.RefObject<LightboxLive>,
  onClose: () => void,
  setCurrentId: Dispatch<SetStateAction<string | null>>,
  onDelete?: (imageId: string) => Promise<void>,
) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset any pending delete confirmation when navigating to a new image.
  useEffect(() => {
    setConfirmingDelete(false);
  }, [current?.imageId]);

  const handleDelete = useCallback(async () => {
    const cur = live.current;
    const list = cur.items;
    const i = cur.index;
    const victim = list[i];
    if (!onDelete || !victim || deleting) return;
    const neighbour = list[i + 1] ?? list[i - 1] ?? null;
    setDeleting(true);
    try {
      await onDelete(victim.imageId);
      setConfirmingDelete(false);
      if (neighbour) setCurrentId(neighbour.imageId);
      else onClose();
    } finally {
      setDeleting(false);
    }
  }, [onDelete, deleting, onClose, live, setCurrentId]);

  return { confirmingDelete, setConfirmingDelete, deleting, handleDelete };
}
