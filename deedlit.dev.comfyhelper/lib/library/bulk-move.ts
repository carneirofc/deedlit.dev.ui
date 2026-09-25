import { z } from "zod";

export const MoveFailureSchema = z.object({
  id: z.string(),
  error: z.string(),
});
export type MoveFailure = z.infer<typeof MoveFailureSchema>;

export const MoveResultSchema = z.object({
  moved: z.array(z.string()),
  failed: z.array(MoveFailureSchema),
});
export type MoveResult = z.infer<typeof MoveResultSchema>;

const MoveResponseSchema = MoveResultSchema.partial().extend({
  error: z.string().optional(),
});

export async function moveImages(ids: string[], targetFolder: string): Promise<MoveResult> {
  const r = await fetch("/api/library/images/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageIds: ids, targetFolder }),
  });
  const parsed = MoveResponseSchema.safeParse(await r.json());
  const j = parsed.success ? parsed.data : {};
  if (!r.ok) throw new Error(j.error ?? "Move failed");
  return { moved: j.moved ?? [], failed: j.failed ?? [] };
}
