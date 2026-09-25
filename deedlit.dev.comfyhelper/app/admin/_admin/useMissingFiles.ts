import { useState } from "react";

import { useActivity } from "@/lib/store/activity";

import {
  deleteSelectedMissing as deleteSelectedMissingAction,
  scanMissingFiles as scanMissingFilesAction,
  toggleAllMissing as toggleAllMissingAction,
  toggleMissing as toggleMissingAction,
} from "./missingFilesActions";
import type { MissingFilesResult, MissingState } from "./schemas";

export function useMissingFiles() {
  const { fetchJson } = useActivity();

  const [missingState, setMissingState] = useState<MissingState>("idle");
  const [missing, setMissing] = useState<MissingFilesResult | null>(null);
  const [missingError, setMissingError] = useState<string | null>(null);
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set());
  const [deletingMissing, setDeletingMissing] = useState(false);
  const [missingNotice, setMissingNotice] = useState<string | null>(null);

  const setters = { setMissing, setMissingError, setSelectedMissing, setMissingNotice };
  const scanMissingFiles = () => scanMissingFilesAction({ ...setters, setMissingState });
  const toggleMissing = (sha256: string) => toggleMissingAction(setSelectedMissing, sha256);
  const toggleAllMissing = () => toggleAllMissingAction(setSelectedMissing, missing);
  const deleteSelectedMissing = () =>
    deleteSelectedMissingAction({ ...setters, fetchJson, selectedMissing, setDeletingMissing });

  return {
    missingState,
    missing,
    missingError,
    selectedMissing,
    deletingMissing,
    missingNotice,
    scanMissingFiles,
    toggleMissing,
    toggleAllMissing,
    deleteSelectedMissing,
  };
}
