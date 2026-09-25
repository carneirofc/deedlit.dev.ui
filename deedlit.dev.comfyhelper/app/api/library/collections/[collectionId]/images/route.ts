import { z } from "zod";

import { handleRoute, jsonError, jsonOk } from "@/lib/library/http";
import { setCollectionImages, GatewayError } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"collectionId", string>>>() });

const PutBodySchema = z.object({ images: z.array(z.string()).optional() });

/**
 * Replace a collection's ordered membership. Proxies the gateway
 * PUT /collections/{id}/images (-> catalog) with set/replace semantics: the
 * `images` array is the complete, ordered sha256 list (add/remove/reorder).
 */
export async function PUT(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { collectionId } = await params;
    const { images } = PutBodySchema.parse(await request.json());
    try {
      await setCollectionImages(collectionId, images ?? []);
      return jsonOk({ status: "ok" });
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) return jsonError("Collection not found.", 404);
      throw e;
    }
  });
}
