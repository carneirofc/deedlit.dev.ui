import { z } from "zod";

import { handleRoute, jsonError, jsonOk } from "@/lib/library/http";
import {
  getImage,
  imageToUiDetail,
  deleteImage,
  patchImage,
  GatewayError,
  type ImagePatchBody,
} from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"imageId", string>>>() });

export async function GET(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    try {
      // Light catalog passthrough — the panel/detail page render only curated
      // fields, so skip the /detail fan-out (search+graph) AND the heavy
      // workflow_json/api_prompt_json graphs. Similar/neighbors, when shown, are
      // fetched by their own routes.
      const image = await getImage(imageId, { light: true });
      return jsonOk(imageToUiDetail(image));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) {
        return jsonError("Image not found.", 404);
      }
      throw e;
    }
  });
}

/**
 * Edit curated catalog fields (#30): tags / safety / rating / favorite / prompt /
 * negative. Proxies the gateway PATCH /images/{sha} (catalog truth). A gateway
 * 404 means the image is not in the library.
 */
export async function PATCH(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    const body = (await request.json()) as ImagePatchBody;
    try {
      return jsonOk(await patchImage(imageId, body));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) {
        return jsonError("Image not found.", 404);
      }
      throw e;
    }
  });
}

/**
 * Un-index an image. Proxies the gateway DELETE /images/{sha256}, which removes
 * the catalog record + search vector + graph node — NOT the source file on
 * disk. A gateway 404 means the image is not in the library.
 */
export async function DELETE(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { imageId } = await params;
    try {
      return jsonOk(await deleteImage(imageId));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) {
        return jsonError("Image not found.", 404);
      }
      throw e;
    }
  });
}
