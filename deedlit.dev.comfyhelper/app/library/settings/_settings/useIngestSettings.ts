import { useCallback, useEffect, useState } from "react";

import { getIngestConfig, updateIngestConfig, type IngestConfig } from "@/lib/api-client";

import type { RescanState, SaveState } from "./schemas";

/**
 * Ingest & indexing section state — SERVER-backed (deedlit.ingest /config via
 * the gateway), unlike the rest of the settings page (browser localStorage).
 * Tunes the producer fast-path parallelism live; consumer/deploy knobs are
 * shown read-only.
 */
export function useIngestSettings() {
  const [cfg, setCfg] = useState<IngestConfig | null>(null);
  const [status, setStatus] = useState<SaveState>("idle");
  // Manual library rescan (walks the source root for new/vanished files). Reuses
  // the existing maintenance job — this is just a trigger from the settings panel.
  const [rescan, setRescan] = useState<RescanState>("idle");

  const rescanNow = useCallback(async () => {
    setRescan("running");
    try {
      const r = await fetch("/api/library/maintenance/rescan-files", { method: "POST" });
      setRescan(r.ok ? "done" : "error");
    } catch {
      setRescan("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getIngestConfig()
      .then((c) => alive && setCfg(c))
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (patch: Partial<IngestConfig>) => {
    setCfg((prev) => (prev ? { ...prev, ...patch } : prev)); // optimistic
    setStatus("saving");
    try {
      setCfg(await updateIngestConfig(patch));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  return { cfg, status, rescan, rescanNow, save };
}
