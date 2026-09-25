import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { callMcpTool } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"imageId", string>>>() });

/**
 * Image lineage (variant/upscale/inpaint chain). Proxies to the gateway MCP
 * tool `find_image_lineage` (-> deedlit.graph /lineage).
 */
export async function GET(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    const tool = await callMcpTool("find_image_lineage", { image_id: imageId });
    return jsonOk(tool.structuredContent ?? {});
  });
}
