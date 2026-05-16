"""Pydantic schemas for the console mint endpoint (plan 04-08).

The mint route returns a :class:`VncProxyResponse`. Its ``relay_url`` is the
GUI's own reverse-proxied WebSocket path — deliberately NOT the Proxmox host
``wss://...:8006/.../vncwebsocket`` URL (CON-03 / T-04-08-01). The browser
points its noVNC iframe at ``relay_url``; the GUI relay (``console/proxy.py``)
holds the Proxmox-host leg and mints its own fresh ticket per connection.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class VncProxyResponse(BaseModel):
    """The response of ``POST .../console/vncproxy`` — the "Open console" click.

    ``ticket`` + ``port`` are returned for completeness, but the load-bearing
    field is ``relay_url``: the GUI-origin path the iframe's noVNC client
    connects to. The browser never receives a Proxmox-host URL.
    """

    ticket: str = Field(
        ...,
        description=(
            "The raw PVE vncticket (PVEVNC:...). ~30-40s lifetime — minted "
            "on click, never cached/persisted/logged."
        ),
    )
    port: int = Field(
        ...,
        ge=5900,
        le=5999,
        description="The PVE VNC port the ticket is bound to (5900-5999).",
    )
    relay_url: str = Field(
        ...,
        description=(
            "The GUI's own reverse-proxied WebSocket path the iframe connects "
            "to — e.g. /api/v1/ws/console/{cluster_id}/{vms|lxcs}/{vmid}. "
            "Never the Proxmox host:8006 URL (CON-03)."
        ),
    )
