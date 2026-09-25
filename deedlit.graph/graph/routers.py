"""FastAPI routes for deedlit.graph (see contracts/graph.openapi.yaml)."""
from __future__ import annotations

import asyncio
import os

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from graph import repository
from graph.models import (
    EdgeUpsert,
    EdgeUpsertResult,
    NeighborResponse,
    PruneResponse,
    RelatedTag,
    StatusDeletedResponse,
)
from graph.rebuild import RebuildResult, rebuild_from_catalog

router = APIRouter()


class BatchDeleteRequest(BaseModel):
    """Bulk un-index body: the sha256s whose nodes to remove in one Cypher call."""

    sha256s: list[str] = Field(default_factory=list, max_length=1000)


# --- /edges micro-batcher -------------------------------------------------
# The index.graph worker pool POSTs /edges one per image; each upsert_edges was
# its own Neo4j write transaction (MERGE storms), which floods Neo4j during bulk
# ingest / rebuild / reconcile and starves the read queries the UI makes
# (neighbors / lineage / related-tags). The batcher coalesces concurrent /edges
# calls arriving within a short window into ONE transaction (repository
# .upsert_edges_batch, UNWIND over the batch). Each caller still awaits its flush,
# so read-after-write holds. Mirrors deedlit.search's /points micro-batcher.
#   GRAPH_EDGES_BATCH_MAX:     max images per Neo4j write transaction.
#   GRAPH_EDGES_BATCH_WAIT_MS: how long the first waiter accumulates a batch.
EDGES_BATCH_MAX = max(1, int(os.getenv("GRAPH_EDGES_BATCH_MAX", "64")))
EDGES_BATCH_WAIT_MS = max(0.0, float(os.getenv("GRAPH_EDGES_BATCH_WAIT_MS", "10")))

_EdgeJob = tuple[EdgeUpsert, "asyncio.Future[EdgeUpsertResult]"]

# Loop-bound (recreated if the running loop changes, e.g. across TestClient
# requests) so a Future is never awaited on a foreign loop.
_edges_queue: asyncio.Queue[_EdgeJob] | None = None
_edges_task: asyncio.Task[None] | None = None
_edges_loop: asyncio.AbstractEventLoop | None = None


async def _accumulate_batch(queue: asyncio.Queue[_EdgeJob], first: _EdgeJob) -> list[_EdgeJob]:
    """Collect ``first`` plus whatever else arrives on ``queue`` within the
    coalescing window, up to ``EDGES_BATCH_MAX``."""
    loop = asyncio.get_running_loop()
    batch = [first]
    deadline = loop.time() + EDGES_BATCH_WAIT_MS / 1000.0
    while len(batch) < EDGES_BATCH_MAX:
        remaining = deadline - loop.time()
        if remaining <= 0:
            break
        try:
            batch.append(await asyncio.wait_for(queue.get(), remaining))
        except TimeoutError:
            break
    return batch


def _flush_batch(edges: list[EdgeUpsert]) -> list[EdgeUpsertResult]:
    return repository.upsert_edges_batch(edges)


async def _resolve_batch(batch: list[_EdgeJob]) -> None:
    """Flush ``batch`` in one Neo4j write tx and resolve each waiter's future."""
    edges = [e for e, _ in batch]
    try:
        results = await asyncio.to_thread(_flush_batch, edges)
        # Map results back by sha256 (order-independent + handles a duplicate
        # image queued twice within the window — both waiters get its result).
        by_sha = {r.sha256: r for r in results}
        for e, f in batch:
            if not f.done():
                f.set_result(
                    by_sha.get(
                        e.sha256,
                        EdgeUpsertResult(sha256=e.sha256, assets=0, tags=0, lineage=0),
                    )
                )
    except Exception as exc:  # propagate the same failure to every waiter
        for _, f in batch:
            if not f.done():
                f.set_exception(exc)


async def _edges_batch_loop(queue: asyncio.Queue[_EdgeJob]) -> None:
    """Drain ``queue`` forever, flushing each coalesced batch in one Neo4j tx."""
    while True:
        job = await queue.get()
        batch = await _accumulate_batch(queue, job)
        await _resolve_batch(batch)


def _get_edges_queue() -> asyncio.Queue[_EdgeJob]:
    """Return (lazily creating) the per-loop edges queue + its drain task."""
    global _edges_queue, _edges_task, _edges_loop
    loop = asyncio.get_running_loop()
    if _edges_queue is None or _edges_loop is not loop:
        _edges_queue = asyncio.Queue()
        _edges_loop = loop
        _edges_task = loop.create_task(_edges_batch_loop(_edges_queue))
    return _edges_queue


@router.post("/edges")
async def post_edges(edge: EdgeUpsert) -> EdgeUpsertResult:
    """Upsert one image's edges — coalesced with concurrent calls into one Neo4j
    write transaction by the micro-batcher. Awaits its flush (read-after-write)."""
    fut: asyncio.Future[EdgeUpsertResult] = asyncio.get_running_loop().create_future()
    await _get_edges_queue().put((edge, fut))
    return await fut


@router.post("/images/batch-delete")
def batch_delete_images(body: BatchDeleteRequest) -> StatusDeletedResponse:
    """Delete MANY image nodes + edges in one query (bulk un-index). Idempotent.

    Called by the gateway after the catalog records are gone. Missing nodes are a
    no-op. Returns the count of nodes removed."""
    deleted = repository.delete_images(body.sha256s)
    return StatusDeletedResponse(status="ok", deleted=deleted)


@router.delete("/images/{sha256}")
def delete_image(sha256: str) -> StatusDeletedResponse:
    """Delete an image node + its edges from the graph projection. Idempotent.

    Returns ``{deleted: <count>}`` (0 when the node was not present). A missing
    node is not an error — the graph is a rebuildable projection, so the gateway
    treats this as best-effort cleanup once the catalog record is gone.
    """
    deleted = repository.delete_image(sha256)
    return StatusDeletedResponse(status="ok", deleted=deleted)


@router.get("/neighbors/{sha256}", response_model=NeighborResponse)
def get_neighbors(
    sha256: str,
    relation: str = Query("any", pattern="^(shared_asset|tag_cooccurrence|any)$"),
    limit: int = Query(24, ge=1, le=200),
) -> NeighborResponse:
    rows = repository.neighbors(sha256, relation=relation, limit=limit)
    return NeighborResponse(neighbors=rows)


@router.get("/lineage/{sha256}", response_model=NeighborResponse)
def get_lineage(sha256: str) -> NeighborResponse:
    rows = repository.lineage(sha256)
    return NeighborResponse(neighbors=rows)


@router.get("/related-tags/{tag}", response_model=list[RelatedTag])
def get_related_tags(
    tag: str, limit: int = Query(24, ge=1, le=200)
) -> list[RelatedTag]:
    return repository.related_tags(tag, limit=limit)


@router.get("/entities", response_model=list[str])
def list_entities(
    type: str = Query(..., description="tag | checkpoint | lora | embedding | vae | controlnet | upscaler"),
    prefix: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[str]:
    """Distinct entity names of ``type`` matching ``prefix``, most-used first.

    Backs the graph-filter value autocomplete: ``type=tag`` lists :Tag names,
    any other value lists :Asset names of that ``kind``. Empty prefix returns the
    most-used entities of the type."""
    return repository.suggest_entities(type, prefix=prefix, limit=limit)


@router.post("/rebuild", status_code=202)
def post_rebuild() -> RebuildResult:
    return rebuild_from_catalog()


class PruneRequest(BaseModel):
    """POST /prune body. ``dry_run`` reports the counts that WOULD be removed
    without deleting (admin "preview impact"); default runs the deletion."""

    dry_run: bool = False


@router.post("/prune")
def post_prune(body: PruneRequest | None = None) -> PruneResponse:
    """Remove structurally-orphaned :Asset / :Tag nodes (no incoming USES /
    TAGGED) left behind by image deletes. Idempotent. :Image nodes are never
    touched — reconciling them against catalog truth is the rebuild path.

    Backs the on-demand admin "Prune graph orphans" action, the ingest
    ``prune-graph-orphans`` maintenance job, and the opt-in periodic sweep.
    With ``dry_run`` it only counts, for a preview before the real run."""
    result = repository.prune_orphans(dry_run=(body.dry_run if body else False))
    return PruneResponse(
        status="ok",
        assets_deleted=result.assets_deleted,
        tags_deleted=result.tags_deleted,
        dry_run=result.dry_run,
    )
