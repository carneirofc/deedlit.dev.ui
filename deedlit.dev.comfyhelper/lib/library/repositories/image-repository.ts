import { z } from "zod";
import { maybeRow, query, rows, withTransaction } from "@/lib/library/db/postgres";
import type { PoolClient } from "pg";
import type { ExtractedImageRecord } from "@/lib/library/services/metadata-service";
import {
  inferModelFamily,
  linkImageLora,
  upsertCheckpoint,
  upsertLora,
  upsertModel,
} from "@/lib/library/repositories/model-repository";
import { clearImageTags, linkImageTag, upsertTag } from "@/lib/library/repositories/tag-repository";
import { SearchFiltersSchema } from "@/lib/library/schemas";
import type { ImageDetail } from "@/lib/library/schemas";

export const ImageRowLiteSchema = z.object({
  id: z.string(),
  sha256_hash: z.string(),
  file_path: z.string(),
  thumbnail_path: z.string().nullable(),
  filename: z.string(),
  ingestion_status: z.string(),
});
type ImageRowLite = z.infer<typeof ImageRowLiteSchema>;

export async function findBySha256(sha256: string): Promise<ImageRowLite | null> {
  return maybeRow<ImageRowLite>(
    `SELECT id, sha256_hash, file_path, thumbnail_path, filename, ingestion_status
       FROM images WHERE sha256_hash = $1`,
    [sha256],
  );
}

export async function findById(id: string): Promise<ImageRowLite | null> {
  return maybeRow<ImageRowLite>(
    `SELECT id, sha256_hash, file_path, thumbnail_path, filename, ingestion_status
       FROM images WHERE id = $1`,
    [id],
  );
}

export const IdRowSchema = z.object({ id: z.string() });

/** Insert-or-update the `images` row itself; returns its id. */
const UPSERT_IMAGE_ROW_SQL = `INSERT INTO images (
       file_path, thumbnail_path, filename, extension, sha256_hash, perceptual_hash,
       width, height, file_size_bytes, created_at, modified_at, source_tool,
       prompt, negative_prompt, workflow_json, metadata_json, model_id, checkpoint_id,
       ingestion_status
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'indexed'
     )
     ON CONFLICT (sha256_hash) DO UPDATE SET
       file_path = EXCLUDED.file_path,
       thumbnail_path = COALESCE(EXCLUDED.thumbnail_path, images.thumbnail_path),
       perceptual_hash = EXCLUDED.perceptual_hash,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       prompt = EXCLUDED.prompt,
       negative_prompt = EXCLUDED.negative_prompt,
       workflow_json = EXCLUDED.workflow_json,
       metadata_json = EXCLUDED.metadata_json,
       source_tool = EXCLUDED.source_tool,
       model_id = COALESCE(EXCLUDED.model_id, images.model_id),
       checkpoint_id = COALESCE(EXCLUDED.checkpoint_id, images.checkpoint_id),
       modified_at = EXCLUDED.modified_at,
       ingestion_status = 'indexed'
     RETURNING id`;

function upsertImageRowParams(
  record: ExtractedImageRecord,
  thumbnailPath: string | null,
  modelId: string | null,
  checkpointId: string | null,
): unknown[] {
  return [
    record.filePath,
    thumbnailPath,
    record.filename,
    record.extension,
    record.sha256Hash,
    record.perceptualHash,
    record.width,
    record.height,
    record.fileSizeBytes,
    record.createdAt,
    record.modifiedAt,
    record.sourceTool,
    record.prompt,
    record.negativePrompt,
    record.workflowJson ? JSON.stringify(record.workflowJson) : null,
    record.metadataJson ? JSON.stringify(record.metadataJson) : null,
    modelId,
    checkpointId,
  ];
}

async function upsertImageRow(
  client: PoolClient,
  record: ExtractedImageRecord,
  thumbnailPath: string | null,
  modelId: string | null,
  checkpointId: string | null,
): Promise<string> {
  const upsert = await client.query<z.infer<typeof IdRowSchema>>(
    UPSERT_IMAGE_ROW_SQL,
    upsertImageRowParams(record, thumbnailPath, modelId, checkpointId),
  );
  return upsert.rows[0].id;
}

async function upsertGenerationParams(
  client: PoolClient,
  imageId: string,
  gp: ExtractedImageRecord["generationParams"],
): Promise<void> {
  await client.query(
    `INSERT INTO generation_params (image_id, seed, steps, cfg_scale, sampler, scheduler, denoise, width, height, clip_skip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (image_id) DO UPDATE SET
       seed = EXCLUDED.seed, steps = EXCLUDED.steps, cfg_scale = EXCLUDED.cfg_scale,
       sampler = EXCLUDED.sampler, scheduler = EXCLUDED.scheduler, denoise = EXCLUDED.denoise,
       width = EXCLUDED.width, height = EXCLUDED.height, clip_skip = EXCLUDED.clip_skip`,
    [imageId, gp.seed, gp.steps, gp.cfgScale, gp.sampler, gp.scheduler, gp.denoise, gp.width, gp.height, gp.clipSkip],
  );
}

async function replaceImageTags(
  client: PoolClient,
  imageId: string,
  tags: ExtractedImageRecord["tags"],
): Promise<void> {
  await clearImageTags(client, imageId, "prompt");
  for (const tag of tags) {
    const tagId = await upsertTag(client, tag, null, "prompt");
    await linkImageTag(client, imageId, tagId, { source: "prompt", confidence: 1 });
  }
}

async function replaceImageLoras(
  client: PoolClient,
  imageId: string,
  loras: ExtractedImageRecord["loras"],
): Promise<void> {
  await client.query(`DELETE FROM image_loras WHERE image_id = $1 AND source = 'prompt'`, [imageId]);
  for (const lora of loras) {
    const loraId = await upsertLora(client, lora.name);
    await linkImageLora(client, imageId, loraId, lora.weight, "prompt");
  }
}

/**
 * Persist a fully-extracted image record plus its tags, loras, model,
 * checkpoint and generation params in a single transaction.  Idempotent on
 * sha256: an existing row is updated rather than duplicated.
 */
export async function persistImage(
  record: ExtractedImageRecord,
  thumbnailPath: string | null,
): Promise<string> {
  return withTransaction(async (client) => {
    let modelId: string | null = null;
    let checkpointId: string | null = null;
    if (record.model) {
      const family = inferModelFamily(record.model);
      modelId = await upsertModel(client, record.model, family);
      checkpointId = await upsertCheckpoint(client, record.model, modelId);
    }

    const imageId = await upsertImageRow(client, record, thumbnailPath, modelId, checkpointId);
    await upsertGenerationParams(client, imageId, record.generationParams);
    await replaceImageTags(client, imageId, record.tags);
    await replaceImageLoras(client, imageId, record.loras);

    return imageId;
  });
}

export async function setThumbnail(imageId: string, thumbnailPath: string): Promise<void> {
  await query(`UPDATE images SET thumbnail_path = $2 WHERE id = $1`, [imageId, thumbnailPath]);
}

export async function setRating(imageId: string, rating: number | null): Promise<void> {
  await query(`UPDATE images SET rating = $2 WHERE id = $1`, [imageId, rating]);
}

export async function setFavorite(imageId: string, favorite: boolean): Promise<void> {
  await query(`UPDATE images SET favorite = $2 WHERE id = $1`, [imageId, favorite]);
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export const DetailRowSchema = z.object({
  id: z.string(),
  file_path: z.string(),
  thumbnail_path: z.string().nullable(),
  filename: z.string(),
  extension: z.string().nullable(),
  sha256_hash: z.string(),
  perceptual_hash: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  file_size_bytes: z.string().nullable(),
  created_at: z.custom<Date>().nullable(),
  imported_at: z.custom<Date>(),
  modified_at: z.custom<Date>().nullable(),
  source_tool: z.string().nullable(),
  prompt: z.string().nullable(),
  negative_prompt: z.string().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  ingestion_status: z.string(),
  model_name: z.string().nullable(),
  model_family: z.string().nullable(),
  checkpoint_name: z.string().nullable(),
});
type DetailRow = z.infer<typeof DetailRowSchema>;

export const DetailTagRowSchema = z.object({
  name: z.string(),
  normalized_name: z.string(),
  category: z.string().nullable(),
  confidence: z.number().nullable(),
  source: z.string().nullable(),
});
export const DetailLoraRowSchema = z.object({ name: z.string(), weight: z.number().nullable() });
export const DetailGenerationParamsRowSchema = z.object({
  seed: z.string().nullable(),
  steps: z.number().nullable(),
  cfg_scale: z.number().nullable(),
  sampler: z.string().nullable(),
  scheduler: z.string().nullable(),
  denoise: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  clip_skip: z.number().nullable(),
});
export const DetailDescriptionRowSchema = z.object({
  id: z.string(),
  description: z.string(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  created_at: z.custom<Date>(),
});

async function fetchDetailRelations(id: string) {
  return Promise.all([
    rows<z.infer<typeof DetailTagRowSchema>>(
      `SELECT t.name, t.normalized_name, t.category, it.confidence, it.source
         FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = $1`,
      [id],
    ),
    rows<z.infer<typeof DetailLoraRowSchema>>(
      `SELECT l.name, il.weight FROM image_loras il JOIN loras l ON l.id = il.lora_id WHERE il.image_id = $1`,
      [id],
    ),
    maybeRow<z.infer<typeof DetailGenerationParamsRowSchema>>(
      `SELECT * FROM generation_params WHERE image_id = $1`,
      [id],
    ),
    rows<z.infer<typeof DetailDescriptionRowSchema>>(
      `SELECT id, description, provider, model, created_at FROM image_descriptions WHERE image_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
  ]);
}

function toDetailCore(row: DetailRow): Omit<ImageDetail, "tags" | "loras" | "generationParams" | "descriptions"> {
  return {
    id: row.id,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    filename: row.filename,
    extension: row.extension,
    sha256Hash: row.sha256_hash,
    perceptualHash: row.perceptual_hash,
    width: row.width,
    height: row.height,
    fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    importedAt: row.imported_at.toISOString(),
    modifiedAt: row.modified_at ? row.modified_at.toISOString() : null,
    sourceTool: row.source_tool,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt,
    rating: row.rating,
    favorite: row.favorite,
    ingestionStatus: row.ingestion_status,
    model: row.model_name,
    checkpoint: row.checkpoint_name,
    modelFamily: row.model_family,
  };
}

function toDetailGenerationParams(
  gpRow: z.infer<typeof DetailGenerationParamsRowSchema> | null,
): ImageDetail["generationParams"] {
  if (!gpRow) return null;
  return {
    seed: gpRow.seed ? Number(gpRow.seed) : null,
    steps: gpRow.steps,
    cfgScale: gpRow.cfg_scale,
    sampler: gpRow.sampler,
    scheduler: gpRow.scheduler,
    denoise: gpRow.denoise,
    width: gpRow.width,
    height: gpRow.height,
    clipSkip: gpRow.clip_skip,
  };
}

function toImageDetail(
  row: DetailRow,
  tagRows: z.infer<typeof DetailTagRowSchema>[],
  loraRows: z.infer<typeof DetailLoraRowSchema>[],
  gpRow: z.infer<typeof DetailGenerationParamsRowSchema> | null,
  descRows: z.infer<typeof DetailDescriptionRowSchema>[],
): ImageDetail {
  return {
    ...toDetailCore(row),
    tags: tagRows.map((t) => ({
      name: t.name,
      normalizedName: t.normalized_name,
      category: t.category,
      confidence: t.confidence,
      source: t.source,
    })),
    loras: loraRows.map((l) => ({ name: l.name, weight: l.weight })),
    generationParams: toDetailGenerationParams(gpRow),
    descriptions: descRows.map((d) => ({
      id: d.id,
      description: d.description,
      provider: d.provider,
      model: d.model,
      createdAt: d.created_at.toISOString(),
    })),
  };
}

export async function getImageDetail(id: string): Promise<ImageDetail | null> {
  const row = await maybeRow<DetailRow>(
    `SELECT i.*, m.name AS model_name, m.family AS model_family, c.name AS checkpoint_name
       FROM images i
       LEFT JOIN models m ON m.id = i.model_id
       LEFT JOIN checkpoints c ON c.id = i.checkpoint_id
      WHERE i.id = $1`,
    [id],
  );
  if (!row) return null;

  const [tagRows, loraRows, gpRow, descRows] = await fetchDetailRelations(id);
  return toImageDetail(row, tagRows, loraRows, gpRow, descRows);
}

// ---------------------------------------------------------------------------
// Filtered listing (metadata search)
// ---------------------------------------------------------------------------

export const ImageListItemSchema = z.object({
  id: z.string(),
  filename: z.string(),
  thumbnailPath: z.string().nullable(),
  prompt: z.string().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  model: z.string().nullable(),
  checkpoint: z.string().nullable(),
  tags: z.array(z.string()),
});
export type ImageListItem = z.infer<typeof ImageListItemSchema>;

export const ListFiltersSchema = SearchFiltersSchema.extend({
  query: z.string().optional(),
  ids: z.array(z.string()).optional(),
});
export type ListFilters = z.infer<typeof ListFiltersSchema>;

export const FilterClauseSchema = z.object({ where: z.string(), params: z.array(z.unknown()) });
type FilterClause = z.infer<typeof FilterClauseSchema>;

/** Mutable accumulator threaded through the `buildFilterClause` condition builders. */
class FilterBuilder {
  readonly conditions: string[] = ["i.deleted = false"];
  readonly params: unknown[] = [];
  idx: number;

  constructor(startIndex: number) {
    this.idx = startIndex;
  }

  push(condition: string, ...values: unknown[]): void {
    this.conditions.push(condition);
    this.params.push(...values);
    this.idx += values.length;
  }
}

function applyScalarFilters(b: FilterBuilder, filters: ListFilters): void {
  if (filters.ids) b.push(`i.id = ANY($${b.idx})`, filters.ids);
  if (filters.query) b.push(`(i.prompt ILIKE $${b.idx} OR i.filename ILIKE $${b.idx})`, `%${filters.query}%`);
  if (filters.modelFamily) b.push(`m.family = $${b.idx}`, filters.modelFamily);
  if (filters.checkpoint) b.push(`c.name ILIKE $${b.idx}`, `%${filters.checkpoint}%`);
  if (filters.sourceTool) b.push(`i.source_tool = $${b.idx}`, filters.sourceTool);
  if (typeof filters.ratingGte === "number") b.push(`i.rating >= $${b.idx}`, filters.ratingGte);
  if (filters.favorite) b.conditions.push(`i.favorite = true`);
}

function applyArrayFilters(b: FilterBuilder, filters: ListFilters): void {
  if (filters.tags && filters.tags.length > 0) {
    const normalized = filters.tags.map((t) => t.toLowerCase().replace(/\s+/g, "_"));
    b.push(
      `i.id IN (SELECT it.image_id FROM image_tags it JOIN tags t ON t.id = it.tag_id
                WHERE t.normalized_name = ANY($${b.idx}) GROUP BY it.image_id HAVING COUNT(DISTINCT t.normalized_name) = $${b.idx + 1})`,
      normalized,
      filters.tags.length,
    );
  }
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const normalized = filters.excludeTags.map((t) => t.toLowerCase().replace(/\s+/g, "_"));
    b.push(
      `i.id NOT IN (SELECT it.image_id FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE t.normalized_name = ANY($${b.idx}))`,
      normalized,
    );
  }
  if (filters.loras && filters.loras.length > 0) {
    b.push(
      `i.id IN (SELECT il.image_id FROM image_loras il JOIN loras l ON l.id = il.lora_id WHERE l.name = ANY($${b.idx}))`,
      filters.loras,
    );
  }
}

/** Build a WHERE clause from search filters; returns sql fragment + params. */
function buildFilterClause(filters: ListFilters, startIndex: number): FilterClause {
  const b = new FilterBuilder(startIndex);
  applyScalarFilters(b, filters);
  applyArrayFilters(b, filters);
  return { where: b.conditions.join(" AND "), params: b.params };
}

export const ListItemRowSchema = z.object({
  id: z.string(),
  filename: z.string(),
  thumbnail_path: z.string().nullable(),
  prompt: z.string().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  model: z.string().nullable(),
  checkpoint: z.string().nullable(),
  tags: z.array(z.string()),
});
type ListItemRow = z.infer<typeof ListItemRowSchema>;

function toListItem(r: ListItemRow): ImageListItem {
  return {
    id: r.id,
    filename: r.filename,
    thumbnailPath: r.thumbnail_path,
    prompt: r.prompt,
    rating: r.rating,
    favorite: r.favorite,
    model: r.model,
    checkpoint: r.checkpoint,
    tags: r.tags ?? [],
  };
}

const LIST_ITEM_SELECT = `SELECT i.id, i.filename, i.thumbnail_path, i.prompt, i.rating, i.favorite,
           m.name AS model, c.name AS checkpoint,
           COALESCE(ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
      FROM images i
      LEFT JOIN models m ON m.id = i.model_id
      LEFT JOIN checkpoints c ON c.id = i.checkpoint_id
      LEFT JOIN image_tags it ON it.image_id = i.id
      LEFT JOIN tags t ON t.id = it.tag_id`;

export async function listImages(
  filters: ListFilters,
  limit: number,
  offset: number,
): Promise<ImageListItem[]> {
  const { where, params } = buildFilterClause(filters, 1);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const sql = `${LIST_ITEM_SELECT}
     WHERE ${where}
     GROUP BY i.id, m.name, c.name
     ORDER BY i.imported_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  const result = await rows<ListItemRow>(sql, [...params, limit, offset]);
  return result.map(toListItem);
}

/** Fetch list items for an explicit set of ids, preserving the given order. */
export async function getListItemsByIds(ids: string[]): Promise<Map<string, ImageListItem>> {
  if (ids.length === 0) return new Map();
  const result = await rows<ListItemRow>(
    `${LIST_ITEM_SELECT}
      WHERE i.id = ANY($1)
      GROUP BY i.id, m.name, c.name`,
    [ids],
  );
  const map = new Map<string, ImageListItem>();
  for (const r of result) map.set(r.id, toListItem(r));
  return map;
}

export const ReindexRowSchema = z.object({ id: z.string(), filePath: z.string(), sha256: z.string() });
export type ReindexRow = z.infer<typeof ReindexRowSchema>;

/** All image ids + file paths for rebuild/reindex jobs. */
export async function listAllForReindex(): Promise<ReindexRow[]> {
  return rows<ReindexRow>(
    `SELECT id, file_path AS "filePath", sha256_hash AS sha256 FROM images WHERE deleted = false`,
  );
}
