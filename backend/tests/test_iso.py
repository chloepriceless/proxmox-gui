"""Phase 4 Plan 04-05 Task 1 — the ISO / cloud-image library backend.

TDD: written BEFORE the ``app.iso`` module + the two connector ISO-read
methods land — expected to fail (RED) until Task 1 is implemented.

Covers:
- ``connector.list_iso_content`` / ``connector.storages_for_content`` —
  content-type-filtered storage reads (Pitfall 16).
- ``GET /api/v1/clusters/{id}/iso`` — the ISO library across storages.
- ``GET /api/v1/clusters/{id}/iso/cloud-images`` — the curated cloud-image
  list (D-15).
- ``POST /api/v1/clusters/{id}/iso/download`` — a 202 ``storage.download``
  job; rejects a non-http(s) URL scheme 422 (SSRF — V12); open to any
  authenticated user (D-17); cross-tenant → 403.

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync).
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
import sqlalchemy as sa

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import FakeProxmox

_DL_UPID = "UPID:pve-01:0003:000C:65000000:download:storage:gui-team-80@pve:"


# ---------------------------------------------------------------------------
# Connector ISO-read methods
# ---------------------------------------------------------------------------


def _connector(fake: FakeProxmox):
    """Build a PVEConnector wired to the supplied FakeProxmox."""
    from app.clusters.connector import PVEConnector

    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        return PVEConnector(
            host="pve.test", port=8006, token_user="gui-team-80@pve",
            token_name="api", token_value="secret", verify_ssl=False,
        )


@pytest.mark.asyncio
async def test_connector_storages_for_content_filters_by_content() -> None:
    """storages_for_content returns only storages whose content list has the type."""
    storages = [
        {"storage": "local", "type": "dir", "content": "iso,vztmpl,backup"},
        {"storage": "local-lvm", "type": "lvmthin", "content": "images,rootdir"},
        {"storage": "isos", "type": "nfs", "content": "iso"},
    ]
    fake = FakeProxmox(responses={"nodes.pve-01.storage.get": storages})
    conn = _connector(fake)
    conn._resource_cache.snapshot = [{"vmid": 1}]  # a read must NOT clear it
    result = await conn.storages_for_content(node="pve-01", content="iso")
    names = {s["storage"] for s in result}
    assert names == {"local", "isos"}, names
    assert "local-lvm" not in names  # no iso content support (Pitfall 16)
    assert conn._resource_cache.snapshot == [{"vmid": 1}]


@pytest.mark.asyncio
async def test_connector_list_iso_content_enumerates_iso_volumes() -> None:
    """list_iso_content enumerates iso volumes across the node's iso storages."""
    storages = [
        {"storage": "local", "type": "dir", "content": "iso,vztmpl"},
        {"storage": "local-lvm", "type": "lvmthin", "content": "images"},
    ]
    iso_vols = [
        {"volid": "local:iso/debian-12.iso", "size": 700000000,
         "content": "iso", "format": "iso"},
        {"volid": "local:iso/ubuntu-24.iso", "size": 2000000000,
         "content": "iso", "format": "iso"},
    ]
    fake = FakeProxmox(responses={"nodes.pve-01.storage.get": storages})
    fake.queue_response("nodes.pve-01.storage.local.content.get", iso_vols)
    conn = _connector(fake)
    result = await conn.list_iso_content(node="pve-01")
    volids = {row["volid"] for row in result}
    assert volids == {
        "local:iso/debian-12.iso", "local:iso/ubuntu-24.iso",
    }, volids
    # Each row carries a filename derived from the volid + a size.
    for row in result:
        assert row["filename"]
        assert row["size"] > 0
        assert row["storage"] == "local"


# ---------------------------------------------------------------------------
# Test seeding helpers (mirrors test_provisioning.py)
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str | None = None,
):
    from app.models import Cluster, Team, TeamClusterToken

    poolid = poolid or f"gui-team-{team_id}"
    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False,
                    is_active=True)
        session.add(team)
        await session.flush()

        cluster = Cluster(
            name=f"cluster-{team_id}", host="pve-iso.test", port=8006,
            verify_ssl=False, token_user="root@pam", token_name="gui",
            api_token_secret="bootstrap-secret", is_active=True,
        )
        session.add(cluster)
        await session.flush()

        token = TeamClusterToken(
            team_id=team.id, cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve", tokenid="api",
            token_secret=f"team-{team_id}-secret", poolid=poolid,
        )
        session.add(token)
        await session.commit()
        await session.refresh(cluster)
        return cluster.id, team.id, poolid


async def _add_user_to_team(session_factory, *, user_id: int, team_id: int):
    from app.models import TeamMembership

    async with session_factory() as session:
        session.add(TeamMembership(team_id=team_id, user_id=user_id))
        await session.commit()


def _make_fake_for_iso():
    """A FakeProxmox pre-wired for the ISO library + download dispatch."""
    storages = [
        {"storage": "local", "type": "dir", "content": "iso,vztmpl"},
    ]
    iso_vols = [
        {"volid": "local:iso/debian-12.iso", "size": 700000000,
         "content": "iso", "format": "iso"},
    ]
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.storage.get": storages,
            "nodes.pve-01.storage.local.download-url.post": {"data": _DL_UPID},
        }
    )
    # list_iso_content reads the storage list once, then content per storage.
    fake.queue_response("nodes.pve-01.storage.local.content.get", iso_vols)
    return fake


# ---------------------------------------------------------------------------
# GET /clusters/{id}/iso
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_iso_library_lists_isos(client, session_factory) -> None:
    """GET .../iso returns the content-filtered ISO list (Pitfall 16)."""
    user = await make_user(session_factory, username="isolist", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=80,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_iso()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="isolist",
                                 password="testpass12345")
        resp = await client.get(
            f"/api/v1/clusters/{cluster_id}/iso?team_id={team_id}&node=pve-01",
            cookies=cookies,
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "isos" in body
    assert len(body["isos"]) == 1
    row = body["isos"][0]
    assert row["volid"] == "local:iso/debian-12.iso"
    assert row["filename"]
    assert row["storage"] == "local"


@pytest.mark.asyncio
async def test_get_cloud_images_returns_curated_list(
    client, session_factory
) -> None:
    """GET .../iso/cloud-images returns the curated list with url + os family."""
    user = await make_user(session_factory, username="cloudimg", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=81,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="cloudimg",
                             password="testpass12345")
    resp = await client.get(
        f"/api/v1/clusters/{cluster_id}/iso/cloud-images",
        cookies=cookies,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "images" in body
    assert len(body["images"]) >= 3
    for img in body["images"]:
        assert img["url"].startswith("http")
        assert img["os_family"]
        assert img["name"]


# ---------------------------------------------------------------------------
# POST /clusters/{id}/iso/download
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_iso_download_returns_202_with_job(client, session_factory) -> None:
    """POST .../iso/download → 202 + a job id; enqueued kind is storage.download."""
    from app.models import Job

    user = await make_user(session_factory, username="isodl", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=82,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_iso()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="isodl",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/iso/download",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local",
                "content": "iso", "filename": "debian-12.iso",
                "url": "https://cdimage.debian.org/debian-12.iso",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["kind"] == "storage.download"
    assert "job_id" in body

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(Job).where(Job.kind == "storage.download")
        )).scalars().all()
    assert len(rows) == 1
    payload = json.loads(rows[0].payload)
    assert payload["storage"] == "local"
    assert payload["url"] == "https://cdimage.debian.org/debian-12.iso"


@pytest.mark.asyncio
async def test_iso_download_rejects_non_http_url(client, session_factory) -> None:
    """A non-http(s) URL scheme is rejected 422 (SSRF mitigation — V12)."""
    user = await make_user(session_factory, username="isossrf", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=83,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_iso()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="isossrf",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/iso/download",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local",
                "content": "iso", "filename": "evil.iso",
                "url": "file:///etc/passwd",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_iso_download_open_to_any_authenticated_user(
    client, session_factory
) -> None:
    """A non-admin team member can trigger the download (D-17 — not admin-gated)."""
    from app.models import Job

    user = await make_user(session_factory, username="isononadmin",
                           is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=84,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_iso()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="isononadmin",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/iso/download",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local",
                "content": "iso", "filename": "ubuntu-24.iso",
                "url": "https://releases.ubuntu.com/ubuntu-24.iso",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    # 202 — not 403; ISO downloads are open to any authenticated team member.
    assert resp.status_code == 202, resp.text

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(Job).where(Job.kind == "storage.download")
        )).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_iso_download_cross_tenant_returns_403(
    client, session_factory
) -> None:
    """A download for a team the principal does not belong to → 403."""
    user = await make_user(session_factory, username="isoxt", is_admin=False)
    cluster_id, other_team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=85,
    )
    # The user is NOT a member of team 85.

    fake = _make_fake_for_iso()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="isoxt",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/iso/download",
            json={
                "team_id": other_team_id, "node": "pve-01", "storage": "local",
                "content": "iso", "filename": "x.iso",
                "url": "https://example.test/x.iso",
            },
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 403, resp.text


def test_app_boots_with_iso_router() -> None:
    """create_app() succeeds and mounts the iso_download operation."""
    from app.main import create_app

    app = create_app()
    op_ids = {
        route.operation_id
        for route in app.routes
        if getattr(route, "operation_id", None)
    }
    assert "iso_download" in op_ids
    assert "iso_library" in op_ids
    assert "iso_cloud_images" in op_ids


def test_cloud_images_module_has_curated_list() -> None:
    """cloud_images.py exposes at least 3 curated images each with a URL."""
    from app.iso.cloud_images import CURATED_CLOUD_IMAGES

    assert len(CURATED_CLOUD_IMAGES) >= 3
    for img in CURATED_CLOUD_IMAGES:
        assert img["url"].startswith("http")
        assert img["id"] and img["name"] and img["os_family"]
