import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { notesByImage } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"imageId", string>>>() });

/** List notes attached to a specific image. Proxies the gateway GET /notes/by-image/{sha256}. */
export async function GET(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    const notes = await notesByImage(imageId);
    return jsonOk(notes);
  });
}
