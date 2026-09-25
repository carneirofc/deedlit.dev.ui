"""Health probe — what Docker HEALTHCHECK + the status dashboard poll."""
from __future__ import annotations

import app as app_module
from fastapi.testclient import TestClient


def test_health_ok():
    with TestClient(app_module.app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"
