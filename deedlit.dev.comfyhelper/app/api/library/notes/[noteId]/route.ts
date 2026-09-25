import { z } from "zod";

import { handleRoute, jsonError, jsonOk } from "@/lib/library/http";
import { getNote, updateNote, GatewayError, type NoteUpsert } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteContextSchema = z.object({ params: z.custom<Promise<Record<"noteId", string>>>() });

/** Read a note. Proxies the gateway GET /notes/{id} (-> catalog). */
export async function GET(_request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { noteId } = await params;
    try {
      return jsonOk(await getNote(noteId));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) return jsonError("Note not found.", 404);
      throw e;
    }
  });
}

/** Update a note. Proxies the gateway PUT /notes/{id} (-> catalog). */
export async function PUT(request: Request, context: unknown) {
  return handleRoute(async () => {
    const { params } = RouteContextSchema.parse(context);
    const { noteId } = await params;
    const body = (await request.json()) as NoteUpsert;
    try {
      return jsonOk(await updateNote(noteId, body));
    } catch (e) {
      if (e instanceof GatewayError && e.status === 404) return jsonError("Note not found.", 404);
      throw e;
    }
  });
}
