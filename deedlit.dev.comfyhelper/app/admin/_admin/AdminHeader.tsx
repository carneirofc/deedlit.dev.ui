"use client";

import { cls, GRAFANA_URL } from "./constants";

export function AdminHeader() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Backend Admin</h1>
        <p className="text-ui-sm text-ui-ink-muted">
          Trigger ingestion &amp; maintenance and monitor jobs.
        </p>
      </div>
      {/* Deep-link to the distributed traces (one ingest = one cross-service
          trace tree) for debugging beyond the live board. */}
      <a
        href={GRAFANA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cls.btn}
        data-testid="grafana-link"
      >
        View traces in Grafana ↗
      </a>
    </header>
  );
}
