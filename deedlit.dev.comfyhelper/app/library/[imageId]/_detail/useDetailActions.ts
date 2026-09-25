import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ImageDetail } from "@/lib/library/schemas";
import { useActivity } from "@/lib/store/activity";

import { VectorDebugSchema } from "./schemas";
import type { VectorDebug } from "./schemas";

/** Inline star-rating edit. */
export function useRateImage(
  imageId: string,
  detail: ImageDetail | null,
  setDetail: Dispatch<SetStateAction<ImageDetail | null>>,
) {
  const [ratingBusy, setRatingBusy] = useState(false);

  const rateImage = useCallback(async (rating: number | null) => {
    if (!detail || ratingBusy) return;
    setRatingBusy(true);
    try {
      const res = await fetch(`/api/library/images/${imageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
      }
    } finally {
      setRatingBusy(false);
    }
  }, [detail, imageId, ratingBusy, setDetail]);

  return { rateImage, ratingBusy };
}

/** Favorite toggle, tracked in the activity dock. */
export function useToggleFavorite(
  imageId: string,
  detail: ImageDetail | null,
  setDetail: Dispatch<SetStateAction<ImageDetail | null>>,
  track: ReturnType<typeof useActivity>["track"],
) {
  return useCallback(async () => {
    if (!detail) return;
    const next = !detail.favorite;
    try {
      const updated = await track(next ? "Add favorite" : "Remove favorite", async () => {
        const res = await fetch(`/api/library/images/${imageId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ favorite: next }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to update favorite");
        }
        return res.json();
      });
      setDetail(updated);
    } catch {
      // Surfaced by the activity dock/toast; nothing else to do here.
    }
  }, [detail, imageId, track, setDetail]);
}

/** Two-step "remove from library" confirmation. Un-indexes the image (catalog
 * record + search vector + graph node) via the gateway; the source file on
 * disk is NOT touched. On success we leave the now-deleted detail page. */
export function useRemoveFromLibrary(imageId: string, track: ReturnType<typeof useActivity>["track"]) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const removeFromLibrary = useCallback(async () => {
    setDeleting(true);
    try {
      await track("Remove from library", async () => {
        const res = await fetch(`/api/library/images/${imageId}`, { method: "DELETE" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to remove image");
        }
        return res.json();
      });
      router.push("/library");
      router.refresh();
    } catch {
      // Surfaced by the activity dock/toast; re-enable the controls so the user
      // can retry or cancel.
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [imageId, track, router]);

  return { confirmingDelete, setConfirmingDelete, deleting, removeFromLibrary };
}

/** Vector debug panel: fetched once, lazily, on first open. */
export function useVectorDebug(imageId: string) {
  const [debug, setDebug] = useState<VectorDebug | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

  const loadDebug = useCallback(async () => {
    setDebugOpen((open) => !open);
    if (debug || debugLoading) return; // fetch once
    setDebugLoading(true);
    setDebugError(null);
    try {
      const res = await fetch(`/api/library/images/${imageId}/vector?limit=12`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Debug fetch failed");
      setDebug(VectorDebugSchema.parse(json));
    } catch (e) {
      setDebugError(e instanceof Error ? e.message : "Debug fetch failed");
    } finally {
      setDebugLoading(false);
    }
  }, [imageId, debug, debugLoading]);

  return { debug, debugOpen, debugLoading, debugError, loadDebug };
}

/** Transient "Copied" state for the source-path copy button. */
export function useCopyPath(filePath: string | undefined) {
  const [pathCopied, setPathCopied] = useState(false);

  const copyPath = useCallback(() => {
    if (!filePath) return;
    navigator.clipboard
      ?.writeText(filePath)
      .then(() => {
        setPathCopied(true);
        setTimeout(() => setPathCopied(false), 1500);
      })
      .catch(() => {});
  }, [filePath]);

  return { pathCopied, copyPath };
}
