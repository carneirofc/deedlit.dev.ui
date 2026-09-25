"""Rebuild the Qdrant collection from the catalog service.

This is the ONLY cross-service read the search service performs. It pulls image
records from deedlit.catalog (``GET /images``) and upserts a point per image.

Each catalog item is expected to carry the vectors to index:
  - ``dense``  : list[float] (1024-dim CLIP embedding)
  - ``sparse`` : {indices, values} (optional SPLADE sparse vector)
  - ``payload``: optional extra payload to store alongside the point
Items without a ``dense`` vector are skipped (nothing to index on).

NOTE: this inline-vector rebuild does NOT populate the ``description`` named
vector — the catalog ``/images`` record's ``description`` is the AI *text*, not a
vector. The description vector is (re)built through the ingest DAG rebuild
(REBUILD_SEARCH republishes the embed stages), which embeds the description text
on the GPU and upserts it via ``POST /points``.

The catalog HTTP call is isolated in ``fetch_catalog_images`` so tests can mock
it without requiring a running catalog.
"""
from __future__ import annotations

import httpx
from pydantic import BaseModel, JsonValue, TypeAdapter, field_validator

from search.config import SearchConfig
from search.schemas import SparseVector
from search.store import SearchStore

# Pull the whole catalog in pages so a large library doesn't need one giant call.
PAGE_SIZE = 500


class CatalogImage(BaseModel):
    """One ``GET /images`` record from deedlit.catalog (only the fields this
    service reads; extra catalog fields are ignored)."""

    sha256: str | None = None
    dense: list[float] | None = None
    sparse: SparseVector | None = None
    payload: dict[str, JsonValue] | None = None

    @field_validator("sparse", mode="before")
    @classmethod
    def _empty_sparse_is_none(cls, value: JsonValue) -> JsonValue:
        # Catalog may send ``{}``/``null`` for images without a sparse vector.
        return value or None


_CATALOG_PAGE_ADAPTER: TypeAdapter[list[CatalogImage]] = TypeAdapter(list[CatalogImage])


def fetch_catalog_images(config: SearchConfig) -> list[CatalogImage]:
    """Fetch all image records from the catalog service (paged)."""
    items: list[CatalogImage] = []
    offset = 0
    with httpx.Client(timeout=30.0) as client:
        while True:
            resp = client.get(
                f"{config.catalog_url}/images",
                params={"limit": PAGE_SIZE, "offset": offset},
            )
            resp.raise_for_status()
            page = _CATALOG_PAGE_ADAPTER.validate_json(resp.content)
            if not page:
                break
            items.extend(page)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    return items


def rebuild_from_catalog(store: SearchStore, config: SearchConfig) -> int:
    """Repopulate the collection from the catalog. Returns the count upserted.

    The collection is dropped and recreated so the rebuild is a clean,
    full repopulation (no stale points from a previous schema).
    """
    items = fetch_catalog_images(config)

    store.drop_collection()
    store.ensure_collection()

    upserted = 0
    for item in items:
        if not item.dense or not item.sha256:
            continue
        store.upsert_point(
            sha256=item.sha256,
            dense=item.dense,
            sparse=item.sparse,
            payload=item.payload or {},
        )
        upserted += 1
    return upserted
