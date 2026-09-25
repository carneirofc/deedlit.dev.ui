import { z } from "zod";
import { handleRoute, jsonOk } from "@/lib/library/http";
import { callMcpTool } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"tag", string>>>() });

const RelatedTagRawSchema = z.object({
  tag: z.string().optional(),
  name: z.string().optional(),
  weight: z.number().optional(),
  coOccurrence: z.number().optional(),
});

const StructuredContentSchema = z.object({
  related: z.array(RelatedTagRawSchema).optional(),
});

/**
 * Tags co-occurring with a tag. Proxies to the gateway MCP tool
 * `find_related_tags` (-> deedlit.graph /related-tags) and maps the
 * { tag, weight } rows into the { name, coOccurrence } shape the UI renders.
 */
export async function GET(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { tag } = await params;
    const decoded = decodeURIComponent(tag);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

    const tool = await callMcpTool("find_related_tags", { tag: decoded, limit });
    const structured = StructuredContentSchema.parse(tool.structuredContent ?? {});
    const related = (structured.related ?? []).map((r) => ({
      name: r.name ?? r.tag ?? "",
      coOccurrence: r.coOccurrence ?? r.weight ?? 0,
    }));
    return jsonOk({ tag: decoded, related });
  });
}
