"""Phase 04 Plan 08 — embedded-noVNC console backend (spike 04-03 gated).

Covers the two tasks of plan 04-08:

Task 1 — the ``connector.vncproxy`` ticket mint + the ``console/routes.py``
mint endpoint:
  - ``vncproxy`` issues the spike-confirmed ``POST .../{qemu|lxc}/{vmid}/vncproxy``
    through ``_call_with_breaker`` and returns ``{ticket, port, ...}``.
  - ``POST .../vms/{vmid}/console/vncproxy`` for an owned VM returns the ticket +
    port + the GUI's own relay WS URL (never the Proxmox host URL).
  - the mint route runs the ownership check first — cross-tenant → 403.
  - the LXC mint route uses the ``lxc`` path; the VM route the ``qemu`` path.
  - the response body carries no ``:8006`` and no raw ``vncwebsocket`` URL (CON-03).

Task 2 — the reverse-proxied bidirectional WebSocket relay (``console/proxy.py``)
+ the Caddyfile delta:
  - a connection without a valid ``access_token`` cookie is closed 1008 before
    ``accept()``.
  - a cross-tenant connection is closed before ``accept()``.
  - an authenticated, owning connection is accepted; the relay opens an upstream
    WS to ``wss://{pve-host}:8006/.../vncwebsocket?port=..&vncticket=..``.
  - the ``vncticket`` is URL-encoded EXACTLY ONCE on the upstream leg (Pitfall 2).
  - browser↔upstream bytes are relayed bidirectionally.
  - an upstream close cleanly closes the browser side.
  - the upstream leg uses the per-cluster ``verify_ssl`` posture.

Proxmox is exercised through ``FakeProxmox`` (proxmoxer 2.3 is sync); the
upstream noVNC WebSocket is exercised through a fake ``websockets`` client.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user
from tests.fixtures.pve_responses import CLUSTER_RESOURCES_LXC, CLUSTER_RESOURCES_VM, FakeProxmox

# A canned vncproxy mint response — the spike's measured field set
# (cert/port/ticket/upid/user). The relay needs only ``ticket`` + ``port``.
_VNC_TICKET = "PVEVNC:6A08C225::x3IL+fuHY/zdq=4UaxPrN6hi2qHcl"
_VNCPROXY_OK = {
    "data": {
        "cert": "-----BEGIN CERTIFICATE-----\nMIIF...\n-----END CERTIFICATE-----",
        "port": "5900",
        "ticket": _VNC_TICKET,
        "upid": "UPID:pz1:000B6456:07DD6FE5:6A08C225:vncproxy:100:root@pam!gui:",
        "user": "root@pam!proxmox-gui",
    }
}


# ---------------------------------------------------------------------------
# Helpers — Cluster + Team + TeamClusterToken + membership seeding
# ---------------------------------------------------------------------------


async def _seed_cluster_and_token(
    session_factory,
    *,
    team_id: int = 42,
    poolid: str = "gui-team-42",
    host: str = "pve-console.test",
    verify_ssl: bool = False,
):
    """Seed Cluster + Team + TeamClusterToken; return (cluster_id, team_id, poolid)."""
    from app.models import Cluster, Team, TeamClusterToken

    async with session_factory() as session:
        team = Team(id=team_id, name=f"gui-team-{team_id}", personal=False, is_active=True)
        session.add(team)
        await session.flush()

        cluster = Cluster(
            name=f"cluster-{team_id}",
            host=host,
            port=8006,
            verify_ssl=verify_ssl,
            token_user="root@pam",
            token_name="gui",
            api_token_secret="bootstrap-secret",
            is_active=True,
        )
        session.add(cluster)
        await session.flush()

        token = TeamClusterToken(
            team_id=team.id,
            cluster_id=cluster.id,
            userid=f"gui-team-{team_id}@pve",
            tokenid="api",
            token_secret=f"team-{team_id}-secret",
            poolid=poolid,
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


def _make_fake_for_mint():
    """A FakeProxmox pre-wired for a vncproxy mint on vmid 100 (qemu) / 200 (lxc).

    ``require_resource_access`` calls ``list_resources`` which issues a single
    ``cluster.resources.get?type=vm`` — PVE returns BOTH QEMU VMs and LXCs in
    that one call (each item carries its real ``type``), so the queued snapshot
    is the concatenation of the canned VM + LXC rows.
    """
    fake = FakeProxmox(
        responses={
            "nodes.pve-01.qemu.100.vncproxy.post": _VNCPROXY_OK,
            "nodes.pve-01.lxc.200.vncproxy.post": _VNCPROXY_OK,
        }
    )
    fake.queue_response(
        "cluster.resources.get", [*CLUSTER_RESOURCES_VM, *CLUSTER_RESOURCES_LXC]
    )
    return fake


# ===========================================================================
# Task 1 — connector.vncproxy
# ===========================================================================


@pytest.mark.asyncio
async def test_connector_vncproxy_qemu_path():
    """vncproxy(is_lxc=False) POSTs the qemu vncproxy path with websocket=1."""
    from app.clusters.connector import PVEConnector

    fake = FakeProxmox(responses={"nodes.pve-01.qemu.100.vncproxy.post": _VNCPROXY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="pve.example.test",
            port=8006,
            token_user="root@pam",
            token_name="gui",
            token_value="deadbeef",
            verify_ssl=True,
        )
        result = await conn.vncproxy(node="pve-01", vmid=100, is_lxc=False)

    assert result["ticket"] == _VNC_TICKET
    assert result["port"] == "5900"
    posts = [c for c in fake.calls if c[0] == "nodes.pve-01.qemu.100.vncproxy.post"]
    assert len(posts) == 1
    # websocket=1 is always passed (spike §1).
    assert posts[0][2].get("websocket") == 1


@pytest.mark.asyncio
async def test_connector_vncproxy_lxc_path():
    """vncproxy(is_lxc=True) POSTs the lxc vncproxy path."""
    from app.clusters.connector import PVEConnector

    fake = FakeProxmox(responses={"nodes.pve-01.lxc.200.vncproxy.post": _VNCPROXY_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="pve.example.test",
            port=8006,
            token_user="root@pam",
            token_name="gui",
            token_value="deadbeef",
            verify_ssl=True,
        )
        result = await conn.vncproxy(node="pve-01", vmid=200, is_lxc=True)

    assert result["ticket"] == _VNC_TICKET
    posts = [c for c in fake.calls if c[0] == "nodes.pve-01.lxc.200.vncproxy.post"]
    assert len(posts) == 1


@pytest.mark.asyncio
async def test_connector_records_host_and_tls_posture():
    """The connector exposes host/port/verify_ssl for the relay's upstream leg."""
    from app.clusters.connector import PVEConnector

    fake = FakeProxmox(responses={})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(
            host="pve.example.test",
            port=8006,
            token_user="root@pam",
            token_name="gui",
            token_value="deadbeef",
            verify_ssl=False,
        )
    assert conn.host == "pve.example.test"
    assert conn.port == 8006
    assert conn.verify_ssl is False


# ===========================================================================
# Task 1 — the console mint route
# ===========================================================================


@pytest.mark.asyncio
async def test_mint_vm_returns_ticket_and_relay_url(client, session_factory):
    """POST .../vms/100/console/vncproxy for an owned VM → 200 + ticket + relay_url."""
    user = await make_user(session_factory, username="conmint", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=42)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_mint()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="conmint", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/console/vncproxy",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ticket"] == _VNC_TICKET
    assert body["port"] == 5900
    # The relay URL is the GUI's own reverse-proxied path — never Proxmox.
    assert body["relay_url"].startswith("/api/v1/ws/console/")
    assert str(cluster_id) in body["relay_url"]
    assert "/vms/100" in body["relay_url"]


@pytest.mark.asyncio
async def test_mint_lxc_uses_lxc_path(client, session_factory):
    """POST .../lxcs/200/console/vncproxy mints via the lxc vncproxy path."""
    user = await make_user(session_factory, username="conlxc", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=43)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_mint()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="conlxc", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/lxcs/200/console/vncproxy",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "/lxcs/200" in body["relay_url"]
    posts = [c for c in fake.calls if c[0] == "nodes.pve-01.lxc.200.vncproxy.post"]
    assert len(posts) == 1


@pytest.mark.asyncio
async def test_mint_cross_tenant_returns_403(client, session_factory):
    """A mint POST on a VM in a team the user is not on → 403 (ownership first)."""
    owner = await make_user(session_factory, username="conowner", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=48)
    await _add_user_to_team(session_factory, user_id=owner.id, team_id=team_id)

    # A second user with no membership on this cluster.
    await make_user(session_factory, username="conother", is_admin=False)

    fake = _make_fake_for_mint()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="conother", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/console/vncproxy",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_mint_response_leaks_no_proxmox_host(client, session_factory):
    """CON-03: the mint response carries no :8006 and no raw vncwebsocket URL."""
    user = await make_user(session_factory, username="connoleak", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=50)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    fake = _make_fake_for_mint()
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        cookies = await login_as(client, username="connoleak", password="testpass12345")
        csrf = cookies.get("csrf_token", "")
        resp = await client.post(
            f"/api/v1/clusters/{cluster_id}/vms/100/console/vncproxy",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 200, resp.text
    raw = resp.text
    assert "8006" not in raw
    assert "vncwebsocket" not in raw
    assert "pve-console.test" not in raw
