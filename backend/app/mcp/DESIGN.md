# MCP server — design (T-0032)

A stdio Model-Context-Protocol server that lets an MCP client (Claude Desktop,
an agent, etc.) create / list / start / stop / delete VMs and LXCs on the
Proxmox-GUI's existing backend.

## Core architecture decision: stdio ↔ REST bridge with a PAT

The MCP server **does NOT talk to Proxmox directly** and does **NOT import the
app's service layer or DB**. It is a thin client of the GUI's own REST API,
authenticating with a Personal Access Token (`Authorization: Bearer pat_…`).

Why this and not a direct in-process integration:

- **Inherits the whole security model for free.** A PAT resolves to its owning
  user (PATs are unscoped — they carry that user's full RBAC). So every MCP
  call goes through the exact same gates as a UI click: tenant/pool RBAC
  (multi-tenancy invariant), quota admission control, the audit log, and the
  **job queue** (every mutating Proxmox call is a 202 + UPID-polled job — the
  foundational Proxmox constraint). No security logic is re-implemented or
  bypassed; the MCP server is structurally incapable of escalating past its
  PAT's user.
- **No second source of truth.** Proxmox quirks (UPID race, vncticket, pool
  privsep, nextid locking) are already solved once in the backend. The bridge
  reuses them rather than re-deriving them.
- **Decoupled lifecycle.** The MCP process can run anywhere that can reach the
  API; default target is the loopback API on the same LXC
  (`http://127.0.0.1:8000`), so no TLS / network exposure is added.

Trade-off accepted: one extra HTTP hop per call (negligible on loopback) in
exchange for zero duplication of the auth/audit/quota/job machinery.

## Tool surface (scope = create / list / start / stop / delete)

| Tool | REST call | Notes |
|---|---|---|
| `list_resources(cluster_id?)` | `GET /me/inventory` or `/clusters/{id}/inventory` | returns cluster_id+vmid+type+node+status — the discovery source for the action tools |
| `create_lxc(...)` | `POST /clusters/{id}/provisioning/lxc` | 202 + job_id + vmid |
| `create_vm(...)` | `POST /clusters/{id}/provisioning/qemu` | 202 + job_id + vmid |
| `power_action(cluster_id, vmid, kind, action)` | `POST /clusters/{id}/{vms\|lxcs}/{vmid}/power` | action ∈ start/stop/reboot/shutdown |
| `delete_resource(cluster_id, vmid, kind)` | `DELETE /clusters/{id}/{vms\|lxcs}/{vmid}` | single-target only — never bulk (Bulk Delete is out of scope by project rule) |

All mutating tools accept `wait: bool` (default false) → when true the bridge
polls `GET /jobs/{id}` until the job reaches a terminal state (bounded by a
timeout) and returns the final state, so a caller gets a synchronous-feeling
result without the bridge ever blocking a Proxmox call itself.

## Security posture (this feature is security-critical — create/delete)

- The PAT is read from `PROXMOX_GUI_MCP_PAT` (env) and **never logged**; the
  HTTP client scrubs the `Authorization` header from all error surfaces.
- Recommended deployment: mint a PAT for a **dedicated service user** whose
  team membership scopes exactly what the MCP client may touch — the MCP
  server then cannot exceed that user's tenancy. An admin PAT grants admin
  reach; choose deliberately.
- `delete_resource` is single-target and irreversible at the Proxmox layer;
  it is gated by the same RBAC + audit as the UI. No bulk/wildcard delete.

## Packaging

`python -m app.mcp` (stdio). `mcp` SDK is an **optional** dependency
(`pip install -e backend[mcp]`) so the core API never imports it.

## Open scope decision flagged to the Hub

`create_lxc`/`create_vm` require `node` / `storage` / `ostemplate` (or
`source_kind`+image) values. `list_resources` surfaces existing resources but
not the infra catalog. **Decision for the Hub:** should the MCP surface also
expose read-only discovery tools (nodes / storages / ISO+template catalog) so
an agent can fill create params unaided, or is `create` expected to be called
with operator-known values? Built conservatively (core 5) pending the answer.
