"""Shared pydantic models for deedlit.ingest's queue payloads and I/O records.

Queue message SHAPES here mirror :mod:`broker`'s publish helpers exactly (same
field names) — other workers/services decode the same JSON, so these must never
change the wire format. Fields are optional at the model level (loose parsing);
callers apply the same "falsy == missing" leniency the old ``dict.get()`` code
used, then raise their own context-specific error.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, JsonValue


class IngestTaskPayload(BaseModel):
    """``ingest`` queue payload: keyed by on-disk path (ADR 0002)."""

    path: str | None = None
    type: str | None = None
    source_folder_id: str | None = None
    parent_op_id: str | None = None


class ShaTaskPayload(BaseModel):
    """Per-stage DAG payload keyed by ``sha256`` (embed.*/index.*/label queues).

    ``path`` is only ever set by ``embed.dense`` (the GPU stage that reads bytes
    off disk directly); every other stage leaves it unset.
    """

    sha256: str | None = None
    type: str | None = None
    parent_op_id: str | None = None
    path: str | None = None


class IngestRuntimeConfig(BaseModel):
    """Effective runtime producer config: env defaults + live overrides (ADR 0002).

    Wire shape of ``GET/PUT /config`` — field names must stay in sync with
    :class:`ConfigPatch`.
    """

    ingest_concurrency: int
    llm_enabled: bool


class ConfigPatch(BaseModel):
    """``PUT /config`` body — partial update of the live producer knobs (ADR 0002).

    Both optional so the settings panel can patch one field; None leaves it
    unchanged. ``ingest_concurrency`` is clamped to >= 1 by the config layer.
    """

    ingest_concurrency: int | None = None
    # Master switch for the vision-LLM (labelagent) enrichment stage.
    llm_enabled: bool | None = None


# ---------------------------------------------------------------------------
# Catalog / metadata record shapes (``pipeline.py`` boundary + fan-out)
#
# These mirror the catalog ImageUpsert / ImageRow contract fields exactly (same
# names) — catalog and the search/graph payloads built from them must never
# change shape. Every field is optional/defaulted so a partial read (e.g.
# ``?fields=light``) or a test's hand-built fixture still validates.
# ---------------------------------------------------------------------------
class AssetRef(BaseModel):
    """One flattened reference row: ``{kind, name, hash}`` (catalog/graph)."""

    kind: str | None = None
    name: str | None = None
    hash: str | None = None


class RefItem(BaseModel):
    """One entry inside a metadata ``References`` bucket (checkpoints/loras/…)."""

    name: str | None = None
    hash: str | None = None


class ReferencesBlock(BaseModel):
    """The metadata ``/extract`` References object, keyed by plural kind."""

    checkpoints: list[RefItem] = Field(default_factory=list)
    loras: list[RefItem] = Field(default_factory=list)
    embeddings: list[RefItem] = Field(default_factory=list)
    vae: list[RefItem] = Field(default_factory=list)
    controlnets: list[RefItem] = Field(default_factory=list)
    upscalers: list[RefItem] = Field(default_factory=list)


class ExtractResult(BaseModel):
    """Parsed view of deedlit.metadata's ``/extract`` response."""

    sourceTool: str | None = None
    prompt: str | None = None
    negative: str | None = None
    tags: list[str] = Field(default_factory=list)
    params: JsonValue = None
    references: ReferencesBlock = Field(default_factory=ReferencesBlock)
    workflow_json: JsonValue = None
    api_prompt_json: JsonValue = None


class DescribeResult(BaseModel):
    """Parsed view of deedlit.labelagent's ``/describe`` response."""

    label: str | None = None
    description: str | None = None
    safety: str | None = None
    tags: list[str] = Field(default_factory=list)


class CatalogImageRow(BaseModel):
    """Parsed (partial) view of a catalog image row/record.

    Backs both the paged ``GET /images`` list rows and the single
    ``GET /images/{sha256}`` read — every field is optional since callers read
    different projections (e.g. ``?fields=light``)."""

    sha256: str | None = None
    filepath: str | None = None
    filename: str | None = None
    directory: str | None = None
    prompt: str | None = None
    description: str | None = None
    safety: str | None = None
    tags: list[str] = Field(default_factory=list)
    references: list[AssetRef] = Field(default_factory=list)


class CatalogImageRecord(BaseModel):
    """The catalog ``ImageUpsert`` record — the source-of-truth row written by
    the ``ingest`` and ``label`` stages. See ``pipeline.build_catalog_record``."""

    sha256: str
    filepath: str | None = None
    createdAt: str | None = None
    phash: str | None = None
    width: int | None = None
    height: int | None = None
    sourceTool: str | None = None
    prompt: str | None = None
    negative: str | None = None
    tags: list[str] = Field(default_factory=list)
    params: JsonValue = None
    references: list[AssetRef] = Field(default_factory=list)
    workflow_json: JsonValue = None
    api_prompt_json: JsonValue = None
    safety: str | None = None
    description: str | None = None


class GraphEdges(BaseModel):
    """``index.graph`` stage payload posted to graph ``POST /edges``."""

    sha256: str
    references: list[AssetRef] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    lineage: list[JsonValue] = Field(default_factory=list)


class MissingFileEntry(BaseModel):
    """One orphaned catalog row: cataloged but its source file is gone."""

    sha256: str
    filepath: str
    filename: str | None = None
    directory: str | None = None


class MissingFilesReport(BaseModel):
    """``GET /maintenance/missing-files`` response (``pipeline.scan_missing_files``)."""

    checked: int
    missing: list[MissingFileEntry]
    missing_count: int
    truncated: bool


class ReconcileImageStatus(BaseModel):
    """One image's per-stage coverage + repair outcome in a reconcile ``report``."""

    dense: bool
    sparse: bool
    in_search: bool
    in_graph: bool
    enqueued: list[str] = Field(default_factory=list)


class ReconcileReport(BaseModel):
    """``Job.report`` for a ``reconcile`` job (drift probe + per-stage repair)."""

    catalog_count: int
    drift: dict[str, list[str]]
    enqueued: dict[str, list[str]]
    repair_strategy: str
    images: dict[str, ReconcileImageStatus]


class SourceFolder(BaseModel):
    """One configured source folder (catalog ``GET /folders`` row)."""

    id: str | None = None
    path: str | None = None
    enabled: bool = False
    last_scan_at: str | None = None
    last_scan_status: str | None = None
    last_scan_job_id: str | None = None
    last_error: str | None = None
    scan_interval_seconds: int | None = None


class SparseVector(BaseModel):
    """SPLADE sparse vector: parallel ``{indices, values}`` arrays (``sparse`` blob)."""

    indices: list[int] = Field(default_factory=list)
    values: list[float] = Field(default_factory=list)


class SearchPointPayload(BaseModel):
    """The ``payload`` object nested inside a search ``UpsertPoint``."""

    sha256: str
    point_id: str
    tags: list[str] = Field(default_factory=list)
    image_url: str
    thumbnail_url: str
    filepath: str | None = None
    description: str | None = None
    safety: str | None = None


class SearchPoint(BaseModel):
    """``index.search`` stage payload posted to search ``POST /points``."""

    sha256: str
    dense: list[float]
    sparse: SparseVector
    payload: SearchPointPayload
    description: list[float] | None = None
