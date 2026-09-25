import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { reindexImage } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"imageId", string>>>() });

/** Re-project one image (publish an index task). Gateway POST /images/{sha}/reindex. */
export async function POST(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    return jsonOk(await reindexImage(imageId));
  });
}
