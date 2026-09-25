import { CatalogImageSchema, type CatalogImage, type EditState } from "./schemas";

export function editBodyFrom(edit: EditState) {
  return {
    prompt: edit.prompt,
    negative: edit.negative,
    tags: edit.tags.split(",").map((s) => s.trim()).filter(Boolean),
    safety: edit.safety ? edit.safety : null,
    rating: edit.rating ? Number(edit.rating) : null,
    favorite: edit.favorite,
  };
}

/** Full catalog record for one image — the heavy fields the lightweight
 * browse list omits (workflow_json / api_prompt_json / negative / params). */
export async function fetchFullImage(sha256: string): Promise<CatalogImage> {
  const r = await fetch(`/api/library/images/${sha256}/raw`);
  if (!r.ok) throw new Error(`detail fetch failed (${r.status})`);
  return CatalogImageSchema.parse(await r.json());
}

export async function patchImage(sha256: string, edit: EditState): Promise<CatalogImage> {
  const r = await fetch(`/api/library/images/${sha256}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(editBodyFrom(edit)),
  });
  if (!r.ok) throw new Error(`save failed (${r.status})`);
  return CatalogImageSchema.parse(await r.json());
}

export async function runImageAction(sha256: string, kind: "reindex" | "relabel"): Promise<void> {
  const r = await fetch(`/api/library/images/${sha256}/${kind}`, { method: "POST" });
  if (!r.ok) throw new Error(`${kind} failed (${r.status})`);
}

export async function deleteImageEverywhere(sha256: string): Promise<void> {
  const r = await fetch(`/api/library/images/${sha256}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`delete failed (${r.status})`);
}
