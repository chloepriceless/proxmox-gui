"""Console HTTP surface — the ``vncproxy`` ticket mint (CON-01, CON-02, CON-03).

``POST /api/v1/clusters/{cluster_id}/{vms|lxcs}/{vmid}/console/vncproxy`` mints
a Proxmox ``vncticket`` for an embedded-noVNC console session. Pinned by spike
04-03 (``04-SPIKE-novnc.md``):

- the ticket is minted server-side ON the click that hits this route — never
  on page load (CON-02; the ticket lives ~30-40s, Pitfall 3).
- ``require_resource_access`` runs the team-scoped ownership check FIRST — a
  console for a resource the principal does not own → 403 (CON-01,
  T-04-08-03 / don't-leak-existence).
- the response carries the GUI's OWN reverse-proxied WebSocket path
  (``relay_url``) — never the Proxmox-host:8006 URL or a raw ``vncwebsocket``
  URL (CON-03, T-04-08-01). The browser's noVNC iframe points at ``relay_url``;
  the relay (``console/proxy.py``) holds the Proxmox-host leg.

The bidirectional WebSocket relay endpoint (``console/proxy.py``) is included
on the same package router so a single ``console_router`` mounts both.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import csrf_protect
from app.console.proxy import router as _relay_router
from app.console.schemas import VncProxyResponse
from app.inventory.access import ResolvedResource, require_resource_access

router = APIRouter()


def _relay_url(*, cluster_id: int, kind: str, vmid: int) -> str:
    """Build the GUI's own reverse-proxied console WebSocket path.

    This is a GUI-origin path — never the Proxmox host. ``console/proxy.py``
    mounts its ``@router.websocket`` at the matching ``/ws/console/...`` route,
    and ``deploy/caddy/Caddyfile.template`` has a dedicated
    ``handle /api/v1/ws/console*`` block (spike §4).
    """
    return f"/api/v1/ws/console/{cluster_id}/{kind}/{vmid}"


async def _mint(*, resolved: ResolvedResource, cluster_id: int, kind: str, vmid: int) -> VncProxyResponse:
    """Run the vncproxy mint for an already-ownership-resolved resource.

    ``require_resource_access`` has already confirmed the principal's team owns
    ``(cluster_id, vmid)`` — so this only mints and packs the response. The
    raw PVE ticket is returned as a JSON string (JSON serialization is NOT
    URL-encoding — the single encode hop is in ``console/proxy.py``, spike §2).
    """
    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = resolved.vm_item["node"]
    raw = await resolved.connector.vncproxy(node=node, vmid=vmid, is_lxc=is_lxc)
    return VncProxyResponse(
        ticket=str(raw["ticket"]),
        port=int(raw["port"]),
        relay_url=_relay_url(cluster_id=cluster_id, kind=kind, vmid=vmid),
    )


@router.post(
    "/clusters/{cluster_id}/vms/{vmid}/console/vncproxy",
    response_model=VncProxyResponse,
    summary="Mint a noVNC console ticket for a VM (on the 'Open console' click)",
    operation_id="console_vncproxy_vm",
    dependencies=[Depends(csrf_protect)],
)
async def console_vncproxy_vm(
    cluster_id: int,
    vmid: int,
    resolved: ResolvedResource = Depends(require_resource_access),
) -> VncProxyResponse:
    """Mint a console ticket for a VM the caller owns (cross-tenant → 403)."""
    return await _mint(resolved=resolved, cluster_id=cluster_id, kind="vms", vmid=vmid)


@router.post(
    "/clusters/{cluster_id}/lxcs/{vmid}/console/vncproxy",
    response_model=VncProxyResponse,
    summary="Mint a noVNC console ticket for an LXC (on the 'Open console' click)",
    operation_id="console_vncproxy_lxc",
    dependencies=[Depends(csrf_protect)],
)
async def console_vncproxy_lxc(
    cluster_id: int,
    vmid: int,
    resolved: ResolvedResource = Depends(require_resource_access),
) -> VncProxyResponse:
    """Mint a console ticket for an LXC the caller owns (cross-tenant → 403)."""
    return await _mint(resolved=resolved, cluster_id=cluster_id, kind="lxcs", vmid=vmid)


# The reverse-proxied WebSocket relay endpoint lives on the same package
# router so a single ``console_router`` include in ``main.py`` mounts both
# the mint route and the relay (spike §3).
router.include_router(_relay_router)
