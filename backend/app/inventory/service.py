"""Inventory service — PVE reads, RBAC-scoped, with stale-cache awareness."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal
from app.clusters.registry import PVEConnectorRegistry
from app.inventory.access import (
    ResolvedResource,
    _team_ids_for_user,
    _team_tokens_for_cluster,
)
from app.inventory.rrd import normalize_rrd_samples
from app.inventory.schemas import (
    ClusterInventory,
    RRDQuery,
    RRDSample,
    VMDetail,
    VMInventoryItem,
)
from app.models import Cluster, Job

#: A ``vm.power`` action → the run-state the VM is in once that action
#: succeeds. Anything not listed (unknown action) yields no override.
_POWER_ACTION_STATUS = {
    "start": "running",
    "reboot": "running",
    "stop": "stopped",
    "shutdown": "stopped",
}


async def _recent_power_outcomes(
    db: AsyncSession, cluster_id: int, *, window_seconds: int = 90
) -> dict[int, str]:
    """Map ``vmid`` → run-state implied by a recently-succeeded ``vm.power`` job.

    ``/cluster/resources`` (the inventory list's source) is fed by Proxmox
    ``pvestatd`` on a ~10s tick and the connector caches it for 30s, so a VM's
    run-state in the list can lag a power action by tens of seconds. A
    succeeded ``vm.power`` job IS the authoritative outcome — overlay it for a
    short window so the list reflects the action at once, then fall back to
    PVE's own view once it has caught up.
    """
    cutoff = datetime.now(UTC) - timedelta(seconds=window_seconds)
    rows = await db.execute(
        select(Job)
        .where(
            Job.kind == "vm.power",
            Job.state == "succeeded",
            Job.cluster_id == cluster_id,
            Job.finished_at.is_not(None),
            Job.finished_at >= cutoff,
        )
        .order_by(Job.finished_at)
    )
    outcomes: dict[int, str] = {}
    for job in rows.scalars():
        try:
            payload = json.loads(job.payload)
        except (ValueError, TypeError):
            continue
        vmid = payload.get("vmid")
        status = _POWER_ACTION_STATUS.get(payload.get("action"))
        if isinstance(vmid, int) and status is not None:
            # rows are ordered oldest-first → the most recent action wins.
            outcomes[vmid] = status
    return outcomes


async def list_inventory_for_cluster(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
    cluster_id: int,
) -> ClusterInventory:
    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    tokens = await _team_tokens_for_cluster(
        db,
        team_ids=user_team_ids,
        cluster_id=cluster_id,
    )
    items: list[VMInventoryItem] = []
    is_stale = False
    last_error: str | None = None
    for tok in tokens:
        try:
            team_conn = await registry.get_for_team(
                cluster_id=cluster_id,
                team_id=tok.team_id,
                db=db,
            )
            snapshot, stale = await team_conn.list_resources()
            is_stale = is_stale or stale
            for it in snapshot:
                # PVE's /cluster/resources only fills the `pool` field for
                # principals with Pool.Audit globally; a privsep token whose
                # ACL is scoped to /pool/<id> sees `pool: null` even for VMs
                # it CAN see — which by construction are members of its own
                # pool, since the ACL is the only way the token reaches them.
                # Trust the structural guarantee and tag accordingly.
                item_pool = it.get("pool") or tok.poolid
                if item_pool != tok.poolid:
                    continue
                # Re-inject pool so downstream consumers (and the schema) see
                # the team's pool consistently.
                tagged = dict(it)
                tagged["pool"] = tok.poolid
                items.append(
                    VMInventoryItem.from_pve(tagged, cluster_id=cluster_id, is_stale=stale)
                )
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            is_stale = True
    # Overlay the authoritative outcome of any just-completed power action —
    # /cluster/resources lags real run-state by pvestatd's tick plus the 30s
    # connector cache, so a stopped VM can still read "running" here for tens
    # of seconds. A succeeded vm.power job is ground truth for that window.
    outcomes = await _recent_power_outcomes(db, cluster_id)
    if outcomes:
        for item in items:
            implied = outcomes.get(item.vmid)
            if implied is not None and implied != item.status:
                item.status = implied

    # cluster_status reflects cluster reachability, which is owned by the
    # admin-token connector (the one health_probe_loop runs against). The
    # per-team connectors don't get their own probe, so falling back to
    # their .status would always return "untested" until they're hit.
    admin_conn = await registry.get(cluster_id, db=db)
    return ClusterInventory(
        cluster_id=cluster.id,
        cluster_name=cluster.name,
        cluster_status=admin_conn.status,
        is_stale=is_stale,
        last_error=last_error,
        items=items,
    )


async def list_inventory_for_principal(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
) -> list[ClusterInventory]:
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    if not user_team_ids:
        return []
    # Which clusters does the principal touch?
    from app.models import TeamClusterToken

    rows = await db.execute(
        select(TeamClusterToken.cluster_id)
        .where(TeamClusterToken.team_id.in_(user_team_ids))
        .distinct()
    )
    cluster_ids = [r[0] for r in rows.all()]
    out: list[ClusterInventory] = []
    for cid in cluster_ids:
        out.append(
            await list_inventory_for_cluster(db, registry, principal=principal, cluster_id=cid)
        )
    return out


def _vm_detail_from_payloads(
    resolved: ResolvedResource,
    *,
    status_payload: dict,
    config_payload: dict,
) -> VMDetail:
    item = resolved.vm_item
    raw_tags = config_payload.get("tags") or item.get("tags") or ""
    tag_list = [t for t in re.split(r"[;,\s]+", str(raw_tags)) if t]
    return VMDetail(
        cluster_id=resolved.cluster.id,
        vmid=int(item["vmid"]),
        name=item.get("name") or config_payload.get("name"),
        type=("lxc" if item.get("type") == "lxc" else "qemu"),
        node=str(item.get("node") or ""),
        status=str(status_payload.get("status") or item.get("status") or "unknown"),
        uptime=int(status_payload.get("uptime") or 0),
        cpu=float(status_payload.get("cpu") or 0.0),
        mem=int(status_payload.get("mem") or 0),
        maxcpu=int(status_payload.get("maxcpu") or item.get("maxcpu") or 0),
        maxmem=int(status_payload.get("maxmem") or item.get("maxmem") or 0),
        disk=int(status_payload.get("disk") or 0),
        maxdisk=int(status_payload.get("maxdisk") or item.get("maxdisk") or 0),
        netin=int(status_payload.get("netin") or 0),
        netout=int(status_payload.get("netout") or 0),
        diskread=int(status_payload.get("diskread") or 0),
        diskwrite=int(status_payload.get("diskwrite") or 0),
        tags=tag_list,
        description=config_payload.get("description"),
        raw_config=config_payload or {},
    )


async def get_vm_detail(
    db: AsyncSession,
    *,
    resolved: ResolvedResource,
) -> VMDetail:
    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = str(resolved.vm_item.get("node") or "")
    vmid = int(resolved.vm_item["vmid"])
    status_payload = await resolved.connector.get_vm_status(
        node=node,
        vmid=vmid,
        is_lxc=is_lxc,
    )
    config_payload = await resolved.connector.get_vm_config(
        node=node,
        vmid=vmid,
        is_lxc=is_lxc,
    )
    # proxmoxer normalizes ``{"data": ...}`` — but a defensive `.get("data", x)`
    # keeps us safe if a fixture returns wrapped form.
    status_payload = (
        status_payload.get("data", status_payload)
        if isinstance(status_payload, dict)
        else {}
    )
    config_payload = (
        config_payload.get("data", config_payload)
        if isinstance(config_payload, dict)
        else {}
    )
    return _vm_detail_from_payloads(
        resolved,
        status_payload=status_payload if isinstance(status_payload, dict) else {},
        config_payload=config_payload if isinstance(config_payload, dict) else {},
    )


async def get_vm_rrd(
    *,
    resolved: ResolvedResource,
    query: RRDQuery,
) -> list[RRDSample]:
    is_lxc = resolved.vm_item.get("type") == "lxc"
    raw = await resolved.connector.rrddata(
        node=str(resolved.vm_item.get("node") or ""),
        vmid=int(resolved.vm_item["vmid"]),
        is_lxc=is_lxc,
        timeframe=query.timeframe,
        cf=query.cf,
    )
    rows = raw.get("data", raw) if isinstance(raw, dict) else raw
    return normalize_rrd_samples(rows or [])


# ---------------------------------------------------------------------------
# Write functions (tags + notes) — added for Task 2
# ---------------------------------------------------------------------------

from app.audit.writer import audit_write  # noqa: E402

_TOKEN_SCRUB_RE = re.compile(
    r"PVEAPIToken=[^\s,]+|token[_-]value=[^\s,]+", re.IGNORECASE
)


def _scrub_pve_error(msg: str | None) -> str | None:
    """Strip PVE token substrings from an error message before persisting to
    AuditLog.error. T-02-03-06 mitigation."""
    if msg is None:
        return None
    return _TOKEN_SCRUB_RE.sub("[REDACTED]", str(msg))


async def update_vm_tags(
    db: AsyncSession,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    new_tags: list[str],
    source_ip: str | None,
    correlation_id: str | None = None,
) -> VMDetail:
    """Replace PVE tag set; audit before+after; commit-before-raise on failure."""
    from fastapi import HTTPException, status

    from app.inventory.schemas import PVE_TAG_RE

    # Defense-in-depth: schema already validated; assert again to keep service
    # honest if someone bypasses the route (admin script, future caller).
    for t in new_tags:
        if not PVE_TAG_RE.match(t):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"invalid tag format: {t!r}",
            )

    # Old state from the resource snapshot (we already paid the cache lookup
    # in require_resource_access).
    old_raw = resolved.vm_item.get("tags") or ""
    old_tags = sorted({t for t in re.split(r"[;,\s]+", str(old_raw)) if t})
    joined = ";".join(sorted(set(new_tags)))

    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = str(resolved.vm_item.get("node") or "")
    vmid = int(resolved.vm_item["vmid"])
    target_type = "lxc" if is_lxc else "vm"

    try:
        await resolved.connector.set_vm_config(
            node=node,
            vmid=vmid,
            is_lxc=is_lxc,
            tags=joined,
        )
    except Exception as exc:  # noqa: BLE001
        await audit_write(
            db,
            actor_user_id=principal.user.id,
            team_id=resolved.team_id,
            cluster_id=resolved.cluster.id,
            action="vm.tag.update",
            target_type=target_type,
            target_id=str(vmid),
            result="failure",
            source_ip=source_ip,
            correlation_id=correlation_id,
            payload_before={"tags": old_tags},
            payload_after={"tags": sorted(set(new_tags))},
            error=_scrub_pve_error(str(exc)),
        )
        await db.commit()
        from app.clusters.errors import PVEAuthError, PVEUnreachable

        if isinstance(exc, PVEUnreachable):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Couldn't reach the cluster.",
            ) from exc
        if isinstance(exc, PVEAuthError):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cluster auth failed; admin must re-validate the token.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't update tags.",
        ) from exc

    await audit_write(
        db,
        actor_user_id=principal.user.id,
        team_id=resolved.team_id,
        cluster_id=resolved.cluster.id,
        action="vm.tag.update",
        target_type=target_type,
        target_id=str(vmid),
        result="success",
        source_ip=source_ip,
        correlation_id=correlation_id,
        payload_before={"tags": old_tags},
        payload_after={"tags": sorted(set(new_tags))},
    )
    await db.commit()

    # Re-fetch detail (will use freshly invalidated cache).
    return await get_vm_detail(db, resolved=resolved)


async def update_vm_notes(
    db: AsyncSession,
    *,
    principal: Principal,
    resolved: ResolvedResource,
    new_notes: str,
    source_ip: str | None,
    correlation_id: str | None = None,
) -> VMDetail:
    from fastapi import HTTPException, status

    if len(new_notes) > 8000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Notes are limited to 8000 characters.",
        )

    # Old state: fetch the current config to read description (the resource
    # cache item doesn't expose description).
    is_lxc = resolved.vm_item.get("type") == "lxc"
    node = str(resolved.vm_item.get("node") or "")
    vmid = int(resolved.vm_item["vmid"])
    target_type = "lxc" if is_lxc else "vm"

    try:
        current_cfg = await resolved.connector.get_vm_config(
            node=node,
            vmid=vmid,
            is_lxc=is_lxc,
        )
    except Exception as exc:  # noqa: BLE001
        await audit_write(
            db,
            actor_user_id=principal.user.id,
            team_id=resolved.team_id,
            cluster_id=resolved.cluster.id,
            action="vm.notes.update",
            target_type=target_type,
            target_id=str(vmid),
            result="failure",
            source_ip=source_ip,
            correlation_id=correlation_id,
            error=_scrub_pve_error(str(exc)),
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't read current notes.",
        ) from exc

    current_cfg = (
        current_cfg.get("data", current_cfg) if isinstance(current_cfg, dict) else {}
    )
    old_notes = (current_cfg or {}).get("description") or ""

    try:
        await resolved.connector.set_vm_config(
            node=node,
            vmid=vmid,
            is_lxc=is_lxc,
            description=new_notes,
        )
    except Exception as exc:  # noqa: BLE001
        await audit_write(
            db,
            actor_user_id=principal.user.id,
            team_id=resolved.team_id,
            cluster_id=resolved.cluster.id,
            action="vm.notes.update",
            target_type=target_type,
            target_id=str(vmid),
            result="failure",
            source_ip=source_ip,
            correlation_id=correlation_id,
            payload_before={"description": old_notes},
            payload_after={"description": new_notes},
            error=_scrub_pve_error(str(exc)),
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't update notes.",
        ) from exc

    await audit_write(
        db,
        actor_user_id=principal.user.id,
        team_id=resolved.team_id,
        cluster_id=resolved.cluster.id,
        action="vm.notes.update",
        target_type=target_type,
        target_id=str(vmid),
        result="success",
        source_ip=source_ip,
        correlation_id=correlation_id,
        payload_before={"description": old_notes},
        payload_after={"description": new_notes},
    )
    await db.commit()

    return await get_vm_detail(db, resolved=resolved)
