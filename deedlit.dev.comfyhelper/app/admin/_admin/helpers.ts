export function jobStatusColor(status: string): string {
  switch (status) {
    case "running":
      return "bg-sky-500/15 text-sky-500";
    case "completed":
      return "bg-emerald-500/15 text-emerald-500";
    case "failed":
      return "bg-rose-500/15 text-rose-500";
    case "cancelled":
      return "bg-amber-500/15 text-amber-500";
    // Left in-flight by an ingest restart (its in-memory worker is gone). A
    // terminal state — re-trigger the job manually to re-run it.
    case "interrupted":
      return "bg-orange-500/15 text-orange-500";
    default:
      return "bg-ui-bg text-ui-ink-muted";
  }
}
