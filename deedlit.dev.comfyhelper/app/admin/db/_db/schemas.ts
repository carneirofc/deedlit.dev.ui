import { z } from "zod";

// ---------------------------------------------------------------------------
// DB power-user page — shared domain types (catalog truth, editor state).
// ---------------------------------------------------------------------------

export const CatalogImageReferenceSchema = z.object({
  kind: z.string(),
  name: z.string(),
  hash: z.string().nullable().optional(),
});
export type CatalogImageReference = z.infer<typeof CatalogImageReferenceSchema>;

export const CatalogImageSchema = z
  .object({
    sha256: z.string(),
    prompt: z.string().nullable().optional(),
    negative: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    safety: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    favorite: z.boolean().optional(),
    sourceTool: z.string().nullable().optional(),
    params: z.record(z.string(), z.unknown()).nullable().optional(),
    references: z.array(CatalogImageReferenceSchema).optional(),
    workflow_json: z.unknown().optional(),
    api_prompt_json: z.unknown().optional(),
  })
  .catchall(z.unknown());
export type CatalogImage = z.infer<typeof CatalogImageSchema>;

export const CatalogImagesListResponseSchema = z.object({
  images: z.array(CatalogImageSchema).default([]),
});

export const CatalogFiltersSchema = z.object({
  tag: z.string(),
  safety: z.string(),
  favorite: z.boolean(),
  path: z.string(),
});
export type CatalogFilters = z.infer<typeof CatalogFiltersSchema>;

export const EditStateSchema = z.object({
  prompt: z.string(),
  negative: z.string(),
  tags: z.string(),
  safety: z.string(),
  rating: z.string(),
  favorite: z.boolean(),
});
export type EditState = z.infer<typeof EditStateSchema>;

export const SAFETY = ["", "sfw", "nsfw", "explicit"] as const;

// Catalog page size for the infinite-scroll list. A short final page (< this)
// means there is nothing more to fetch.
export const PAGE_SIZE = 60;

export const cls = {
  card: "rounded-xl border border-ui-border/60 bg-ui-bg-soft/40 p-4",
  input:
    "w-full rounded-lg border border-ui-border/70 bg-ui-bg px-3 py-2 text-ui-sm outline-none focus:border-accent-cyan",
  btn: "rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10 disabled:opacity-50",
  danger:
    "rounded-md border border-rose-500/40 px-2 py-1 text-ui-xs text-rose-500 transition hover:bg-rose-500/10",
};

/** Originating on-disk path of the source file, captured at ingest. The catalog
 * serialises it as `filepath`; tolerate the other casings any producer might use. */
export function sourcePath(img: CatalogImage): string {
  const v = img.filepath ?? img.file_path ?? img.filePath;
  return typeof v === "string" ? v : "";
}

export function editFrom(img: CatalogImage): EditState {
  return {
    prompt: img.prompt ?? "",
    negative: img.negative ?? "",
    tags: (img.tags ?? []).join(", "),
    safety: img.safety ?? "",
    rating: img.rating != null ? String(img.rating) : "",
    favorite: Boolean(img.favorite),
  };
}
