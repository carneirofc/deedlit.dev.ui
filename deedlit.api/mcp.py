"""MCP (JSON-RPC 2.0 over HTTP) surface for the deedlit.api gateway.

This is the Python port of the TS MCP server that used to live inside the
Next.js app (``deedlit.dev.comfyhelper/lib/library/mcp/{tools,server}.ts``).

In the monolith each tool called a repository/service that talked to the DB
directly. In the decomposed topology the gateway has NO database, so every tool
DISPATCHES over HTTP to the owning service:

    catalog  -> browse_images (query + paginate by file path), get_image_details,
                get_image (thumbnail bytes), get_library_stats, list_collections,
                get_image_collections, create_collection, set_collection_images,
                list_image_notes
    search   -> search_images, semantic_image_search, find_similar_images
    graph    -> get_image_graph, find_image_lineage, find_related_tags
    ingest   -> ingest_folder, reindex_image, list_jobs, browse_folders
    (multi)  -> get_image_detail (catalog+search+graph), delete_image (all stores)

The surface is meant to be a complete agent-facing API for the library: SEARCH
(text / semantic / similar), RETRIEVAL (canonical metadata, the actual image
bytes, the merged detail view, the relationship graph) and the TASKS an agent
runs against the app (ingest a folder, reindex, monitor jobs, browse the host
filesystem, organise collections, delete an indexed image).

Tool names + argument shapes are kept aligned with the TS MCP so existing MCP
clients keep working. A few tools whose backing service is not yet part of the
decomposition (compare / cluster / external vision) are STUBBED — they return a
structured ``{stubbed: true, reason}`` payload rather than failing the call, and
are documented in the module-level ``STUBBED_TOOLS`` list.

Most tools return a JSON-serialisable object the dispatcher wraps as a single
text block (+ ``structuredContent``). A tool that must emit a different MCP
content type — ``get_image`` returns an ``image`` block — returns a
:class:`ToolContent` so the dispatcher passes its blocks through verbatim.

Each tool validates its raw ``dict[str, JsonValue]`` arguments with a small
pydantic ``*Args`` model instead of ad-hoc ``.get()`` chains (see the "Tool
argument models" section below).

JSON-RPC dispatch (initialize / tools/list / tools/call / ping) mirrors
``server.ts`` so the protocol surface is identical; the wire envelope
(request/response/error) is modelled with pydantic in the "JSON-RPC envelope"
section, but :func:`_ok` / :func:`_err` still hand back plain
``dict[str, JsonValue]`` so the emitted JSON keys/omissions stay byte-identical
to the previous dict-based implementation.
"""
from __future__ import annotations

import asyncio
import base64
import json as jsonlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import cast

import clients
from pydantic import BaseModel, Field, JsonValue

# Blob kinds the catalog stores. Only the thumbnail is viewable image bytes (a
# webp); the original stays on disk (catalog never holds it) and ``embedding``
# is a cached vector, not an image. So image retrieval serves the thumbnail.
_IMAGE_BLOB_KIND = "thumbnail"


@dataclass(frozen=True, slots=True)
class ToolContent:
    """A tool result carrying raw MCP content blocks instead of the default
    JSON-encoded-as-text wrapping.

    ``content`` is the list of MCP content blocks (e.g. an ``image`` block);
    ``structured`` is the optional ``structuredContent`` companion. Returned by
    tools whose output is not plain JSON text — see :func:`_get_image`.
    """

    content: list[dict[str, JsonValue]]
    structured: JsonValue = None


# The value a tool handler may hand back to the dispatcher: opaque JSON, a
# labeled pydantic payload (serialised via model_dump), or raw MCP content
# blocks (see ToolContent).
ToolResult = JsonValue | BaseModel | ToolContent
ToolHandler = Callable[[dict[str, JsonValue]], Awaitable[ToolResult]]

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO: dict[str, JsonValue] = {"name": "comfyhelper-image-library", "version": "0.1.0"}


# ---------------------------------------------------------------------------
# Typed tool payloads (labeled Pydantic models, not ad-hoc dicts) so the agent-
# facing API has a declared, validated shape. A tool may return one of these and
# the dispatcher serialises it; see :func:`_tool_result_payload`.
# ---------------------------------------------------------------------------
class BrowseImagesPage(BaseModel):
    """One offset window of a path/facet browse over the catalog, plus the totals
    an agent needs to page the whole matching set.

    ``results`` are the catalog's own canonical image records (already validated
    by deedlit.catalog — passed through verbatim rather than re-modelled here, the
    gateway being a thin proxy that does not own the image schema)."""

    results: list[dict[str, JsonValue]] = Field(default_factory=list)
    total: int
    limit: int
    offset: int
    has_more: bool

# Tools that have no owning service in the current decomposition and therefore
# return a structured stub instead of dispatching. Documented for the report.
STUBBED_TOOLS = ("compare_images", "find_image_clusters", "describe_image_optional")


# ---------------------------------------------------------------------------
# Tool argument models (validate the raw MCP `arguments` dict per tool, rather
# than ad-hoc `.get()` chains inside each handler).
# ---------------------------------------------------------------------------
class FilterArgs(BaseModel):
    """The library's shared browse/search facets (snake_case, as advertised in
    every tool's inputSchema)."""

    tags: list[str] | None = None
    exclude_tags: list[str] | None = None
    model_family: str | None = None
    checkpoint: str | None = None
    loras: list[str] | None = None
    rating_gte: int | None = None
    favorite: bool | None = None
    safety: list[str] | None = None

    def to_qdrant_filter_dict(self) -> dict[str, JsonValue]:
        """Map the snake_case facets onto the camelCase filter object the
        search service expects (mirrors the TS schema)."""
        out: dict[str, JsonValue] = {}
        if self.tags is not None:
            out["tags"] = cast(list[JsonValue], self.tags)
        if self.exclude_tags is not None:
            out["excludeTags"] = cast(list[JsonValue], self.exclude_tags)
        if self.model_family is not None:
            out["modelFamily"] = self.model_family
        if self.checkpoint is not None:
            out["checkpoint"] = self.checkpoint
        if self.loras is not None:
            out["loras"] = cast(list[JsonValue], self.loras)
        if self.rating_gte is not None:
            out["ratingGte"] = self.rating_gte
        if self.favorite is not None:
            out["favorite"] = self.favorite
        if self.safety is not None:
            out["safety"] = cast(list[JsonValue], self.safety)
        return out


class SearchImagesArgs(FilterArgs):
    """search_images carries its filter fields at the top level (per the TS
    schema), unlike semantic_image_search/find_similar_images which nest them
    under `filters`."""

    query: str = ""
    limit: int = 30


class SemanticSearchArgs(BaseModel):
    query: str
    limit: int = 30
    filters: FilterArgs | None = None


class FindSimilarArgs(BaseModel):
    image_id: str
    # Forwarded as-is (not translated via FilterArgs) — matches the TS schema,
    # which lets the by-image path pass a raw filter object straight through.
    filters: JsonValue = None
    limit: int = 30
    offset: int = 0


class BrowseImagesArgs(BaseModel):
    path: str | None = None
    tags: list[str] | None = None
    exclude_tags: list[str] | None = None
    favorite: bool | None = None
    rating_gte: int | None = None
    safety: list[str] | None = None
    sort: str = "newest"
    limit: int = 50
    offset: int = 0


class ImageIdArgs(BaseModel):
    image_id: str


class ImageGraphArgs(BaseModel):
    image_id: str
    limit: int = 24
    relationship_types: list[str] | None = None


class RelatedTagsArgs(BaseModel):
    tag: str
    limit: int = 20


class FolderPathArgs(BaseModel):
    folder_path: str


class ImageDetailArgs(BaseModel):
    image_id: str
    similar_limit: int = 12
    neighbor_limit: int = 24


class CreateCollectionArgs(BaseModel):
    name: str
    image_ids: list[str] = Field(default_factory=list)


class SetCollectionImagesArgs(BaseModel):
    collection_id: str
    image_ids: list[str]


class BrowseFoldersArgs(BaseModel):
    path: str | None = None


def _hits(res: JsonValue) -> list[JsonValue]:
    """Pull the `hits` array out of a search response, tolerating a missing/
    malformed body (a downstream degrading to `{}` should read as no hits)."""
    hits = res.get("hits") if isinstance(res, dict) else None
    return hits if isinstance(hits, list) else []


# ---------------------------------------------------------------------------
# Tool handlers — each dispatches to a downstream service via clients.py
# ---------------------------------------------------------------------------
async def _search_images(args: dict[str, JsonValue]) -> ToolResult:
    parsed = SearchImagesArgs.model_validate(args)
    res = await clients.search_by_text(parsed.query, parsed.limit, parsed.to_qdrant_filter_dict() or None)
    return {"results": _hits(res)}


async def _semantic_image_search(args: dict[str, JsonValue]) -> ToolResult:
    parsed = SemanticSearchArgs.model_validate(args)
    filters = parsed.filters.to_qdrant_filter_dict() if parsed.filters else None
    res = await clients.search_by_text(parsed.query, parsed.limit, filters or None)
    return {"results": _hits(res)}


def _catalog_browse_params(parsed: BrowseImagesArgs) -> clients.QueryParams:
    """Map the snake_case browse args onto catalog ``GET /images`` query params.

    ``tags``/``exclude_tags``/``safety`` are repeatable params (httpx serialises a
    list value as repeated keys); ``path`` is the separator-insensitive file-path
    substring filter; the rest are scalar facets. Only present values are sent so
    an unspecified facet stays unfiltered.
    """
    params: clients.QueryParams = {"sort": parsed.sort}
    path = (parsed.path or "").strip()
    if path:
        params["path"] = path
    if parsed.tags:
        params["tag"] = parsed.tags
    if parsed.exclude_tags:
        params["exclude_tag"] = parsed.exclude_tags
    if parsed.favorite is not None:
        params["favorite"] = parsed.favorite
    if parsed.rating_gte is not None:
        params["rating_gte"] = parsed.rating_gte
    if parsed.safety:
        params["safety"] = parsed.safety
    return params


async def _browse_images(args: dict[str, JsonValue]) -> ToolResult:
    """Query + paginate cataloged images by on-disk file PATH (and the standard
    browse facets), straight from the catalog source of truth.

    The vector ``search_images`` path can't answer a path/filter-only browse, so
    this dispatches to catalog ``GET /images`` for one offset window AND
    ``GET /images/count`` for the matching total — fetched in parallel — so an
    agent can walk the whole matching set page by page. ``path`` is a
    separator-insensitive substring match on the file path (e.g. ``2024/portraits``
    or ``_upscaled``); ``sort`` is the same whitelist the browse grid uses.
    """
    parsed = BrowseImagesArgs.model_validate(args)
    facets = _catalog_browse_params(parsed)
    rows_r, count_r = await asyncio.gather(
        clients.catalog("GET", "/images", params={**facets, "limit": parsed.limit, "offset": parsed.offset}),
        clients.catalog("GET", "/images/count", params=facets),
        return_exceptions=True,
    )
    if isinstance(rows_r, BaseException):
        raise rows_r
    rows = [row for row in rows_r if isinstance(row, dict)] if isinstance(rows_r, list) else []
    # The count is a sizing aid — degrade to a best-effort estimate if it fails so
    # a transient count error never sinks the page the agent actually asked for.
    count_value = count_r.get("count") if isinstance(count_r, dict) else None
    total = count_value if isinstance(count_value, int) else parsed.offset + len(rows)
    return BrowseImagesPage(
        results=rows,
        total=total,
        limit=parsed.limit,
        offset=parsed.offset,
        has_more=parsed.offset + len(rows) < total,
    )


async def _find_similar_images(args: dict[str, JsonValue]) -> ToolResult:
    # ``filters`` is advertised in this tool's inputSchema; forward it so the
    # by-image (similar) path honours the same safety/tag filter as text search.
    parsed = FindSimilarArgs.model_validate(args)
    res = await clients.search_similar(parsed.image_id, parsed.limit, parsed.filters, parsed.offset)
    return {"results": _hits(res)}


async def _get_image_details(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageIdArgs.model_validate(args)
    return await clients.catalog("GET", f"/images/{parsed.image_id}")


async def _get_image_graph(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageGraphArgs.model_validate(args)
    params: clients.QueryParams = {"limit": parsed.limit}
    if parsed.relationship_types:
        params["relation"] = parsed.relationship_types[0]
    return await clients.graph("GET", f"/neighbors/{parsed.image_id}", params=params)


async def _find_related_tags(args: dict[str, JsonValue]) -> ToolResult:
    parsed = RelatedTagsArgs.model_validate(args)
    related = await clients.graph(
        "GET", f"/related-tags/{parsed.tag}", params={"limit": parsed.limit}
    )
    return {"tag": parsed.tag, "related": related or []}


async def _find_image_lineage(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageIdArgs.model_validate(args)
    return await clients.graph("GET", f"/lineage/{parsed.image_id}")


async def _ingest_folder(args: dict[str, JsonValue]) -> ToolResult:
    parsed = FolderPathArgs.model_validate(args)
    res = await clients.ingest("POST", "/ingest", json={"folderPath": parsed.folder_path})
    res_map = res if isinstance(res, dict) else {}
    return {"job_id": res_map.get("id"), "status": res_map.get("status", "started")}


async def _reindex_image(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageIdArgs.model_validate(args)
    res = await clients.ingest(
        "POST", "/jobs", json={"type": "reindex-one-image", "sha256": parsed.image_id}
    )
    res_map = res if isinstance(res, dict) else {}
    return {"job_id": res_map.get("id"), "status": res_map.get("status", "started")}


# --- retrieval -------------------------------------------------------------
async def _get_image(args: dict[str, JsonValue]) -> ToolResult:
    """Retrieve the actual image bytes (the stored thumbnail) as an MCP image
    block so an agent can SEE the image, not just its metadata."""
    parsed = ImageIdArgs.model_validate(args)
    data, content_type = await clients.request_bytes(
        "catalog", "GET", clients.CATALOG_URL, f"/blobs/{parsed.image_id}/{_IMAGE_BLOB_KIND}"
    )
    encoded = base64.b64encode(data).decode("ascii")
    return ToolContent(
        content=[{"type": "image", "data": encoded, "mimeType": content_type}],
        structured={"image_id": parsed.image_id, "mimeType": content_type, "bytes": len(data)},
    )


async def _get_image_detail(args: dict[str, JsonValue]) -> ToolResult:
    """One-call detail view: canonical metadata + similar images + graph
    neighbors, merged via the same parallel fan-out the REST /detail uses."""
    parsed = ImageDetailArgs.model_validate(args)
    return await clients.image_detail(
        parsed.image_id,
        similar_limit=parsed.similar_limit,
        neighbor_limit=parsed.neighbor_limit,
    )


async def _get_library_stats(_args: dict[str, JsonValue]) -> ToolResult:
    res = await clients.catalog("GET", "/stats")
    return res if isinstance(res, dict) else {}


# --- collections + notes ---------------------------------------------------
async def _list_collections(_args: dict[str, JsonValue]) -> ToolResult:
    res = await clients.catalog("GET", "/collections")
    return {"collections": res if isinstance(res, list) else []}


async def _get_image_collections(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageIdArgs.model_validate(args)
    res = await clients.catalog("GET", f"/collections/by-image/{parsed.image_id}")
    return {"collections": res if isinstance(res, list) else []}


async def _create_collection(args: dict[str, JsonValue]) -> ToolResult:
    parsed = CreateCollectionArgs.model_validate(args)
    body: dict[str, JsonValue] = {"name": parsed.name, "images": cast(list[JsonValue], parsed.image_ids)}
    return await clients.catalog("POST", "/collections", json=body)


async def _set_collection_images(args: dict[str, JsonValue]) -> ToolResult:
    parsed = SetCollectionImagesArgs.model_validate(args)
    images = cast(list[JsonValue], parsed.image_ids)
    await clients.catalog(
        "PUT", f"/collections/{parsed.collection_id}/images", json={"images": images}
    )
    return {"status": "ok", "collection_id": parsed.collection_id, "images": images}


async def _list_image_notes(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageIdArgs.model_validate(args)
    res = await clients.catalog("GET", f"/notes/by-image/{parsed.image_id}")
    return {"notes": res if isinstance(res, list) else []}


# --- maintenance / housekeeping --------------------------------------------
async def _list_jobs(_args: dict[str, JsonValue]) -> ToolResult:
    res = await clients.ingest("GET", "/jobs")
    return {"jobs": res if isinstance(res, list) else []}


async def _browse_folders(args: dict[str, JsonValue]) -> ToolResult:
    """List a directory on the ingest host so an agent can pick a folder to feed
    ``ingest_folder``. Omit ``path`` for the roots view."""
    parsed = BrowseFoldersArgs.model_validate(args)
    params: clients.QueryParams | None = {"path": parsed.path} if parsed.path else None
    return await clients.ingest("GET", "/fs/browse", params=params)


async def _delete_image(args: dict[str, JsonValue]) -> ToolResult:
    parsed = ImageIdArgs.model_validate(args)
    return await clients.unindex_image(parsed.image_id)


def _stub(name: str, reason: str) -> ToolHandler:
    async def handler(_args: dict[str, JsonValue]) -> ToolResult:
        return {"stubbed": True, "tool": name, "reason": reason}

    return handler


# ---------------------------------------------------------------------------
# Tool registry (descriptor + handler per tool)
# ---------------------------------------------------------------------------
class ToolDescriptor(BaseModel):
    """The MCP-visible shape of a tool, as advertised by tools/list."""

    name: str
    description: str
    inputSchema: dict[str, JsonValue]


@dataclass(frozen=True, slots=True)
class Tool:
    """A registered tool: its advertised descriptor plus the handler that
    dispatches a tools/call for it."""

    descriptor: ToolDescriptor
    handler: ToolHandler


def _filter_props() -> dict[str, JsonValue]:
    return {
        "tags": {"type": "array", "items": {"type": "string"}},
        "exclude_tags": {"type": "array", "items": {"type": "string"}},
        "model_family": {"type": "string"},
        "checkpoint": {"type": "string"},
        "loras": {"type": "array", "items": {"type": "string"}},
        "rating_gte": {"type": "integer", "minimum": 0, "maximum": 5},
        "favorite": {"type": "boolean"},
        "safety": {"type": "array", "items": {"type": "string", "enum": ["sfw", "nsfw", "explicit"]}},
    }


MCP_TOOLS: list[Tool] = [
    Tool(
        descriptor=ToolDescriptor(
            name="search_images",
            description="General metadata / hybrid image search across the library.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    **_filter_props(),
                    "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 30},
                },
            },
        ),
        handler=_search_images,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="semantic_image_search",
            description="Natural-language image search (hybrid dense+sparse via deedlit.search).",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "minLength": 1},
                    "filters": {"type": "object", "properties": _filter_props()},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 30},
                },
                "required": ["query"],
            },
        ),
        handler=_semantic_image_search,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="find_similar_images",
            description="Find images visually similar to a selected image.",
            inputSchema={
                "type": "object",
                "properties": {
                    "image_id": {"type": "string", "minLength": 1},
                    "filters": {"type": "object", "properties": _filter_props()},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 30},
                    "offset": {"type": "integer", "minimum": 0, "default": 0},
                },
                "required": ["image_id"],
            },
        ),
        handler=_find_similar_images,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="browse_images",
            description=(
                "Query + paginate the library by on-disk file PATH (and the standard "
                "browse facets) from the catalog source of truth. `path` is a "
                "separator-insensitive substring match on the file path (folder or "
                "filename fragment, e.g. '2024/portraits' or '_upscaled'); page the "
                "whole matching set with `limit`/`offset` (the reply carries `total` "
                "and `has_more`). Use this — not the vector search — when you want to "
                "walk images under a folder."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File-path fragment to match (any separator)."},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "exclude_tags": {"type": "array", "items": {"type": "string"}},
                    "favorite": {"type": "boolean"},
                    "rating_gte": {"type": "integer", "minimum": 0, "maximum": 5},
                    "safety": {"type": "array", "items": {"type": "string", "enum": ["sfw", "nsfw", "explicit"]}},
                    "sort": {
                        "type": "string",
                        "enum": [
                            "newest", "oldest", "created_desc", "created_asc",
                            "rating_desc", "rating_asc", "name_asc", "name_desc",
                        ],
                        "default": "newest",
                    },
                    "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
                    "offset": {"type": "integer", "minimum": 0, "default": 0},
                },
            },
        ),
        handler=_browse_images,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="compare_images",
            description="Compare 2-4 images (metadata diff, shared/unique tags, similarity, combined graph). STUBBED: no owning service in the current decomposition.",
            inputSchema={
                "type": "object",
                "properties": {"image_ids": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 4}},
                "required": ["image_ids"],
            },
        ),
        handler=_stub("compare_images", "compare-service is not part of the decomposed topology yet"),
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="find_image_clusters",
            description="Cluster the library by embedding similarity (Louvain). STUBBED: no owning service in the current decomposition.",
            inputSchema={
                "type": "object",
                "properties": {
                    "filters": {"type": "object", "properties": _filter_props()},
                    "sample": {"type": "integer", "default": 400},
                    "neighbors": {"type": "integer", "default": 6},
                    "threshold": {"type": "number", "default": 0.6},
                    "resolution": {"type": "number", "default": 1},
                },
            },
        ),
        handler=_stub("find_image_clusters", "cluster-service is not part of the decomposed topology yet"),
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="get_image_details",
            description="Return complete canonical metadata for an image (from deedlit.catalog).",
            inputSchema={
                "type": "object",
                "properties": {"image_id": {"type": "string", "minLength": 1}},
                "required": ["image_id"],
            },
        ),
        handler=_get_image_details,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="get_image_graph",
            description="Return the relationship graph (neighbors) around an image (from deedlit.graph).",
            inputSchema={
                "type": "object",
                "properties": {
                    "image_id": {"type": "string", "minLength": 1},
                    "depth": {"type": "integer", "minimum": 1, "maximum": 4, "default": 1},
                    "relationship_types": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["image_id"],
            },
        ),
        handler=_get_image_graph,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="find_related_tags",
            description="Find tags related to a tag via co-occurrence (from deedlit.graph).",
            inputSchema={
                "type": "object",
                "properties": {
                    "tag": {"type": "string", "minLength": 1},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
                },
                "required": ["tag"],
            },
        ),
        handler=_find_related_tags,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="find_image_lineage",
            description="Return original / variant / upscale / inpaint relationships for an image (from deedlit.graph).",
            inputSchema={
                "type": "object",
                "properties": {"image_id": {"type": "string", "minLength": 1}},
                "required": ["image_id"],
            },
        ),
        handler=_find_image_lineage,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="describe_image_optional",
            description="Trigger optional external vision/LLM description. STUBBED: external vision enrichment is not wired into the gateway.",
            inputSchema={
                "type": "object",
                "properties": {
                    "image_id": {"type": "string", "minLength": 1},
                    "mode": {"type": "string", "enum": ["short_caption", "full_description", "tags", "all"], "default": "all"},
                },
                "required": ["image_id"],
            },
        ),
        handler=_stub("describe_image_optional", "external vision enrichment is disabled in the gateway"),
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="ingest_folder",
            description="Trigger ingestion of a local folder (enqueues a deedlit.ingest job). Returns a job id immediately.",
            inputSchema={
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "minLength": 1},
                    "recursive": {"type": "boolean", "default": True},
                    "run_external_enrichment": {"type": "boolean", "default": False},
                    "generate_embeddings": {"type": "boolean", "default": True},
                    "generate_thumbnails": {"type": "boolean", "default": True},
                },
                "required": ["folder_path"],
            },
        ),
        handler=_ingest_folder,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="reindex_image",
            description="Re-extract metadata and refresh graph/vector indexes for an image (enqueues a deedlit.ingest maintenance job).",
            inputSchema={
                "type": "object",
                "properties": {
                    "image_id": {"type": "string", "minLength": 1},
                    "refresh_metadata": {"type": "boolean", "default": True},
                    "refresh_graph": {"type": "boolean", "default": True},
                    "refresh_qdrant": {"type": "boolean", "default": True},
                    "run_external_enrichment": {"type": "boolean", "default": False},
                },
                "required": ["image_id"],
            },
        ),
        handler=_reindex_image,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="get_image",
            description="Retrieve the actual image (the stored thumbnail) as an image block, so the agent can view it — not just its metadata. Originals stay on disk and are not served.",
            inputSchema={
                "type": "object",
                "properties": {"image_id": {"type": "string", "minLength": 1}},
                "required": ["image_id"],
            },
        ),
        handler=_get_image,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="get_image_detail",
            description="One-call detail view for an image: canonical metadata + visually similar images + graph neighbors, merged in a single parallel fan-out (catalog + search + graph).",
            inputSchema={
                "type": "object",
                "properties": {
                    "image_id": {"type": "string", "minLength": 1},
                    "similar_limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 12},
                    "neighbor_limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 24},
                },
                "required": ["image_id"],
            },
        ),
        handler=_get_image_detail,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="get_library_stats",
            description="Return aggregate library counts (images, tags, collections, notes) so the agent can orient itself.",
            inputSchema={"type": "object", "properties": {}},
        ),
        handler=_get_library_stats,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="list_collections",
            description="List all collections in the library (id + name + member images).",
            inputSchema={"type": "object", "properties": {}},
        ),
        handler=_list_collections,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="get_image_collections",
            description="List the collections that contain a given image.",
            inputSchema={
                "type": "object",
                "properties": {"image_id": {"type": "string", "minLength": 1}},
                "required": ["image_id"],
            },
        ),
        handler=_get_image_collections,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="create_collection",
            description="Create a named collection, optionally seeded with an ordered list of image ids.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "minLength": 1},
                    "image_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name"],
            },
        ),
        handler=_create_collection,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="set_collection_images",
            description="Replace a collection's ordered membership with the given image ids (set/replace semantics).",
            inputSchema={
                "type": "object",
                "properties": {
                    "collection_id": {"type": "string", "minLength": 1},
                    "image_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["collection_id", "image_ids"],
            },
        ),
        handler=_set_collection_images,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="list_image_notes",
            description="List the notes attached to an image (read-only; note authoring uses the rich-text editor in the app).",
            inputSchema={
                "type": "object",
                "properties": {"image_id": {"type": "string", "minLength": 1}},
                "required": ["image_id"],
            },
        ),
        handler=_list_image_notes,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="list_jobs",
            description="List ingest / maintenance jobs and their status, so the agent can monitor work it enqueued via ingest_folder or reindex_image.",
            inputSchema={"type": "object", "properties": {}},
        ),
        handler=_list_jobs,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="browse_folders",
            description="List a directory on the ingest host to discover a folder to feed ingest_folder. Omit 'path' for the roots view.",
            inputSchema={
                "type": "object",
                "properties": {"path": {"type": "string"}},
            },
        ),
        handler=_browse_folders,
    ),
    Tool(
        descriptor=ToolDescriptor(
            name="delete_image",
            description="Un-index an image across the stores (catalog record + search vector + graph node). Does NOT delete the source file on disk. Returns per-store outcomes.",
            inputSchema={
                "type": "object",
                "properties": {"image_id": {"type": "string", "minLength": 1}},
                "required": ["image_id"],
            },
        ),
        handler=_delete_image,
    ),
]

_TOOLS_BY_NAME: dict[str, Tool] = {t.descriptor.name: t for t in MCP_TOOLS}


def get_tool(name: str) -> Tool | None:
    return _TOOLS_BY_NAME.get(name)


# ---------------------------------------------------------------------------
# JSON-RPC envelope (request in, response/error out) — modelled with pydantic
# so the shape is declared, but _ok/_err still return plain dicts and omit
# null/absent fields exactly as before, keeping the wire output byte-identical.
# ---------------------------------------------------------------------------
class RpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: JsonValue = None
    method: str | None = None
    params: JsonValue = None


class ToolCallParams(BaseModel):
    name: str = ""
    arguments: JsonValue = None


class RpcErrorBody(BaseModel):
    code: int
    message: str
    data: JsonValue = None


class RpcResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: JsonValue = None
    result: JsonValue = None
    error: RpcErrorBody | None = None

    def to_wire(self) -> dict[str, JsonValue]:
        payload: dict[str, JsonValue] = {"jsonrpc": self.jsonrpc, "id": self.id}
        if self.error is not None:
            error_payload: dict[str, JsonValue] = {"code": self.error.code, "message": self.error.message}
            if self.error.data is not None:
                error_payload["data"] = self.error.data
            payload["error"] = error_payload
        else:
            payload["result"] = self.result
        return payload


def _ok(rpc_id: JsonValue, result: JsonValue) -> dict[str, JsonValue]:
    return RpcResponse(id=rpc_id, result=result).to_wire()


def _err(rpc_id: JsonValue, code: int, message: str, data: JsonValue = None) -> dict[str, JsonValue]:
    return RpcResponse(id=rpc_id, error=RpcErrorBody(code=code, message=message, data=data)).to_wire()


def _tool_list_payload() -> dict[str, JsonValue]:
    return {"tools": [t.descriptor.model_dump(mode="json") for t in MCP_TOOLS]}


def _tool_result_payload(result: ToolResult) -> dict[str, JsonValue]:
    if isinstance(result, ToolContent):
        # Tool emits raw MCP content blocks (e.g. an image) — pass through.
        payload: dict[str, JsonValue] = {"content": cast(list[JsonValue], result.content), "isError": False}
        if result.structured is not None:
            payload["structuredContent"] = result.structured
        return payload
    if isinstance(result, BaseModel):
        # Labeled Pydantic payload -> JSON so _to_text + structuredContent
        # (both plain-JSON serialised downstream) carry its declared shape.
        result = result.model_dump(mode="json")
    return {
        "content": [{"type": "text", "text": _to_text(result)}],
        "structuredContent": result,
        "isError": False,
    }


async def _dispatch_tool_call(rpc_id: JsonValue, params: JsonValue) -> dict[str, JsonValue]:
    call = ToolCallParams.model_validate(params if isinstance(params, dict) else {})
    tool = get_tool(call.name) if call.name else None
    if tool is None:
        return _err(rpc_id, -32602, f"unknown tool: {call.name or '(none)'}")
    arguments = call.arguments if isinstance(call.arguments, dict) else {}
    try:
        result = await tool.handler(arguments)
        return _ok(rpc_id, _tool_result_payload(result))
    except Exception as exc:  # downstream failure / bad args -> tool error
        return _ok(rpc_id, {"content": [{"type": "text", "text": f"Error: {exc}"}], "isError": True})


# ---------------------------------------------------------------------------
# JSON-RPC dispatch (mirrors server.ts)
# ---------------------------------------------------------------------------
async def handle_message(message: JsonValue) -> dict[str, JsonValue] | None:
    """Dispatch one JSON-RPC message. Returns None for notifications (no id)."""
    if not isinstance(message, dict):
        return _err(None, -32600, "invalid request")
    request = RpcRequest.model_validate(message)
    rpc_id = request.id
    method = request.method

    if method == "initialize":
        return _ok(rpc_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": SERVER_INFO,
        })

    if method in ("notifications/initialized", "notifications/cancelled"):
        return None

    if method == "ping":
        return _ok(rpc_id, {})

    if method == "tools/list":
        return _ok(rpc_id, _tool_list_payload())

    if method == "tools/call":
        return await _dispatch_tool_call(rpc_id, request.params)

    return _err(rpc_id, -32601, f"method not found: {method}")


async def handle_body(body: JsonValue) -> JsonValue:
    """Handle a single JSON-RPC message or a batch (list)."""
    if isinstance(body, list):
        responses = [await handle_message(m) for m in body]
        filtered: list[JsonValue] = [r for r in responses if r is not None]
        return filtered or None
    return await handle_message(body)


def _to_text(result: JsonValue) -> str:
    try:
        return jsonlib.dumps(result, indent=2, default=str)
    except (TypeError, ValueError):
        return str(result)
