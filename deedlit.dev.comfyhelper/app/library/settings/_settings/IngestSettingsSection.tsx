"use client";

import { InfoRow, Row, Section, NumberSlider, Toggle, cls } from "./primitives";
import type { RescanButtonProps, RescanState, SaveState } from "./schemas";
import { useIngestSettings } from "./useIngestSettings";

function ingestStatusText(rescan: RescanState, status: SaveState): string {
  if (rescan === "error") return "Rescan failed — is the ingest service up?";
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved.";
  if (status === "error") return "Save failed — is the ingest service up?";
  return "";
}

function RescanButton({ rescan, onRescan }: RescanButtonProps) {
  const label =
    rescan === "running" ? "Starting…" : rescan === "done" ? "Started ✓" : rescan === "error" ? "Retry" : "Rescan";
  return (
    <button
      type="button"
      className={cls.btn}
      onClick={onRescan}
      disabled={rescan === "running"}
      data-testid="rescan-now"
    >
      {label}
    </button>
  );
}

export function IngestSettingsSection() {
  const { cfg, status, rescan, rescanNow, save } = useIngestSettings();

  return (
    <Section
      title="Ingest & indexing"
      hint="Server-side ingest parallelism. Applies to the next folder scan — not stored in this browser."
    >
      {cfg === null ? (
        <p className="py-2 text-ui-2xs text-ui-ink-muted">
          {status === "error" ? "Ingest service unreachable." : "Loading…"}
        </p>
      ) : (
        <>
          <Row
            label="Folder-scan publish concurrency"
            hint="How many ingest tasks a scan publishes to the queue in parallel. The worker pool catalogs and projects them across processes."
            control={
              <NumberSlider
                value={cfg.ingest_concurrency}
                min={1}
                max={32}
                step={1}
                onChange={(v) => save({ ingest_concurrency: v })}
              />
            }
          />
          <Row
            label="AI labelling (LLM)"
            hint="Run the vision model to add a description, content-safety class & extra tags to each image. Off skips it — images are still cataloged, embedded & searchable. Applies to new ingests (and the label-backfill sweep)."
            control={<Toggle checked={cfg.llm_enabled} onChange={(v) => save({ llm_enabled: v })} />}
          />
          <Row
            label="Rescan library now"
            hint="Walk the source folders for new or vanished files and reconcile the catalog. Runs as a background job — watch it on the Admin page."
            control={<RescanButton rescan={rescan} onRescan={rescanNow} />}
          />
          <InfoRow
            label="Consumer prefetch (fast queues)"
            value="TASK_PREFETCH"
            hint="Tasks each fast worker runs at once. Deploy-time: set in docker-compose, scale with --scale ingest-worker=N."
          />
          <InfoRow
            label="LLM (label) queue"
            value="single · prefetch 1"
            hint="When AI labelling is on, the label queue runs one exclusive consumer at prefetch 1 so the vision model is never hit concurrently. Fixed."
          />
          <p className="pt-2 text-ui-2xs text-ui-ink-muted" aria-live="polite" data-testid="ingest-config-status">
            {ingestStatusText(rescan, status)}
          </p>
        </>
      )}
    </Section>
  );
}
