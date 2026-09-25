"use client";
import { z } from "zod";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types — mirror the /api/library/health response (see app/api/library/health).
// ---------------------------------------------------------------------------

const ComponentStatusSchema = z.enum(["ok", "degraded", "down"]);
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

const DependencySchema = z.object({
  name: z.string(),
  ready: z.boolean(),
});

const ComponentHealthSchema = z.object({
  name: z.string(),
  status: ComponentStatusSchema,
  dependencies: z.array(DependencySchema),
});
type ComponentHealth = z.infer<typeof ComponentHealthSchema>;

const HealthPayloadSchema = z.object({
  healthy: z.boolean(),
  status: ComponentStatusSchema,
  gatewayReachable: z.boolean(),
  checkedAt: z.string(),
  components: z.array(ComponentHealthSchema),
  warnings: z.array(z.string()),
});
type HealthPayload = z.infer<typeof HealthPayloadSchema>;

/**
 * One service's live work, from /api/library/activity (the gateway aggregate).
 * `per_min` is the trailing-60s completion rate; `busy` is `inflight > 0`.
 */
const ServiceActivitySchema = z.object({
  name: z.string(),
  inflight: z.number(),
  per_min: z.number(),
  busy: z.boolean(),
  last_op: z.string().nullable(),
  reachable: z.boolean(),
});
type ServiceActivity = z.infer<typeof ServiceActivitySchema>;

const ActivityPayloadSchema = z.object({
  services: z.array(ServiceActivitySchema),
});

// ---------------------------------------------------------------------------
// Presentation helpers.
// ---------------------------------------------------------------------------

/** Friendly one-liner describing what each component is. */
const COMPONENT_BLURB: Record<string, string> = {
  gateway: "BFF — the only API the UI talks to",
  catalog: "Source of truth (Postgres + RustFS)",
  search: "Hybrid vector search (Qdrant)",
  graph: "Relationship graph (Neo4j)",
  ingest: "Ingest & maintenance worker",
  vision: "CLIP + SPLADE embedding service",
  metadata: "PNG metadata extraction",
  labelagent: "AI image labeling / description",
};

function statusDot(status: ComponentStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "down":
      return "bg-rose-500";
  }
}

function statusChip(status: ComponentStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-500";
    case "degraded":
      return "bg-amber-500/15 text-amber-500";
    case "down":
      return "bg-rose-500/15 text-rose-500";
  }
}

function statusLabel(status: ComponentStatus): string {
  return status === "ok" ? "online" : status === "degraded" ? "degraded" : "offline";
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

/**
 * System status & activity board: one card per backend component (gateway,
 * catalog, search, graph, ingest, vision, metadata) with an online/degraded/
 * offline indicator + per-component dependency readiness AND a live "what is it
 * doing right now" line (busy/idle, in-flight count, throughput, current op).
 *
 * Two polls on different cadences: health every `pollMs` (default 10s, drives
 * status + dependencies) and activity every `activityPollMs` (default 4s, the
 * fast "who's working now" signal). Activity degrades silently — when it is
 * unavailable the board still shows health.
 *
 * Each poll fans out gateway -> every backend service, so the cadence is the
 * dominant source of idle inter-service chatter (and trace volume to Tempo).
 * These defaults are deliberately conservative; both pause while the tab is
 * hidden and catch up on return.
 */
const ServiceStatusBoardPropsSchema = z.object({
  pollMs: z.number().optional(),
  activityPollMs: z.number().optional(),
});
type ServiceStatusBoardProps = z.infer<typeof ServiceStatusBoardPropsSchema>;

/** Polls /api/library/health on `pollMs`, pausing while the tab is hidden. */
function useHealthPoll(pollMs: number) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/library/health")
      .then((r) => r.json())
      .then((j: unknown) => setHealth(HealthPayloadSchema.parse(j)))
      .catch(() => setHealth(null))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
    // Pause the background poll while the tab is hidden; resume + catch up the
    // moment it's visible again. The manual Refresh button still calls `refresh`
    // unconditionally, so explicit user action is never gated.
    const tick = () => { if (!document.hidden) refresh(); };
    const id = setInterval(tick, pollMs);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pollMs]);

  return { health, loaded, refresh };
}

/**
 * Fast, independent poll for the live per-service work line, on `activityPollMs`.
 * Keyed by service name so a card can look up its own activity; failures keep
 * the last snapshot.
 */
function useActivityPoll(activityPollMs: number) {
  const [activity, setActivity] = useState<Record<string, ServiceActivity>>({});

  useEffect(() => {
    let cancelled = false;
    const pollActivity = () => {
      fetch("/api/library/activity", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: unknown) => {
          const parsed = ActivityPayloadSchema.safeParse(j);
          if (cancelled || !parsed.success) return;
          setActivity(Object.fromEntries(parsed.data.services.map((s) => [s.name, s])));
        })
        .catch(() => {});
    };
    pollActivity();
    // Skip activity probes while the tab is hidden (this poll fans out to every
    // service); catch up immediately on return so the board is never stale on-screen.
    const tick = () => { if (!document.hidden) pollActivity(); };
    const id = setInterval(tick, activityPollMs);
    const onVisible = () => { if (!document.hidden) pollActivity(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activityPollMs]);

  return activity;
}

const BoardHeaderPropsSchema = z.object({
  health: z.custom<HealthPayload | null>(),
  loaded: z.boolean(),
  overall: ComponentStatusSchema,
  offline: z.number(),
  totalInflight: z.number(),
  onRefresh: z.custom<() => void>(),
});
type BoardHeaderProps = z.infer<typeof BoardHeaderPropsSchema>;

function BoardHeader({ health, loaded, overall, offline, totalInflight, onRefresh }: BoardHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">System status &amp; activity</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-ui-2xs font-medium ${
            loaded ? statusChip(overall) : "bg-ui-bg text-ui-ink-muted"
          }`}
          data-testid="status-overall"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${loaded ? statusDot(overall) : "bg-ui-ink-muted"}`} />
          {!loaded
            ? "checking…"
            : overall === "ok"
              ? "all systems online"
              : `${offline} component${offline === 1 ? " needs" : "s need"} attention`}
        </span>
        {totalInflight > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2 py-0.5 text-ui-2xs font-medium text-sky-500"
            data-testid="status-inflight"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            {totalInflight} in-flight
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-ui-2xs text-ui-ink-muted">
        {health?.checkedAt && <span>updated {relativeTime(health.checkedAt)}</span>}
        <button
          className="rounded-md border border-ui-border/70 px-2 py-1 transition hover:bg-accent-cyan/10"
          onClick={onRefresh}
          data-testid="status-refresh"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

const DependenciesRowPropsSchema = z.object({
  dependencies: z.array(DependencySchema),
});
type DependenciesRowProps = z.infer<typeof DependenciesRowPropsSchema>;

function DependenciesRow({ dependencies }: DependenciesRowProps) {
  if (dependencies.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 border-t border-ui-border/40 pt-2">
      {dependencies.map((d) => (
        <span
          key={d.name}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-ui-2xs ${
            d.ready ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
          }`}
          title={d.ready ? "ready" : "not ready"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${d.ready ? "bg-emerald-500" : "bg-rose-500"}`} />
          {d.name}
        </span>
      ))}
    </div>
  );
}

const ActivityRowPropsSchema = z.object({
  name: z.string(),
  activity: ServiceActivitySchema,
});
type ActivityRowProps = z.infer<typeof ActivityRowPropsSchema>;

/** Live work line: what this service is doing right now. */
function ActivityRow({ name, activity }: ActivityRowProps) {
  return (
    <div
      className="flex items-center gap-2 border-t border-ui-border/40 pt-2 text-ui-2xs"
      data-testid={`activity-${name}`}
    >
      <span
        className={`inline-flex shrink-0 items-center gap-1 font-medium ${
          activity.busy ? "text-sky-500" : "text-ui-ink-muted"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${activity.busy ? "animate-pulse bg-sky-500" : "bg-ui-ink-muted/50"}`}
        />
        {activity.busy ? "busy" : "idle"}
      </span>
      <span className="shrink-0 text-ui-ink-muted">
        {activity.inflight} in-flight · {activity.per_min}/min
      </span>
      {activity.busy && activity.last_op && (
        <span className="min-w-0 flex-1 truncate text-right text-ui-ink-muted" title={activity.last_op ?? undefined}>
          {activity.last_op}
        </span>
      )}
    </div>
  );
}

const StatusCardPropsSchema = z.object({
  component: ComponentHealthSchema,
  activity: z.custom<ServiceActivity | undefined>(),
});
type StatusCardProps = z.infer<typeof StatusCardPropsSchema>;

function StatusCard({ component: c, activity }: StatusCardProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-ui-border/50 bg-ui-bg p-3"
      data-testid={`status-card-${c.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-ui-sm font-medium text-ui-ink-title">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(c.status)}`} />
            {c.name}
          </p>
          <p className="mt-0.5 truncate text-ui-2xs text-ui-ink-muted">{COMPONENT_BLURB[c.name] ?? "service"}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-ui-2xs font-medium ${statusChip(c.status)}`}>
          {statusLabel(c.status)}
        </span>
      </div>

      <DependenciesRow dependencies={c.dependencies} />

      {activity && <ActivityRow name={c.name} activity={activity} />}
    </div>
  );
}

const BoardBodyPropsSchema = z.object({
  health: z.custom<HealthPayload | null>(),
  loaded: z.boolean(),
  components: z.array(ComponentHealthSchema),
  activity: z.custom<Record<string, ServiceActivity>>(),
});
type BoardBodyProps = z.infer<typeof BoardBodyPropsSchema>;

function BoardBody({ health, loaded, components, activity }: BoardBodyProps) {
  return (
    <>
      {health?.warnings?.length ? (
        <p className="mb-3 text-ui-2xs text-rose-500" data-testid="status-warning">
          {health.warnings.join(" · ")}
        </p>
      ) : null}

      {loaded && components.length === 0 ? (
        <p className="text-ui-sm text-ui-ink-muted">No status available.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(loaded ? components : SKELETON).map((c, i) => (
            <StatusCard key={c.name + i} component={c} activity={activity[c.name]} />
          ))}
        </div>
      )}
    </>
  );
}

export function ServiceStatusBoard({ pollMs = 10000, activityPollMs = 4000 }: ServiceStatusBoardProps) {
  const { health, loaded, refresh } = useHealthPoll(pollMs);
  const activity = useActivityPoll(activityPollMs);

  const overall: ComponentStatus = health ? health.status : "down";
  const components = health?.components ?? [];
  const offline = components.filter((c) => c.status !== "ok").length;
  const totalInflight = Object.values(activity).reduce((n, a) => n + (a.inflight || 0), 0);

  return (
    <section
      className="rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4"
      data-testid="service-status"
    >
      <BoardHeader
        health={health}
        loaded={loaded}
        overall={overall}
        offline={offline}
        totalInflight={totalInflight}
        onRefresh={refresh}
      />
      <BoardBody health={health} loaded={loaded} components={components} activity={activity} />
    </section>
  );
}

// Placeholder cards shown before the first health response lands.
const SKELETON: ComponentHealth[] = [
  "gateway",
  "catalog",
  "search",
  "graph",
  "ingest",
  "vision",
  "metadata",
].map((name) => ({ name, status: "down", dependencies: [] }));
