import type { Dispatch, SetStateAction } from "react";

import { z } from "zod";

import type { useActivity } from "@/lib/store/activity";

import { MISSING_SCAN_LIMIT } from "./constants";
import {
  MissingFilesResultSchema,
  type BatchDeleteResponse,
  type MissingFilesResult,
  type MissingState,
} from "./schemas";

type FetchJson = ReturnType<typeof useActivity>["fetchJson"];

const ScanDepsSchema = z.object({
  setMissingState: z.custom<Dispatch<SetStateAction<MissingState>>>(),
  setMissing: z.custom<Dispatch<SetStateAction<MissingFilesResult | null>>>(),
  setMissingError: z.custom<Dispatch<SetStateAction<string | null>>>(),
  setSelectedMissing: z.custom<Dispatch<SetStateAction<Set<string>>>>(),
  setMissingNotice: z.custom<Dispatch<SetStateAction<string | null>>>(),
});
type ScanDeps = z.infer<typeof ScanDepsSchema>;

export async function scanMissingFiles(deps: ScanDeps): Promise<void> {
  const { setMissingState, setMissing, setMissingError, setSelectedMissing, setMissingNotice } = deps;
  setMissingState("scanning");
  setMissingError(null);
  setMissingNotice(null);
  setSelectedMissing(new Set());
  try {
    const res = await fetch(`/api/library/maintenance/missing-files?limit=${MISSING_SCAN_LIMIT}`);
    const raw: unknown = await res.json();
    if (!res.ok) {
      const message =
        raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string"
          ? raw.error
          : `scan failed (${res.status})`;
      throw new Error(message);
    }
    const body = MissingFilesResultSchema.parse(raw);
    setMissing(body);
    // Pre-select everything found — the common case is "clean up all of these".
    setSelectedMissing(new Set(body.missing.map((m) => m.sha256)));
    setMissingState("done");
  } catch (e) {
    setMissingError(e instanceof Error ? e.message : "Scan failed");
    setMissingState("error");
  }
}

export function toggleMissing(setSelectedMissing: Dispatch<SetStateAction<Set<string>>>, sha256: string): void {
  setSelectedMissing((prev) => {
    const next = new Set(prev);
    if (next.has(sha256)) next.delete(sha256);
    else next.add(sha256);
    return next;
  });
}

export function toggleAllMissing(
  setSelectedMissing: Dispatch<SetStateAction<Set<string>>>,
  missing: MissingFilesResult | null,
): void {
  setSelectedMissing((prev) => {
    const all = missing?.missing ?? [];
    if (prev.size === all.length) return new Set();
    return new Set(all.map((m) => m.sha256));
  });
}

const DeleteDepsSchema = z.object({
  fetchJson: z.custom<FetchJson>(),
  selectedMissing: z.custom<Set<string>>(),
  setMissing: z.custom<Dispatch<SetStateAction<MissingFilesResult | null>>>(),
  setSelectedMissing: z.custom<Dispatch<SetStateAction<Set<string>>>>(),
  setDeletingMissing: z.custom<Dispatch<SetStateAction<boolean>>>(),
  setMissingError: z.custom<Dispatch<SetStateAction<string | null>>>(),
  setMissingNotice: z.custom<Dispatch<SetStateAction<string | null>>>(),
});
type DeleteDeps = z.infer<typeof DeleteDepsSchema>;

// Drop the cleaned-up entries from the list and the selection.
function applyDeletion(
  deps: Pick<DeleteDeps, "setMissing" | "setSelectedMissing" | "setMissingNotice">,
  deleted: Set<string>,
) {
  const { setMissing, setSelectedMissing, setMissingNotice } = deps;
  setMissing((prev) =>
    prev
      ? {
          ...prev,
          missing: prev.missing.filter((m) => !deleted.has(m.sha256)),
          missingCount: Math.max(0, prev.missingCount - deleted.size),
        }
      : prev,
  );
  setSelectedMissing(new Set());
  setMissingNotice(`Cleaned up ${deleted.size} stale catalog entr${deleted.size === 1 ? "y" : "ies"}.`);
}

export async function deleteSelectedMissing(deps: DeleteDeps): Promise<void> {
  const { fetchJson, selectedMissing, setDeletingMissing, setMissingError, setMissingNotice } = deps;
  const ids = Array.from(selectedMissing);
  if (ids.length === 0) return;
  setDeletingMissing(true);
  setMissingError(null);
  setMissingNotice(null);
  try {
    const j = await fetchJson<BatchDeleteResponse>(
      `Clean up ${ids.length} stale entr${ids.length === 1 ? "y" : "ies"}`,
      "/api/library/images/batch-delete",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    );
    const deleted = new Set(Array.isArray(j.deleted) ? j.deleted : ids);
    applyDeletion(deps, deleted);
  } catch (e) {
    setMissingError(e instanceof Error ? e.message : "Cleanup failed");
  } finally {
    setDeletingMissing(false);
  }
}
