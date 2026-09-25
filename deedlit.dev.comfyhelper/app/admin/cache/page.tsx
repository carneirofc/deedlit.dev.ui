"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import type { CacheStatsResponse } from "@/app/api/library/cache/route";

const CacheConnectionSectionPropsSchema = z.object({
  data: z.custom<CacheStatsResponse>(),
});
type CacheConnectionSectionProps = z.infer<typeof CacheConnectionSectionPropsSchema>;

const CacheStatsSectionPropsSchema = z.object({
  stats: z.custom<CacheStatsResponse["stats"]>(),
});
type CacheStatsSectionProps = z.infer<typeof CacheStatsSectionPropsSchema>;

const CacheEntriesTablePropsSchema = z.object({
  sample: z.custom<CacheStatsResponse["sample"]>(),
});
type CacheEntriesTableProps = z.infer<typeof CacheEntriesTablePropsSchema>;

const CacheEntriesSectionPropsSchema = z.object({
  data: z.custom<CacheStatsResponse>(),
});
type CacheEntriesSectionProps = z.infer<typeof CacheEntriesSectionPropsSchema>;

const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  badge: (ok: boolean) =>
    ok
      ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-ui-2xs font-medium text-emerald-500"
      : "rounded-full bg-rose-500/15 px-2 py-0.5 text-ui-2xs font-medium text-rose-500",
  stat: "flex flex-col gap-0.5",
  statLabel: "text-ui-2xs text-ui-ink-muted",
  statValue: "text-ui-sm font-semibold tabular-nums text-ui-ink-title",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  btnDanger:
    "rounded-lg border border-rose-500/40 px-3 py-2 text-ui-sm font-medium text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50",
};

function fmtTtl(ttl: number | null): string {
  if (ttl === null) return "—";
  if (ttl < 0) return "no expiry";
  const d = Math.floor(ttl / 86400);
  const h = Math.floor((ttl % 86400) / 3600);
  const m = Math.floor((ttl % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function useCacheDebugState() {
  const [data, setData] = useState<CacheStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/library/cache")
      .then((r) => r.json())
      .then((d: CacheStatsResponse) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "fetch failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flush = async () => {
    setFlushing(true);
    setFlushResult(null);
    setError(null);
    try {
      const r = await fetch("/api/library/cache", { method: "DELETE" });
      const j = await r.json();
      setFlushResult(`Deleted ${j.deleted} keys.`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "flush failed");
    } finally {
      setFlushing(false);
    }
  };

  return { data, loading, flushing, flushResult, error, refresh, flush };
}

const CacheHeaderPropsSchema = z.object({
  loading: z.boolean(),
  flushing: z.boolean(),
  onRefresh: z.custom<() => void>(),
  onFlush: z.custom<() => void>(),
});
type CacheHeaderProps = z.infer<typeof CacheHeaderPropsSchema>;

function CacheHeader({ loading, flushing, onRefresh, onFlush }: CacheHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Image Cache</h1>
        <p className="text-ui-sm text-ui-ink-muted">
          Redis thumbnail &amp; original image byte cache — hit rates, entry counts, TTLs.
        </p>
      </div>
      <div className="flex gap-2">
        <button className={cls.btn} onClick={onRefresh} disabled={loading} data-testid="cache-refresh">
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button className={cls.btnDanger} onClick={onFlush} disabled={flushing || loading} data-testid="cache-flush">
          {flushing ? "Flushing…" : "Flush cache"}
        </button>
      </div>
    </header>
  );
}

export default function CacheDebugPage() {
  const { data, loading, flushing, flushResult, error, refresh, flush } = useCacheDebugState();

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6" data-testid="cache-page">
      <CacheHeader loading={loading} flushing={flushing} onRefresh={refresh} onFlush={flush} />

      {error && <p className="text-ui-sm text-rose-500">{error}</p>}
      {flushResult && <p className="text-ui-sm text-emerald-500">{flushResult}</p>}

      {data && (
        <>
          <CacheConnectionSection data={data} />
          {data.connected && (
            <>
              <CacheStatsSection stats={data.stats} />
              <CacheEntriesSection data={data} />
            </>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <p className="text-ui-sm text-ui-ink-muted">No data.</p>
      )}
    </div>
  );
}

function CacheConnectionSection({ data }: CacheConnectionSectionProps) {
  return (
    <section className={cls.card}>
      <h2 className="mb-3 text-ui-sm font-semibold text-ui-ink-title">Connection</h2>
      <div className="flex flex-wrap items-center gap-4">
        <div className={cls.stat}>
          <span className={cls.statLabel}>Configured</span>
          <span className={cls.badge(data.configured)}>
            {data.configured ? "yes" : "no — set REDIS_URL"}
          </span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Connected</span>
          <span className={cls.badge(data.connected)}>
            {data.connected ? "connected" : "unreachable"}
          </span>
        </div>
        {data.redisUrl && (
          <div className={cls.stat}>
            <span className={cls.statLabel}>URL</span>
            <span className="font-mono text-ui-xs text-ui-ink">{data.redisUrl}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function CacheStatsSection({ stats }: CacheStatsSectionProps) {
  return (
    <section className={cls.card}>
      <h2 className="mb-3 text-ui-sm font-semibold text-ui-ink-title">Statistics</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className={cls.stat}>
          <span className={cls.statLabel}>Thumbnails cached</span>
          <span className={cls.statValue}>{stats.thumbCount.toLocaleString()}</span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Originals cached</span>
          <span className={cls.statValue}>{stats.origCount.toLocaleString()}</span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Memory used</span>
          <span className={cls.statValue}>{stats.usedMemoryHuman ?? "—"}</span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Max memory</span>
          <span className={cls.statValue}>{stats.maxMemoryHuman ?? "—"}</span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Hit rate</span>
          <span className={cls.statValue}>
            {stats.hitRate !== null ? `${stats.hitRate}%` : "—"}
          </span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Keyspace hits</span>
          <span className={cls.statValue}>
            {stats.keyspaceHits?.toLocaleString() ?? "—"}
          </span>
        </div>
        <div className={cls.stat}>
          <span className={cls.statLabel}>Keyspace misses</span>
          <span className={cls.statValue}>
            {stats.keyspaceMisses?.toLocaleString() ?? "—"}
          </span>
        </div>
      </div>
    </section>
  );
}

function CacheEntriesTable({ sample }: CacheEntriesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-ui-xs">
        <thead>
          <tr className="border-b border-ui-border/50 text-left text-ui-2xs text-ui-ink-muted">
            <th className="pb-2 pr-4 font-medium">SHA-256</th>
            <th className="pb-2 pr-4 font-medium text-center">Thumb</th>
            <th className="pb-2 pr-4 font-medium text-center">Orig</th>
            <th className="pb-2 pr-4 font-medium">Thumb TTL</th>
            <th className="pb-2 font-medium">Orig TTL</th>
          </tr>
        </thead>
        <tbody>
          {sample.map((e) => (
            <tr
              key={e.sha256}
              className="border-b border-ui-border/30 last:border-0 hover:bg-ui-bg-soft/40"
            >
              <td className="py-1.5 pr-4 font-mono text-ui-ink">{e.sha256.slice(0, 16)}…</td>
              <td className="py-1.5 pr-4 text-center">
                {e.hasThumb ? (
                  <span className="text-emerald-500">✓</span>
                ) : (
                  <span className="text-ui-ink-muted">—</span>
                )}
              </td>
              <td className="py-1.5 pr-4 text-center">
                {e.hasOrig ? (
                  <span className="text-emerald-500">✓</span>
                ) : (
                  <span className="text-ui-ink-muted">—</span>
                )}
              </td>
              <td className="py-1.5 pr-4 tabular-nums text-ui-ink-muted">{fmtTtl(e.thumbTtl)}</td>
              <td className="py-1.5 tabular-nums text-ui-ink-muted">{fmtTtl(e.origTtl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CacheEntriesSection({ data }: CacheEntriesSectionProps) {
  return (
    <section className={cls.card}>
      <h2 className="mb-3 text-ui-sm font-semibold text-ui-ink-title">
        Cached entries
        <span className="ml-2 text-ui-2xs font-normal text-ui-ink-muted">
          first {data.sample.length} of {Math.max(data.stats.thumbCount, data.stats.origCount)}
        </span>
      </h2>
      {data.sample.length === 0 ? (
        <p className="text-ui-sm text-ui-ink-muted">No entries.</p>
      ) : (
        <CacheEntriesTable sample={data.sample} />
      )}
    </section>
  );
}
