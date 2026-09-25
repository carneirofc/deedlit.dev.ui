import { z } from "zod";

import { panel } from "./styles";
import { VectorDebugHitSchema, VectorDebugSchema, VectorDebugStatsSchema } from "./schemas";

const VectorDebugSummaryPropsSchema = z.object({ debug: VectorDebugSchema });
type VectorDebugSummaryProps = z.infer<typeof VectorDebugSummaryPropsSchema>;

function VectorDebugSummary({ debug }: VectorDebugSummaryProps) {
  return (
    <dl className="grid grid-cols-2 gap-1 text-ui-ink-muted sm:grid-cols-4">
      <dt>Embedder</dt>
      <dd className="text-ui-ink">{debug.embedding.provider}</dd>
      <dt>Semantic (CLIP)</dt>
      <dd className={debug.embedding.hasExternalImageEmbeddings ? "text-emerald-400" : "text-amber-400"}>
        {debug.embedding.hasExternalImageEmbeddings ? "yes" : "no — vision not configured"}
      </dd>
      <dt>Embedder dims</dt>
      <dd className="text-ui-ink">{debug.embedding.dimensions}</dd>
      <dt>Collection dims</dt>
      <dd className={debug.collection.vectorSize === debug.embedding.dimensions ? "text-ui-ink" : "text-rose-400"}>
        {debug.collection.vectorSize ?? "—"} {debug.collection.distance ? `(${debug.collection.distance})` : ""}
      </dd>
      <dt>Points</dt>
      <dd className="text-ui-ink">{debug.collection.pointsCount ?? "—"}</dd>
      <dt>hnsw_ef / exact</dt>
      <dd className="text-ui-ink">{debug.params.hnswEf} / {String(debug.params.exact)}</dd>
      <dt>minScore</dt>
      <dd className="text-ui-ink">{debug.params.minScore}</dd>
      <dt>Took</dt>
      <dd className="text-ui-ink">{debug.tookMs} ms</dd>
    </dl>
  );
}

const VectorDebugQueryStatsPropsSchema = z.object({ stats: VectorDebugStatsSchema });
type VectorDebugQueryStatsProps = z.infer<typeof VectorDebugQueryStatsPropsSchema>;

function VectorDebugQueryStats({ stats }: VectorDebugQueryStatsProps) {
  return (
    <dl className="grid grid-cols-2 gap-1 text-ui-ink-muted sm:grid-cols-4">
      <dt>Vector norm</dt>
      <dd className={stats.isZero ? "text-rose-400" : "text-ui-ink"}>
        {stats.norm.toFixed(4)} {stats.isZero ? "(ZERO — reindex!)" : ""}
      </dd>
      <dt>Non-zero</dt>
      <dd className="text-ui-ink">{stats.nonZero}/{stats.dims}</dd>
      <dt>min / max</dt>
      <dd className="text-ui-ink">{stats.min.toFixed(3)} / {stats.max.toFixed(3)}</dd>
      <dt>sample</dt>
      <dd className="truncate font-mono text-ui-ink" title={stats.sample.join(", ")}>
        [{stats.sample.map((n) => n.toFixed(2)).join(", ")}]
      </dd>
    </dl>
  );
}

function tagsOf(payload: Record<string, unknown> | null): string[] {
  return Array.isArray(payload?.tags) ? (payload.tags as string[]) : [];
}

const VectorDebugHitRowPropsSchema = z.object({ hit: VectorDebugHitSchema, index: z.number() });
type VectorDebugHitRowProps = z.infer<typeof VectorDebugHitRowPropsSchema>;

function VectorDebugHitRow({ hit, index }: VectorDebugHitRowProps) {
  const tags = tagsOf(hit.payload);
  return (
    <tr className="border-t border-ui-border/40">
      <td className="py-1 pr-3">{index + 1}</td>
      <td className="py-1 pr-3 text-accent-cyan">{hit.score.toFixed(4)}</td>
      <td className="py-1 pr-3">{String(hit.payload?.checkpoint ?? "—")}</td>
      <td className="py-1 pr-3">{String(hit.payload?.model_family ?? "—")}</td>
      <td className="max-w-[20rem] truncate py-1" title={tags.join(", ")}>
        {tags.length > 0 ? tags.slice(0, 6).join(", ") : "—"}
      </td>
    </tr>
  );
}

const VectorDebugHitsTablePropsSchema = z.object({ hits: z.array(VectorDebugHitSchema) });
type VectorDebugHitsTableProps = z.infer<typeof VectorDebugHitsTablePropsSchema>;

function VectorDebugHitsTable({ hits }: VectorDebugHitsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-ui-2xs">
        <thead className="text-ui-ink-muted">
          <tr>
            <th className="py-1 pr-3">#</th>
            <th className="py-1 pr-3">score</th>
            <th className="py-1 pr-3">checkpoint</th>
            <th className="py-1 pr-3">model_family</th>
            <th className="py-1">tags</th>
          </tr>
        </thead>
        <tbody className="font-mono text-ui-ink">
          {hits.map((h, i) => (
            <VectorDebugHitRow key={h.id} hit={h} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VectorDebugContentPropsSchema = z.object({ debug: VectorDebugSchema });
type VectorDebugContentProps = z.infer<typeof VectorDebugContentPropsSchema>;

function VectorDebugContent({ debug }: VectorDebugContentProps) {
  return (
    <div className="flex flex-col gap-3 text-ui-xs">
      {debug.warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-300">
          {debug.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      <VectorDebugSummary debug={debug} />
      {debug.query.stats && <VectorDebugQueryStats stats={debug.query.stats} />}
      {!debug.query.vectorFound && (
        <p className="text-rose-400">No stored vector — image not indexed in Qdrant.</p>
      )}
      {debug.hits.length > 0 && <VectorDebugHitsTable hits={debug.hits} />}
    </div>
  );
}

const VectorDebugSectionPropsSchema = z.object({
  debug: VectorDebugSchema.nullable(),
  debugLoading: z.boolean(),
  debugError: z.string().nullable(),
});
type VectorDebugSectionProps = z.infer<typeof VectorDebugSectionPropsSchema>;

/** Vector-search debug panel: embedder/collection health, the query vector's
 * stats, and the raw similarity hits behind the "similar images" section. */
export function VectorDebugSection({ debug, debugLoading, debugError }: VectorDebugSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-lg font-semibold text-ui-ink-title">Vector debug</h2>
      {debugLoading && <p className="text-ui-xs text-ui-ink-muted">Loading…</p>}
      {debugError && <p className="text-ui-xs text-rose-500">{debugError}</p>}
      {debug && <VectorDebugContent debug={debug} />}
    </section>
  );
}
