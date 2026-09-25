import { useState } from "react";

import { useActivity } from "@/lib/store/activity";

import { DEFAULT_INGEST_OPTIONS } from "./constants";
import { startIngestSingle } from "./ingestActions";
import type { IngestOptions } from "./schemas";

export function useIngestForm(
  onError: (message: string | null) => void,
  onNotice: (message: string | null) => void,
  refreshJobs: () => void,
) {
  const { fetchJson, trackJob } = useActivity();

  const [folderPath, setFolderPath] = useState("");
  const [options, setOptions] = useState<IngestOptions>(DEFAULT_INGEST_OPTIONS);
  const [ingestBusy, setIngestBusy] = useState(false);
  // Bulk one-shot ingest: one path per line, one job dispatched per path.
  const [multiMode, setMultiMode] = useState(false);
  const [multiText, setMultiText] = useState("");

  const toggleOption = (key: keyof IngestOptions) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const startIngest = () =>
    startIngestSingle(
      { fetchJson, trackJob, options, setIngestBusy, onError, onNotice, refreshJobs },
      folderPath,
      multiMode,
      multiText,
    );

  return {
    folderPath,
    setFolderPath,
    options,
    toggleOption,
    ingestBusy,
    multiMode,
    setMultiMode,
    multiText,
    setMultiText,
    startIngest,
  };
}
