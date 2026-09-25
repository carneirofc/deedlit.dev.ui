"""deedlit.ingest — stateless ingest/index worker (no DB).

FastAPI worker that owns write/index orchestration (moved out of the Next.js
app). Per-file pipeline computes sha256/phash/dims/WebP-thumbnail, calls
``metadata`` + ``vision`` (dense + sparse), assembles a record, and fans the
writes out DIRECTLY to the owning services — catalog (record + thumbnail blob),
search (point), graph (edges) — catalog-first, per-store retry (#17).

The job model is IN-MEMORY (the service holds no DB driver) with an async
claim/worker loop.

Endpoints (see contracts/ingest.openapi.yaml):
  GET  /health
  GET  /fs/browse?path=   -> directory listing for the admin folder picker
  POST /ingest            {folderPath} -> Job (202)
  POST /jobs              MaintenanceRequest{type, sha256?} -> Job (202)
  GET  /jobs/{id}         -> Job
  POST /jobs/{id}/cancel  -> Job (cancelling)

Maintenance jobs (POST /jobs) reuse the SAME in-memory Job model + async worker
loop as /ingest, so they report progress and are cancellable like a normal
ingest job.
"""
from __future__ import annotations

import os

if os.getenv("OTEL_TRACES_EXPORTER"):
    from opentelemetry.instrumentation.auto_instrumentation import initialize as _otel_initialize
    _otel_initialize()
    del _otel_initialize

import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Literal

import config
import job_ledger
import ledger
import pipeline
import settings_client
from activity import install_activity
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fs_browse import FsBrowseError, FsBrowseResult, browse_directory
from jobs import (
    REINDEX_ONE_IMAGE,
    JobStore,
    folder_scan_scheduler,
    folder_scan_tick_seconds,
    label_backfill_interval_seconds,
    label_backfill_scheduler,
    orphan_prune_interval_seconds,
    orphan_prune_scheduler,
    publish_label_best_effort,
    publish_reproject_best_effort,
    reconcile_interval_seconds,
    reconcile_scheduler,
)
from models import ConfigPatch, IngestRuntimeConfig
from pydantic import BaseModel, JsonValue, model_validator

store = JobStore()


async def _restore_durable_state() -> None:
    """Restore durable state from catalog before serving (best-effort — a cold
    or unreachable catalog must never block startup; both helpers swallow their
    own errors and degrade to empty):
      1. flip any job left queued/running by the previous process to
         interrupted (its in-memory worker is gone),
      2. hydrate the job registry so GET /jobs shows history immediately, and
      3. seed the live producer config with the persisted UI overrides.
    """
    await job_ledger.interrupt_stale()
    loaded = store.hydrate(await job_ledger.list_jobs(limit=200))
    if loaded:
        logging.getLogger("deedlit.ingest.app").info(
            "hydrated %d job(s) from catalog history", loaded
        )
    overrides = await settings_client.load()
    if overrides:
        config.update(overrides)
        logging.getLogger("deedlit.ingest.app").info(
            "loaded persisted ingest config overrides: %s", overrides
        )


def _start_schedulers() -> list[asyncio.Task[None]]:
    """Start the opt-in background schedulers (all disabled unless their
    interval env > 0, so tests never get a surprise scheduler):
      - reconcile sweep (#21)
      - folder scan (per-folder cadence over the configured-folder registry)
      - label backfill (relabel images missing an AI description)
      - graph orphan prune (sweep orphaned Asset/Tag nodes from Neo4j)
    """
    schedulers: list[asyncio.Task[None]] = []
    if reconcile_interval_seconds() > 0:
        schedulers.append(asyncio.create_task(reconcile_scheduler(store)))
    if folder_scan_tick_seconds() > 0:
        schedulers.append(asyncio.create_task(folder_scan_scheduler(store)))
    if label_backfill_interval_seconds() > 0:
        schedulers.append(asyncio.create_task(label_backfill_scheduler(store)))
    if orphan_prune_interval_seconds() > 0:
        schedulers.append(asyncio.create_task(orphan_prune_scheduler(store)))
    return schedulers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    store.start_worker()
    await _restore_durable_state()
    schedulers = _start_schedulers()
    try:
        yield
    finally:
        for task in schedulers:
            task.cancel()
        # Close the shared pooled HTTP clients (best-effort).
        await pipeline.aclose()
        await ledger.aclose()
        await job_ledger.aclose()
        await settings_client.aclose()


# Health probes are polled on a tight interval (Docker HEALTHCHECK + the status
# dashboard), so their access logs drown out everything else. Drop them from
# uvicorn's access log while leaving real traffic intact.
class _HealthAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        # uvicorn.access record args: (client, method, full_path, http_ver, status)
        if isinstance(args, tuple) and len(args) >= 3:
            path = str(args[2])
            return "/health" not in path and "/activity" not in path
        return True


logging.getLogger("uvicorn.access").addFilter(_HealthAccessFilter())

# Surface the ingest pipeline/job debug logs. uvicorn only configures its own
# loggers and leaves the root at WARNING, so without this the per-file/per-step
# `deedlit.ingest.*` logs (the whole point of the ingest trace) are swallowed.
# Attach a handler to the package logger and honour INGEST_LOG_LEVEL (default
# INFO; set DEBUG for per-step pipeline detail). propagate=False avoids
# double-printing through any root handler.
_ingest_logger = logging.getLogger("deedlit.ingest")
if not _ingest_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     [%(name)s] %(message)s"))
    _ingest_logger.addHandler(_handler)
    _ingest_logger.propagate = False
_ingest_logger.setLevel(os.getenv("INGEST_LOG_LEVEL", "INFO").upper())

app = FastAPI(title="deedlit.ingest", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
install_activity(app)


class IngestRequest(BaseModel):
    folderPath: str


class MaintenanceRequest(BaseModel):
    """POST /jobs body (mirrors contracts/ingest.openapi.yaml).

    ``type`` is a closed enum; ``sha256`` is required (and must be 64 lowercase
    hex chars) only for ``reindex-one-image``. ``folderPath`` optionally overrides
    the library root walked by ``rescan-files``.
    """

    type: Literal[
        "reindex-one-image",
        "rescan-files",
        "rebuild-search",
        "rebuild-graph",
        "rebuild-thumbnails",
        "reconcile",
        "label-backfill",
        "prune-graph-orphans",
    ]
    sha256: str | None = None
    folderPath: str | None = None

    @model_validator(mode="after")
    def _check_required(self) -> MaintenanceRequest:
        if self.type == REINDEX_ONE_IMAGE:
            if not self.sha256:
                raise ValueError("sha256 is required for reindex-one-image")
            import re

            if not re.fullmatch(r"[a-f0-9]{64}", self.sha256):
                raise ValueError("sha256 must be 64 lowercase hex characters")
        return self


class ReconcileRequest(BaseModel):
    """POST /reconcile body. ``perImageMax`` overrides the threshold below which
    drift is repaired per-image (targeted reindex) instead of a full rebuild."""

    perImageMax: int | None = None


@app.get("/health")
def health() -> dict[str, JsonValue]:
    return {"status": "ok"}


@app.get("/config")
def get_config() -> IngestRuntimeConfig:
    """Effective runtime producer config (env defaults + live overrides)."""
    return config.runtime()


@app.put("/config")
async def put_config(patch: ConfigPatch) -> IngestRuntimeConfig:
    """Update the live producer config; returns the new effective config.

    Tunes folder-scan parallelism from the settings panel without a restart.
    The effective config is persisted to catalog best-effort so the change
    survives an ingest restart (a persist failure is swallowed — the in-memory
    override still applies this run). Consumer-side parallelism (broker prefetch /
    worker replicas) is deploy-time and not settable here."""
    effective = config.update(patch.model_dump(exclude_none=True))
    await settings_client.save(effective.model_dump())
    return effective


@app.get("/fs/browse")
def fs_browse(path: str | None = Query(default=None)) -> FsBrowseResult:
    """List a directory on the ingest host for the admin folder picker.

    Read-only. Omitting ``path`` returns the synthetic roots view (drives/home/
    cwd). Filesystem errors (missing/denied/not-a-dir) are user-correctable, so
    they surface as 400s the picker shows inline rather than 500s.
    """
    try:
        return browse_directory(path)
    except FsBrowseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/ingest", status_code=202)
def start_ingest(req: IngestRequest) -> JSONResponse:
    # Ensure the worker is running even outside the lifespan (e.g. TestClient
    # contexts that reuse the app); start_worker is idempotent.
    store.start_worker()
    job = store.create_ingest_job(req.folderPath)
    return JSONResponse(status_code=202, content=job.to_dict())


@app.get("/jobs")
def list_jobs() -> list[dict[str, JsonValue]]:
    """List every job (newest first) for the gateway/dashboard.

    The gateway proxies ``GET /jobs`` here; without this route it 405s and the
    UI's job poller silently degrades to an empty list, so ingest progress and
    completion never surface in the activity dock.
    """
    return [job.to_dict() for job in store.list()]


@app.post("/jobs", status_code=202)
def start_maintenance(req: MaintenanceRequest) -> JSONResponse:
    # Idempotent; see start_ingest for why this is called here too.
    store.start_worker()
    job = store.create_maintenance_job(
        req.type, sha256=req.sha256, folder_path=req.folderPath
    )
    return JSONResponse(status_code=202, content=job.to_dict())


@app.post("/reconcile", status_code=202)
def start_reconcile(req: ReconcileRequest) -> JSONResponse:
    """On-demand reconcile sweep (#21): compare catalog coverage vs the search
    and graph projections and repair drift via the rebuild-from-catalog paths.
    Also runnable via POST /jobs {type: reconcile}; see the periodic scheduler."""
    store.start_worker()
    job = store.create_reconcile_job(per_image_max=req.perImageMax)
    return JSONResponse(status_code=202, content=job.to_dict())


class SingleTaskRequest(BaseModel):
    """POST /tasks/{index,label} body — enqueue ONE async task for an image.

    Backs the DB power page's per-image re-index / re-label actions (#30). The
    sha256 must be 64 lowercase hex chars (the cross-service id).
    """

    sha256: str

    @model_validator(mode="after")
    def _check_sha(self) -> SingleTaskRequest:
        import re

        if not re.fullmatch(r"[a-f0-9]{64}", self.sha256):
            raise ValueError("sha256 must be 64 lowercase hex characters")
        return self


@app.post("/tasks/index", status_code=202)
async def enqueue_index_task(req: SingleTaskRequest) -> dict[str, JsonValue]:
    """Re-project one image from catalog truth: publish the per-stage projection
    set (embed.dense + embed.sparse -> index.search, plus index.graph). No relabel."""
    ok = await publish_reproject_best_effort(req.sha256)
    return {"status": "queued" if ok else "publish_failed", "sha256": req.sha256, "type": "reproject"}


@app.post("/tasks/label", status_code=202)
async def enqueue_label_task(req: SingleTaskRequest) -> dict[str, JsonValue]:
    """Publish a single label task for one image (describe -> patch -> re-index)."""
    ok = await publish_label_best_effort(req.sha256)
    return {"status": "queued" if ok else "publish_failed", "sha256": req.sha256, "type": "label"}


@app.get("/maintenance/missing-files")
async def missing_files(limit: int = Query(default=500, ge=0, le=5000)) -> dict[str, JsonValue]:
    """Scan the catalog for images whose on-disk source file has vanished.

    Walks catalog truth and probes ``os.path.exists`` for every record with a
    local filepath (blob-only ``s3://`` fallbacks are skipped). Synchronous so the
    admin can REVIEW the orphaned entries before cleaning them up via the existing
    batch-delete. ``limit`` caps the returned list; the count is exact regardless.
    Read-only — deletes nothing. The blocking catalog paging + stat calls run off
    the event loop.
    """
    report = await asyncio.to_thread(pipeline.scan_missing_files, limit)
    return report.model_dump(mode="json")


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, JsonValue]:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.to_dict()


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict[str, JsonValue]:
    job = store.request_cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job.to_dict()
