"use client";
import { z } from "zod";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Queue visualization / admin page (#29, ADR 0001 + 0002).
//
// Live queue depth/consumers/rates + DLQ inspection/requeue/purge come from the
// gateway's RabbitMQ management proxy; per-image task history comes from the
// catalog tasks ledger. Deep-links to RabbitMQ's own management UI for power use.
//
// Built wide for ops use: a KPI summary strip up top, a dense depth table with
// total/backlog bars + net throughput, detailed dead-letter cards, and a full
// task ledger table with timestamps.
// ---------------------------------------------------------------------------

const RABBITMQ_MGMT_URL =
  process.env.NEXT_PUBLIC_RABBITMQ_MGMT_URL ?? "http://localhost:15672";

const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  input:
    "w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  btnSm: "rounded-md border border-ui-border/70 bg-ui-bg-soft px-2 py-1 text-ui-2xs font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  danger:
    "rounded-md border border-rose-500/40 px-2 py-1 text-ui-2xs text-rose-500 transition hover:bg-rose-500/10",
};

const QueueStatSchema = z.object({
  name: z.string(),
  reachable: z.boolean(),
  messages: z.number(),
  messages_ready: z.number(),
  messages_unacknowledged: z.number(),
  consumers: z.number(),
  publish_rate: z.number(),
  deliver_rate: z.number(),
});
type QueueStat = z.infer<typeof QueueStatSchema>;

const QueueMessageSchema = z.object({
  payload: z.string().nullable(),
  headers: z.record(z.string(), z.unknown()),
  payload_bytes: z.number().optional(),
  payload_encoding: z.string().optional(),
  redelivered: z.boolean().optional(),
  routing_key: z.string().optional(),
  exchange: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

// A non-destructive peek result for one queue: the sampled messages + how many
// are still queued after the peek (the sample is requeued, not consumed).
const QueuePeekSchema = z.object({
  messages: z.array(QueueMessageSchema),
  remaining: z.number(),
});
type QueuePeek = z.infer<typeof QueuePeekSchema>;

const PeekResponseSchema = z.object({
  messages: z.array(QueueMessageSchema).optional(),
  remaining: z.number().optional(),
});

const TaskSchema = z.object({
  id: z.string(),
  sha256: z.string(),
  type: z.string(),
  status: z.string(),
  attempts: z.number(),
  error: z.string().nullable(),
  parent_op_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
type Task = z.infer<typeof TaskSchema>;

// Per-stage DAG queues (ADR 0002): the opt-in `ingest` producer queue, the
// embed/index/label stages, plus the legacy `index` queue kept for in-flight
// migration drain. Each has a `<base>.dlq` with peek/requeue/purge controls.
const DLQ_BASES = [
  "ingest",
  "embed.dense",
  "embed.sparse",
  "index.search",
  "index.graph",
  "label",
  "index",
] as const;

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "bg-sky-500/15 text-sky-500";
    case "queued":
      return "bg-ui-bg text-ui-ink-muted";
    case "done":
      return "bg-emerald-500/15 text-emerald-500";
    case "failed":
      return "bg-amber-500/15 text-amber-500";
    case "dlq":
      return "bg-rose-500/15 text-rose-500";
    default:
      return "bg-ui-bg text-ui-ink-muted";
  }
}

// Short relative timestamp for the ledger ("12s ago" / "3m ago" / "2h ago").
function ago(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Collapse a long hash to head…tail so the table stays scannable.
function shortSha(sha: string): string {
  return sha.length > 16 ? `${sha.slice(0, 8)}…${sha.slice(-6)}` : sha;
}

// DLQ payloads are JSON task envelopes; pull out the sha for a readable label.
function payloadSha(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const o = JSON.parse(payload) as Record<string, unknown>;
    return typeof o.sha256 === "string" ? o.sha256 : null;
  } catch {
    return null;
  }
}

// Parse a task envelope into its known fields. Most stages carry
// {sha256, type, parent_op_id}; the ingest stage carries {path, source_folder_id}.
const TaskEnvelopeSchema = z.object({
  sha256: z.string().optional(),
  type: z.string().optional(),
  path: z.string().optional(),
  parent_op_id: z.string().optional(),
  source_folder_id: z.string().optional(),
});
type TaskEnvelope = z.infer<typeof TaskEnvelopeSchema>;

function taskEnvelope(payload: string | null): TaskEnvelope | null {
  if (!payload) return null;
  try {
    const o = JSON.parse(payload) as Record<string, unknown>;
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
    return {
      sha256: str("sha256"),
      type: str("type"),
      path: str("path"),
      parent_op_id: str("parent_op_id"),
      source_folder_id: str("source_folder_id"),
    };
  } catch {
    return null;
  }
}

// Pretty-print a JSON payload for the raw view; leave non-JSON untouched.
function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

const pillCls = "rounded px-1 py-0.5 text-ui-2xs";

// One message in a queue, rendered with its decoded task fields up top (stage,
// sha/path, op, attempt, redelivered, size) and the raw payload + headers behind
// disclosure toggles. Shared by the live-queue inspector and the DLQ cards.
const MessageCardPropsSchema = z.object({
  m: QueueMessageSchema,
  index: z.number(),
});
type MessageCardProps = z.infer<typeof MessageCardPropsSchema>;

const MessageCardBadgesPropsSchema = z.object({
  m: QueueMessageSchema,
  index: z.number(),
  env: TaskEnvelopeSchema.nullable(),
  sha: z.string().nullable(),
});
type MessageCardBadgesProps = z.infer<typeof MessageCardBadgesPropsSchema>;

const MessageCardIdentifierPropsSchema = z.object({
  sha: z.string().nullable(),
  path: z.string().optional(),
});
type MessageCardIdentifierProps = z.infer<typeof MessageCardIdentifierPropsSchema>;

/** The message's sha256 (preferred) or source path, whichever is known. */
function MessageCardIdentifier({ sha, path }: MessageCardIdentifierProps) {
  if (sha) {
    return (
      <span className="font-mono text-ui-ink" title={sha}>
        {shortSha(sha)}
      </span>
    );
  }
  if (path) {
    return (
      <span className="min-w-0 truncate font-mono text-ui-ink" title={path}>
        {path}
      </span>
    );
  }
  return null;
}

function MessageCardBadges({ m, index, env, sha }: MessageCardBadgesProps) {
  const attempt = m.headers?.["x-attempt"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-ui-ink-muted">#{index + 1}</span>
      {env?.type && <span className={`${pillCls} bg-accent-cyan/10 font-medium text-accent-cyan`}>{env.type}</span>}
      <MessageCardIdentifier sha={sha} path={env?.path} />
      {m.redelivered && <span className={`${pillCls} bg-amber-500/10 text-amber-500`}>redelivered</span>}
      {attempt != null && (
        <span className={`${pillCls} bg-rose-500/10 text-rose-500`}>attempt {String(attempt)}</span>
      )}
      {typeof m.payload_bytes === "number" && (
        <span className="text-ui-ink-muted" title="payload size">
          {m.payload_bytes} B
        </span>
      )}
      {m.routing_key && (
        <span className="text-ui-ink-muted" title="routing key">
          rk:{m.routing_key}
        </span>
      )}
    </div>
  );
}

const MessageCardDetailsPropsSchema = z.object({
  m: QueueMessageSchema,
  index: z.number(),
});
type MessageCardDetailsProps = z.infer<typeof MessageCardDetailsPropsSchema>;

function MessageCardDetails({ m, index }: MessageCardDetailsProps) {
  const hasHeaders = m.headers && Object.keys(m.headers).length > 0;
  return (
    <>
      {m.payload && (
        <details className="mt-1">
          <summary
            className="cursor-pointer text-ui-ink-muted hover:text-ui-ink"
            data-testid={`queue-msg-payload-toggle-${index}`}
          >
            payload
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-ui-bg p-1.5 font-mono text-ui-ink-muted">
            {prettyJson(m.payload)}
          </pre>
        </details>
      )}
      {hasHeaders && (
        <details className="mt-1">
          <summary
            className="cursor-pointer text-ui-ink-muted hover:text-ui-ink"
            data-testid={`queue-msg-headers-toggle-${index}`}
          >
            headers
          </summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-ui-bg p-1.5 font-mono text-ui-ink-muted">
            {JSON.stringify(m.headers, null, 2)}
          </pre>
        </details>
      )}
    </>
  );
}

function MessageCard({ m, index }: MessageCardProps) {
  const env = taskEnvelope(m.payload);
  const sha = env?.sha256 ?? payloadSha(m.payload);
  const err = m.headers?.["x-error"];
  return (
    <li className="min-w-0 rounded border border-ui-border/40 bg-ui-bg-soft/40 p-2 text-ui-2xs">
      <MessageCardBadges m={m} index={index} env={env} sha={sha} />
      {env?.parent_op_id && (
        <div className="mt-1 font-mono text-ui-ink-muted" title={env.parent_op_id}>
          op {env.parent_op_id.slice(0, 8)}
        </div>
      )}
      {err != null && <div className="mt-1 break-words text-rose-500">{String(err)}</div>}
      <MessageCardDetails m={m} index={index} />
    </li>
  );
}

const KpiPropsSchema = z.object({
  label: z.string(),
  value: z.string(),
  tone: z.enum(["default", "good", "warn", "bad"]).optional(),
});
type KpiProps = z.infer<typeof KpiPropsSchema>;

function Kpi({ label, value, tone = "default" }: KpiProps) {
  const toneCls =
    tone === "bad"
      ? "text-rose-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "good"
          ? "text-emerald-500"
          : "text-ui-ink-title";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-ui-border/50 bg-ui-bg px-3 py-2">
      <span className="truncate text-ui-2xs uppercase tracking-wide text-ui-ink-muted">{label}</span>
      <span className={`text-ui-xl font-semibold tabular-nums ${toneCls}`}>{value}</span>
    </div>
  );
}

const QueueRowStatsPropsSchema = z.object({
  q: QueueStatSchema,
  maxMessages: z.number(),
  isDlq: z.boolean(),
});
type QueueRowStatsProps = z.infer<typeof QueueRowStatsPropsSchema>;

/** The depth-bar + numeric cells shared by every queue row. */
function QueueRowStats({ q, maxMessages, isDlq }: QueueRowStatsProps) {
  const net = q.publish_rate - q.deliver_rate;
  const barPct = Math.round((q.messages / maxMessages) * 100);
  const barColor = isDlq ? "bg-rose-500/70" : q.messages_unacknowledged > 0 ? "bg-sky-500/70" : "bg-accent-cyan/70";
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums">{q.messages_ready}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {q.messages_unacknowledged > 0 ? (
          <span className="text-sky-500">{q.messages_unacknowledged}</span>
        ) : (
          q.messages_unacknowledged
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-medium tabular-nums">{q.messages}</td>
      <td className="px-2 py-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ui-bg">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${q.messages > 0 ? Math.max(barPct, 4) : 0}%` }}
          />
        </div>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {q.consumers === 0 && q.messages_ready > 0 ? (
          <span className="text-amber-500" title="messages ready but no consumers">
            {q.consumers}
          </span>
        ) : (
          q.consumers
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{q.publish_rate.toFixed(1)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{q.deliver_rate.toFixed(1)}</td>
      <td
        className={`px-2 py-1.5 text-right tabular-nums ${
          net > 0.05 ? "text-amber-500" : net < -0.05 ? "text-emerald-500" : "text-ui-ink-muted"
        }`}
      >
        {net > 0 ? "+" : ""}
        {net.toFixed(1)}
      </td>
    </>
  );
}

const QueueInspectorRowPropsSchema = z.object({
  name: z.string(),
  peek: QueuePeekSchema.optional(),
  onRePeek: z.custom<() => void>(),
});
type QueueInspectorRowProps = z.infer<typeof QueueInspectorRowPropsSchema>;

/** The expandable "peeked messages" row shown under an open queue row. */
function QueueInspectorRow({ name, peek, onRePeek }: QueueInspectorRowProps) {
  return (
    <tr className="border-t border-ui-border/40 bg-ui-bg-soft/20" data-testid={`queue-inspect-${name}`}>
      <td colSpan={10} className="px-2 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-ui-2xs text-ui-ink-muted">
            {peek
              ? `${peek.messages.length} ready message(s) sampled · ${peek.remaining} remaining · non-destructive (requeued)`
              : "loading…"}
          </span>
          <button className={cls.btnSm} onClick={onRePeek} data-testid={`queue-repeek-${name}`}>
            Re-peek
          </button>
        </div>
        {peek && (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {peek.messages.length === 0 && (
              <li className="text-ui-2xs text-ui-ink-muted">
                no ready messages (queue empty, or all in-flight on a consumer)
              </li>
            )}
            {peek.messages.map((m, i) => (
              <MessageCard key={i} m={m} index={i} />
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

const QueueRowPropsSchema = z.object({
  q: QueueStatSchema,
  maxMessages: z.number(),
  isOpen: z.boolean(),
  peek: QueuePeekSchema.optional(),
  onToggleInspect: z.custom<() => void>(),
  onRePeek: z.custom<() => void>(),
});
type QueueRowProps = z.infer<typeof QueueRowPropsSchema>;

function QueueRow({ q, maxMessages, isOpen, peek, onToggleInspect, onRePeek }: QueueRowProps) {
  const isDlq = q.name.endsWith(".dlq");
  return (
    <Fragment>
      <tr
        className={`border-t border-ui-border/40 align-middle hover:bg-ui-bg-soft/40 ${q.reachable ? "" : "opacity-40"}`}
        data-testid={`queue-row-${q.name}`}
      >
        <td className="px-2 py-1.5 font-medium text-ui-ink">
          <span className={isDlq ? "text-rose-500" : ""}>{q.name}</span>
          {!q.reachable && <span className="ml-1 text-ui-2xs text-ui-ink-muted">(down)</span>}
        </td>
        <QueueRowStats q={q} maxMessages={maxMessages} isDlq={isDlq} />
        <td className="px-2 py-1.5 text-right">
          {/* DLQs are inspected in the dead-letter panel below. */}
          {!isDlq && (
            <button
              className={cls.btnSm}
              onClick={onToggleInspect}
              disabled={!q.reachable}
              data-testid={`queue-peek-${q.name}`}
            >
              {isOpen ? "Hide" : "Peek"}
            </button>
          )}
        </td>
      </tr>
      {isOpen && <QueueInspectorRow name={q.name} peek={peek} onRePeek={onRePeek} />}
    </Fragment>
  );
}

/** Live queue list + polling + the derived KPI/scale aggregates. */
function useQueueStats() {
  const [queues, setQueues] = useState<QueueStat[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/library/queues")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.queues)) {
          setQueues(j.queues as QueueStat[]);
          setLastUpdated(Date.now());
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  // Aggregate KPIs across the live queue set. DLQ depth is summed separately so
  // a stuck dead-letter is impossible to miss at the top of the page.
  const kpis = useMemo(() => {
    let ready = 0;
    let unacked = 0;
    let consumers = 0;
    let inRate = 0;
    let outRate = 0;
    let dlqTotal = 0;
    let unreachable = 0;
    for (const q of queues) {
      if (!q.reachable) unreachable += 1;
      if (q.name.endsWith(".dlq")) {
        dlqTotal += q.messages;
        continue;
      }
      ready += q.messages_ready;
      unacked += q.messages_unacknowledged;
      consumers += q.consumers;
      inRate += q.publish_rate;
      outRate += q.deliver_rate;
    }
    return { ready, unacked, consumers, inRate, outRate, dlqTotal, unreachable };
  }, [queues]);

  // Scale the in-row depth bars against the busiest queue.
  const maxMessages = useMemo(() => Math.max(1, ...queues.map((q) => q.messages)), [queues]);

  return { queues, lastUpdated, refresh, kpis, maxMessages };
}

/** Peek/inspect/requeue/purge actions shared by the queue table and DLQ cards. */
function useQueueInspector(refresh: () => void, setNotice: (v: string | null) => void, setError: (v: string | null) => void) {
  const [peeked, setPeeked] = useState<Record<string, QueuePeek>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  // Non-destructively peek a queue's contents (works for any queue — live stage,
  // .retry, or .dlq). The sample is requeued, so the depth is unchanged.
  const peekQueue = useCallback(async (name: string, limit = 25) => {
    setError(null);
    try {
      const raw = await fetch(
        `/api/library/queues/${encodeURIComponent(name)}/messages?limit=${limit}`,
      ).then((r) => r.json());
      const j = PeekResponseSchema.parse(raw);
      setPeeked((prev) => ({
        ...prev,
        [name]: { messages: j.messages ?? [], remaining: j.remaining ?? 0 },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Peek failed");
    }
  }, [setError]);

  // Toggle the inline inspector on a live-queue row, fetching its contents the
  // first time it opens.
  const toggleInspect = (name: string) => {
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    if (!peeked[name]) void peekQueue(name);
  };

  const requeueDlq = async (base: string) => {
    if (!window.confirm(`Requeue all ${base}.dlq messages back to "${base}"?`)) return;
    setError(null);
    try {
      const j = await fetch(`/api/library/dlq/${encodeURIComponent(base)}/requeue`, {
        method: "POST",
      }).then((r) => r.json());
      setNotice(`Requeued ${j.count ?? 0} message(s) to ${base}.`);
      setPeeked((prev) => ({ ...prev, [`${base}.dlq`]: { messages: [], remaining: 0 } }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Requeue failed");
    }
  };

  const purge = async (name: string) => {
    // Typed-confirm: the operator must type the queue name to purge it.
    const typed = window.prompt(`Type "${name}" to PURGE all its messages (irreversible):`);
    if (typed !== name) return;
    setError(null);
    try {
      await fetch(`/api/library/queues/${encodeURIComponent(name)}/purge`, { method: "POST" });
      setNotice(`Purged ${name}.`);
      setPeeked((prev) => ({ ...prev, [name]: { messages: [], remaining: 0 } }));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purge failed");
    }
  };

  return { peeked, expanded, peekQueue, toggleInspect, requeueDlq, purge };
}

/** Per-image task-history lookup (catalog ledger). */
function useTaskLookup(setError: (v: string | null) => void) {
  const [taskSha, setTaskSha] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);

  const lookupTasks = async () => {
    const sha = taskSha.trim();
    setError(null);
    try {
      const qs = sha ? `?sha256=${encodeURIComponent(sha)}` : "";
      const j = await fetch(`/api/library/tasks${qs}`).then((r) => r.json());
      setTasks((j.tasks ?? []) as Task[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    }
  };

  return { taskSha, setTaskSha, tasks, lookupTasks };
}

const QueueKpisSchema = z.object({
  ready: z.number(),
  unacked: z.number(),
  consumers: z.number(),
  inRate: z.number(),
  outRate: z.number(),
  dlqTotal: z.number(),
  unreachable: z.number(),
});

function QueuesHeader() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Queues</h1>
        <p className="max-w-3xl text-ui-sm text-ui-ink-muted">
          Per-stage ingest DAG queues (embed.dense/embed.sparse → index.search, index.graph, label) — live depth,
          peek any queue&apos;s contents, dead-letters, and per-image history.
        </p>
      </div>
      <a
        href={RABBITMQ_MGMT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cls.btn}
        data-testid="rabbitmq-link"
      >
        Open RabbitMQ console ↗
      </a>
    </header>
  );
}

const QueueKpisSectionPropsSchema = z.object({
  kpis: QueueKpisSchema,
});
type QueueKpisSectionProps = z.infer<typeof QueueKpisSectionPropsSchema>;

function QueueKpisSection({ kpis }: QueueKpisSectionProps) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="queue-kpis">
      <Kpi label="Ready backlog" value={kpis.ready.toLocaleString()} tone={kpis.ready > 0 ? "warn" : "good"} />
      <Kpi label="In-flight" value={kpis.unacked.toLocaleString()} />
      <Kpi label="Dead-letters" value={kpis.dlqTotal.toLocaleString()} tone={kpis.dlqTotal > 0 ? "bad" : "good"} />
      <Kpi label="Consumers" value={kpis.consumers.toLocaleString()} tone={kpis.consumers > 0 ? "default" : "warn"} />
      <Kpi label="Publish /s" value={kpis.inRate.toFixed(1)} />
      <Kpi label="Deliver /s" value={kpis.outRate.toFixed(1)} />
    </section>
  );
}

const QueueStatsSectionPropsSchema = z.object({
  queues: z.array(QueueStatSchema),
  lastUpdated: z.number().nullable(),
  unreachable: z.number(),
  maxMessages: z.number(),
  expanded: z.string().nullable(),
  peeked: z.record(z.string(), QueuePeekSchema),
  onRefresh: z.custom<() => void>(),
  onToggleInspect: z.custom<(name: string) => void>(),
  onRePeek: z.custom<(name: string) => void>(),
});
type QueueStatsSectionProps = z.infer<typeof QueueStatsSectionPropsSchema>;

const QueueTablePropsSchema = z.object({
  queues: z.array(QueueStatSchema),
  maxMessages: z.number(),
  expanded: z.string().nullable(),
  peeked: z.record(z.string(), QueuePeekSchema),
  onToggleInspect: z.custom<(name: string) => void>(),
  onRePeek: z.custom<(name: string) => void>(),
});
type QueueTableProps = z.infer<typeof QueueTablePropsSchema>;

function QueueTable({ queues, maxMessages, expanded, peeked, onToggleInspect, onRePeek }: QueueTableProps) {
  return (
    <table className="w-full min-w-[760px] text-ui-xs">
      <thead className="text-ui-ink-muted">
        <tr className="text-left">
          <th className="px-2 py-1">queue</th>
          <th className="px-2 py-1 text-right">ready</th>
          <th className="px-2 py-1 text-right">unacked</th>
          <th className="px-2 py-1 text-right">total</th>
          <th className="w-[28%] px-2 py-1">depth</th>
          <th className="px-2 py-1 text-right">consumers</th>
          <th className="px-2 py-1 text-right">in/s</th>
          <th className="px-2 py-1 text-right">out/s</th>
          <th className="px-2 py-1 text-right">net/s</th>
          <th className="px-2 py-1 text-right">inspect</th>
        </tr>
      </thead>
      <tbody>
        {queues.map((q) => (
          <QueueRow
            key={q.name}
            q={q}
            maxMessages={maxMessages}
            isOpen={expanded === q.name}
            peek={peeked[q.name]}
            onToggleInspect={() => onToggleInspect(q.name)}
            onRePeek={() => onRePeek(q.name)}
          />
        ))}
        {queues.length === 0 && (
          <tr>
            <td colSpan={10} className="px-2 py-3 text-ui-ink-muted">
              No queue data (broker unreachable?).
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function QueueStatsSection({
  queues,
  lastUpdated,
  unreachable,
  maxMessages,
  expanded,
  peeked,
  onRefresh,
  onToggleInspect,
  onRePeek,
}: QueueStatsSectionProps) {
  return (
    <section className={cls.card} data-testid="queue-stats">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">
          Queue depth{" "}
          <span className="ml-2 text-ui-2xs text-ui-ink-muted">
            live · 3s{lastUpdated ? ` · updated ${ago(new Date(lastUpdated).toISOString())}` : ""}
            {unreachable > 0 ? ` · ${unreachable} unreachable` : ""}
          </span>
        </h2>
        <button className={cls.btn} onClick={onRefresh} data-testid="queues-refresh">
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <QueueTable
          queues={queues}
          maxMessages={maxMessages}
          expanded={expanded}
          peeked={peeked}
          onToggleInspect={onToggleInspect}
          onRePeek={onRePeek}
        />
      </div>
    </section>
  );
}

const DlqCardPropsSchema = z.object({
  base: z.string(),
  count: z.number(),
  messages: z.array(QueueMessageSchema).optional(),
  onPeek: z.custom<() => void>(),
  onRequeue: z.custom<() => void>(),
  onPurge: z.custom<() => void>(),
});
type DlqCardProps = z.infer<typeof DlqCardPropsSchema>;

function DlqCard({ base, count, messages, onPeek, onRequeue, onPurge }: DlqCardProps) {
  const name = `${base}.dlq`;
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-lg border bg-ui-bg p-3 ${
        count > 0 ? "border-rose-500/40" : "border-ui-border/50"
      }`}
      data-testid={`dlq-${base}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-ui-sm font-medium text-ui-ink-title">
          {name}
          <span className={`ml-2 text-ui-2xs ${count > 0 ? "font-semibold text-rose-500" : "text-ui-ink-muted"}`}>
            {count} msg
          </span>
        </p>
        <div className="flex shrink-0 gap-1">
          <button className={cls.btnSm} onClick={onPeek} data-testid={`dlq-peek-${base}`}>
            Peek
          </button>
          <button className={cls.btnSm} onClick={onRequeue} disabled={count === 0} data-testid={`dlq-requeue-${base}`}>
            Requeue
          </button>
          <button className={cls.danger} onClick={onPurge} data-testid={`dlq-purge-${base}`}>
            Purge
          </button>
        </div>
      </div>
      {messages && (
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {messages.length === 0 && <li className="text-ui-2xs text-ui-ink-muted">empty</li>}
          {messages.map((m, i) => (
            <MessageCard key={i} m={m} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

const DlqPanelPropsSchema = z.object({
  queues: z.array(QueueStatSchema),
  peeked: z.record(z.string(), QueuePeekSchema),
  dlqTotal: z.number(),
  onPeek: z.custom<(name: string) => void>(),
  onRequeue: z.custom<(base: string) => void>(),
  onPurge: z.custom<(name: string) => void>(),
});
type DlqPanelProps = z.infer<typeof DlqPanelPropsSchema>;

function DlqPanel({ queues, peeked, dlqTotal, onPeek, onRequeue, onPurge }: DlqPanelProps) {
  return (
    <section className={cls.card} data-testid="dlq-panel">
      <h2 className="mb-3 text-ui-sm font-semibold text-ui-ink-title">
        Dead-letter queues
        {dlqTotal > 0 && (
          <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-ui-2xs text-rose-500">
            {dlqTotal} stuck
          </span>
        )}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {DLQ_BASES.map((base) => {
          const name = `${base}.dlq`;
          const stat = queues.find((q) => q.name === name);
          const count = stat ? stat.messages : 0;
          return (
            <DlqCard
              key={name}
              base={base}
              count={count}
              messages={peeked[name]?.messages}
              onPeek={() => onPeek(name)}
              onRequeue={() => onRequeue(base)}
              onPurge={() => onPurge(name)}
            />
          );
        })}
      </div>
    </section>
  );
}

const TaskLookupSectionPropsSchema = z.object({
  taskSha: z.string(),
  onTaskShaChange: z.custom<(v: string) => void>(),
  tasks: z.array(TaskSchema),
  onLookup: z.custom<() => void>(),
});
type TaskLookupSectionProps = z.infer<typeof TaskLookupSectionPropsSchema>;

const TaskLookupTablePropsSchema = z.object({
  tasks: z.array(TaskSchema),
});
type TaskLookupTableProps = z.infer<typeof TaskLookupTablePropsSchema>;

function TaskLookupTable({ tasks }: TaskLookupTableProps) {
  return (
    <table className="w-full min-w-[820px] text-ui-xs" data-testid="task-table">
      <thead className="text-ui-ink-muted">
        <tr className="text-left">
          <th className="px-2 py-1">status</th>
          <th className="px-2 py-1">type</th>
          <th className="px-2 py-1">sha256</th>
          <th className="px-2 py-1 text-right">attempts</th>
          <th className="px-2 py-1">created</th>
          <th className="px-2 py-1">updated</th>
          <th className="px-2 py-1">op</th>
          <th className="px-2 py-1">error</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <tr key={t.id} className="border-t border-ui-border/40 align-middle hover:bg-ui-bg-soft/40">
            <td className="px-2 py-1.5">
              <span className={`rounded-full px-2 py-0.5 text-ui-2xs font-medium ${statusColor(t.status)}`}>
                {t.status}
              </span>
            </td>
            <td className="px-2 py-1.5 text-ui-ink-muted">{t.type}</td>
            <td className="px-2 py-1.5 font-mono text-ui-ink" title={t.sha256}>
              {shortSha(t.sha256)}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{t.attempts}</td>
            <td className="px-2 py-1.5 text-ui-ink-muted" title={t.created_at ?? ""}>
              {ago(t.created_at)}
            </td>
            <td className="px-2 py-1.5 text-ui-ink-muted" title={t.updated_at ?? ""}>
              {ago(t.updated_at)}
            </td>
            <td className="px-2 py-1.5 font-mono text-ui-2xs text-ui-ink-muted" title={t.parent_op_id ?? ""}>
              {t.parent_op_id ? t.parent_op_id.slice(0, 8) : "—"}
            </td>
            <td className="max-w-[24rem] truncate px-2 py-1.5 text-rose-500" title={t.error ?? ""}>
              {t.error ?? ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TaskLookupSection({ taskSha, onTaskShaChange, tasks, onLookup }: TaskLookupSectionProps) {
  return (
    <section className={cls.card} data-testid="task-lookup">
      <h2 className="mb-3 text-ui-sm font-semibold text-ui-ink-title">Per-image task history</h2>
      <div className="flex flex-wrap gap-2">
        <input
          className={`${cls.input} flex-1`}
          value={taskSha}
          onChange={(e) => onTaskShaChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLookup()}
          placeholder="sha256 (blank = recent tasks across the library)"
          data-testid="task-sha-input"
        />
        <button className={cls.btn} onClick={onLookup} data-testid="task-lookup-btn">
          Look up
        </button>
      </div>
      {tasks.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <TaskLookupTable tasks={tasks} />
        </div>
      ) : (
        <p className="mt-3 text-ui-2xs text-ui-ink-muted">No tasks loaded — look up a sha256 or list recent.</p>
      )}
    </section>
  );
}

export default function QueuesPage() {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { queues, lastUpdated, refresh, kpis, maxMessages } = useQueueStats();
  const { peeked, expanded, peekQueue, toggleInspect, requeueDlq, purge } = useQueueInspector(refresh, setNotice, setError);
  const { taskSha, setTaskSha, tasks, lookupTasks } = useTaskLookup(setError);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6" data-testid="queues-page">
      <QueuesHeader />

      {error && <p className="text-ui-sm text-rose-500" data-testid="queues-error">{error}</p>}
      {notice && <p className="text-ui-sm text-emerald-500" data-testid="queues-notice">{notice}</p>}

      <QueueKpisSection kpis={kpis} />

      <QueueStatsSection
        queues={queues}
        lastUpdated={lastUpdated}
        unreachable={kpis.unreachable}
        maxMessages={maxMessages}
        expanded={expanded}
        peeked={peeked}
        onRefresh={refresh}
        onToggleInspect={toggleInspect}
        onRePeek={peekQueue}
      />

      <DlqPanel
        queues={queues}
        peeked={peeked}
        dlqTotal={kpis.dlqTotal}
        onPeek={peekQueue}
        onRequeue={requeueDlq}
        onPurge={purge}
      />

      <TaskLookupSection taskSha={taskSha} onTaskShaChange={setTaskSha} tasks={tasks} onLookup={lookupTasks} />
    </div>
  );
}
