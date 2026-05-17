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

import asyncio
from unittest.mock import patch
from urllib.parse import quote

import pytest

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

# The relay no longer mints its own vncproxy session — there is exactly one
# mint (the console mint route's). The browser hands the relay the minted
# `port` + `vncticket` as query params on the relay WebSocket URL; these tests
# connect with the canned mint values (the vncticket URL-encoded exactly once
# for the WS URL, which Starlette decodes back to raw for the relay).
_RELAY_QS = f"?port=5900&vncticket={quote(_VNC_TICKET, safe='')}"


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


# ===========================================================================
# Task 2 — the reverse-proxied WebSocket relay
# ===========================================================================


class _FakeUpstream:
    """A fake ``websockets`` client connection — the upstream noVNC WS leg.

    Records bytes the relay sends; yields canned frames back to the relay's
    ``async for`` upstream→browser pump, then ends (mimicking PVE closing the
    socket — e.g. ticket expiry / session end).

    When ``wait_for_send`` is set, the upstream→browser pump blocks on the
    first ``__anext__`` until the relay has forwarded at least one
    browser→upstream frame — so the bidirectional test can assert *both*
    directions deterministically without a cancellation race.
    """

    def __init__(self, *, inbound: list | None = None, wait_for_send: bool = False) -> None:
        self.sent: list = []
        self._inbound = list(inbound or [])
        self.closed = False
        self._wait_for_send = wait_for_send
        self._sent_event = asyncio.Event()

    async def send(self, data) -> None:  # noqa: ANN001
        self.sent.append(data)
        self._sent_event.set()

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._wait_for_send and not self._sent_event.is_set():
            # Block the upstream→browser pump until the relay has forwarded a
            # browser→upstream frame — deterministic bidirectional ordering.
            await self._sent_event.wait()
        if self._inbound:
            return self._inbound.pop(0)
        self.closed = True
        raise StopAsyncIteration


class _FakeConnectCM:
    """An async context manager mimicking ``websockets.asyncio.client.connect``.

    Records the URL it was opened with + the ssl argument so tests can assert
    the single-encoding rule and the per-cluster TLS posture.
    """

    last_url: str | None = None
    last_ssl: object = None
    last_headers: dict | None = None

    def __init__(  # noqa: ANN001
        self,
        url: str,
        *,
        ssl=None,
        additional_headers=None,
        upstream: _FakeUpstream | None = None,
    ):
        type(self).last_url = url
        type(self).last_ssl = ssl
        type(self).last_headers = additional_headers
        self._upstream = upstream or _FakeUpstream()

    async def __aenter__(self) -> _FakeUpstream:
        return self._upstream

    async def __aexit__(self, *exc) -> bool:  # noqa: ANN002
        return False


def _make_connect_factory(upstream: _FakeUpstream | None = None):
    """Return a ``websockets_connect`` replacement that records its args."""

    def _connect(url: str, *, ssl=None, additional_headers=None):  # noqa: ANN001
        return _FakeConnectCM(
            url, ssl=ssl, additional_headers=additional_headers, upstream=upstream
        )

    return _connect


def _ws_test_app(session_factory, cookies: dict[str, str] | None = None):
    """Build a fresh app with the per-test DB wired — for TestClient WS tests."""
    from app.core.db import get_db
    from app.main import create_app

    app = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    return app


def _reinstall_test_cipher() -> None:
    """Re-install the deterministic test cipher.

    ``TestClient.__enter__`` runs the app lifespan, which calls
    ``install_cipher`` with a fresh *ephemeral* cipher (no master.key in the
    test env) — clobbering the conftest autouse test cipher. The console relay
    decrypts the per-cluster token via ``EncryptedSecret``, so the cipher used
    to *read* the seeded rows must match the one used to *write* them. Call
    this right after entering the ``TestClient`` context.
    """
    from app.core.cipher import SecretCipher
    from app.models._types_init import install_cipher

    install_cipher(SecretCipher(b"\x00" * 32))


def test_relay_unauthenticated_closed_1008(session_factory):
    """A console WS connect with no valid session is closed 1008 before accept()."""
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    app = _ws_test_app(session_factory)

    with TestClient(app) as tc:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with tc.websocket_connect("/api/v1/ws/console/1/vms/100") as ws:
                ws.receive_bytes()
        assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_relay_cross_tenant_closed(client, session_factory):
    """A console WS connect for a resource the user does not own is closed."""
    import anyio
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    owner = await make_user(session_factory, username="relayowner", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=60)
    await _add_user_to_team(session_factory, user_id=owner.id, team_id=team_id)
    await make_user(session_factory, username="relayother", is_admin=False)

    cookies = await login_as(client, username="relayother", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)

    def _run() -> int:
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                try:
                    with tc.websocket_connect(
                        f"/api/v1/ws/console/{cluster_id}/vms/100"
                    ) as ws:
                        ws.receive_bytes()
                except WebSocketDisconnect as exc:
                    return exc.code
        return -1

    code = await anyio.to_thread.run_sync(_run)
    assert code == 1008


@pytest.mark.asyncio
async def test_relay_missing_vncproxy_params_closed(client, session_factory):
    """An owning connection with no port/vncticket query params is closed 1008.

    The relay does not mint — the vncproxy session (port + ticket) is handed
    to it as query params. A connection that clears auth + ownership but
    carries neither is rejected before accept().
    """
    import anyio
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    user = await make_user(session_factory, username="relaynoparams", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=66)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="relaynoparams", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)

    def _run() -> int:
        with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                try:
                    with tc.websocket_connect(
                        f"/api/v1/ws/console/{cluster_id}/vms/100"
                    ) as ws:
                        ws.receive_bytes()
                except WebSocketDisconnect as exc:
                    return exc.code
        return -1

    code = await anyio.to_thread.run_sync(_run)
    assert code == 1008


@pytest.mark.asyncio
async def test_relay_opens_upstream_vncwebsocket(client, session_factory):
    """An owning connection is accepted; the relay opens the upstream vncwebsocket."""
    import anyio
    from starlette.testclient import TestClient

    from app.console import proxy as proxy_mod

    user = await make_user(session_factory, username="relayup", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=61, host="pve-relay.test"
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="relayup", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)
    _FakeConnectCM.last_url = None

    def _run() -> None:
        with (
            patch("app.clusters.connector.ProxmoxAPI", return_value=fake),
            patch.object(proxy_mod, "websockets_connect", _make_connect_factory()),
        ):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                # The relay opens the upstream WS BEFORE accept(); a fake
                # upstream that yields nothing closes the session fast — that
                # may surface as a WebSocketDisconnect at connect time. Either
                # way the upstream URL was recorded by _FakeConnectCM.
                try:
                    with tc.websocket_connect(
                        f"/api/v1/ws/console/{cluster_id}/vms/100{_RELAY_QS}"
                    ) as ws:
                        ws.receive_bytes()
                except Exception:  # noqa: BLE001 — clean close after upstream end
                    pass

    await anyio.to_thread.run_sync(_run)
    url = _FakeConnectCM.last_url
    assert url is not None
    assert url.startswith("wss://pve-relay.test:8006/api2/json/nodes/pve-01/qemu/100/vncwebsocket")
    assert "port=5900" in url
    assert "vncticket=" in url


@pytest.mark.asyncio
async def test_relay_encodes_vncticket_exactly_once(client, session_factory):
    """The vncticket in the upstream URL is URL-encoded EXACTLY ONCE (Pitfall 2)."""
    import anyio
    from starlette.testclient import TestClient

    from app.console import proxy as proxy_mod

    user = await make_user(session_factory, username="relayenc", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=62)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="relayenc", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)
    _FakeConnectCM.last_url = None

    def _run() -> None:
        with (
            patch("app.clusters.connector.ProxmoxAPI", return_value=fake),
            patch.object(proxy_mod, "websockets_connect", _make_connect_factory()),
        ):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                # The relay opens the upstream WS BEFORE accept(); a fast
                # upstream close may surface as a connect-time disconnect.
                try:
                    with tc.websocket_connect(
                        f"/api/v1/ws/console/{cluster_id}/vms/100{_RELAY_QS}"
                    ) as ws:
                        ws.receive_bytes()
                except Exception:  # noqa: BLE001 — clean close after upstream end
                    pass

    await anyio.to_thread.run_sync(_run)
    url = _FakeConnectCM.last_url
    assert url is not None
    vncticket_part = url.split("vncticket=", 1)[1]
    # _VNC_TICKET = "PVEVNC:6A08C225::x3IL+fuHY/zdq=4UaxPrN6hi2qHcl"
    # Single encoding: ':' -> %3A, '+' -> %2B, '/' -> %2F, '=' -> %3D.
    assert "%3A" in vncticket_part  # ':' encoded once
    assert "%2B" in vncticket_part  # '+' encoded once
    assert "%2F" in vncticket_part  # '/' encoded once (safe="" is load-bearing)
    # Double encoding would turn '%' into '%25' — must NOT happen.
    assert "%25" not in vncticket_part
    # Round-trips back to exactly the raw ticket — proves a single quote layer.
    from urllib.parse import unquote

    assert unquote(vncticket_part) == _VNC_TICKET


@pytest.mark.asyncio
async def test_relay_pumps_bytes_bidirectionally(client, session_factory):
    """Bytes from the browser reach the upstream and upstream bytes reach the browser."""
    import anyio
    from starlette.testclient import TestClient

    from app.console import proxy as proxy_mod

    user = await make_user(session_factory, username="relaypump", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=63)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="relaypump", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)
    # The upstream yields one RFB-style binary frame — but only AFTER the relay
    # has forwarded a browser→upstream frame (deterministic both-directions).
    upstream = _FakeUpstream(inbound=[b"\x00rfb-from-pve"], wait_for_send=True)

    def _run() -> bytes:
        with (
            patch("app.clusters.connector.ProxmoxAPI", return_value=fake),
            patch.object(
                proxy_mod, "websockets_connect", _make_connect_factory(upstream)
            ),
        ):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                with tc.websocket_connect(
                    f"/api/v1/ws/console/{cluster_id}/vms/100{_RELAY_QS}"
                ) as ws:
                    ws.send_bytes(b"rfb-from-browser")
                    received = ws.receive_bytes()
                    return received

    received = await anyio.to_thread.run_sync(_run)
    # Upstream → browser: the canned PVE frame reached the browser.
    assert received == b"\x00rfb-from-pve"
    # Browser → upstream: the relay forwarded the browser's bytes.
    assert b"rfb-from-browser" in upstream.sent


@pytest.mark.asyncio
async def test_relay_closes_browser_when_upstream_closes(client, session_factory):
    """When the upstream WS closes, the browser-side connection is closed cleanly."""
    import anyio
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    from app.console import proxy as proxy_mod

    user = await make_user(session_factory, username="relayclose", is_admin=False)
    cluster_id, team_id, _ = await _seed_cluster_and_token(session_factory, team_id=64)
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="relayclose", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)
    # An upstream that immediately closes (no inbound frames) — e.g. ticket
    # already expired at handshake.
    upstream = _FakeUpstream(inbound=[])

    def _run() -> bool:
        with (
            patch("app.clusters.connector.ProxmoxAPI", return_value=fake),
            patch.object(
                proxy_mod, "websockets_connect", _make_connect_factory(upstream)
            ),
        ):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                with tc.websocket_connect(
                    f"/api/v1/ws/console/{cluster_id}/vms/100{_RELAY_QS}"
                ) as ws:
                    try:
                        ws.receive_bytes()
                    except WebSocketDisconnect:
                        return True
        return False

    closed = await anyio.to_thread.run_sync(_run)
    assert closed is True


@pytest.mark.asyncio
async def test_relay_upstream_uses_per_cluster_tls_posture(client, session_factory):
    """The upstream wss leg reuses the cluster's verify_ssl posture (spike §5)."""
    import ssl as ssl_mod

    import anyio
    from starlette.testclient import TestClient

    from app.console import proxy as proxy_mod

    user = await make_user(session_factory, username="relaytls", is_admin=False)
    # verify_ssl=False — the realistic home-lab PVE default.
    cluster_id, team_id, _ = await _seed_cluster_and_token(
        session_factory, team_id=65, verify_ssl=False
    )
    await _add_user_to_team(session_factory, user_id=user.id, team_id=team_id)

    cookies = await login_as(client, username="relaytls", password="testpass12345")
    fake = _make_fake_for_mint()
    app = _ws_test_app(session_factory)
    _FakeConnectCM.last_ssl = None

    def _run() -> None:
        with (
            patch("app.clusters.connector.ProxmoxAPI", return_value=fake),
            patch.object(proxy_mod, "websockets_connect", _make_connect_factory()),
        ):
            with TestClient(app, cookies=cookies) as tc:
                _reinstall_test_cipher()
                # The relay opens the upstream WS BEFORE accept(); a fast
                # upstream close may surface as a connect-time disconnect.
                try:
                    with tc.websocket_connect(
                        f"/api/v1/ws/console/{cluster_id}/vms/100{_RELAY_QS}"
                    ) as ws:
                        ws.receive_bytes()
                except Exception:  # noqa: BLE001 — clean close after upstream end
                    pass

    await anyio.to_thread.run_sync(_run)
    ctx = _FakeConnectCM.last_ssl
    assert isinstance(ctx, ssl_mod.SSLContext)
    # verify_ssl=False → CERT_NONE + hostname check off (proxmoxer parity).
    assert ctx.verify_mode == ssl_mod.CERT_NONE
    assert ctx.check_hostname is False


def test_relay_unknown_kind_closed_1008(session_factory):
    """A console WS connect with an unknown {kind} segment is closed 1008."""
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    app = _ws_test_app(session_factory)

    with TestClient(app) as tc:
        # No session either — but the kind guard would also reject this.
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with tc.websocket_connect("/api/v1/ws/console/1/widgets/100") as ws:
                ws.receive_bytes()
        assert exc_info.value.code == 1008

