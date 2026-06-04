"""Entry point: ``python -m app.mcp`` — run the stdio MCP bridge.

Reads ``PROXMOX_GUI_MCP_PAT`` (+ optional ``PROXMOX_GUI_MCP_API_BASE``,
``PROXMOX_GUI_MCP_VERIFY_TLS``) from the environment, builds the REST client and
serves over stdio. An MCP client (Claude Desktop, an agent runtime, …) launches
this process and speaks MCP on stdin/stdout — so nothing here writes to stdout
except the protocol.
"""

from __future__ import annotations

import sys

from app.mcp.client import ProxmoxGuiClient
from app.mcp.config import MCPConfigError, load_config
from app.mcp.server import build_server


def main() -> None:
    try:
        config = load_config()
    except MCPConfigError as exc:
        # stderr only — stdout is the MCP protocol channel.
        print(f"proxmox-gui MCP: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc

    client = ProxmoxGuiClient(config)
    server = build_server(client)
    # FastMCP.run() owns the event loop for the lifetime of the stdio session;
    # the client's httpx.AsyncClient binds lazily to that loop on first request.
    # Process exit tears the client down.
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
