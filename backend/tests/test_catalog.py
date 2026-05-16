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


# ===========================================================================
# Community-script create endpoint (Task 2)
# ===========================================================================

_VZCREATE_UPID = "UPID:pve-01:0002:000B:65000000:vzcreate:150:gui-team-90@pve:"
_START_UPID = "UPID:pve-01:0004:000D:65000000:vzstart:150:gui-team-90@pve:"


async def _seed_cluster_and_token(
    session_factory, *, team_id: int, poolid: str | None = None,
):
    """Seed Cluster + Team + TeamClusterToken; return (cluster_id, team_id, poolid)."""
    from app.models import Cluster, Team, TeamClusterToken

    poolid = poolid or f"gui-team-{team_id}"
    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False,
                    is_active=True)
        session.add(team)
        await session.flush()
        cluster = Cluster(
            name=f"cluster-{team_id}", host="pve-cs.test", port=8006,
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


async def _set_team_quota(session_factory, *, team_id, cluster_id, vm_count):
    from app.models import Quota

    async with session_factory() as session:
        session.add(Quota(team_id=team_id, cluster_id=cluster_id,
                           vm_count=vm_count))
        await session.commit()


def _make_fake_for_community_script():
    """A FakeProxmox pre-wired for nextid + the LXC create dispatch."""
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID},
            "cluster.nextid.get": 150,
        }
    )
    # resolve / quota admission read /cluster/resources thrice.
    for _ in range(3):
        fake.queue_response("cluster.resources.get", CLUSTER_RESOURCES_VM)
    return fake


@pytest.mark.asyncio
async def test_community_script_create_returns_202(client, session_factory) -> None:
    """POST .../provisioning/community-script → 202; kind lxc.community-script."""
    from app.models import Job

    user = await make_user(session_factory, username="csuser", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=90,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_community_script()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="csuser",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/community-script",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local",
                "script_slug": "pihole", "hostname": "ct-pihole",
                "cpu_cores": 1, "memory_mb": 512, "disk_gb": 4,
            },
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["kind"] == "lxc.community-script"
    assert body["vmid"] == 150

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(Job).where(Job.kind == "lxc.community-script")
        )).scalars().all()
    assert len(rows) == 1
    payload = json.loads(rows[0].payload)
    assert payload["script_slug"] == "pihole"
    assert payload["commit_sha"] == _FLOOR_SHA


@pytest.mark.asyncio
async def test_community_script_unknown_slug_returns_422(
    client, session_factory
) -> None:
    """An unknown script_slug → 422 (threat T-04-06-01 — slug validated)."""
    user = await make_user(session_factory, username="csbad", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=91,
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_community_script()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="csbad",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/community-script",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local",
                "script_slug": "definitely-not-a-real-script",
                "hostname": "ct-x", "cpu_cores": 1, "memory_mb": 512,
                "disk_gb": 4,
            },
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_community_script_quota_exceeded_returns_409(
    client, session_factory
) -> None:
    """An over-quota community-script create → 409 (admission before reserve)."""
    user = await make_user(session_factory, username="csquota", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=92, poolid="gui-team-42",
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)
    # The fixture pool has 2 VMs; vm_count=2 leaves zero headroom.
    await _set_team_quota(session_factory, team_id=team_id,
                          cluster_id=cluster_id, vm_count=2)

    fake = _make_fake_for_community_script()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="csquota",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/community-script",
            json={
                "team_id": team_id, "node": "pve-01", "storage": "local",
                "script_slug": "pihole", "hostname": "ct-q",
                "cpu_cores": 1, "memory_mb": 512, "disk_gb": 4,
            },
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_community_script_cross_tenant_returns_403(
    client, session_factory
) -> None:
    """A community-script create for a team the principal is not in → 403."""
    await make_user(session_factory, username="csxt", is_admin=False)
    cluster_id, other_team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=93,
    )
    # The user has only their personal team — not team 93.

    fake = _make_fake_for_community_script()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="csxt",
                                 password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/provisioning/community-script",
            json={
                "team_id": other_team_id, "node": "pve-01",
                "storage": "local", "script_slug": "pihole",
                "hostname": "ct-xt", "cpu_cores": 1, "memory_mb": 512,
                "disk_gb": 4,
            },
            cookies=cookies, headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 403, resp.text


# ===========================================================================
# run_community_script two-stage job (Task 2)
# ===========================================================================


def test_run_community_script_is_two_stage() -> None:
    """run_community_script is two-stage — create_lxc then lxc_exec; no delete."""
    import inspect

    from app.jobs import provisioning_functions

    src = inspect.getsource(provisioning_functions.run_community_script)
    assert "create_lxc" in src  # stage 1
    assert "lxc_exec" in src  # stage 2 runs inside the container
    assert "publish_event" in src  # D-08 output streaming
    assert "dispatch_and_poll" in src  # stage 1 is UPID-polled
    # Pitfall 8 — a stage-2 failure must NEVER delete the container.
    assert "vm_delete" not in src
    assert ".delete" not in src
    assert inspect.iscoroutinefunction(
        provisioning_functions.run_community_script
    )


async def _build_worker_ctx(session_factory, connector):
    """Build an arq ``ctx`` dict + a fake registry returning ``connector``."""

    class _FakeRegistry:
        async def get_for_team(self, *, cluster_id, team_id, db=None):  # noqa: ANN001
            return connector

    class _FakeRedis:
        async def publish(self, *a, **kw):  # noqa: ANN002, ANN003
            return None

    return {
        "sessionmaker": session_factory,
        "registry": _FakeRegistry(),
        "redis": _FakeRedis(),
    }


async def _seed_community_script_job(session_factory, *, vmid: int = 150):
    """Insert a pending lxc.community-script Job row; return its id."""
    from app.models import Job

    payload = {
        "node": "pve-01", "vmid": vmid, "is_lxc": True,
        "config": {
            "hostname": "ct-pihole", "cores": 1, "memory": 512,
            "rootfs": "local:4", "unprivileged": 1, "pool": "gui-team-90",
            "ostemplate": "local:vztmpl/debian-12-standard_amd64.tar.zst",
            "net0": "name=eth0,bridge=vmbr0,ip=dhcp",
        },
        "script_slug": "pihole", "script_options": {},
        "commit_sha": _FLOOR_SHA, "application": "Pi-hole",
    }
    async with session_factory() as session:
        job = Job(
            kind="lxc.community-script", cluster_id=1, team_id=90,
            actor_user_id=1, payload=json.dumps(payload),
            idempotency_key=f"cs-{vmid}", state="pending",
        )
        session.add(job)
        await session.commit()
        await session.refresh(job)
        return job.id


@pytest.mark.asyncio
async def test_run_community_script_stage1_creates_then_stage2_execs(
    session_factory,
) -> None:
    """Stage 1 creates the LXC (UPID-polled), stage 2 lxc_execs the install."""
    from app.jobs.provisioning_functions import run_community_script
    from app.jobs.service import get_job

    # FakeProxmox: vzcreate UPID, the task polls stopped/OK, then start.
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID},
            "nodes.pve-01.lxc.150.status.start.post": {"data": _START_UPID},
            "nodes.pve-01.tasks.get": {"status": "stopped", "exitstatus": "OK"},
        }
    )
    # Both the create task and the start task poll the same tasks path.
    fake.queue_response(
        f"nodes.pve-01.tasks.{_VZCREATE_UPID}.status.get",
        {"status": "stopped", "exitstatus": "OK"},
    )
    fake.queue_response(
        f"nodes.pve-01.tasks.{_VZCREATE_UPID}.log.get", [{"n": 1, "t": "done"}],
    )
    conn = _connector(fake)

    lxc_exec_calls: list[dict] = []

    async def _fake_lxc_exec(*, node, vmid, command, **kw):  # noqa: ANN001
        lxc_exec_calls.append({"node": node, "vmid": vmid, "command": command})
        return {"exit_code": 0, "output": "Pi-hole installed\n"}

    conn.lxc_exec = _fake_lxc_exec  # type: ignore[method-assign]

    job_id = await _seed_community_script_job(session_factory, vmid=150)
    ctx = await _build_worker_ctx(session_factory, conn)
    await run_community_script(ctx, job_id)

    # Stage 1 issued the create.
    create_calls = fake.find_calls("nodes.pve-01.lxc.post")
    assert len(create_calls) == 1
    # Stage 2 ran lxc_exec inside the created container (not the host).
    assert len(lxc_exec_calls) == 1
    assert lxc_exec_calls[0]["vmid"] == 150
    # The install command targets the install-stage script at the pinned SHA.
    assert _FLOOR_SHA in " ".join(lxc_exec_calls[0]["command"])

    async with session_factory() as db:
        final = await get_job(db, job_id)
    assert final.state == "succeeded"


@pytest.mark.asyncio
async def test_run_community_script_stage2_failure_keeps_lxc(
    session_factory,
) -> None:
    """A stage-2 install failure marks the job failed but issues NO LXC delete."""
    from app.jobs.provisioning_functions import run_community_script
    from app.jobs.service import get_job

    fake = FakeProxmox(
        responses={
            "nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID},
            "nodes.pve-01.lxc.150.status.start.post": {"data": _START_UPID},
        }
    )
    fake.queue_response(
        f"nodes.pve-01.tasks.{_VZCREATE_UPID}.status.get",
        {"status": "stopped", "exitstatus": "OK"},
    )
    fake.queue_response(
        f"nodes.pve-01.tasks.{_VZCREATE_UPID}.log.get", [{"n": 1, "t": "done"}],
    )
    conn = _connector(fake)

    async def _failing_lxc_exec(*, node, vmid, command, **kw):  # noqa: ANN001
        # The install stage RAN but exited non-zero.
        return {"exit_code": 13, "output": "install error: package missing\n"}

    conn.lxc_exec = _failing_lxc_exec  # type: ignore[method-assign]

    job_id = await _seed_community_script_job(session_factory, vmid=150)
    ctx = await _build_worker_ctx(session_factory, conn)
    await run_community_script(ctx, job_id)

    async with session_factory() as db:
        final = await get_job(db, job_id)
    # The job failed...
    assert final.state == "failed"
    # ...but the container is KEPT — NO delete call was ever issued (Pitfall 8).
    delete_calls = [c for c in fake.calls if c[0].endswith(".delete")]
    assert delete_calls == [], f"a stage-2 failure must NOT delete: {delete_calls}"


@pytest.mark.asyncio
async def test_run_community_script_captures_output_to_audit(
    session_factory,
) -> None:
    """The install output is captured to the audit log (CLAUDE.md #8)."""
    from app.jobs.provisioning_functions import run_community_script
    from app.models import AuditLog

    fake = FakeProxmox(
        responses={
            "nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID},
            "nodes.pve-01.lxc.150.status.start.post": {"data": _START_UPID},
        }
    )
    fake.queue_response(
        f"nodes.pve-01.tasks.{_VZCREATE_UPID}.status.get",
        {"status": "stopped", "exitstatus": "OK"},
    )
    fake.queue_response(
        f"nodes.pve-01.tasks.{_VZCREATE_UPID}.log.get", [{"n": 1, "t": "done"}],
    )
    conn = _connector(fake)

    async def _fake_lxc_exec(*, node, vmid, command, on_output=None, **kw):  # noqa: ANN001
        if on_output is not None:
            on_output("UNIQUE-INSTALL-MARKER line 1\n")
        return {"exit_code": 0, "output": "UNIQUE-INSTALL-MARKER line 1\n"}

    conn.lxc_exec = _fake_lxc_exec  # type: ignore[method-assign]

    job_id = await _seed_community_script_job(session_factory, vmid=150)
    ctx = await _build_worker_ctx(session_factory, conn)
    await run_community_script(ctx, job_id)

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(AuditLog).where(
                AuditLog.action == "lxc.community-script"
            )
        )).scalars().all()
    # The terminal audit row carries the captured install output.
    assert any(
        r.payload_after and "UNIQUE-INSTALL-MARKER" in str(r.payload_after)
        for r in rows
    ), "install output was not captured to the audit log"


def test_worker_registers_community_script_kind() -> None:
    """The worker registers lxc.community-script with max_tries=1."""
    import inspect

    from app.jobs import worker

    src = inspect.getsource(worker)
    assert "func(run_community_script, name='lxc.community-script'" in src
    assert "max_tries=1" in src


# ===========================================================================
# WR-01 — commit_sha + slug validation guards (Plan 04-17)
#
# CLAUDE.md constraint #8 ("Pin to commit hashes"): _build_install_command
# interpolates commit_sha + slug into a raw GitHub URL and a `bash -c` shell
# command. A malformed/malicious value is a supply-chain / path-traversal /
# shell-injection surface; both inputs must be validated against strict
# charsets before they can ever reach interpolation.
# ===========================================================================


def test_validate_commit_sha_accepts_a_real_sha() -> None:
    """A 40-char lowercase hex SHA passes and is returned unchanged."""
    from app.jobs.provisioning_functions import _validate_commit_sha

    assert _validate_commit_sha("a" * 40) == "a" * 40
    assert _validate_commit_sha(_FLOOR_SHA) == _FLOOR_SHA


def test_validate_commit_sha_rejects_uppercase() -> None:
    """An uppercase SHA is rejected — git SHAs are lowercase hex."""
    from app.jobs.provisioning_functions import _validate_commit_sha

    with pytest.raises(ValueError):
        _validate_commit_sha("A" * 40)


def test_validate_commit_sha_rejects_too_short() -> None:
    """A SHA shorter than 40 chars is rejected."""
    from app.jobs.provisioning_functions import _validate_commit_sha

    with pytest.raises(ValueError):
        _validate_commit_sha("abc")


def test_validate_commit_sha_rejects_non_hex() -> None:
    """A 40-char string with a non-hex character is rejected."""
    from app.jobs.provisioning_functions import _validate_commit_sha

    with pytest.raises(ValueError):
        _validate_commit_sha("a" * 39 + "g")


def test_validate_commit_sha_rejects_shell_metacharacters() -> None:
    """A commit_sha carrying shell metacharacters is rejected."""
    from app.jobs.provisioning_functions import _validate_commit_sha

    with pytest.raises(ValueError):
        _validate_commit_sha("369f9013088f19771a1b95c40ee252fd; rm -rf /")


def test_validate_commit_sha_rejects_non_string() -> None:
    """A non-string commit_sha is rejected, not crashed on."""
    from app.jobs.provisioning_functions import _validate_commit_sha

    with pytest.raises(ValueError):
        _validate_commit_sha(None)  # type: ignore[arg-type]


def test_validate_slug_accepts_a_real_slug() -> None:
    """A lowercase-alphanumeric-plus-hyphen slug passes unchanged."""
    from app.jobs.provisioning_functions import _validate_slug

    assert _validate_slug("home-assistant") == "home-assistant"
    assert _validate_slug("plex") == "plex"
    assert _validate_slug("nextcloud") == "nextcloud"


def test_validate_slug_rejects_path_traversal() -> None:
    """A slug carrying `../` path traversal is rejected."""
    from app.jobs.provisioning_functions import _validate_slug

    with pytest.raises(ValueError):
        _validate_slug("../../etc/passwd")


def test_validate_slug_rejects_shell_metacharacters() -> None:
    """A slug carrying shell metacharacters is rejected."""
    from app.jobs.provisioning_functions import _validate_slug

    with pytest.raises(ValueError):
        _validate_slug("plex; curl evil")


def test_validate_slug_rejects_leading_hyphen() -> None:
    """A slug must start with an alphanumeric — a leading hyphen is rejected."""
    from app.jobs.provisioning_functions import _validate_slug

    with pytest.raises(ValueError):
        _validate_slug("-leading-hyphen")


def test_validate_slug_rejects_empty() -> None:
    """An empty slug is rejected."""
    from app.jobs.provisioning_functions import _validate_slug

    with pytest.raises(ValueError):
        _validate_slug("")


def test_build_install_command_rejects_bad_commit_sha() -> None:
    """_build_install_command validates the SHA before building the URL."""
    from app.jobs.provisioning_functions import _build_install_command

    with pytest.raises(ValueError):
        _build_install_command(slug="plex", commit_sha="not-a-sha")


def test_build_install_command_rejects_bad_slug() -> None:
    """_build_install_command validates the slug before building the URL."""
    from app.jobs.provisioning_functions import _build_install_command

    with pytest.raises(ValueError):
        _build_install_command(slug="../evil", commit_sha=_FLOOR_SHA)


async def _seed_community_script_job_with(
    session_factory, *, vmid: int = 151, slug: str = "pihole",
    commit_sha: str = _FLOOR_SHA,
):
    """Insert a pending lxc.community-script Job with the given slug/SHA."""
    from app.models import Job

    payload = {
        "node": "pve-01", "vmid": vmid, "is_lxc": True,
        "config": {
            "hostname": "ct-pihole", "cores": 1, "memory": 512,
            "rootfs": "local:4", "unprivileged": 1, "pool": "gui-team-90",
            "ostemplate": "local:vztmpl/debian-12-standard_amd64.tar.zst",
            "net0": "name=eth0,bridge=vmbr0,ip=dhcp",
        },
        "script_slug": slug, "script_options": {},
        "commit_sha": commit_sha, "application": "Pi-hole",
    }
    async with session_factory() as session:
        job = Job(
            kind="lxc.community-script", cluster_id=1, team_id=90,
            actor_user_id=1, payload=json.dumps(payload),
            idempotency_key=f"cs-bad-{vmid}", state="pending",
        )
        session.add(job)
        await session.commit()
        await session.refresh(job)
        return job.id


@pytest.mark.asyncio
async def test_run_community_script_malformed_commit_sha_fails_fast(
    session_factory,
) -> None:
    """A malformed commit_sha fails the job fast — no LXC create dispatched."""
    from app.jobs.provisioning_functions import run_community_script
    from app.jobs.service import get_job

    fake = FakeProxmox(
        responses={"nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID}}
    )
    conn = _connector(fake)
    job_id = await _seed_community_script_job_with(
        session_factory, vmid=161, commit_sha="not-a-real-sha",
    )
    ctx = await _build_worker_ctx(session_factory, conn)
    await run_community_script(ctx, job_id)

    async with session_factory() as db:
        final = await get_job(db, job_id)
    # The job failed with an explanatory friendly message...
    assert final.state == "failed"
    assert final.friendly_error and "commit" in final.friendly_error.lower()
    # ...and stage 1 (the LXC create) was NEVER dispatched.
    assert fake.find_calls("nodes.pve-01.lxc.post") == []


@pytest.mark.asyncio
async def test_run_community_script_malformed_slug_fails_fast(
    session_factory,
) -> None:
    """A malformed slug fails the job fast — no LXC create dispatched."""
    from app.jobs.provisioning_functions import run_community_script
    from app.jobs.service import get_job

    fake = FakeProxmox(
        responses={"nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID}}
    )
    conn = _connector(fake)
    job_id = await _seed_community_script_job_with(
        session_factory, vmid=162, slug="../../etc/passwd",
    )
    ctx = await _build_worker_ctx(session_factory, conn)
    await run_community_script(ctx, job_id)

    async with session_factory() as db:
        final = await get_job(db, job_id)
    assert final.state == "failed"
    assert final.friendly_error and "slug" in final.friendly_error.lower()
    assert fake.find_calls("nodes.pve-01.lxc.post") == []


@pytest.mark.asyncio
async def test_run_community_script_malformed_input_is_audited(
    session_factory,
) -> None:
    """A fail-fast rejection is recorded to the audit log (threat T-04-17-04)."""
    from app.jobs.provisioning_functions import run_community_script
    from app.models import AuditLog

    fake = FakeProxmox(
        responses={"nodes.pve-01.lxc.post": {"data": _VZCREATE_UPID}}
    )
    conn = _connector(fake)
    job_id = await _seed_community_script_job_with(
        session_factory, vmid=163, slug="plex; curl evil",
    )
    ctx = await _build_worker_ctx(session_factory, conn)
    await run_community_script(ctx, job_id)

    async with session_factory() as db:
        rows = (await db.execute(
            sa.select(AuditLog).where(
                AuditLog.action == "lxc.community-script"
            )
        )).scalars().all()
    assert any(r.result == "failure" for r in rows), (
        "the rejected malformed-input job was not audited"
    )
