/**
 * deedlit.api gateway client — the ONLY data source for the comfyhelper UI.
 *
 * comfyhelper is UI-only: it holds no database connections and talks to no
 * datastore directly. Every read/write goes through the single BFF gateway
 * (`deedlit.api`) over HTTP. This module is the seam: typed calls to the
 * gateway endpoints (see contracts/api.openapi.yaml) plus mappers that adapt
 * the gateway/downstream contract shapes into the shapes the existing React
 * surfaces already consume (CompactResult, the detail-page record, Graph).
 *
 * Endpoints used:
 *   GET  /detail/{sha256}  -> { image, similar, neighbors }
 *   POST /search           -> { hits: [{ sha256, score, payload }] }
 *   GET  /stats            -> { images, tags, collections, notes }
 *   GET  /jobs / POST /jobs
 *   GET  /health           -> { status, services: [{ name, status }] }
 *   POST /mcp              -> JSON-RPC (clusters/compare/related-tags/lineage)
 *
 * Base URL: DEEDLIT_API_URL (server-side, default http://localhost:8088). When
 * a value is needed in the browser, NEXT_PUBLIC_DEEDLIT_API_URL is consulted
 * first. In practice the React surfaces call the in-app /api/library/* routes,
 * which run server-side and proxy through this client, so the browser never
 * needs the gateway URL directly — but the public var is supported for a
 * future direct-fetch path.
 */
import { z } from "zod";
import { GenerationParamsSchema, LoraRefSchema } from "@/lib/library/schemas";
import type {
  CompactResult,
  DirectoryCount,
  Graph,
  GenerationParams,
  ImageTag,
  LoraRef,
} from "@/lib/library/schemas";

// ---------------------------------------------------------------------------
// Base URL + low-level request
// ---------------------------------------------------------------------------

export function getGatewayBaseUrl(): string {
  const server = process.env.DEEDLIT_API_URL?.trim();
  const pub = process.env.NEXT_PUBLIC_DEEDLIT_API_URL?.trim();
  return (server || pub || "http://localhost:8088").replace(/\/+$/, "");
}

/**
 * Base URL for fetching image blobs (thumbnails / originals).
 *
 * The catalog owns blobs at GET /blobs/{sha256}/{kind}; the gateway now proxies
 * them at the same path (deedlit.api GET /blobs/{sha256}/{kind}). Since
 * comfyhelper is UI-only it can't stream bytes from a datastore itself, so the
 * thumbnail/file routes proxy through this base. DEEDLIT_BLOB_URL overrides it
 * (e.g. to hit the catalog directly in a dev setup); when unset we default to
 * the gateway, which is the canonical blob source.
 */
export function getBlobBaseUrl(): string | null {
  const v = process.env.DEEDLIT_BLOB_URL?.trim();
  return (v ? v : getGatewayBaseUrl()).replace(/\/+$/, "");
}

/** Build the upstream blob URL for an image, or null if blob serving is unconfigured. */
export function blobUrl(sha256: string, kind: "thumbnail" | "embedding" | "original"): string | null {
  const base = getBlobBaseUrl();
  if (!base) return null;
  // catalog serves thumbnail/embedding; "original" maps to the image bytes.
  const catalogKind = kind === "original" ? "thumbnail" : kind;
  return `${base}/blobs/${encodeURIComponent(sha256)}/${catalogKind}`;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export const RequestOptionsSchema = z.object({
  method: z.string().optional(),
  body: z.unknown().optional(),
  /**
   * Query params appended to the path. An array value is emitted as a repeated
   * param (?k=a&k=b); undefined values and empty arrays are skipped.
   */
  query: z.record(z.string(), z.custom<string | number | boolean | string[] | undefined>()).optional(),
  signal: z.custom<AbortSignal>().optional(),
});
type RequestOptions = z.infer<typeof RequestOptionsSchema>;

const ErrorDetailSchema = z.object({ detail: z.unknown() });

/** Extract a gateway error's `detail` message from an unknown JSON/text body. */
function extractDetailMessage(detail: unknown): string | undefined {
  const parsed = ErrorDetailSchema.safeParse(detail);
  return parsed.success ? String(parsed.data.detail) : undefined;
}

function appendQuery(url: URL, query: RequestOptions["query"]): void {
  if (!query) return;
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
}

async function readErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return await res.text().catch(() => undefined);
  }
}

async function throwGatewayError(res: Response, method: string, path: string): Promise<never> {
  const detail = await readErrorBody(res);
  const msg = extractDetailMessage(detail) ?? `gateway ${method} ${path} -> ${res.status}`;
  throw new GatewayError(msg, res.status, detail);
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = getGatewayBaseUrl();
  const url = new URL(`${base}${path}`);
  appendQuery(url, opts.query);
  const method = opts.method ?? "GET";
  const init: RequestInit = {
    method,
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    // Always fetch fresh; the UI controls its own caching.
    cache: "no-store",
  };

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (cause) {
    throw new GatewayError(`gateway unreachable at ${base} (${method} ${path})`, 503, cause);
  }

  if (!res.ok) await throwGatewayError(res, method, path);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Gateway / downstream contract shapes (see contracts/*.openapi.yaml)
// ---------------------------------------------------------------------------

/** A scored hit from deedlit.search (proxied through the gateway). */
export const SearchHitSchema = z.object({
  sha256: z.string(),
  score: z.number(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchResponseSchema = z.object({
  fusion: z.enum(["rrf", "dense", "sparse"]).optional(),
  hits: z.array(SearchHitSchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/** A graph neighbor from deedlit.graph (proxied through the gateway). */
export const GraphNeighborSchema = z.object({
  sha256: z.string(),
  relation: z.string(),
  weight: z.number().optional(),
});
export type GraphNeighbor = z.infer<typeof GraphNeighborSchema>;

const CatalogImageParamsSchema = z.object({
  seed: z.number().nullable().optional(),
  steps: z.number().nullable().optional(),
  cfg: z.number().nullable().optional(),
  sampler: z.string().nullable().optional(),
  scheduler: z.string().nullable().optional(),
  denoise: z.number().nullable().optional(),
  clipskip: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

const CatalogReferenceSchema = z.object({
  kind: z.string(),
  name: z.string(),
  hash: z.string().nullable().optional(),
});

/** The catalog Image record (canonical metadata). */
export const CatalogImageSchema = z
  .object({
    sha256: z.string(),
    phash: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    sourceTool: z.string().nullable().optional(),
    prompt: z.string().nullable().optional(),
    negative: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    params: CatalogImageParamsSchema.nullable().optional(),
    references: z.array(CatalogReferenceSchema).optional(),
    rating: z.number().nullable().optional(),
    favorite: z.boolean().optional(),
    /** Parent directory of the source file (split-by-source-directory grouping key). */
    directory: z.string().nullable().optional(),
    /** AI-generated description (deedlit.labelagent), persisted by the catalog. */
    description: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  // tolerate extra payload fields the gateway forwards
  .catchall(z.unknown());
export type CatalogImage = z.infer<typeof CatalogImageSchema>;

/** Aggregated detail response from the gateway. */
export const DetailResponseSchema = z.object({
  image: CatalogImageSchema,
  similar: z.array(SearchHitSchema),
  neighbors: z.array(GraphNeighborSchema),
});
export type DetailResponse = z.infer<typeof DetailResponseSchema>;

export const StatsResponseSchema = z.object({
  images: z.number(),
  tags: z.number().optional(),
  collections: z.number().optional(),
  notes: z.number().optional(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

export const ServiceHealthSchema = z.object({
  name: z.string(),
  status: z.enum(["ok", "degraded", "down"]),
  /**
   * Downstream readiness flags forwarded verbatim by the gateway, e.g.
   * { db_ready, blob_ready } (catalog), { neo4j_ready } (graph),
   * { collection_ready } (search), { vision_ready, sparse_ready } (vision).
   */
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  services: z.array(ServiceHealthSchema).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * One service's live work snapshot, as aggregated by the gateway GET /activity.
 * `per_min` is the trailing-60s completion rate; `busy` is `inflight > 0`;
 * `reachable` is false when the gateway couldn't reach that service's /activity.
 */
export const ServiceActivitySchema = z.object({
  name: z.string(),
  inflight: z.number(),
  per_min: z.number(),
  busy: z.boolean(),
  last_op: z.string().nullable(),
  reachable: z.boolean(),
});
export type ServiceActivity = z.infer<typeof ServiceActivitySchema>;

export const ActivityResponseSchema = z.object({
  services: z.array(ServiceActivitySchema),
});
export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

export async function getDetail(sha256: string, signal?: AbortSignal): Promise<DetailResponse> {
  return request<DetailResponse>(`/detail/${encodeURIComponent(sha256)}`, { signal });
}

/**
 * Read ONE image's catalog record directly via the gateway GET /images/{sha256}
 * — a pure catalog passthrough. Unlike {@link getDetail}, it does NOT run the
 * detail fan-out (no search /similar, no graph /neighbors), so callers that only
 * need the image record (detail panels, admin raw inspector, export, move) don't
 * pay two extra downstream queries per read. Pass `light: true` to also drop the
 * heavy workflow_json/api_prompt_json graphs (the panels render none of them) via
 * ?fields=light. Throws a {@link GatewayError} with status 404 when absent.
 */
export const GetImageOptionsSchema = z.object({ light: z.boolean().optional() });
type GetImageOptions = z.infer<typeof GetImageOptionsSchema>;

export async function getImage(
  sha256: string,
  opts: GetImageOptions = {},
  signal?: AbortSignal,
): Promise<CatalogImage> {
  return request<CatalogImage>(`/images/${encodeURIComponent(sha256)}`, {
    query: opts.light ? { fields: "light" } : undefined,
    signal,
  });
}

/** Per-store outcome of un-indexing an image (DELETE /images/{sha256}). */
export const DeleteImageResultSchema = z.object({
  status: z.string(),
  sha256: z.string(),
  /** Catalog record removed (always true on success — catalog is the truth). */
  catalog: z.boolean(),
  /** Search vector removed (best-effort projection cleanup). */
  search: z.boolean(),
  /** Graph node/edges removed (best-effort projection cleanup). */
  graph: z.boolean(),
});
export type DeleteImageResult = z.infer<typeof DeleteImageResultSchema>;

/**
 * Delete an image's INDEXATION — catalog record + search vector + graph node —
 * NOT the original file on disk. Proxies the gateway DELETE /images/{sha256},
 * which removes the catalog record first (source of truth) then cleans the
 * derived projections. A {@link GatewayError} with status 404 means the image
 * is not in the library.
 */
export async function deleteImage(sha256: string, signal?: AbortSignal): Promise<DeleteImageResult> {
  return request<DeleteImageResult>(`/images/${encodeURIComponent(sha256)}`, {
    method: "DELETE",
    signal,
  });
}

/** Outcome of a bulk un-index (gateway POST /images/batch-delete). */
export const BatchDeleteResultSchema = z.object({
  /** sha256s whose catalog record was removed by this call. */
  deleted: z.array(z.string()),
  /** sha256s that were not in the catalog (already gone). */
  missing: z.array(z.string()),
  /** Search points removed for the deleted set (best-effort projection cleanup). */
  search: z.boolean(),
  /** Graph nodes removed for the deleted set (best-effort projection cleanup). */
  graph: z.boolean(),
});
export type BatchDeleteResult = z.infer<typeof BatchDeleteResultSchema>;

/**
 * Bulk un-index MANY images in ONE call — catalog record + search vector + graph
 * node for each, NOT the source files on disk. Proxies the gateway POST
 * /images/batch-delete, which does a single batch op per store (vs N per-image
 * deletes). De-dupes server-side; capped at 1000 ids per call.
 */
export async function batchDeleteImages(
  sha256s: string[],
  signal?: AbortSignal,
): Promise<BatchDeleteResult> {
  const res = await request<Partial<BatchDeleteResult>>("/images/batch-delete", {
    method: "POST",
    body: { sha256s },
    signal,
  });
  return {
    deleted: Array.isArray(res?.deleted) ? res.deleted : [],
    missing: Array.isArray(res?.missing) ? res.missing : [],
    search: Boolean(res?.search),
    graph: Boolean(res?.graph),
  };
}

/** One cataloged image whose on-disk source file has vanished. */
export const MissingFileSchema = z.object({
  sha256: z.string(),
  filepath: z.string(),
  filename: z.string().nullable().optional(),
  directory: z.string().nullable().optional(),
});
export type MissingFile = z.infer<typeof MissingFileSchema>;

/** Result of the missing-file scan (gateway GET /maintenance/missing-files). */
export const MissingFilesResultSchema = z.object({
  /** Records probed (those with a local filepath; blob-only entries skipped). */
  checked: z.number(),
  /** The orphaned entries, capped at the requested `limit`. */
  missing: z.array(MissingFileSchema),
  /** Exact total of orphaned entries (may exceed `missing.length`). */
  missingCount: z.number(),
  /** True when more entries matched than were returned. */
  truncated: z.boolean(),
});
export type MissingFilesResult = z.infer<typeof MissingFilesResultSchema>;

export const FindMissingFilesResponseSchema = z.object({
  checked: z.number().optional(),
  missing: z.array(MissingFileSchema).optional(),
  missing_count: z.number().optional(),
  truncated: z.boolean().optional(),
});

/**
 * Scan the catalog for images whose source file vanished from disk. Proxies the
 * gateway GET /maintenance/missing-files (routed to deedlit.ingest, the host-FS
 * owner). Read-only — pairs with {@link batchDeleteImages} to clean up the stale
 * catalog records the scan surfaces.
 */
export async function findMissingFiles(
  limit = 500,
  signal?: AbortSignal,
): Promise<MissingFilesResult> {
  const res = await request<z.infer<typeof FindMissingFilesResponseSchema>>(
    "/maintenance/missing-files",
    { query: { limit }, signal },
  );
  return {
    checked: Number(res?.checked ?? 0),
    missing: Array.isArray(res?.missing) ? res.missing : [],
    missingCount: Number(res?.missing_count ?? 0),
    truncated: Boolean(res?.truncated),
  };
}

export const GatewaySearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  /** Rank offset for server-side pagination over the whole matching set. */
  offset: z.number().optional(),
  filter: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type GatewaySearchRequest = z.infer<typeof GatewaySearchRequestSchema>;

export async function search(req: GatewaySearchRequest, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await request<SearchResponse>("/search", { method: "POST", body: req, signal });
  return { fusion: res?.fusion, hits: Array.isArray(res?.hits) ? res.hits : [] };
}

export const GatewayImageSearchOptionsSchema = z.object({
  limit: z.number(),
  /** Rank offset for server-side pagination over the whole matching set. */
  offset: z.number().optional(),
  /** Cleaned camelCase facet object (tags/excludeTags/safety) the gateway translates to a Qdrant filter. */
  filter: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type GatewayImageSearchOptions = z.infer<typeof GatewayImageSearchOptionsSchema>;

/**
 * Reverse-image search: forward an uploaded image to the gateway's multipart
 * POST /search/by-image (which embeds it via deedlit.vision, then dense-queries
 * deedlit.search). The body is multipart so it can't ride the JSON `request()`
 * helper; the base URL + error mapping mirror it here.
 */
export async function searchByImageUpload(
  file: Blob,
  filename: string,
  opts: GatewayImageSearchOptions,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const base = getGatewayBaseUrl();
  const fd = new FormData();
  fd.append("file", file, filename);
  fd.append("limit", String(opts.limit));
  if (opts.offset) fd.append("offset", String(opts.offset));
  if (opts.filter) fd.append("filter", JSON.stringify(opts.filter));

  let res: Response;
  try {
    res = await fetch(`${base}/search/by-image`, {
      method: "POST",
      body: fd,
      signal,
      cache: "no-store",
    });
  } catch (cause) {
    throw new GatewayError(`gateway unreachable at ${base} (POST /search/by-image)`, 503, cause);
  }
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => undefined);
    }
    const msg = extractDetailMessage(detail) ?? `gateway POST /search/by-image -> ${res.status}`;
    throw new GatewayError(msg, res.status, detail);
  }
  const body = (await res.json()) as SearchResponse;
  return { fusion: body?.fusion, hits: Array.isArray(body?.hits) ? body.hits : [] };
}

export async function getStats(signal?: AbortSignal): Promise<StatsResponse> {
  return request<StatsResponse>("/stats", { signal });
}

export async function listJobs(signal?: AbortSignal): Promise<Array<Record<string, unknown>>> {
  const res = await request<unknown>("/jobs", { signal });
  return Array.isArray(res) ? (res as Array<Record<string, unknown>>) : [];
}

export async function dispatchJob(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/jobs", { method: "POST", body: payload, signal });
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", { signal });
}

/**
 * Live per-service activity (in-flight / throughput / current op), aggregated by
 * the gateway GET /activity. Tolerates a missing/odd `services` field by
 * returning an empty list so the status board degrades to its health-only view.
 */
export async function getActivity(signal?: AbortSignal): Promise<ActivityResponse> {
  const res = await request<ActivityResponse>("/activity", { signal });
  return { services: Array.isArray(res?.services) ? res.services : [] };
}

// ---------------------------------------------------------------------------
// Filesystem browse — the admin directory picker. The gateway proxies this to
// deedlit.ingest, which owns the host filesystem the ingest paths live on.
// comfyhelper itself has no filesystem access, so this is the only way the
// picker can list folders.
// ---------------------------------------------------------------------------

export const FsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
});
export type FsEntry = z.infer<typeof FsEntrySchema>;

export const FsRootSchema = z.object({
  label: z.string(),
  path: z.string(),
});
export type FsRoot = z.infer<typeof FsRootSchema>;

export const FsBrowseResultSchema = z.object({
  /** Absolute path being listed, or null for the synthetic "roots" view. */
  path: z.string().nullable(),
  /** Parent directory, or null when already at a drive/filesystem root. */
  parent: z.string().nullable(),
  separator: z.string(),
  entries: z.array(FsEntrySchema),
  /** Quick-access jump targets (drives, home, cwd) shown in every view. */
  roots: z.array(FsRootSchema),
});
export type FsBrowseResult = z.infer<typeof FsBrowseResultSchema>;

/**
 * List a directory on the ingest host. Passing null/empty returns the roots
 * view. A {@link GatewayError} with status 400 means the path is missing /
 * denied / not a folder — user-correctable, surfaced inline by the picker.
 */
export async function browseFs(path: string | null, signal?: AbortSignal): Promise<FsBrowseResult> {
  return request<FsBrowseResult>("/fs/browse", {
    query: path ? { path } : undefined,
    signal,
  });
}

// ---------------------------------------------------------------------------
// Source folders — the configured-ingest-folder registry, proxied through the
// gateway /folders routes (catalog owns the data). The registry persists which
// folders to scan; a background scheduler in ingest re-walks each on its own
// interval and writes the last-scan state back, which these reads surface.
// ---------------------------------------------------------------------------

/** A configured source folder + its derived coverage. */
export const SourceFolderSchema = z.object({
  id: z.string(),
  path: z.string(),
  label: z.string().nullable(),
  enabled: z.boolean(),
  recursive: z.boolean(),
  scan_interval_seconds: z.number(),
  last_scan_at: z.string().nullable(),
  last_scan_status: z.string().nullable(),
  last_scan_job_id: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  /** Images whose source path is under this folder (derived). */
  image_count: z.number(),
  /** Of those, how many have an AI label/description. */
  labeled_count: z.number(),
  unlabeled_count: z.number(),
});
export type SourceFolder = z.infer<typeof SourceFolderSchema>;

/** Writable fields when registering a folder. */
export const SourceFolderUpsertSchema = z.object({
  path: z.string(),
  label: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  recursive: z.boolean().optional(),
  scan_interval_seconds: z.number().optional(),
});
export type SourceFolderUpsert = z.infer<typeof SourceFolderUpsertSchema>;

/** Partial folder update (toggle enabled/recursive, edit interval/label). */
export const SourceFolderPatchSchema = z.object({
  label: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  recursive: z.boolean().optional(),
  scan_interval_seconds: z.number().optional(),
});
export type SourceFolderPatch = z.infer<typeof SourceFolderPatchSchema>;

export async function listSourceFolders(signal?: AbortSignal): Promise<SourceFolder[]> {
  const res = await request<unknown>("/folders", { signal });
  return Array.isArray(res) ? (res as SourceFolder[]) : [];
}

export async function createSourceFolder(body: SourceFolderUpsert, signal?: AbortSignal): Promise<SourceFolder> {
  return request<SourceFolder>("/folders", { method: "POST", body, signal });
}

export async function updateSourceFolder(
  id: string,
  body: SourceFolderPatch,
  signal?: AbortSignal,
): Promise<SourceFolder> {
  return request<SourceFolder>(`/folders/${encodeURIComponent(id)}`, { method: "PATCH", body, signal });
}

export async function deleteSourceFolder(id: string, signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/folders/${encodeURIComponent(id)}`, { method: "DELETE", signal });
}

/** Dispatch an immediate ingest scan of a configured folder ("Scan now"). */
export async function scanSourceFolder(id: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/folders/${encodeURIComponent(id)}/scan`, {
    method: "POST",
    signal,
  });
}

export const ListUnlabeledResponseSchema = z.object({ sha256: z.array(z.string()).optional() });

/** sha256 of every cataloged image missing an AI label (library-wide). */
export async function listUnlabeled(signal?: AbortSignal): Promise<string[]> {
  const res = await request<z.infer<typeof ListUnlabeledResponseSchema>>("/images/unlabeled", { signal });
  return Array.isArray(res?.sha256) ? res.sha256 : [];
}

// ---------------------------------------------------------------------------
// Async task queues + ledger (ADR 0001) — backs the queue visualization page.
// Live queue stats + DLQ ops come from the gateway's RabbitMQ management proxy;
// per-image task history comes from the catalog tasks ledger (/tasks).
// ---------------------------------------------------------------------------

/** Live stats for one RabbitMQ queue (from the gateway mgmt proxy). */
export const QueueStatSchema = z.object({
  name: z.string(),
  reachable: z.boolean(),
  messages: z.number(),
  messages_ready: z.number(),
  messages_unacknowledged: z.number(),
  consumers: z.number(),
  publish_rate: z.number(),
  deliver_rate: z.number(),
});
export type QueueStat = z.infer<typeof QueueStatSchema>;

export const ListQueuesResponseSchema = z.object({ queues: z.array(QueueStatSchema).optional() });

export async function listQueues(signal?: AbortSignal): Promise<QueueStat[]> {
  const res = await request<z.infer<typeof ListQueuesResponseSchema>>("/queues", { signal });
  return Array.isArray(res?.queues) ? res.queues : [];
}

/** One peeked message (non-destructive) — payload + AMQP routing/delivery detail. */
export const QueueMessageSchema = z.object({
  payload: z.string().nullable(),
  /** AMQP headers (incl. x-attempt / x-error on retried/dead-lettered tasks). */
  headers: z.record(z.string(), z.unknown()),
  /** Payload size in bytes (RabbitMQ payload_bytes). */
  payload_bytes: z.number().optional(),
  payload_encoding: z.string().optional(),
  /** True when this message was previously delivered and requeued. */
  redelivered: z.boolean().optional(),
  routing_key: z.string().optional(),
  exchange: z.string().optional(),
  /** Full AMQP properties: content_type, delivery_mode, timestamp, headers… */
  properties: z.record(z.string(), z.unknown()).optional(),
});
export type QueueMessage = z.infer<typeof QueueMessageSchema>;

/** Result of a non-destructive queue peek: the sampled messages + depth left. */
export const QueuePeekSchema = z.object({
  messages: z.array(QueueMessageSchema),
  /** Messages still queued after the peek (the sample is requeued, not consumed). */
  remaining: z.number(),
});
export type QueuePeek = z.infer<typeof QueuePeekSchema>;

export const PeekQueueMessagesResponseSchema = z.object({
  messages: z.array(QueueMessageSchema).optional(),
  remaining: z.number().optional(),
});

export async function peekQueueMessages(
  name: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<QueuePeek> {
  const res = await request<z.infer<typeof PeekQueueMessagesResponseSchema>>(
    `/queues/${encodeURIComponent(name)}/messages`,
    { query: { limit }, signal },
  );
  return {
    messages: Array.isArray(res?.messages) ? res.messages : [],
    remaining: typeof res?.remaining === "number" ? res.remaining : 0,
  };
}

/** Purge all messages from a queue (destructive). */
export async function purgeQueue(name: string, signal?: AbortSignal): Promise<void> {
  await request(`/queues/${encodeURIComponent(name)}/purge`, { method: "POST", signal });
}

export const RequeueDlqResponseSchema = z.object({ count: z.number() });

/** Requeue the DLQ of a base queue (index|label) back to the main queue. */
export async function requeueDlq(
  base: string,
  signal?: AbortSignal,
): Promise<z.infer<typeof RequeueDlqResponseSchema>> {
  return request<z.infer<typeof RequeueDlqResponseSchema>>(`/dlq/${encodeURIComponent(base)}/requeue`, {
    method: "POST",
    signal,
  });
}

/** A row from the catalog tasks ledger (per-image async task history). */
export const TaskSchema = z.object({
  id: z.string(),
  sha256: z.string(),
  type: z.enum(["index", "label"]),
  status: z.enum(["queued", "running", "done", "failed", "dlq"]),
  attempts: z.number(),
  error: z.string().nullable(),
  parent_op_id: z.string().nullable(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ListTasksParamsSchema = z.object({
  sha256: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().optional(),
});
type ListTasksParams = z.infer<typeof ListTasksParamsSchema>;

export async function listTasks(
  params: ListTasksParams = {},
  signal?: AbortSignal,
): Promise<Task[]> {
  const res = await request<unknown>("/tasks", { query: params, signal });
  return Array.isArray(res) ? (res as Task[]) : [];
}

// ---------------------------------------------------------------------------
// Ingest runtime config (ADR 0002) — the live producer parallelism knobs the
// settings panel tunes. Folder-scan concurrency + the opt-in ingest-queue route.
// Consumer-side parallelism (broker prefetch, worker replicas) is deploy-time
// and not settable here.
// ---------------------------------------------------------------------------

export const IngestConfigSchema = z.object({
  /** How many `ingest` tasks a folder scan publishes concurrently. */
  ingest_concurrency: z.number(),
  /**
   * Master switch for the vision-LLM (labelagent) enrichment stage. When off,
   * ingest skips the `label` stage so images are cataloged + indexed without an
   * AI description/safety/tags. On by default (labelagent must also be configured).
   */
  llm_enabled: z.boolean(),
});
export type IngestConfig = z.infer<typeof IngestConfigSchema>;

export async function getIngestConfig(signal?: AbortSignal): Promise<IngestConfig> {
  const res = await request<Partial<IngestConfig>>("/ingest/config", { signal });
  return {
    ingest_concurrency:
      typeof res?.ingest_concurrency === "number" ? res.ingest_concurrency : 8,
    // Default ON when the field is absent (older ingest builds) — matches the
    // service default so the toggle doesn't read as off against an unset value.
    llm_enabled: res?.llm_enabled !== false,
  };
}

export async function updateIngestConfig(
  patch: Partial<IngestConfig>,
  signal?: AbortSignal,
): Promise<IngestConfig> {
  return request<IngestConfig>("/ingest/config", { method: "PUT", body: patch, signal });
}

// ---------------------------------------------------------------------------
// Catalog admin (#30) — the DB power-user page works against the RAW catalog
// records (full prompt/params/workflow_json/api_prompt_json), not the search
// CompactResult shape. List/patch proxy the gateway /images routes; re-index /
// re-label dispatch single tasks via ingest; delete-everywhere reuses
// deleteImage (the fan-out un-index above).
// ---------------------------------------------------------------------------

/** Server-side browse/sort/filter knobs for the catalog `GET /images` grid. */
export const CatalogSortSchema = z.enum([
  "newest",
  "oldest",
  "created_desc",
  "created_asc",
  "rating_desc",
  "rating_asc",
  "name_asc",
  "name_desc",
]);
export type CatalogSort = z.infer<typeof CatalogSortSchema>;

export const CatalogBrowseParamsSchema = z.object({
  /** Include tags — image must carry ALL of them (AND). */
  tags: z.array(z.string()).optional(),
  /** Exclude tags — image must carry NONE of them. */
  excludeTags: z.array(z.string()).optional(),
  favorite: z.boolean().optional(),
  /** Keep images rated at least this (0–5). */
  ratingGte: z.number().optional(),
  /** Content-safety classes to include; omit/empty = all. */
  safety: z.array(z.string()).optional(),
  /** Keep images whose on-disk path contains this fragment (separator-insensitive). */
  path: z.string().optional(),
  sort: CatalogSortSchema.optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});
export type CatalogBrowseParams = z.infer<typeof CatalogBrowseParamsSchema>;

/** Browse raw catalog records (gateway GET /images), sorted + paginated. */
export async function listCatalogImages(
  params: CatalogBrowseParams = {},
  signal?: AbortSignal,
): Promise<CatalogImage[]> {
  const res = await request<unknown>("/images", {
    query: {
      tag: params.tags,
      exclude_tag: params.excludeTags,
      favorite: params.favorite,
      rating_gte: params.ratingGte,
      safety: params.safety,
      path: params.path,
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    },
    signal,
  });
  return Array.isArray(res) ? (res as CatalogImage[]) : [];
}

/**
 * Distinct source directories with per-directory image counts (gateway GET
 * /images/directories). Backs the library's split-by-source-directory section
 * headers — true folder totals, not just the loaded page. Biggest folder first;
 * degrades to [] when the gateway/catalog is unavailable.
 */
export async function listDirectories(
  limit = 2000,
  signal?: AbortSignal,
): Promise<DirectoryCount[]> {
  const res = await request<unknown>("/images/directories", {
    query: { limit },
    signal,
  });
  return Array.isArray(res) ? (res as DirectoryCount[]) : [];
}

/**
 * Tag-name autocomplete (gateway GET /tags) — names matching `prefix`, ranked
 * most-used first. Backs the live type-ahead in the library tag filter. An empty
 * prefix returns the globally most-used tags; the gateway degrades to [].
 */
export async function suggestTags(
  prefix: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await request<unknown>("/tags", { query: { prefix, limit }, signal });
  return Array.isArray(res) ? (res as string[]) : [];
}

/**
 * Graph entity-name autocomplete (gateway GET /graph/entities -> deedlit.graph),
 * ranked most-used first. `type` is "tag" (a :Tag) or an asset kind
 * (checkpoint/lora/embedding/vae/controlnet/upscaler → an :Asset of that kind).
 * Backs the graph-filter value picker so every node type offers options instead
 * of a blind free-text field. An empty prefix returns the most-used entities of
 * the type; the gateway degrades to [].
 */
export async function suggestGraphEntities(
  type: string,
  prefix: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await request<unknown>("/graph/entities", {
    query: { type, prefix, limit },
    signal,
  });
  return Array.isArray(res) ? (res as string[]) : [];
}

/** Curated, editable catalog fields (gateway PATCH /images/{sha}). */
export const ImagePatchBodySchema = z.object({
  rating: z.number().nullable().optional(),
  favorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  safety: z.enum(["sfw", "nsfw", "explicit"]).nullable().optional(),
  prompt: z.string().nullable().optional(),
  negative: z.string().nullable().optional(),
});
export type ImagePatchBody = z.infer<typeof ImagePatchBodySchema>;

export async function patchImage(
  sha256: string,
  body: ImagePatchBody,
  signal?: AbortSignal,
): Promise<CatalogImage> {
  return request<CatalogImage>(`/images/${encodeURIComponent(sha256)}`, {
    method: "PATCH",
    body,
    signal,
  });
}

/** Re-project one image (gateway POST /images/{sha}/reindex -> index task). */
export async function reindexImage(sha256: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/images/${encodeURIComponent(sha256)}/reindex`, {
    method: "POST",
    signal,
  });
}

/** Re-label one image (gateway POST /images/{sha}/relabel -> label task). */
export async function relabelImage(sha256: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/images/${encodeURIComponent(sha256)}/relabel`, {
    method: "POST",
    signal,
  });
}

// ---------------------------------------------------------------------------
// Notes — the catalog "note" record (Editor.js block document + positive /
// negative prompt fields + ordered image refs by sha256), proxied through the
// gateway /notes routes. `blocks` is the raw Editor.js OutputData document; the
// gateway/catalog stores it opaquely so the editor round-trips it verbatim.
// ---------------------------------------------------------------------------

/** Editor.js document (kept opaque; the editor owns the exact shape). */
export const NoteBlocksSchema = z.record(z.string(), z.unknown());
export type NoteBlocks = z.infer<typeof NoteBlocksSchema>;

/** The writable fields of a note (POST /notes, PUT /notes/{id}). */
export const NoteUpsertSchema = z.object({
  title: z.string().nullable().optional(),
  positive: z.string().nullable().optional(),
  negative: z.string().nullable().optional(),
  /** Editor.js OutputData document. */
  blocks: NoteBlocksSchema,
  /** Ordered image references by sha256. */
  imageRefs: z.array(z.string()),
});
export type NoteUpsert = z.infer<typeof NoteUpsertSchema>;

/** A persisted note (NoteUpsert + server-assigned id / timestamp). */
export const NoteSchema = NoteUpsertSchema.extend({
  id: z.string(),
  created_at: z.string().optional(),
});
export type Note = z.infer<typeof NoteSchema>;

export async function createNote(body: NoteUpsert, signal?: AbortSignal): Promise<Note> {
  return request<Note>("/notes", { method: "POST", body, signal });
}

export async function getNote(id: string, signal?: AbortSignal): Promise<Note> {
  return request<Note>(`/notes/${encodeURIComponent(id)}`, { signal });
}

export async function updateNote(id: string, body: NoteUpsert, signal?: AbortSignal): Promise<Note> {
  return request<Note>(`/notes/${encodeURIComponent(id)}`, { method: "PUT", body, signal });
}

export async function exportNote(id: string, signal?: AbortSignal): Promise<Note> {
  return request<Note>(`/notes/${encodeURIComponent(id)}/export`, { signal });
}

export async function notesByImage(sha256: string, signal?: AbortSignal): Promise<Note[]> {
  const res = await request<unknown>(`/notes/by-image/${encodeURIComponent(sha256)}`, { signal });
  return Array.isArray(res) ? (res as Note[]) : [];
}

// ---------------------------------------------------------------------------
// Collections — manual, ordered groups of images by sha256, proxied through
// the gateway /collections routes. Membership uses set/replace semantics: PUT
// /collections/{id}/images replaces the whole ordered list.
// ---------------------------------------------------------------------------

/** The writable fields of a collection on create (POST /collections). */
export const CollectionUpsertSchema = z.object({
  name: z.string(),
  /** Ordered image refs by sha256. */
  images: z.array(z.string()).optional(),
});
export type CollectionUpsert = z.infer<typeof CollectionUpsertSchema>;

/** A persisted collection (id + name + ordered image refs). */
export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  images: z.array(z.string()),
});
export type Collection = z.infer<typeof CollectionSchema>;

export async function createCollection(body: CollectionUpsert, signal?: AbortSignal): Promise<Collection> {
  return request<Collection>("/collections", { method: "POST", body, signal });
}

export async function listCollections(signal?: AbortSignal): Promise<Collection[]> {
  const res = await request<unknown>("/collections", { signal });
  return Array.isArray(res) ? (res as Collection[]) : [];
}

export async function getCollection(id: string, signal?: AbortSignal): Promise<Collection> {
  return request<Collection>(`/collections/${encodeURIComponent(id)}`, { signal });
}

/** Rename a collection (PUT /collections/{id} with the new name). */
export async function renameCollection(id: string, name: string, signal?: AbortSignal): Promise<Collection> {
  return request<Collection>(`/collections/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { name },
    signal,
  });
}

export async function deleteCollection(id: string, signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/collections/${encodeURIComponent(id)}`, { method: "DELETE", signal });
}

/**
 * Replace a collection's ordered membership (PUT /collections/{id}/images).
 * Set semantics: `images` is the complete, ordered sha256 list — adds, removes,
 * and reorders are all expressed by sending the desired final list.
 */
export async function setCollectionImages(id: string, images: string[], signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/collections/${encodeURIComponent(id)}/images`, {
    method: "PUT",
    body: { images },
    signal,
  });
}

export async function collectionsByImage(sha256: string, signal?: AbortSignal): Promise<Collection[]> {
  const res = await request<unknown>(`/collections/by-image/${encodeURIComponent(sha256)}`, { signal });
  return Array.isArray(res) ? (res as Collection[]) : [];
}

// ---------------------------------------------------------------------------
// MCP (JSON-RPC) — the gateway's only path for clusters/compare/related-tags/
// lineage/graph. Clusters & compare are STUBBED server-side (return
// { stubbed: true }); callers must handle that gracefully.
// ---------------------------------------------------------------------------

const McpContentItemSchema = z.object({ type: z.string(), text: z.string().optional() });

export const McpToolCallResultSchema = z.object({
  structuredContent: z.unknown().optional(),
  content: z.array(McpContentItemSchema).optional(),
  isError: z.boolean().optional(),
});
export type McpToolCallResult = z.infer<typeof McpToolCallResultSchema>;

const McpRpcResponseSchema = z.object({
  result: McpToolCallResultSchema.optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

/** Raw JSON-RPC pass-through (used by the /api/mcp proxy route). */
export async function mcpRpc(body: unknown, signal?: AbortSignal): Promise<unknown> {
  return request<unknown>("/mcp", { method: "POST", body, signal });
}

let mcpId = 0;

/** Call one MCP tool and return its structuredContent (or throw on tool error). */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<McpToolCallResult> {
  const body = {
    jsonrpc: "2.0",
    id: ++mcpId,
    method: "tools/call",
    params: { name, arguments: args },
  };
  const res = McpRpcResponseSchema.parse(await mcpRpc(body, signal));
  if (res?.error) throw new GatewayError(res.error.message ?? "mcp error", 502, res.error);
  return res?.result ?? {};
}

// ---------------------------------------------------------------------------
// Mappers — adapt gateway/downstream shapes to the UI shapes
// ---------------------------------------------------------------------------

/** Local proxy URL for an image's thumbnail bytes (served by /api/library). The
 * thumbnail doubles as the lightbox preview (~1080-1600px). */
export function thumbnailUrl(sha256: string): string {
  return `/api/library/images/${sha256}/thumbnail`;
}

/** Local proxy URL for an image's small grid-tile bytes (~512px WebP, derived on
 * demand from the thumbnail). Use this for grid cards to avoid downloading the
 * full preview into tiny cells. */
export function gridUrl(sha256: string): string {
  return `/api/library/images/${sha256}/grid`;
}

/** Local proxy URL for an image's full-resolution bytes. */
export function fileUrl(sha256: string): string {
  return `/api/library/images/${sha256}/file`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Build the one-line summary used on result cards from a search payload. */
function summarizePayload(payload: Record<string, unknown> | null | undefined, fallback: string): string {
  if (!payload) return fallback;
  const prompt = str(payload.prompt) ?? str(payload.summary);
  if (prompt) return prompt.replace(/\s+/g, " ").trim().slice(0, 140);
  const tags = stringArray(payload.tags);
  if (tags.length) return tags.slice(0, 8).join(", ");
  return str(payload.filename) ?? fallback;
}

/** Map a deedlit.search hit (payload is the Qdrant payload) -> CompactResult. */
export function hitToCompactResult(hit: SearchHit): CompactResult {
  const p = hit.payload ?? {};
  return {
    imageId: hit.sha256,
    score: typeof hit.score === "number" ? hit.score : null,
    // Prefer a payload-provided URL; otherwise route bytes through the local proxy.
    thumbnailUrl:
      str(p.thumbnail_url) ?? str(p.thumbnailUrl) ?? thumbnailUrl(hit.sha256),
    gridUrl: gridUrl(hit.sha256),
    summary: summarizePayload(p, hit.sha256),
    tags: stringArray(p.tags),
    model: str(p.model) ?? str(p.checkpoint),
    checkpoint: str(p.checkpoint),
    rating: typeof p.rating === "number" ? p.rating : null,
    // Content-safety class (catalog browse forwards the row's `safety`; the
    // vector path carries it in the Qdrant payload). null when unclassified.
    safety:
      p.safety === "sfw" || p.safety === "nsfw" || p.safety === "explicit" ? p.safety : null,
  };
}

export function hitsToCompactResults(hits: SearchHit[]): CompactResult[] {
  return hits.map(hitToCompactResult);
}

function catalogFilePath(image: CatalogImage): string | null {
  return str(image.filepath) ?? str(image.filePath) ?? str(image.file_path);
}

/** Prefer the catalog's stored directory; fall back to deriving the parent dir
 * from the path (separators normalized to '/') for any row not yet backfilled. */
function catalogDirectory(image: CatalogImage, filePath: string | null): string | null {
  return str(image.directory) ?? (filePath ? filePath.replace(/\\/g, "/").replace(/\/[^/]*$/, "") : null);
}

function catalogSummary(image: CatalogImage, tags: string[], filename: string | null): string {
  const prompt = str(image.prompt);
  return (
    (prompt ? prompt.replace(/\s+/g, " ").trim().slice(0, 140) : null) ??
    (tags.length ? tags.slice(0, 8).join(", ") : null) ??
    filename ??
    image.sha256
  );
}

function catalogSafety(image: CatalogImage): CompactResult["safety"] {
  return image.safety === "sfw" || image.safety === "nsfw" || image.safety === "explicit"
    ? image.safety
    : null;
}

/**
 * Map a catalog Image record -> CompactResult for the browse grid. The catalog
 * browse path (filter + server sort + pagination) feeds the same card UI as the
 * vector search path, so the two converge on this shape. `score` is null (browse
 * has no relevance ranking); the summary mirrors {@link summarizePayload}.
 */
export function catalogImageToCompactResult(image: CatalogImage): CompactResult {
  const tags = stringArray(image.tags);
  const filePath = catalogFilePath(image);
  const filename = filePath ? filePath.replace(/^.*[/\\]/, "") : null;
  const checkpoint = refName(image, "checkpoint");
  return {
    imageId: image.sha256,
    score: null,
    thumbnailUrl: thumbnailUrl(image.sha256),
    gridUrl: gridUrl(image.sha256),
    summary: catalogSummary(image, tags, filename),
    tags,
    model: checkpoint ?? str(image.model),
    checkpoint,
    rating: typeof image.rating === "number" ? image.rating : null,
    safety: catalogSafety(image),
    directory: catalogDirectory(image, filePath),
  };
}

/** First reference of a given kind (e.g. checkpoint). */
function refName(image: CatalogImage, kind: string): string | null {
  const ref = (image.references ?? []).find((r) => r.kind === kind);
  return ref ? ref.name : null;
}

function orNull<T>(v: T | null | undefined): T | null {
  return v ?? null;
}

function mapGenerationParams(image: CatalogImage): GenerationParams | null {
  const params = image.params;
  if (!params) return null;
  return {
    seed: orNull(params.seed),
    steps: orNull(params.steps),
    cfgScale: orNull(params.cfg),
    sampler: orNull(params.sampler),
    scheduler: orNull(params.scheduler),
    denoise: orNull(params.denoise),
    width: orNull(params.width),
    height: orNull(params.height),
    clipSkip: orNull(params.clipskip),
  };
}

function mapTags(image: CatalogImage): ImageTag[] {
  return (image.tags ?? []).map((t) => ({
    name: t,
    normalizedName: t,
    source: null,
  }));
}

function mapLoras(image: CatalogImage): LoraRef[] {
  return (image.references ?? [])
    .filter((r) => r.kind === "lora")
    .map((r) => ({ name: r.name, weight: null }));
}

/** Provider recorded by the catalog for the AI description (see catalog
 * repository ``_DESCRIPTION_PROVIDER``). The gateway forwards only the text, so
 * we attribute it to its single known producer here. */
const DESCRIPTION_PROVIDER = "deedlit.labelagent";

/**
 * Map the catalog's persisted AI description into the detail-page list shape.
 * The catalog keeps one current description per provider and the gateway
 * forwards it as a single ``description`` string, so this yields 0 or 1 entry.
 */
function mapDescriptions(image: CatalogImage): UiImageDetail["descriptions"] {
  const description = str(image.description);
  if (!description) return [];
  return [{ id: `${image.sha256}:${DESCRIPTION_PROVIDER}`, description, provider: DESCRIPTION_PROVIDER }];
}

/**
 * The shape the detail page (`app/library/[imageId]/page.tsx`) consumes. This
 * is intentionally a subset of the legacy ImageDetail — only the fields the UI
 * renders — built from the catalog Image record.
 */
const UiImageTagSchema = z.object({
  name: z.string(),
  normalizedName: z.string(),
  source: z.string().nullable().optional(),
});

const UiDescriptionSchema = z.object({
  id: z.string(),
  description: z.string(),
  provider: z.string().nullable(),
});

export const UiImageDetailSchema = z.object({
  id: z.string(),
  filename: z.string(),
  filePath: z.string(),
  prompt: z.string().nullable(),
  negativePrompt: z.string().nullable(),
  rating: z.number().nullable(),
  favorite: z.boolean(),
  model: z.string().nullable(),
  checkpoint: z.string().nullable(),
  modelFamily: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sourceTool: z.string().nullable(),
  tags: z.array(UiImageTagSchema),
  loras: z.array(LoraRefSchema),
  generationParams: GenerationParamsSchema.nullable(),
  descriptions: z.array(UiDescriptionSchema),
});
export type UiImageDetail = z.infer<typeof UiImageDetailSchema>;

function uiFilename(image: CatalogImage, filePath: string): string {
  const basename = filePath ? filePath.replace(/^.*[/\\]/, "") : null;
  return str(image.filename) ?? basename ?? `${image.sha256.slice(0, 12)}…`;
}

function uiModelFamily(image: CatalogImage): string | null {
  return str(image.model_family) ?? str(image.modelFamily);
}

function uiDimension(direct: number | null | undefined, fromParams: number | null | undefined): number | null {
  return direct ?? fromParams ?? null;
}

/** Map the catalog Image record -> the detail-page shape. */
export function imageToUiDetail(image: CatalogImage): UiImageDetail {
  const checkpoint = refName(image, "checkpoint");
  // The catalog serialises the originating on-disk path as `filepath` (one word);
  // keep the camel/snake fallbacks for any other producer. This is captured at
  // ingest and must never be dropped — it's how an image is traced back to source.
  const filePath = catalogFilePath(image) ?? "";
  return {
    id: image.sha256,
    filename: uiFilename(image, filePath),
    filePath,
    prompt: orNull(image.prompt),
    negativePrompt: orNull(image.negative),
    rating: orNull(image.rating),
    favorite: Boolean(image.favorite),
    model: checkpoint ?? str(image.model),
    checkpoint,
    modelFamily: uiModelFamily(image),
    width: uiDimension(image.width, image.params?.width),
    height: uiDimension(image.height, image.params?.height),
    sourceTool: orNull(image.sourceTool),
    tags: mapTags(image),
    loras: mapLoras(image),
    generationParams: mapGenerationParams(image),
    descriptions: mapDescriptions(image),
  };
}

/**
 * Build a relationship Graph (cytoscape shape) for the detail page from the
 * gateway's neighbor list. The gateway returns flat neighbors keyed by sha256;
 * we render the focus image at the centre with one edge per neighbor.
 */
export function neighborsToGraph(focusSha256: string, neighbors: GraphNeighbor[]): Graph {
  const nodes: Graph["nodes"] = [
    { id: focusSha256, label: focusSha256.slice(0, 8), type: "Image", properties: { seed: true, thumbnailUrl: thumbnailUrl(focusSha256) } },
  ];
  const edges: Graph["edges"] = [];
  for (const n of neighbors) {
    nodes.push({
      id: n.sha256,
      label: n.sha256.slice(0, 8),
      type: "Image",
      properties: { thumbnailUrl: thumbnailUrl(n.sha256) },
    });
    edges.push({ from: focusSha256, to: n.sha256, type: n.relation });
  }
  return { nodes, edges };
}

/**
 * Translate the legacy UI filter object (camelCase) into the flat filter the
 * gateway/search expects. Only includes keys with values.
 */
export function buildSearchFilter(filters: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!filters) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
