import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { callMcpTool, neighborsToGraph, GraphNeighborSchema } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"imageId", string>>>() });

const StructuredContentSchema = z.object({
  neighbors: z.array(GraphNeighborSchema).optional(),
});

/**
 * Relationship graph around an image. Proxies to the gateway MCP tool
 * `get_image_graph` (-> deedlit.graph /neighbors) and shapes the flat neighbor
 * list into the cytoscape Graph the UI renders.
 *
 * NOTE: the gateway returns a single hop of neighbors, so `depth` is accepted
 * but not deepened beyond what the graph service returns.
 */
export async function GET(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    const { searchParams } = new URL(request.url);
    const relationshipTypes = searchParams
      .get("relationship_types")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tool = await callMcpTool("get_image_graph", {
      image_id: imageId,
      relationship_types: relationshipTypes,
    });
    const structured = StructuredContentSchema.parse(tool.structuredContent ?? {});
    const graph = neighborsToGraph(imageId, structured.neighbors ?? []);
    return jsonOk(graph);
  });
}
