import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { listCatalogImages } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().catch(50),
  offset: z.coerce.number().catch(0),
  favorite: z.string().optional(),
  tag: z.string().optional(),
  safety: z.string().optional(),
  path: z.string().optional(),
});

function parseQuery(url: string) {
  const sp = new URL(url).searchParams;
  return QuerySchema.parse({
    limit: sp.get("limit") ?? undefined,
    offset: sp.get("offset") ?? undefined,
    favorite: sp.get("favorite") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    safety: sp.get("safety") ?? undefined,
    path: sp.get("path") ?? undefined,
  });
}

/**
 * RAW catalog records for the DB power-user page (#30) — full prompt / params /
 * workflow_json / api_prompt_json, not the search CompactResult shape. Proxies
 * the gateway GET /images (catalog truth). Filterable by ?tag=&favorite=&safety=
 * &path= (path is a separator-insensitive substring match on the file path).
 * Returns `{ images }`.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const query = parseQuery(request.url);
    const tag = query.tag?.trim();
    const safety = query.safety?.trim();
    const path = query.path?.trim();
    const images = await listCatalogImages({
      tags: tag ? [tag] : undefined,
      safety: safety ? [safety] : undefined,
      favorite: query.favorite === "true" ? true : undefined,
      path: path || undefined,
      limit: query.limit,
      offset: query.offset,
    });
    return jsonOk({ images });
  });
}
