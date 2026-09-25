import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { deleteSourceFolder, updateSourceFolder } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"id", string>>>() });

/** Update a folder's controls (enabled / recursive / interval / label). */
export async function PATCH(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { id } = await params;
    const body = (await request.json()) as Parameters<typeof updateSourceFolder>[1];
    const folder = await updateSourceFolder(id, body);
    return jsonOk(folder);
  });
}

/** Remove a folder from the registry (does NOT delete its cataloged images). */
export async function DELETE(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { id } = await params;
    await deleteSourceFolder(id);
    return jsonOk({ status: "ok" });
  });
}
