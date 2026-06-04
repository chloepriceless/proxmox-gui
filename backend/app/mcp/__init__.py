"""Proxmox-GUI MCP bridge (T-0032).

A stdio Model-Context-Protocol server that exposes VM/LXC lifecycle tools
(create / list / start / stop / delete) by calling the GUI's own REST API with
a PAT — inheriting its RBAC, quotas, audit log and job queue. See ``DESIGN.md``.

Run: ``python -m app.mcp`` (requires the ``mcp`` extra: ``pip install -e .[mcp]``).
"""

from __future__ import annotations

from app.mcp.client import MCPClientError, ProxmoxGuiClient
from app.mcp.config import MCPConfig, MCPConfigError, load_config
from app.mcp.server import build_server

__all__ = [
    "MCPClientError",
    "MCPConfig",
    "MCPConfigError",
    "ProxmoxGuiClient",
    "build_server",
    "load_config",
]
