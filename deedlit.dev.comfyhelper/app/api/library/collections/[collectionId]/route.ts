import { z } from "zod";

import { handleRoute, jsonError, jsonOk } from "@/lib/library/http";
import {
  getCollection,
  renameCollection,
  deleteCollection,
  GatewayError,
} from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"collectionId", string>>>() });

const RenameBodySchema = z.object({ name: z.string() });

/** Read a collection. Proxies the gateway GET /collections/{id} (-> catalog). */
export async function GET(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { collectionId } = await params;
    try {
      return jsonOk(await getCollection(collectionId));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) return jsonError("Collection not found.", 404);
      throw e;
    }
  });
}

/** Rename a collection. Proxies the gateway PUT /collections/{id} (-> catalog). */
export async function PUT(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { collectionId } = await params;
    const { name } = RenameBodySchema.parse(await request.json());
    try {
      return jsonOk(await renameCollection(collectionId, name));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) return jsonError("Collection not found.", 404);
      throw e;
    }
  });
}

/** Delete a collection. Proxies the gateway DELETE /collections/{id} (-> catalog). */
export async function DELETE(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { collectionId } = await params;
    try {
      await deleteCollection(collectionId);
      return jsonOk({ status: "ok" });
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) return jsonError("Collection not found.", 404);
      throw e;
    }
  });
}
