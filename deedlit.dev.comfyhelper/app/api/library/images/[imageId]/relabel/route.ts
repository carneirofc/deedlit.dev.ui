import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { relabelImage } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"imageId", string>>>() });

/** Re-label one image (publish a label task). Gateway POST /images/{sha}/relabel. */
export async function POST(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    return jsonOk(await relabelImage(imageId));
  });
}
