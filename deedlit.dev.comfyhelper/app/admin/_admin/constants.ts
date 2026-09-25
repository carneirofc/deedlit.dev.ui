import type { IngestOptions, MaintenanceAction } from "./schemas";

// Pipeline stages in execution order — drives the expanded per-job staircase so
// rows render in a stable, meaningful sequence (mirrors deedlit.ingest).
export const PIPELINE_STAGES = [
  "hash",
  "metadata",
  "label",
  "vision:dense",
  "vision:sparse",
  "catalog",
  "search",
  "graph",
] as const;

// Grafana base URL for the trace deep-link (compose maps it to :3002).
export const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL ?? "http://localhost:3002";

export const DEFAULT_INGEST_OPTIONS: IngestOptions = {
  recursive: true,
  generateThumbnails: true,
  extractMetadata: true,
  runExternalEnrichment: false,
  indexQdrant: true,
  syncNeo4j: true,
};

// ---------------------------------------------------------------------------
// Shared style tokens (matches app/library/page.tsx conventions).
// ---------------------------------------------------------------------------

export const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  input:
    "w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  btnActive: "border-accent-cyan text-accent-cyan",
};

export const ACTIVE_JOB_STATUSES = new Set(["pending", "running"]);

// ---------------------------------------------------------------------------
// Maintenance action descriptors.
// ---------------------------------------------------------------------------

export const MAINTENANCE_ACTIONS: MaintenanceAction[] = [
  {
    key: "rebuild-qdrant",
    label: "Rebuild Qdrant",
    description: "Recompute & re-index every image vector.",
    endpoint: "/api/library/maintenance/rebuild-qdrant",
  },
  {
    key: "rebuild-neo4j",
    label: "Rebuild Neo4j",
    description: "Resync the graph projection from Postgres.",
    endpoint: "/api/library/maintenance/rebuild-neo4j",
  },
  {
    key: "prune-graph-orphans",
    label: "Prune graph orphans",
    description: "Remove orphaned tag/model nodes left behind by deleted images.",
    endpoint: "/api/library/maintenance/prune-graph-orphans",
  },
  {
    key: "regenerate-thumbnails",
    label: "Regenerate thumbnails",
    description: "Generate thumbnails for images missing one.",
    endpoint: "/api/library/maintenance/regenerate-thumbnails",
  },
  {
    key: "rescan-files",
    label: "Rescan files",
    description: "Mark images whose source file vanished as missing.",
    endpoint: "/api/library/maintenance/rescan-files",
  },
  {
    key: "backfill-labels",
    label: "Backfill labels",
    description: "Run the labelagent on every image missing an AI description.",
    endpoint: "/api/library/maintenance/backfill-labels",
  },
];

// Scan deep enough to surface a meaningful batch in one pass; the API caps it.
export const MISSING_SCAN_LIMIT = 2000;
