"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { z } from "zod";

import { LibraryGraph, clusterColor } from "@/app/library/components/LibraryGraph";
import { GraphFilterPanel } from "@/app/library/components/GraphFilterPanel";
import { useCompareTray } from "@/lib/store/compare-tray";
import type { ClusterResult, GraphScope } from "@/lib/library/schemas";

const panel = "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4";
const input =
  "w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan";
const btn =
  "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50";

const SliderPropsSchema = z.object({
  label: z.string(),
  value: z.number(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  onChange: z.custom<(v: number) => void>(),
  testId: z.string().optional(),
});
type SliderProps = z.infer<typeof SliderPropsSchema>;

function Slider({ label, value, min, max, step, onChange, testId }: SliderProps) {
  return (
    <label className="flex flex-col gap-1 text-ui-xs text-ui-ink-muted">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-ui-ink">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={testId}
        aria-label={label}
        className="accent-accent-cyan"
      />
    </label>
  );
}

function useClusterBuilder() {
  const [sample, setSample] = useState(400);
  const [neighbors, setNeighbors] = useState(6);
  const [threshold, setThreshold] = useState(0.6);
  const [resolution, setResolution] = useState(1);

  const [tags, setTags] = useState("");
  const [modelFamily, setModelFamily] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [graphScope, setGraphScope] = useState<GraphScope | null>(null);

  const [data, setData] = useState<ClusterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const build = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const filters = {
      tags: tagList.length ? tagList : undefined,
      modelFamily: modelFamily.trim() || undefined,
      favorite: favorites || undefined,
      ratingGte: minRating > 0 ? minRating : undefined,
    };
    try {
      const r = await fetch("/api/library/clusters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filters,
          graphScope: graphScope ?? undefined,
          sample,
          neighbors,
          threshold,
          resolution,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Clustering failed");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clustering failed");
    } finally {
      setLoading(false);
    }
  }, [tags, modelFamily, favorites, minRating, graphScope, sample, neighbors, threshold, resolution]);

  return {
    sample, setSample, neighbors, setNeighbors, threshold, setThreshold, resolution, setResolution,
    tags, setTags, modelFamily, setModelFamily, favorites, setFavorites, minRating, setMinRating,
    graphScope, setGraphScope, data, loading, error, selected, setSelected, build,
  };
}

const ClusterControlsPropsSchema = z.object({
  builder: z.custom<ReturnType<typeof useClusterBuilder>>(),
});
type ClusterControlsProps = z.infer<typeof ClusterControlsPropsSchema>;

function ClusterSlidersColumn({ builder }: ClusterControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Slider
        label="Sample size"
        value={builder.sample}
        min={50}
        max={2000}
        step={50}
        onChange={builder.setSample}
        testId="clusters-slider-sample-size"
      />
      <Slider
        label="Neighbours (k)"
        value={builder.neighbors}
        min={2}
        max={20}
        step={1}
        onChange={builder.setNeighbors}
        testId="clusters-slider-neighbors"
      />
      <Slider
        label="Similarity threshold"
        value={builder.threshold}
        min={0}
        max={1}
        step={0.02}
        onChange={builder.setThreshold}
        testId="clusters-slider-threshold"
      />
      <Slider
        label="Resolution"
        value={builder.resolution}
        min={0.2}
        max={3}
        step={0.1}
        onChange={builder.setResolution}
        testId="clusters-slider-resolution"
      />
    </div>
  );
}

function ClusterFiltersColumn({ builder }: ClusterControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        className={input}
        placeholder="tags, comma-separated"
        value={builder.tags}
        onChange={(e) => builder.setTags(e.target.value)}
        data-testid="clusters-filter-tags-input"
      />
      <input
        className={input}
        placeholder="model family (sdxl…)"
        value={builder.modelFamily}
        onChange={(e) => builder.setModelFamily(e.target.value)}
        data-testid="clusters-filter-model-family-input"
      />
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-ui-xs text-ui-ink">
          <input
            type="checkbox"
            checked={builder.favorites}
            onChange={(e) => builder.setFavorites(e.target.checked)}
            className="rounded"
            data-testid="clusters-filter-favorites-checkbox"
          />
          Favorites
        </label>
        <select
          className="rounded-lg border border-ui-border/70 bg-ui-bg px-2 py-2 text-ui-xs outline-none"
          value={builder.minRating}
          onChange={(e) => builder.setMinRating(Number(e.target.value))}
          data-testid="clusters-filter-min-rating-select"
          aria-label="Minimum rating"
        >
          <option value={0}>Any rating</option>
          <option value={1}>★+</option>
          <option value={2}>★★+</option>
          <option value={3}>★★★+</option>
          <option value={4}>★★★★+</option>
          <option value={5}>★★★★★</option>
        </select>
      </div>
      <button className={btn} onClick={builder.build} disabled={builder.loading} data-testid="clusters-build-button">
        {builder.loading ? "Clustering…" : "Build clusters"}
      </button>
    </div>
  );
}

function ClusterControlsPanel({ builder }: ClusterControlsProps) {
  return (
    <section className={panel}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        <ClusterSlidersColumn builder={builder} />
        <ClusterFiltersColumn builder={builder} />
        <GraphFilterPanel value={builder.graphScope} onChange={builder.setGraphScope} />
      </div>
    </section>
  );
}

const ClusterCardPropsSchema = z.object({
  cluster: z.custom<ClusterResult["clusters"][number]>(),
  selected: z.boolean(),
  onSelect: z.custom<() => void>(),
});
type ClusterCardProps = z.infer<typeof ClusterCardPropsSchema>;

function ClusterCard({ cluster: c, selected, onSelect }: ClusterCardProps) {
  return (
    <button
      onClick={onSelect}
      data-testid={`clusters-cluster-card-${c.id}`}
      className={`flex flex-col gap-2 rounded-xl border bg-ui-bg-soft/40 p-2 text-left transition ${
        selected ? "border-accent-cyan" : "border-ui-border/60 hover:border-accent-cyan/60"
      }`}
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={`/api/library/images/${c.representativeImageId}/thumbnail`}
          alt={c.label}
          loading="lazy"
          className="aspect-square w-full object-cover"
        />
        <span
          className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border border-ui-ink-inverse/50"
          style={{ backgroundColor: clusterColor(c.id) }}
          aria-hidden="true"
        />
      </div>
      <div>
        <p className="truncate text-ui-xs font-medium text-ui-ink">{c.label}</p>
        <p className="text-ui-2xs text-ui-ink-muted">{c.size} images</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {c.topTags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-ui-bg px-1.5 py-0.5 text-ui-2xs text-ui-ink-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

const ClusterGridPropsSchema = z.object({
  clusters: z.custom<ClusterResult["clusters"]>(),
  selected: z.number().nullable(),
  onSelect: z.custom<(id: number | null) => void>(),
});
type ClusterGridProps = z.infer<typeof ClusterGridPropsSchema>;

function ClusterGrid({ clusters, selected, onSelect }: ClusterGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {clusters.map((c) => (
        <ClusterCard
          key={c.id}
          cluster={c}
          selected={selected === c.id}
          onSelect={() => onSelect(selected === c.id ? null : c.id)}
        />
      ))}
    </div>
  );
}

const SelectedClusterSectionPropsSchema = z.object({
  cluster: z.custom<ClusterResult["clusters"][number]>(),
  onClose: z.custom<() => void>(),
});
type SelectedClusterSectionProps = z.infer<typeof SelectedClusterSectionPropsSchema>;

function SelectedClusterSection({ cluster, onClose }: SelectedClusterSectionProps) {
  const tray = useCompareTray();
  return (
    <section className={panel}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">
          {cluster.label} · {cluster.size} images
        </h2>
        <button
          className="text-ui-xs text-ui-ink-muted hover:text-ui-ink"
          onClick={onClose}
          data-testid="clusters-selected-close"
        >
          close
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {cluster.imageIds.map((id) => (
          <div key={id} className="group relative overflow-hidden rounded-lg border border-ui-border/60">
            <Link href={`/library/${id}`} prefetch={false} data-testid={`clusters-image-link-${id}`}>
              <img
                src={`/api/library/images/${id}/thumbnail`}
                alt=""
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </Link>
            <button
              onClick={() => tray.toggle(id)}
              className={`absolute right-1 top-1 rounded border px-1.5 py-0.5 text-ui-2xs backdrop-blur-sm transition ${
                tray.has(id)
                  ? "border-accent-cyan bg-accent-cyan text-ui-bg-deep"
                  : "border-ui-border/50 bg-ui-bg/80 text-ui-ink opacity-0 group-hover:opacity-100"
              }`}
              title="Add to comparison"
              data-testid={`clusters-compare-toggle-${id}`}
              aria-label={tray.has(id) ? "Remove from comparison" : "Add to comparison"}
            >
              {tray.has(id) ? "✓" : "+"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const ClusterResultsPropsSchema = z.object({
  data: z.custom<ClusterResult>(),
  selected: z.number().nullable(),
  onSelect: z.custom<(id: number | null) => void>(),
});
type ClusterResultsProps = z.infer<typeof ClusterResultsPropsSchema>;

function ClusterResults({ data, selected, onSelect }: ClusterResultsProps) {
  const router = useRouter();
  const selectedCluster = data.clusters.find((c) => c.id === selected) ?? null;

  return (
    <>
      <p className="text-ui-sm text-ui-ink-muted">
        {data.clusters.length} clusters · {data.sampled} images sampled · {data.edges} similarity links
      </p>

      {data.graph.nodes.length > 0 && (
        <section className={panel}>
          <LibraryGraph
            graph={data.graph}
            colorByCluster
            height="600px"
            onNodeClick={(id, type) => {
              if (type === "Image") router.push(`/library/${id}`);
            }}
          />
        </section>
      )}

      {data.clusters.length > 0 && (
        <ClusterGrid clusters={data.clusters} selected={selected} onSelect={onSelect} />
      )}

      {selectedCluster && (
        <SelectedClusterSection cluster={selectedCluster} onClose={() => onSelect(null)} />
      )}
    </>
  );
}

export default function ClustersPage() {
  const builder = useClusterBuilder();

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Cluster explorer</h1>
          <p className="text-ui-sm text-ui-ink-muted">
            Embedding similarity (Qdrant) grouped with Louvain community detection, filtered by Neo4j.
          </p>
        </div>
        <Link href="/library" prefetch={false} className="text-ui-sm text-accent-cyan">
          ← Back to library
        </Link>
      </header>

      <ClusterControlsPanel builder={builder} />

      {builder.error && <p className="text-ui-sm text-rose-500">{builder.error}</p>}

      {builder.data && (
        <ClusterResults
          data={builder.data}
          selected={builder.selected}
          onSelect={builder.setSelected}
        />
      )}

      {!builder.data && !builder.loading && (
        <p className="text-ui-sm text-ui-ink-muted">
          Set your parameters and press “Build clusters”. Requires images indexed in Qdrant.
        </p>
      )}
    </div>
  );
}
