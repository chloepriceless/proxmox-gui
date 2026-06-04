# MCP server (T-0032)

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that
lets an MCP client (Claude Desktop, an agent runtime, …) **create, list, start,
stop and delete VMs and LXCs** on your Proxmox-GUI deployment.

## How it works — a bridge, not a second backend

The MCP server is a thin client of the GUI's **own REST API**. It authenticates
with a Personal Access Token and forwards each tool call to the existing
endpoints. It does **not** talk to Proxmox directly and holds no privileges of
its own.

Because it goes through the REST API, every MCP action inherits the full GUI
security model for free:

- **Tenant/pool RBAC** — the PAT resolves to its owning user; the bridge can
  only touch what that user can.
- **Quota admission control**, the **audit log**, and the **job queue** (every
  mutating call is enqueued and UPID-polled — never a blocking Proxmox call).

See [`backend/app/mcp/DESIGN.md`](../backend/app/mcp/DESIGN.md) for the full
rationale.

## Setup

1. **Install the optional dependency** (the core API never imports it):

   ```bash
   pip install -e "backend[mcp]"
   ```

2. **Mint a PAT** for a service user under **Account → API tokens** in the GUI.
   The bridge acts as that user — pick a user whose team membership scopes
   exactly what the MCP client should be allowed to touch (an admin PAT grants
   admin reach).

3. **Configure + run** (stdio):

   ```bash
   export PROXMOX_GUI_MCP_PAT="pat_…"                       # required
   export PROXMOX_GUI_MCP_API_BASE="http://127.0.0.1:8000"  # default (loopback API)
   python -m app.mcp
   ```

   | Env var | Default | Meaning |
   |---|---|---|
   | `PROXMOX_GUI_MCP_PAT` | — (required) | the PAT, sent as `Authorization: Bearer …`. Never logged. |
   | `PROXMOX_GUI_MCP_API_BASE` | `http://127.0.0.1:8000` | base URL of the GUI REST API |
   | `PROXMOX_GUI_MCP_VERIFY_TLS` | `true` | set `false` only for a self-signed https base |

### Claude Desktop example

```json
{
  "mcpServers": {
    "proxmox-gui": {
      "command": "python",
      "args": ["-m", "app.mcp"],
      "env": {
        "PROXMOX_GUI_MCP_PAT": "pat_…",
        "PROXMOX_GUI_MCP_API_BASE": "http://127.0.0.1:8000"
      }
    }
  }
}
```

## Tools

| Tool | Does |
|---|---|
| `list_resources(cluster_id?)` | list VMs/LXCs (cluster_id, vmid, type, node, status, tags) |
| `create_lxc(...)` | create an LXC container |
| `create_vm(...)` | create a QEMU VM (cloud-image / iso / template-clone / vm-clone) |
| `power_action(cluster_id, vmid, kind, action)` | start / stop / reboot / shutdown |
| `delete_resource(cluster_id, vmid, kind)` | delete one VM/LXC (single-target; no bulk) |

Every mutating tool returns a `job_id` immediately and accepts `wait=true` to
poll the job to completion before returning.

> **Security note:** `delete_resource` is irreversible at the Proxmox layer and
> gated only by the PAT user's RBAC + audit. Scope the service user's PAT
> deliberately. Bulk/wildcard delete is intentionally not exposed.
