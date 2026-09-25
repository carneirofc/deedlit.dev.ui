import { z } from "zod";

import type { Graph } from "@/lib/library/schemas";

import { panel } from "./styles";

const GraphSectionPropsSchema = z.object({
  graph: z.custom<Graph>(),
});
type GraphSectionProps = z.infer<typeof GraphSectionPropsSchema>;

/** Relationship-graph section: chips for every node reachable within the
 * configured hop depth. */
export function GraphSection({ graph }: GraphSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-lg font-semibold text-ui-ink-title">Relationship graph</h2>
      <div className="flex flex-wrap gap-2">
        {graph.nodes.map((n) => (
          <span
            key={n.id}
            className={`rounded-lg border border-ui-border/60 px-2 py-1 text-ui-xs ${n.type === "Image" ? "bg-accent-cyan/10 text-accent-cyan" : "text-ui-ink-muted"}`}
          >
            {n.type}: {n.label}
          </span>
        ))}
      </div>
    </section>
  );
}
