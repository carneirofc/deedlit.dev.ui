import { useState } from "react";

import { useActivity } from "@/lib/store/activity";

import type { ActionRun, MaintenanceAction, MaintenanceRunResponse } from "./schemas";

export function useMaintenanceActions(onClearError: () => void, refreshJobs: () => void) {
  const { fetchJson, trackJob } = useActivity();
  const [runs, setRuns] = useState<Record<string, ActionRun>>({});

  const runMaintenance = async (action: MaintenanceAction) => {
    setRuns((prev) => ({ ...prev, [action.key]: { status: "running", result: null } }));
    onClearError();
    try {
      const j = await fetchJson<MaintenanceRunResponse>(
        action.label,
        action.endpoint,
        { method: "POST" },
      );
      // Maintenance actions dispatch a job too — surface its live progress in the dock.
      trackJob(action.label, j.id ?? j.job_id);
      refreshJobs();
      setRuns((prev) => ({
        ...prev,
        [action.key]: { status: "done", result: JSON.stringify(j) },
      }));
    } catch (e) {
      setRuns((prev) => ({
        ...prev,
        [action.key]: {
          status: "error",
          result: e instanceof Error ? e.message : "failed",
        },
      }));
    }
  };

  return { runs, runMaintenance };
}
