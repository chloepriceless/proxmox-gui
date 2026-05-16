"""Resize lifecycle service — LIFE-08, LIFE-09.

CPU/RAM resize is a SYNCHRONOUS Proxmox ``config.put`` (no UPID — RESEARCH
§Resize). It still flows through a ``vm.resize`` job so the Tasks drawer shows
it for drawer consistency; the job function (``run_resize`` in
``app/jobs/resize_functions.py``) does the sync write and marks the job
``succeeded`` directly, with no poll loop.

:func:`get_resize_info` reads the VM config and reports current cores/memory,
the disk list with sizes, and the ``cpu_hotplug``/``memory_hotplug`` flags
derived from the ``hotplug`` config field — when a flag is ``false`` the
corresponding change needs a reboot (UI-SPEC resize-dialog warning).

:func:`validate_resize` is the server-side shrink block (LIFE-09 / T-03-03-03):
a disk grow whose ``new_size_gb`` is not strictly larger than the disk's
current size is rejected 422. The UI ``min`` is a UX affordance only — the API
is the enforcement point. We never send a smaller size to PVE.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.inventory.access import ResolvedResource
from app.jobs.enqueue import enqueue_job
from app.lifecycle.schemas import DiskInfo, ResizeInfoResponse, ResizeRequest
from app.models import Job

__all__ = ["get_resize_info", "validate_resize", "enqueue_resize", "parse_disk_sizes"]

# A PVE disk key is a bus name + index, e.g. scsi0, virtio1, sata2, ide0,
# or the LXC rootfs / mpN mount points.
_DISK_KEY_RE = re.compile(r"^(?:scsi|virtio|sata|ide)\d+$|^rootfs$|^mp\d+$")

# size= unit suffixes PVE emits in a disk config line (e.g. size=32G).
_SIZE_UNITS = {"T": 1024, "G": 1, "M": 1 / 1024, "K": 1 / (1024 * 1024)}


def _is_lxc(vm_item: dict) -> bool:
    return vm_item.get("type") == "lxc"


def _size_to_gb(raw: str) -> int | None:
    """Convert a PVE ``size=`` token (``32G``, ``1T``, ``512M``) to whole GB.

    Returns ``None`` if the token cannot be parsed — the disk is then simply
    omitted from the resize-info disk list rather than crashing the response.
    """
    raw = raw.strip()
    if not raw:
        return None
    unit = raw[-1].upper()
    if unit in _SIZE_UNITS:
        try:
            value = float(raw[:-1])
        except ValueError:
            return None
        return max(1, round(value * _SIZE_UNITS[unit]))
    # No unit suffix — PVE occasionally reports raw bytes.
    try:
        return max(1, round(int(raw) / (1024 ** 3)))
    except ValueError:
        return None


def parse_disk_sizes(config: dict) -> dict[str, int]:
    """Extract ``{disk_key: size_gb}`` from a VM/LXC config dict.

    A disk config line looks like
    ``scsi0: local-lvm:vm-100-disk-0,size=32G`` — we split on commas and pull
    the ``size=`` token. Disks without a parseable size are skipped.
    """
    sizes: dict[str, int] = {}
    for key, value in config.items():
        if not _DISK_KEY_RE.match(str(key)):
            continue
        if not isinstance(value, str):
            continue
        for part in value.split(","):
            part = part.strip()
            if part.startswith("size="):
                gb = _size_to_gb(part[len("size="):])
                if gb is not None:
                    sizes[str(key)] = gb
                break
    return sizes


def _hotplug_tokens(config: dict) -> tuple[bool, bool]:
    """Derive ``(cpu_hotplug, memory_hotplug)`` from the ``hotplug`` config field.

    The ``hotplug`` field is a comma list (``network,disk,usb``), the literal
    ``1`` (all hotplug enabled) or ``0`` (none). CPU hotplug requires the
    ``cpu`` token; memory hotplug requires the ``memory`` token (RESEARCH A5 —
    standard PVE token names).
    """
    raw = config.get("hotplug")
    if raw is None:
        # PVE default when the field is absent is `network,disk,usb` — neither
        # cpu nor memory, so both changes need a reboot.
        return False, False
    raw_str = str(raw).strip()
    if raw_str == "1":
        return True, True
    if raw_str in {"", "0"}:
        return False, False
    tokens = {t.strip() for t in raw_str.split(",")}
    return ("cpu" in tokens), ("memory" in tokens)


async def get_resize_info(
    db: AsyncSession,  # noqa: ARG001 — kept for caller symmetry; this is a pure read
    *,
    resolved: ResolvedResource,
) -> ResizeInfoResponse:
    """Read the VM config and report cores/memory/disks + hotplug-derived flags."""
    item = resolved.vm_item
    config = await resolved.connector.get_vm_config(
        node=str(item.get("node") or ""),
        vmid=int(item["vmid"]),
        is_lxc=_is_lxc(item),
    )
    cpu_hotplug, memory_hotplug = _hotplug_tokens(config)
    disks = [
        DiskInfo(disk=name, size_gb=size)
        for name, size in sorted(parse_disk_sizes(config).items())
    ]
    return ResizeInfoResponse(
        cores=int(config.get("cores") or 1),
        memory=int(config.get("memory") or 0),
        cpu_hotplug=cpu_hotplug,
        memory_hotplug=memory_hotplug,
        disks=disks,
    )


def validate_resize(config: dict, request: ResizeRequest) -> None:
    """Reject any disk shrink server-side (LIFE-09 / T-03-03-03).

    For each requested :class:`DiskGrow`, look up the disk's current size from
    the parsed config. A request for a size that is not strictly larger than
    the current size — or for a disk that does not exist in the config — is
    rejected with a 422. We NEVER send a smaller size to PVE.
    """
    if not request.disks:
        return
    sizes = parse_disk_sizes(config)
    for grow in request.disks:
        current = sizes.get(grow.disk)
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown disk '{grow.disk}' on this VM.",
            )
        if grow.new_size_gb <= current:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Disks can only grow. Enter a value of {current} GB "
                    f"or more for {grow.disk}."
                ),
            )


async def enqueue_resize(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    request: ResizeRequest,
    source_ip: str | None,
) -> Job:
    """Validate the resize, enqueue a ``vm.resize`` job, and audit the request.

    The current config is read once so :func:`validate_resize` can compute
    each disk's current size for the shrink block; the per-disk current sizes
    are baked into the job payload so the worker can compute the ``+NG`` delta.
    """
    item = resolved.vm_item
    is_lxc = _is_lxc(item)
    vmid = int(item["vmid"])
    node = str(item.get("node") or "")
    target_type = "lxc" if is_lxc else "vm"

    config = await resolved.connector.get_vm_config(
        node=node, vmid=vmid, is_lxc=is_lxc
    )
    # Server-side shrink block — runs BEFORE the job is enqueued (LIFE-09).
    validate_resize(config, request)
    current_sizes = parse_disk_sizes(config)

    disks_payload = [
        {
            "disk": grow.disk,
            "new_size_gb": grow.new_size_gb,
            "current_size_gb": current_sizes[grow.disk],
        }
        for grow in (request.disks or [])
    ]
    payload = {
        "node": node,
        "vmid": vmid,
        "is_lxc": is_lxc,
        "cores": request.cores,
        "memory": request.memory,
        "disks": disks_payload,
    }
    # Capture scalar ids BEFORE enqueue_job — its idempotency-collision
    # rollback expires resolved.cluster (see power.enqueue_power).
    cluster_id = resolved.cluster.id
    team_id = resolved.team_id
    actor_user_id = principal.user.id

    job = await enqueue_job(
        db,
        arq_pool,
        kind="vm.resize",
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
        action="vm.resize",
        target_type=target_type,
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id,
            "cores": request.cores,
            "memory": request.memory,
            "disks": disks_payload,
        },
    )
    await db.commit()
    return job
