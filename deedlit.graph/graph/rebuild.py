"""Rebuild the graph projection from the catalog service.

The catalog (env ``CATALOG_URL``, default http://localhost:8001) is the source of
truth. ``rebuild_from_catalog`` reads every image (with its references, tags and
lineage) and re-upserts the edges. The HTTP call is isolated here so tests can
mock it without a running catalog.

Catalog read contract (best-effort, tolerant of shape): ``GET /images`` returns a
list of image objects, each carrying ``sha256``, ``references`` (AssetRef list),
``tags`` (string list), and optionally ``lineage`` ([{parent, kind}]). Pagination
via ``limit``/``offset`` is followed until a short/empty page is returned.
"""
from __future__ import annotations

from typing import cast

import httpx
from pydantic import BaseModel, Field, JsonValue, field_validator

from graph.config import get_config
from graph.models import AssetKind, AssetRef, EdgeUpsert, LineageKind, LineageRef
from graph.repository import ensure_schema, upsert_edges

_PAGE = 200


class RebuildResult(BaseModel):
    images: int
    edges_upserted: int


class _CatalogAssetRef(BaseModel):
    kind: AssetKind
    name: str
    hash: str | None = None


class _CatalogLineageRef(BaseModel):
    parent: str
    kind: LineageKind


class _CatalogImage(BaseModel):
    """One row of the catalog's ``GET /images`` response, tolerant of shape."""

    sha256: str
    references: list[_CatalogAssetRef] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    lineage: list[_CatalogLineageRef] = Field(default_factory=list)

    @field_validator("references", "tags", "lineage", mode="before")
    @classmethod
    def _null_is_empty(cls, value: JsonValue) -> JsonValue:
        # Catalog may send ``null`` for an image with no refs/tags/lineage.
        return value if value is not None else []


class _CatalogPage(BaseModel):
    images: list[JsonValue] = Field(default_factory=list)


def _parse_page(body: JsonValue) -> list[JsonValue]:
    if isinstance(body, list):
        return body
    return _CatalogPage.model_validate(body).images


def _fetch_images(client: httpx.Client, base_url: str) -> list[_CatalogImage]:
    images: list[_CatalogImage] = []
    offset = 0
    while True:
        resp = client.get(
            f"{base_url}/images", params={"limit": _PAGE, "offset": offset}
        )
        resp.raise_for_status()
        # httpx's .json() is untyped (returns Any) — this is the JSON trust
        # boundary, so cast to JsonValue and validate the shape immediately.
        page = _parse_page(cast(JsonValue, resp.json()))
        if not page:
            break
        images.extend(_CatalogImage.model_validate(row) for row in page)
        if len(page) < _PAGE:
            break
        offset += len(page)
    return images


def _to_edge(image: _CatalogImage) -> EdgeUpsert:
    references = [
        AssetRef(kind=r.kind, name=r.name, hash=r.hash) for r in image.references
    ]
    lineage = [
        LineageRef(parent=ln.parent, kind=ln.kind) for ln in image.lineage
    ]
    return EdgeUpsert(
        sha256=image.sha256,
        references=references,
        tags=list(image.tags),
        lineage=lineage,
    )


def rebuild_from_catalog(client: httpx.Client | None = None) -> RebuildResult:
    """Read all images from the catalog and upsert their edges. Returns counts."""
    cfg = get_config()
    own_client = client is None
    client = client or httpx.Client(timeout=30.0)
    try:
        ensure_schema()  # MERGE lookup indexes before the bulk rebuild
        images = _fetch_images(client, cfg.catalog_url)
        upserted = 0
        for image in images:
            upsert_edges(_to_edge(image))
            upserted += 1
        return RebuildResult(images=len(images), edges_upserted=upserted)
    finally:
        if own_client:
            client.close()
