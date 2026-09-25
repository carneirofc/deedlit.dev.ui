"use client";

import { z } from "zod";

import { cls, MAINTENANCE_ACTIONS } from "./constants";
import { ActionRunSchema, MaintenanceActionSchema, type MaintenanceAction } from "./schemas";

const MaintenancePanelPropsSchema = z.object({
  runs: z.record(z.string(), ActionRunSchema),
  runMaintenance: z.custom<(action: MaintenanceAction) => void>(),
});
type MaintenancePanelProps = z.infer<typeof MaintenancePanelPropsSchema>;

const MaintenanceActionCardPropsSchema = z.object({
  action: MaintenanceActionSchema,
  run: ActionRunSchema.optional(),
  runMaintenance: z.custom<(action: MaintenanceAction) => void>(),
});
type MaintenanceActionCardProps = z.infer<typeof MaintenanceActionCardPropsSchema>;

function MaintenanceActionCard({ action, run, runMaintenance }: MaintenanceActionCardProps) {
  const busy = run?.status === "running";
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ui-border/50 bg-ui-bg p-3">
      <div>
        <p className="text-ui-sm font-medium text-ui-ink-title">{action.label}</p>
        <p className="text-ui-2xs text-ui-ink-muted">{action.description}</p>
      </div>
      <button
        className={cls.btn}
        onClick={() => runMaintenance(action)}
        disabled={busy}
        data-testid={`maintenance-run-${action.key}`}
      >
        {busy ? "Running…" : "Run"}
      </button>
      {run && run.status !== "running" && run.result && (
        <p
          className={`break-words text-ui-2xs ${
            run.status === "error" ? "text-rose-500" : "text-emerald-500"
          }`}
          data-testid={`maintenance-result-${action.key}`}
        >
          {run.result}
        </p>
      )}
    </div>
  );
}

export function MaintenancePanel({ runs, runMaintenance }: MaintenancePanelProps) {
  return (
    <section className={cls.card} data-testid="maintenance-panel">
      <h2 className="mb-3 text-ui-sm font-semibold text-ui-ink-title">Maintenance</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MAINTENANCE_ACTIONS.map((action: MaintenanceAction) => (
          <MaintenanceActionCard
            key={action.key}
            action={action}
            run={runs[action.key]}
            runMaintenance={runMaintenance}
          />
        ))}
      </div>
    </section>
  );
}
