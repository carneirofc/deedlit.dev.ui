import { z } from "zod";

import { LibraryGraph } from "@/app/library/components/LibraryGraph";
import type { Graph } from "@/lib/library/schemas";

import { panel } from "./styles";

const GraphSectionPropsSchema = z.object({
  graph: z.custom<Graph>(),
  onNodeClick: z.custom<(id: string, type: string) => void>(),
});
type GraphSectionProps = z.infer<typeof GraphSectionPropsSchema>;

/** Relationship graph for the compared images, with shared tags/models
 * highlighted. */
export function GraphSection({ graph, onNodeClick }: GraphSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">
        Relationship graph
        <span className="ml-2 text-ui-2xs font-normal text-ui-ink-muted">
          (shared tags / models highlighted)
        </span>
      </h2>
      <LibraryGraph graph={graph} height="460px" onNodeClick={onNodeClick} />
    </section>
  );
}
