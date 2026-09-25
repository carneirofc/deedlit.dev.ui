"""deedlit.metadata — stateless metadata extraction (no DB).

Exposes ``GET /health`` and ``POST /extract``. ``/extract`` parses embedded PNG
text chunks (A1111 ``parameters`` / ComfyUI node graph) into a typed payload.
Pixel work (sha256/phash/dims/thumbnail) is NOT done here — ingest owns it.
The ``references{}`` field is deferred to #7 (always empty here).
See contracts/metadata.openapi.yaml.
"""
import os

if os.getenv("OTEL_TRACES_EXPORTER"):
    from opentelemetry.instrumentation.auto_instrumentation import initialize as _otel_initialize
    _otel_initialize()
    del _otel_initialize

import logging
from typing import cast

from activity import install_activity
from extract import ExtractResult, interpret_metadata
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from png_metadata import read_embedded_metadata_from_png

# fastapi.File() is typed as returning Any (it's a dependency-injection
# descriptor, not a real UploadFile); cast it to the parameter's declared
# type rather than letting the untyped default leak `Any` into the signature.
_UPLOAD_FILE = cast(UploadFile, File(...))


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

app = FastAPI(title="deedlit.metadata", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
install_activity(app)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = _UPLOAD_FILE) -> ExtractResult:
    image_bytes = await file.read()
    embedded = read_embedded_metadata_from_png(image_bytes)
    metadata = embedded.get("metadata") if isinstance(embedded, dict) else None

    result = interpret_metadata(metadata)
    if result.sourceTool == "unknown":
        raise HTTPException(status_code=422, detail="No recognized image metadata")
    return result
