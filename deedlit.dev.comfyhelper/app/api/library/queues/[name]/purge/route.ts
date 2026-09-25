import { z } from "zod";

import { handleRoute, jsonOk } from "@/lib/library/http";
import { purgeQueue } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"name", string>>>() });

/** Purge all messages from a queue (destructive — the UI confirms first). */
export async function POST(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { name } = await params;
    await purgeQueue(name);
    return jsonOk({ status: "purged", queue: name });
  });
}
