"""Reverse-proxied bidirectional console WebSocket relay (CON-03, plan 04-08).

The browser's noVNC iframe never connects to ``wss://pve-host:8006`` — it
connects to *this* GUI-origin endpoint, and the GUI relays raw RFB bytes
to/from Proxmox. Pinned by spike 04-03 (``04-SPIKE-novnc.md``):

- **Auth before accept()** — the ``access_token`` cookie is validated BEFORE
  ``websocket.accept()`` (cookie-only, no PAT); failure → ``close(1008)`` and
  the socket is never accepted (T-04-08-02). Reuses ``jobs/ws.py``'s
  ``_resolve_ws_user`` verbatim.
- **Ownership check** — the resource is resolved for the caller's team; a
  cross-tenant resource → ``close(1008)`` before ``accept()`` (T-04-08-03).
- **Single mint** — the ``vncproxy`` session (VNC port + ticket) is minted
  ONCE by the console mint route on the "Open console" click and reaches this
  relay as ``port`` / ``vncticket`` query params on the relay WebSocket URL.
  The relay does NOT mint a second session. A noVNC RFB client must hold the
  ticket as its VNC-auth password (the upstream VNC server offers security
  type 2 — verified live, spike 04-03 was incomplete here), so the ticket
  necessarily reaches the browser. The browser still never sees the Proxmox
  host URL or the per-cluster API token (CON-03).
- **Single encoding** — the ``vncticket`` is URL-encoded EXACTLY ONCE here,
  via ``urllib.parse.quote(ticket, safe="")``, when the upstream
  ``vncwebsocket`` URL is built. Every other hop carries the raw ticket (a
  JSON field from the mint route, then a relay-WS query param decoded back to
  raw by Starlette) — Pitfall 2 / T-04-08-04.
- **Per-cluster TLS posture** — the upstream ``wss://...:8006`` leg reuses the
  cluster row's ``verify_ssl`` setting (spike §5 / T-04-08-06).
- **Bidirectional relay loop** — two ``_pump`` tasks (browser→upstream,
  upstream→browser); the first to finish cancels the sibling and the browser
  socket is closed cleanly so the frontend can surface "session ended" (§3).
"""

from __future__ import annotations

import asyncio
import logging
import ssl
from urllib.parse import quote

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from websockets.asyncio.client import connect as websockets_connect
from websockets.exceptions import ConnectionClosed

from app.auth.dependencies import Principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.inventory.access import resolve_resource
from app.jobs.ws import _resolve_ws_user

logger = logging.getLogger(__name__)

router = APIRouter()

#: WebSocket close code for a policy violation — unauthenticated handshake or
#: a cross-tenant ownership-check failure (mirrors ``jobs/ws.py``).
_WS_POLICY_VIOLATION = 1008

#: The URL kind segment → ``is_lxc`` mapping. Anything else is a 1008 close.
_KIND_IS_LXC = {"vms": False, "lxcs": True}


def _ws_registry(websocket: WebSocket) -> PVEConnectorRegistry:
    """Resolve the per-cluster connector registry from ``app.state``.

    Mirrors ``inventory/access._get_registry`` — falls back to a fresh
    registry for tests that don't run the full lifespan. ``Request`` is not
    available on a WebSocket route, so this reads ``websocket.app`` directly.
    """
    registry = getattr(websocket.app.state, "registry", None)
    if registry is None:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine

        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False)
        )
        websocket.app.state.registry = registry
    return registry


def _upstream_ssl_context(*, verify_ssl: bool) -> ssl.SSLContext | bool:
    """Build the SSL posture for the upstream ``wss://pve-host:8006`` leg.

    Reuses the per-cluster ``verify_ssl`` setting stored on the ``clusters``
    row — the relay must NOT invent its own TLS policy (spike §5 / T-04-08-06).

    - ``verify_ssl=True``  → a normal verifying context (chain + hostname).
    - ``verify_ssl=False`` → ``CERT_NONE`` + ``check_hostname=False``, the
      ``websockets`` equivalent of proxmoxer's ``verify_ssl=False``. This is
      the realistic home-lab PVE default (self-signed cert, Pitfall A9).
    """
    ctx = ssl.create_default_context()
    if not verify_ssl:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _build_vncwebsocket_url(
    *, host: str, port: int, node: str, is_lxc: bool, vmid: int,
    vnc_port: int, ticket: str,
) -> str:
    """Build the upstream ``vncwebsocket`` URL — THE single encode hop (§2).

    The ``vncticket`` is percent-encoded EXACTLY ONCE with
    ``quote(ticket, safe="")``. ``safe=""`` is load-bearing: Python's ``quote``
    leaves ``/`` unescaped by default, and the base64 ticket body contains
    ``/`` — leaving it raw would produce an invalid query string. Double
    encoding (``%253A`` instead of ``%3A``) makes PVE reject the ticket with a
    useless 401 (Pitfall 2). No other hop in the relay chain encodes the
    ticket — the mint route returns it raw as JSON, and the browser never
    receives it at all.
    """
    kind = "lxc" if is_lxc else "qemu"
    enc_ticket = quote(ticket, safe="")
    return (
        f"wss://{host}:{port}/api2/json/nodes/{node}/{kind}/{vmid}"
        f"/vncwebsocket?port={vnc_port}&vncticket={enc_ticket}"
    )


async def _pump_browser_to_upstream(browser: WebSocket, upstream: object) -> None:
    """Relay raw frames browser → upstream until either side closes.

    noVNC's RFB protocol is binary; binary frames are forwarded as binary and
    text frames as text — the relay never coerces one to the other.
    """
    try:
        while True:
            message = await browser.receive()
            if message["type"] == "websocket.disconnect":
                break
            if (data := message.get("bytes")) is not None:
                await upstream.send(data)
            elif (text := message.get("text")) is not None:
                await upstream.send(text)
    except (WebSocketDisconnect, ConnectionClosed):
        pass


async def _pump_upstream_to_browser(upstream: object, browser: WebSocket) -> None:
    """Relay raw frames upstream → browser until either side closes."""
    try:
        async for message in upstream:
            if isinstance(message, bytes | bytearray):
                await browser.send_bytes(bytes(message))
            else:
                await browser.send_text(message)
    except (WebSocketDisconnect, ConnectionClosed):
        pass


@router.websocket("/ws/console/{cluster_id}/{kind}/{vmid}")
async def console_relay(
    websocket: WebSocket,
    cluster_id: int,
    kind: str,
    vmid: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Authenticated, ownership-checked, reverse-proxied noVNC WebSocket relay.

    The full handshake — auth, ownership check, vncproxy-param validation —
    all runs BEFORE ``accept()``; an unauthenticated or cross-tenant socket is
    closed 1008 and never accepted (T-04-08-02 / T-04-08-03).
    """
    # 1. AUTH BEFORE accept() — cookie-only, no PAT (reuse jobs/ws.py verbatim).
    user = await _resolve_ws_user(websocket, db)
    if user is None:
        logger.info(
            "console relay rejected: unauthenticated (cluster=%s vmid=%s)",
            cluster_id, vmid,
        )
        await websocket.close(code=_WS_POLICY_VIOLATION)
        return

    # The URL kind segment must be a known resource type.
    if kind not in _KIND_IS_LXC:
        logger.info(
            "console relay rejected: unknown kind %r (cluster=%s vmid=%s)",
            kind, cluster_id, vmid,
        )
        await websocket.close(code=_WS_POLICY_VIOLATION)
        return

    # 2. OWNERSHIP CHECK — resolve the resource for the caller's team. A
    #    cross-tenant / unknown resource raises HTTPException(403) inside
    #    resolve_resource; we translate that to a 1008 close before accept().
    registry = _ws_registry(websocket)
    principal = Principal(user=user, mode="session")
    try:
        resolved = await resolve_resource(
            db=db,
            registry=registry,
            principal=principal,
            cluster_id=cluster_id,
            vmid=vmid,
        )
    except Exception as exc:  # noqa: BLE001 — any resolve failure → policy close
        logger.info(
            "console relay rejected: ownership check failed (cluster=%s vmid=%s): %r",
            cluster_id, vmid, exc,
        )
        await websocket.close(code=_WS_POLICY_VIOLATION)
        return

    connector = resolved.connector
    node = resolved.vm_item["node"]
    is_lxc = _KIND_IS_LXC[kind]

    # 3. The vncproxy session (VNC port + ticket) was minted ONCE by the
    #    console mint route on the "Open console" click and reaches the relay
    #    as `port` / `vncticket` query params on this WebSocket URL — the relay
    #    does NOT mint a second session. PVE re-validates the ticket against
    #    {node}/{vmid} when the upstream vncwebsocket opens, and the team
    #    ownership check above already gated {cluster_id}/{vmid}: a caller can
    #    therefore only ever relay to a VNC session it legitimately minted.
    raw_port = websocket.query_params.get("port")
    ticket = websocket.query_params.get("vncticket")
    try:
        vnc_port = int(raw_port) if raw_port is not None else -1
    except ValueError:
        vnc_port = -1
    if not ticket or not (5900 <= vnc_port <= 5999):
        logger.info(
            "console relay rejected: missing/invalid vncproxy params "
            "(cluster=%s vmid=%s)",
            cluster_id, vmid,
        )
        await websocket.close(code=_WS_POLICY_VIOLATION)
        return

    # 4. Build the upstream URL — the SINGLE ticket-encode hop (§2).
    upstream_url = _build_vncwebsocket_url(
        host=connector.host,
        port=connector.port,
        node=node,
        is_lxc=is_lxc,
        vmid=vmid,
        vnc_port=vnc_port,
        ticket=ticket,
    )
    ssl_ctx = _upstream_ssl_context(verify_ssl=connector.verify_ssl)

    # 5. Open the upstream WS, accept the browser, run the bidirectional relay.
    logger.info(
        "console relay: connecting upstream %s:%s node=%s vmid=%s is_lxc=%s "
        "verify_ssl=%s",
        connector.host, connector.port, node, vmid, is_lxc, connector.verify_ssl,
    )
    # PVE authenticates the vncwebsocket request itself — the `vncticket`
    # query param alone is not enough; without an Authorization header PVE
    # answers 401 "No ticket". Send the cluster's API token, the same
    # credential proxmoxer uses for every other call to this connector.
    pve_auth = (
        f"PVEAPIToken={connector.token_user}!{connector.token_name}"
        f"={connector.token_value}"
    )
    try:
        async with websockets_connect(
            upstream_url,
            ssl=ssl_ctx,
            additional_headers={"Authorization": pve_auth},
        ) as upstream:
            await websocket.accept()
            logger.info(
                "console relay: established (cluster=%s vmid=%s)", cluster_id, vmid
            )
            browser_task = asyncio.create_task(
                _pump_browser_to_upstream(websocket, upstream)
            )
            upstream_task = asyncio.create_task(
                _pump_upstream_to_browser(upstream, websocket)
            )
            done, pending = await asyncio.wait(
                {browser_task, upstream_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
    except Exception as exc:  # noqa: BLE001 — upstream connect / relay failure
        logger.info(
            "console relay closed (cluster=%s vmid=%s): %r", cluster_id, vmid, exc
        )
        # If accept() never ran (upstream connect failed) close 1008; if it
        # did, a plain close lets the frontend surface "session ended".
        from starlette.websockets import WebSocketState

        try:
            if websocket.application_state == WebSocketState.CONNECTING:
                await websocket.close(code=_WS_POLICY_VIOLATION)
            else:
                await websocket.close()
        except RuntimeError:
            pass
        return

    # Clean shutdown — close the browser side so the frontend surfaces the
    # "Console session ended." strip with the Reconnect button (§3).
    logger.info(
        "console relay: session ended cleanly (cluster=%s vmid=%s)", cluster_id, vmid
    )
    try:
        await websocket.close()
    except RuntimeError:
        pass
