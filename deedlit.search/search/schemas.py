"""Pydantic DTOs mirroring contracts/search.openapi.yaml."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, JsonValue

SHA256_PATTERN = r"^[a-f0-9]{64}$"

FusionKind = Literal["rrf", "dense", "description", "sparse"]


class SparseVector(BaseModel):
    indices: list[int]
    values: list[float]


class UpsertPoint(BaseModel):
    sha256: str = Field(pattern=SHA256_PATTERN)
    dense: list[float] = Field(description="1024-dim CLIP image vector")
    description: list[float] | None = Field(
        default=None,
        description="1024-dim CLIP text vector of the AI description (optional).",
    )
    sparse: SparseVector | None = None
    payload: dict[str, JsonValue] = Field(default_factory=dict)


class HybridQuery(BaseModel):
    dense: list[float] | None = None
    description: list[float] | None = Field(
        default=None,
        description="CLIP text vector to match against description vectors (optional).",
    )
    sparse: SparseVector | None = None
    limit: int = 24
    # Rank offset into the result, so search paginates over the WHOLE matching set
    # server-side rather than the client slicing a fixed top-K. 0 = the top window.
    offset: int = Field(default=0, ge=0)
    filter: dict[str, JsonValue] | None = None


class SimilarQuery(BaseModel):
    sha256: str = Field(pattern=SHA256_PATTERN)
    limit: int = 24
    # Rank offset into the neighbour list, so similar/by-image can paginate the
    # same way /search does (deeper proximity pages). 0 = the nearest window.
    offset: int = Field(default=0, ge=0)
    # Same payload-filter shape as HybridQuery (e.g. a safety/tag filter). When
    # given it is applied to image-to-image (/by-image, /similar) results too, so
    # the UI's filter holds on by-image search.
    filter: dict[str, JsonValue] | None = None


class BatchDeletePoints(BaseModel):
    """Bulk un-index body: the sha256s whose points to delete in one Qdrant call."""

    sha256s: list[str] = Field(default_factory=list, max_length=1000)


class Hit(BaseModel):
    sha256: str = Field(pattern=SHA256_PATTERN)
    score: float = Field(description="RRF-fused score when hybrid")
    payload: dict[str, JsonValue] | None = None


class QueryResponse(BaseModel):
    fusion: FusionKind
    hits: list[Hit] = Field(default_factory=list)


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    collection_ready: bool | None = None


class PointWriteResponse(BaseModel):
    """Shared response shape for a single-point write (upsert or delete)."""

    status: Literal["ok"] = "ok"
    id: str
    sha256: str


class BatchDeleteResponse(BaseModel):
    status: Literal["ok"] = "ok"
    count: int


class RebuildResponse(BaseModel):
    status: Literal["ok"] = "ok"
    upserted: int
