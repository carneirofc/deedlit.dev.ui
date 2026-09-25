import { z } from "zod";

import { CatalogFiltersSchema, CatalogImagesListResponseSchema, PAGE_SIZE, type CatalogImage } from "./schemas";

const CatalogPageParamsSchema = z.object({
  filters: CatalogFiltersSchema,
  offset: z.number(),
  signal: z.custom<AbortSignal>(),
});
type CatalogPageParams = z.infer<typeof CatalogPageParamsSchema>;

function buildCatalogQuery({ filters, offset }: Pick<CatalogPageParams, "filters" | "offset">) {
  const sp = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (filters.tag.trim()) sp.set("tag", filters.tag.trim());
  if (filters.safety) sp.set("safety", filters.safety);
  if (filters.favorite) sp.set("favorite", "true");
  if (filters.path.trim()) sp.set("path", filters.path.trim());
  return sp;
}

/** Fetches one catalog page for the given filters/offset, parsing the response
 * at this fetch trust boundary. Callers translate an AbortError into a no-op. */
export async function fetchCatalogPage({ filters, offset, signal }: CatalogPageParams): Promise<CatalogImage[]> {
  const sp = buildCatalogQuery({ filters, offset });
  const r = await fetch(`/api/library/admin/images?${sp.toString()}`, { signal });
  const json: unknown = await r.json();
  return CatalogImagesListResponseSchema.parse(json).images;
}
