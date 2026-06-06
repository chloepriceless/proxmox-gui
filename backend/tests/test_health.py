"""Liveness probe — must report the real package version, not a stale literal."""

import pytest

from app import __version__


@pytest.mark.asyncio
async def test_health_ok(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health_reports_package_version(client):
    """Regression guard: the version is wired to package metadata (D-13 follow-up).

    Previously hardcoded to "0.1.0", which lied about the deployed version. A
    reverted hardcode would no longer equal ``app.__version__``.
    """
    body = (await client.get("/api/v1/health")).json()
    assert body["version"] == __version__
    assert body["version"]  # non-empty
