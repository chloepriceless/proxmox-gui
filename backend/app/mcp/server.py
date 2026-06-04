"""FastMCP server exposing Proxmox-GUI VM/LXC lifecycle tools (T-0032).

``build_server(client)`` registers the tool surface against an injected
:class:`~app.mcp.client.ProxmoxGuiClient`, so tests can drive the tools with a
fake client and ``__main__`` wires the real one. See ``DESIGN.md``.

Tool surface (scope = create / list / start / stop / delete):
  list_resources · create_lxc · create_vm · power_action · delete_resource
"""

from __future__ import annotations

import json
from typing import Any, Literal

from mcp.server.fastmcp import FastMCP

from app.mcp.client import TERMINAL_JOB_STATES, MCPClientError, ProxmoxGuiClient

Kind = Literal["vm", "lxc"]
PowerVerb = Literal["start", "stop", "reboot", "shutdown"]


def _dump(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str, ensure_ascii=False)


def _drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


async def _enqueue_result(
    client: ProxmoxGuiClient, accepted: Any, *, wait: bool, what: str
) -> str:
    """Render a 202 ``{job_id, …}`` response, optionally waiting for the job."""
    if not isinstance(accepted, dict) or "job_id" not in accepted:
        return f"{what}: enqueued.\n{_dump(accepted)}"
    job_id = accepted["job_id"]
    if not wait:
        return (
            f"{what}: enqueued as job {job_id} (state={accepted.get('state', '?')}). "
            f"Poll job {job_id} or call again with wait=true.\n{_dump(accepted)}"
        )
    try:
        jid = int(job_id)
    except (TypeError, ValueError):
        return f"{what}: enqueued (job_id {job_id!r} is not pollable).\n{_dump(accepted)}"
    job = await client.wait_for_job(jid)
    state = job.get("state") if isinstance(job, dict) else None
    note = ""
    if state == "failed":
        err = job.get("friendly_error") or job.get("error") or "unknown error"
        note = f"  FAILED: {err}\n"
    elif state == "needs_review":
        # Settled but outcome-unknown (orphan reaper). NOT "still running" — an
        # admin must verify before any retry, so surface it distinctly.
        note = (
            "  NEEDS REVIEW: the job's outcome could not be determined "
            "automatically — verify it in the GUI before retrying.\n"
        )
    elif state not in TERMINAL_JOB_STATES:
        note = "  (still running — poll-timeout reached; job continues server-side)\n"
    return f"{what}: job {jid} → {state}.\n{note}{_dump({'accepted': accepted, 'job': job})}"


def build_server(client: ProxmoxGuiClient) -> FastMCP:
    """Build the FastMCP server bound to ``client``."""
    mcp = FastMCP("proxmox-gui")

    @mcp.tool()
    async def list_resources(cluster_id: int | None = None) -> str:
        """List VMs and LXCs the authenticated token can see.

        Args:
            cluster_id: Restrict to one cluster. Omit for all clusters.

        Returns each resource's cluster_id, vmid, name, type (qemu/lxc), node,
        status and tags — the identifiers needed by the other tools.
        """
        try:
            return _dump(await client.list_inventory(cluster_id))
        except MCPClientError as exc:
            return f"ERROR: {exc}"

    @mcp.tool()
    async def create_lxc(
        cluster_id: int,
        team_id: int,
        node: str,
        storage: str,
        ostemplate: str,
        hostname: str,
        cpu_cores: int,
        memory_mb: int,
        disk_gb: int,
        unprivileged: bool = True,
        nesting: bool = False,
        ssh_public_keys: str | None = None,
        password: str | None = None,
        start_after_create: bool = False,
        wait: bool = False,
    ) -> str:
        """Create an LXC container (enqueued; goes through quota + audit + the job queue).

        Args:
            cluster_id: Target cluster (see list_resources / the GUI).
            team_id: Owning team — the container lands in that team's pool.
            node: Proxmox node name (e.g. "pve-01").
            storage: Storage ID for the rootfs.
            ostemplate: OS template volid (e.g. "local:vztmpl/debian-12...tar.zst").
            hostname: Container hostname.
            cpu_cores / memory_mb / disk_gb: Resources.
            unprivileged / nesting: Container flags.
            ssh_public_keys: Newline-separated public keys to inject.
            password: Root password (optional; prefer SSH keys).
            start_after_create: Power on once created.
            wait: Poll the create job to completion before returning.
        """
        body = _drop_none({
            "team_id": team_id, "node": node, "storage": storage,
            "ostemplate": ostemplate, "hostname": hostname,
            "cpu_cores": cpu_cores, "memory_mb": memory_mb, "disk_gb": disk_gb,
            "unprivileged": unprivileged, "nesting": nesting,
            "ssh_public_keys": ssh_public_keys, "password": password,
            "start_after_create": start_after_create,
        })
        try:
            accepted = await client.create_lxc(cluster_id, body)
            return await _enqueue_result(client, accepted, wait=wait, what="create_lxc")
        except MCPClientError as exc:
            return f"ERROR: {exc}"

    @mcp.tool()
    async def create_vm(
        cluster_id: int,
        team_id: int,
        node: str,
        name: str,
        source_kind: Literal["cloud-image", "blank-iso", "template-clone", "vm-clone"],
        storage: str | None = None,
        cpu_cores: int | None = None,
        memory_mb: int | None = None,
        disk_gb: int | None = None,
        image_id: str | None = None,
        iso_volid: str | None = None,
        source_vmid: int | None = None,
        ci_user: str | None = None,
        ci_password: str | None = None,
        ssh_public_keys: str | None = None,
        wait: bool = False,
    ) -> str:
        """Create a QEMU VM (enqueued; quota + audit + job queue).

        Args:
            source_kind: How to build the VM — "cloud-image" (image_id),
                "blank-iso" (iso_volid), "template-clone"/"vm-clone" (source_vmid).
            team_id: Owning team. node/name: placement + display name.
            storage / cpu_cores / memory_mb / disk_gb: Resources (defaults apply per source).
            image_id / iso_volid / source_vmid: Source selector for the matching source_kind.
            ci_user / ci_password / ssh_public_keys: Cloud-Init seed (cloud-image).
            wait: Poll the create job to completion before returning.
        """
        body = _drop_none({
            "team_id": team_id, "source_kind": source_kind, "node": node, "name": name,
            "storage": storage, "cpu_cores": cpu_cores, "memory_mb": memory_mb,
            "disk_gb": disk_gb, "image_id": image_id, "iso_volid": iso_volid,
            "source_vmid": source_vmid, "ci_user": ci_user, "ci_password": ci_password,
            "ssh_public_keys": ssh_public_keys,
        })
        try:
            accepted = await client.create_qemu(cluster_id, body)
            return await _enqueue_result(client, accepted, wait=wait, what="create_vm")
        except MCPClientError as exc:
            return f"ERROR: {exc}"

    @mcp.tool()
    async def power_action(
        cluster_id: int, vmid: int, kind: Kind, action: PowerVerb, wait: bool = False
    ) -> str:
        """Start / stop / reboot / shutdown a VM or LXC (enqueued).

        Args:
            cluster_id / vmid: Target (from list_resources).
            kind: "vm" (qemu) or "lxc".
            action: start | stop (force) | reboot | shutdown (graceful ACPI).
            wait: Poll the job to completion before returning.
        """
        try:
            accepted = await client.power(
                cluster_id, vmid, is_lxc=(kind == "lxc"), action=action
            )
            return await _enqueue_result(
                client, accepted, wait=wait, what=f"{action} {kind} {vmid}"
            )
        except MCPClientError as exc:
            return f"ERROR: {exc}"

    @mcp.tool()
    async def delete_resource(
        cluster_id: int, vmid: int, kind: Kind, wait: bool = False
    ) -> str:
        """Delete a single VM or LXC (enqueued; irreversible at the Proxmox layer).

        Single-target only — there is no bulk/wildcard delete. Gated by the same
        RBAC + audit as the GUI.

        Args:
            cluster_id / vmid: Target (from list_resources).
            kind: "vm" (qemu) or "lxc".
            wait: Poll the delete job to completion before returning.
        """
        try:
            accepted = await client.delete(cluster_id, vmid, is_lxc=(kind == "lxc"))
            return await _enqueue_result(
                client, accepted, wait=wait, what=f"delete {kind} {vmid}"
            )
        except MCPClientError as exc:
            return f"ERROR: {exc}"

    return mcp
