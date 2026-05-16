"""Phase 4 Plan 04-06 — the community-scripts catalog backend + run_community_script.

TDD: written alongside the catalog module + the ``lxc_exec`` connector method
+ the two-stage ``run_community_script`` job.

Task 1 covers:
- ``GET /clusters/{id}/catalog?view=curated`` — the featured + override
  shortlist (LXC-01).
- ``GET /clusters/{id}/catalog?view=full&q=&category=`` — the searchable full
  catalog (LXC-02).
- Every entry carries ``source_url`` / ``commit_sha`` / ``last_reviewed``
  (LXC-04); ``commit_sha`` equals the active ``CatalogPin.commit_sha``.
- ``POST /catalog/sync`` re-pins the ``catalog_pin`` row (admin); a non-admin
  → 403.
- ``connector.lxc_exec`` issues the spike-confirmed SSH ``pct exec`` and routes
  through ``_call_with_breaker``.
- With no ``CatalogPin`` row the catalog falls back to the vendored
  ``snapshot.json`` floor.

Task 2 covers:
- ``POST .../provisioning/community-script`` → 202 + a job; kind
  ``lxc.community-script``.
- Quota admission runs (rejects 409) BEFORE the VMID is reserved.
- A cross-tenant request → 403.
- ``run_community_script`` is a two-stage job — create the LXC, then
  ``lxc_exec`` the install stage inside it; a stage-2 failure marks the job
  failed but issues NO LXC delete (Pitfall 8).

Proxmox REST is exercised through ``FakeProxmox``; the SSH ``pct exec`` shell-
out is patched at the connector boundary.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_VM, FakeProxmox

_LXC_UPID = "UPID:pve-01:0002:000B:65000000:vzcreate:150:gui-team-90@pve:"
_FLOOR_SHA = "369f9013088f19771a1b95c40ee252fd4c16f91b"

BACKEND_DIR = Path(__file__).resolve().parents[1]
SNAPSHOT_PATH = BACKEND_DIR / "app" / "catalog" / "snapshot.json"


# ===========================================================================
# Vendored snapshot.json floor (Task 1)
# ===========================================================================


def test_snapshot_json_exists_and_parses() -> None:
    """snapshot.json parses, pins a 40-char SHA, and has >=10 entries (D-05)."""
    import re

    assert SNAPSHOT_PATH.exists(), "app/catalog/snapshot.json is missing"
    data = json.loads(SNAPSHOT_PATH.read_text())
    assert re.fullmatch(r"[0-9a-f]{40}", data["commit_sha"]), data["commit_sha"]
    assert data["commit_sha"] == _FLOOR_SHA
    scripts = data["scripts"]
    assert len(scripts) >= 10, f"expected >=10 entries, got {len(scripts)}"
    # A mix of featured / non-featured spanning >=3 categories.
    assert any(s["featured"] for s in scripts)
    assert any(not s["featured"] for s in scripts)
    cats: set[str] = set()
    for s in scripts:
        cats.update(s["categories"])
    assert len(cats) >= 3, cats
    # Every entry carries the spike-confirmed field set.
    for s in scripts:
        for field in ("slug", "name", "description", "categories", "type",
                      "source_url", "install_methods"):
            assert field in s, f"{s.get('slug')} missing {field}"
        assert s["type"] == "lxc"
        assert s["install_methods"][0]["resources"]["os"]


# ===========================================================================
# Catalog service — load / search / curated / attribution (Task 1)
# ===========================================================================


async def _seed_catalog_pin(session_factory, *, commit_sha: str,
                             curated_overrides: str | None = None):
    """Insert a CatalogPin row; return its id."""
    from datetime import datetime

    from app.models import CatalogPin

    async with session_factory() as session:
        pin = CatalogPin(
            commit_sha=commit_sha,
            synced_at=datetime(2026, 5, 16, 12, 0, 0),
            curated_overrides=curated_overrides,
        )
        session.add(pin)
        await session.commit()
        await session.refresh(pin)
        return pin.id


@pytest.mark.asyncio
async def test_load_catalog_falls_back_to_snapshot_floor(session_factory) -> None:
    """With no CatalogPin row, load_catalog uses the vendored snapshot floor."""
    from app.catalog import service

    async with session_factory() as db:
        catalog = await service.load_catalog(db)
    assert catalog.commit_sha == _FLOOR_SHA
    assert len(catalog.entries) >= 10
    # Every entry's commit_sha is the snapshot floor SHA.
    for entry in catalog.entries:
        assert entry.commit_sha == _FLOOR_SHA


@pytest.mark.asyncio
async def test_load_catalog_uses_pin_commit_when_present(session_factory) -> None:
    """When a CatalogPin row exists, the active commit_sha comes from it."""
    from app.catalog import service

    synced_sha = "a" * 40
    await _seed_catalog_pin(session_factory, commit_sha=synced_sha)
    async with session_factory() as db:
        catalog = await service.load_catalog(db)
    assert catalog.commit_sha == synced_sha
    for entry in catalog.entries:
        assert entry.commit_sha == synced_sha


@pytest.mark.asyncio
async def test_search_catalog_filters_by_term_and_category(session_factory) -> None:
    """search_catalog substring-matches name/slug/description + exact category."""
    from app.catalog import service

    async with session_factory() as db:
        # Term-only: 'jelly' matches Jellyfin.
        by_term = await service.search_catalog(db, q="jelly")
        assert {e.slug for e in by_term} == {"jellyfin"}
        # Category-only: 'Media' matches the media apps.
        by_cat = await service.search_catalog(db, category="Media")
        assert "jellyfin" in {e.slug for e in by_cat}
        assert all("Media" in e.categories for e in by_cat)
        # Term + category combined.
        combined = await service.search_catalog(db, q="jelly", category="Media")
        assert {e.slug for e in combined} == {"jellyfin"}
        # Empty q + category returns the full catalog (LXC-02).
        full = await service.search_catalog(db)
        assert len(full) >= 10


@pytest.mark.asyncio
async def test_curated_shortlist_is_featured_plus_overrides(session_factory) -> None:
    """curated_shortlist = featured set merged with the admin curated_overrides."""
    from app.catalog import service

    # No pin → the plain featured set.
    async with session_factory() as db:
        plain = await service.curated_shortlist(db)
    plain_slugs = {e.slug for e in plain}
    assert all(e.featured for e in plain)

    # An override that adds a non-featured slug and removes a featured one.
    overrides = json.dumps({"add": ["grafana"], "remove": ["pihole"]})
    await _seed_catalog_pin(session_factory, commit_sha="b" * 40,
                            curated_overrides=overrides)
    async with session_factory() as db:
        merged = await service.curated_shortlist(db)
    merged_slugs = {e.slug for e in merged}
    assert "grafana" in merged_slugs  # added
    assert "pihole" not in merged_slugs  # removed


@pytest.mark.asyncio
async def test_attribution_carries_source_commit_lastreviewed(
    session_factory,
) -> None:
    """attribution_for returns source_url + commit_sha + last_reviewed (LXC-04)."""
    from app.catalog import service

    async with session_factory() as db:
        attribution = await service.attribution_for("pihole", db)
    assert attribution is not None
    assert attribution["commit_sha"] == _FLOOR_SHA
    assert "github.com" in attribution["source_url"]
    assert attribution["last_reviewed"]


# ===========================================================================
# Catalog routes — GET catalog + GET catalog/{slug} + POST catalog/sync (Task 1)
# ===========================================================================


@pytest.mark.asyncio
async def test_get_catalog_curated_view(client, session_factory) -> None:
    """GET .../catalog?view=curated returns the curated shortlist (LXC-01)."""
    await make_user(session_factory, username="catuser", is_admin=False)
    cookies = await login_as(client, username="catuser",
                             password="testpass12345")
    resp = await client.get(
        "/api/v1/clusters/1/catalog?view=curated", cookies=cookies,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["view"] == "curated"
    assert body["commit_sha"] == _FLOOR_SHA
    assert len(body["entries"]) >= 1
    # Every entry carries the LXC-04 attribution triple.
    for entry in body["entries"]:
        assert entry["source_url"]
        assert entry["commit_sha"] == _FLOOR_SHA
        assert entry["last_reviewed"]
        assert entry["featured"] is True


@pytest.mark.asyncio
async def test_get_catalog_full_view_with_search(client, session_factory) -> None:
    """GET .../catalog?view=full&q=jelly&category=Media filters the full list."""
    await make_user(session_factory, username="catsearch", is_admin=False)
    cookies = await login_as(client, username="catsearch",
                             password="testpass12345")
    resp = await client.get(
        "/api/v1/clusters/1/catalog?view=full&q=jelly&category=Media",
        cookies=cookies,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["view"] == "full"
    slugs = {e["slug"] for e in body["entries"]}
    assert slugs == {"jellyfin"}


@pytest.mark.asyncio
async def test_get_catalog_entry_has_attribution(client, session_factory) -> None:
    """GET .../catalog/{slug} returns the entry + the LXC-04 attribution block."""
    await make_user(session_factory, username="catentry", is_admin=False)
    cookies = await login_as(client, username="catentry",
                             password="testpass12345")
    resp = await client.get(
        "/api/v1/clusters/1/catalog/pihole", cookies=cookies,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["entry"]["slug"] == "pihole"
    assert body["attribution"]["commit_sha"] == _FLOOR_SHA
    assert "github.com" in body["attribution"]["source_url"]


@pytest.mark.asyncio
async def test_catalog_sync_as_admin_repins(client, session_factory) -> None:
    """POST /catalog/sync (admin) pulls a fresher commit and re-pins CatalogPin."""
    from app.models import CatalogPin

    admin = await make_user(session_factory, username="catadmin", is_admin=True)
    cookies = await login_as(client, username="catadmin",
                             password="testpass12345")
    csrf = cookies.get("csrf_token", "")

    new_sha = "c" * 40

    class _FakeResp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"sha": new_sha}

    class _FakeClient:
        def __init__(self, *a, **kw) -> None:  # noqa: ANN002, ANN003
            pass

        async def __aenter__(self) -> _FakeClient:
            return self

        async def __aexit__(self, *exc) -> None:  # noqa: ANN002
            return None

        async def get(self, *a, **kw):  # noqa: ANN002, ANN003
            return _FakeResp()

    with patch("app.catalog.service.httpx.AsyncClient", _FakeClient):
        resp = await client.post(
            "/api/v1/catalog/sync", cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["commit_sha"] == new_sha
    assert body["added"] + body["updated"] == 1

    async with session_factory() as db:
        rows = (await db.execute(sa.select(CatalogPin))).scalars().all()
    assert len(rows) == 1
    assert rows[0].commit_sha == new_sha
    assert rows[0].synced_by_user_id == admin.id


@pytest.mark.asyncio
async def test_catalog_sync_as_non_admin_returns_403(client, session_factory) -> None:
    """POST /catalog/sync as a non-admin → 403 (threat T-04-06-03)."""
    await make_user(session_factory, username="catnoadmin", is_admin=False)
    cookies = await login_as(client, username="catnoadmin",
                             password="testpass12345")
    csrf = cookies.get("csrf_token", "")
    resp = await client.post(
        "/api/v1/catalog/sync", cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 403, resp.text


# ===========================================================================
# Connector lxc_exec (Task 1)
# ===========================================================================


def _connector(fake: FakeProxmox):
    """Build a PVEConnector wired to the supplied FakeProxmox."""
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.test", port=8006, token_user="gui-team-90@pve",
            token_name="api", token_value="secret", verify_ssl=False,
        )


@pytest.mark.asyncio
async def test_connector_lxc_exec_runs_pct_exec_over_ssh() -> None:
    """lxc_exec shells out to the SSH pct exec transport and returns the result."""
    fake = FakeProxmox()
    conn = _connector(fake)
    # Pre-seed a stale cache snapshot — a command-run inside a container is NOT
    # a create; it must NOT clear the resource cache.
    conn._resource_cache.snapshot = [{"vmid": 1}]

    recorded: dict = {}

    def _fake_ssh(*, node, vmid, command, stdin_data, env, on_output, timeout):  # noqa: ANN001
        recorded["node"] = node
        recorded["vmid"] = vmid
        recorded["command"] = command
        return {"exit_code": 0, "output": "install ok\n"}

    with patch.object(conn, "_ssh_pct_exec", side_effect=_fake_ssh):
        result = await conn.lxc_exec(
            node="pve-01", vmid=150, command=["bash", "-c", "echo hi"],
        )
    assert result["exit_code"] == 0
    assert "install ok" in result["output"]
    assert recorded["node"] == "pve-01"
    assert recorded["vmid"] == 150
    # The resource cache is untouched (it is a command-run, not a create).
    assert conn._resource_cache.snapshot == [{"vmid": 1}]


def test_connector_lxc_exec_routes_through_breaker() -> None:
    """lxc_exec's body calls _call_with_breaker — confirmed by static inspection."""
    import inspect

    from app.clusters.connector import PVEConnector

    src = inspect.getsource(PVEConnector.lxc_exec)
    assert "_call_with_breaker" in src
