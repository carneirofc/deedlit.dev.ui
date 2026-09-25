"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";
import type { Core, ElementDefinition, EventObject, StylesheetStyle } from "cytoscape";

import type { Graph } from "@/lib/library/schemas";

/** Distinct cluster hues that read well on both light and dark themes. */
export const CLUSTER_PALETTE = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4",
  "#8b5cf6", "#ef4444", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#eab308",
];

export function clusterColor(cluster: number): string {
  return CLUSTER_PALETTE[cluster % CLUSTER_PALETTE.length];
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

const LibraryGraphPropsSchema = z.object({
  graph: z.custom<Graph>(),
  onNodeClick: z.custom<(id: string, type: string) => void>().optional(),
  height: z.string().optional(),
  /** Colour image nodes by their `properties.cluster` index. */
  colorByCluster: z.boolean().optional(),
  className: z.string().optional(),
});
export type LibraryGraphProps = z.infer<typeof LibraryGraphPropsSchema>;

const GraphThemeSchema = z.object({
  ink: z.string(),
  muted: z.string(),
  border: z.string(),
  card: z.string(),
  accent: z.string(),
});
type GraphTheme = z.infer<typeof GraphThemeSchema>;

function readGraphTheme(el: HTMLElement): GraphTheme {
  return {
    ink: cssVar(el, "--ui-ink", "#e5e7eb"),
    muted: cssVar(el, "--ui-ink-muted", "#9ca3af"),
    border: cssVar(el, "--ui-border", "#374151"),
    card: cssVar(el, "--ui-bg-card", "#111827"),
    accent: cssVar(el, "--ui-ink-accent", "#6366f1"),
  };
}

function buildGraphElements(graph: Graph, colorByCluster: boolean): ElementDefinition[] {
  return [
    ...graph.nodes.map((n) => {
      const props = (n.properties ?? {}) as Record<string, unknown>;
      const cluster = typeof props.cluster === "number" ? props.cluster : -1;
      return {
        data: {
          id: n.id,
          label: n.label,
          ntype: n.type,
          thumb: typeof props.thumbnailUrl === "string" ? props.thumbnailUrl : "",
          color: colorByCluster && cluster >= 0 ? clusterColor(cluster) : undefined,
          shared: props.shared === true ? 1 : 0,
          seed: props.seed === true ? 1 : 0,
        },
      };
    }),
    ...graph.edges.map((e, i) => ({
      data: { id: `e${i}_${e.from}_${e.to}`, source: e.from, target: e.to, etype: e.type },
    })),
  ];
}

function buildGraphStyle(theme: GraphTheme): StylesheetStyle[] {
  return [
    {
      selector: "node",
      style: {
        "background-color": theme.card,
        "border-width": 2,
        "border-color": theme.border,
        label: "data(label)",
        color: theme.muted,
        "font-size": 8,
        "text-valign": "bottom",
        "text-margin-y": 3,
        "text-max-width": "84px",
        "text-wrap": "ellipsis",
        width: 26,
        height: 26,
      },
    },
    {
      selector: "node[ntype = 'Image']",
      style: {
        shape: "round-rectangle",
        width: 46,
        height: 46,
        "background-image": "data(thumb)",
        "background-fit": "cover",
        label: "",
      },
    },
    { selector: "node[color]", style: { "border-color": "data(color)", "border-width": 4 } },
    { selector: "node[seed = 1]", style: { "border-color": theme.accent, "border-width": 4 } },
    {
      selector: "node[shared = 1]",
      style: { "background-color": theme.accent, color: theme.ink, "border-color": theme.accent },
    },
    {
      selector: "edge",
      style: { width: 1, "line-color": theme.border, "curve-style": "haystack", opacity: 0.5 },
    },
    {
      selector: "node:selected",
      style: { "border-color": theme.accent, "border-width": 5 },
    },
  ];
}

function useLibraryGraphCytoscape(
  containerRef: React.RefObject<HTMLDivElement | null>,
  graph: Graph,
  colorByCluster: boolean,
  clickRef: React.RefObject<LibraryGraphProps["onNodeClick"]>,
) {
  useEffect(() => {
    let cancelled = false;
    let cy: Core | undefined;
    const container = containerRef.current;
    if (!container) return;

    void import("cytoscape").then(({ default: cytoscape }) => {
      if (cancelled || !containerRef.current) return;
      const el = containerRef.current;
      const theme = readGraphTheme(el);

      cy = cytoscape({
        container: el,
        elements: buildGraphElements(graph, colorByCluster),
        style: buildGraphStyle(theme),
        layout: {
          name: "cose",
          animate: false,
          padding: 30,
          nodeRepulsion: () => 9000,
          idealEdgeLength: () => 90,
        },
        wheelSensitivity: 0.25,
        minZoom: 0.2,
        maxZoom: 3,
      });

      cy.on("tap", "node", (evt: EventObject) => {
        const node = evt.target;
        clickRef.current?.(node.id(), node.data("ntype"));
      });
    });

    return () => {
      cancelled = true;
      cy?.destroy();
    };
  }, [graph, colorByCluster, containerRef, clickRef]);
}

/**
 * Interactive relationship / cluster graph rendered with cytoscape.js.  The
 * library is imported lazily inside the effect so it only ever runs in the
 * browser (cytoscape touches `window`), avoiding SSR issues under the Next.js
 * app router.  Image nodes render their thumbnail; hub nodes (Tag/Model/…) show
 * a label; cluster membership and shared/seed flags drive border colour.
 */
export function LibraryGraph({
  graph,
  onNodeClick,
  height = "560px",
  colorByCluster = false,
  className,
}: LibraryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onNodeClick);
  useEffect(() => {
    clickRef.current = onNodeClick;
  }, [onNodeClick]);

  useLibraryGraphCytoscape(containerRef, graph, colorByCluster, clickRef);

  if (graph.nodes.length === 0) {
    return (
      <div
        style={{ height }}
        className={`grid place-items-center rounded-xl border border-ui-border/60 bg-ui-bg-soft/30 text-ui-sm text-ui-ink-muted ${className ?? ""}`}
      >
        No graph data.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className={`rounded-xl border border-ui-border/60 bg-ui-bg-soft/30 ${className ?? ""}`}
    />
  );
}
