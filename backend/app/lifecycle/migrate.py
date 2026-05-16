"""Migrate lifecycle service with pre-flights — LIFE-11.

Migration is the highest-risk lifecycle op: a bad migration can leave a VM in
an inconsistent state. Two pre-flights run server-side BEFORE the job is
enqueued (T-03-04-05) — the API is the enforcement point, not just the UI:

1. **Quorum pre-flight (Pitfall 18).** ``cluster_status()`` reports a
   ``type=='cluster'`` item carrying ``quorate``. A non-quorate cluster has
   writes paused — the migrate is rejected 409 with the locked friendly copy.

2. **Node-local snippet pre-flight (Pitfall 20).** A VM whose ``cicustom``
   config references a snippet on node-local (non-shared) storage cannot be
   migrated until that's resolved. ``get_vm_config()`` exposes ``cicustom``;
   the referenced storage's ``shared`` flag is resolved via the storage list.
   Most VMs have no ``cicustom`` — that is fine (no ``cicustom`` → pre-flight
   passes). The hook lives in Phase 3 even though snippets are written in
   Phase 4 (ROADMAP locked note).

:func:`enqueue_migrate` runs both pre-flights, converts the UI's MB/s bwlimit
to PVE's KiB/s (RESEARCH A8 — the conversion is explicit), and enqueues a
``vm.migrate`` job.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.inventory.access import ResolvedResource
from app.jobs.enqueue import enqueue_job
from app.lifecycle.schemas import MigrateRequest
from app.models import Job

__all__ = ["preflight_migrate", "enqueue_migrate"]

# Locked friendly copy (UI-SPEC).
_QUORUM_MSG = (
    "The Proxmox cluster has lost quorum — writes are paused until it recovers."
)
_NODE_LOCAL_SNIPPET_MSG = (
    "This VM references a file that only exists on its current node. It can't "
    "be migrated until that's resolved."
)

# bwlimit MB/s → KiB/s (RESEARCH A8 — the UI shows MB/s, PVE wants KiB/s).
_KIB_PER_MB = 1024


def _is_lxc(vm_item: dict) -> bool:
    return vm_item.get("type") == "lxc"


def _vmid(vm_item: dict) -> int:
    return int(vm_item["vmid"])


def _node(vm_item: dict) -> str:
    return str(vm_item.get("node") or "")


def _cicustom_storage(cicustom: str) -> str | None:
    """Extract the storage id a ``cicustom`` value references, if any.

    A ``cicustom`` value looks like ``user=local:snippets/user.yml`` (possibly
    several comma-separated ``key=storage:path`` entries). We return the first
    storage id found — that is the storage whose ``shared`` flag must be
    checked. Returns ``None`` when nothing parseable is present.
    """
    if not cicustom:
        return None
    for entry in str(cicustom).split(","):
        entry = entry.strip()
        # Entry shape: "user=local:snippets/user.yml" — take the part after '='.
        value = entry.split("=", 1)[-1] if "=" in entry else entry
        if ":" in value:
            return value.split(":", 1)[0].strip()
    return None


async def preflight_migrate(
    connector: Any,
    *,
    node: str,
    vmid: int,
    is_lxc: bool,
) -> None:
    """Run the quorum + node-local-snippet pre-flights — raise 409 on failure.

    Both checks block the enqueue at the API layer (T-03-04-05). A VM with no
    ``cicustom`` config passes the snippet check trivially.
    """
    # ---- (a) Quorum pre-flight (Pitfall 18) -------------------------------
    statuses = await connector.cluster_status()
    cluster_item = next(
        (s for s in (statuses or []) if s.get("type") == "cluster"), None
    )
    if cluster_item is not None:
        # `quorate` is 1 when the cluster has quorum. A single-node cluster
        # with no `type=='cluster'` item is treated as quorate (pass).
        if int(cluster_item.get("quorate") or 0) != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=_QUORUM_MSG,
            )

    # ---- (b) Node-local snippet pre-flight (Pitfall 20) -------------------
    config = await connector.get_vm_config(node=node, vmid=vmid, is_lxc=is_lxc)
    cicustom = config.get("cicustom")
    storage_id = _cicustom_storage(str(cicustom)) if cicustom else None
    if storage_id:
        storages = await connector.node_storages(node=node, content="snippets")
        match = next(
            (s for s in (storages or []) if s.get("storage") == storage_id),
            None,
        )
        # A storage is node-local when shared != 1. If the storage is not in
        # the list at all it is, by definition, not a shared cluster storage.
        if match is None or int(match.get("shared") or 0) != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_NODE_LOCAL_SNIPPET_MSG,
            )


async def enqueue_migrate(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    request: MigrateRequest,
    source_ip: str | None,
) -> Job:
    """Run the migrate pre-flights, then enqueue a ``vm.migrate`` job.

    The bwlimit is converted from the UI's MB/s to PVE's KiB/s here — the
    conversion is explicit (RESEARCH A8); ``0`` means unlimited.
    """
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = _vmid(item)
    node = _node(item)
    target_type = "lxc" if is_lxc else "vm"

    # Pre-flights run BEFORE the job is enqueued (T-03-04-05).
    await preflight_migrate(
        resolved.connector, node=node, vmid=vmid, is_lxc=is_lxc,
    )

    # MB/s → KiB/s (RESEARCH A8). 1 MB/s == 1024 KiB/s.
    bwlimit_kib = int(request.bwlimit_mbps) * _KIB_PER_MB

    payload = {
        "node": node,
        "vmid": vmid,
        "is_lxc": is_lxc,
        "target": request.target_node,
        "online": request.online,
        "bwlimit": bwlimit_kib,
    }
    # Capture scalar ids BEFORE enqueue_job (idempotency-collision rollback
    # expires resolved.cluster — see power.enqueue_power).
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.migrate",
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=payload,
    )
    job_id = job.id

    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action="vm.migrate",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "target": request.target_node,
            "online": request.online, "bwlimit_kib": bwlimit_kib,
        },
    )
    await db.commit()
    return job
