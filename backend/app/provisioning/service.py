"""Provisioning create service — LXC-05..07, VM-01..04.

Modelled on ``app.lifecycle.clone`` — ``enqueue_create_lxc`` /
``enqueue_create_qemu`` follow the exact ``enqueue_clone`` ordering:

  1. resolve the team + per-team privsep connector
  2. run quota admission (rejects 409) — BEFORE the VMID is reserved
  3. reserve the VMID (per-cluster lock + 60s reserved set — Pitfall 1)
  4. resolve the team PVE pool and build the payload (carries ``pool=`` —
     Pitfall 5/7, CLAUDE.md #7)
  5. enqueue_job
  6. audit-write the pending row; commit; return (job, vmid)

``reserve_vmid`` is reused verbatim from ``clone.py``. Quota admission is the
sibling ``run_quota_admission_for_request`` — ``clone.py``'s
``run_quota_admission`` sizes from a *source VM*; provisioning sizes from the
wizard's request directly.

The two clone source kinds (``template-clone`` / ``vm-clone``) do NOT build a
fresh create — they delegate to the existing ``clone.enqueue_clone`` (04-
RESEARCH §VM-02/VM-04 "reuse the Phase-3 clone path entirely").
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.inventory.access import ResolvedResource
from app.jobs.enqueue import enqueue_job
from app.lifecycle.clone import enqueue_clone, reserve_vmid
from app.lifecycle.schemas import CloneRequest
from app.models import Job, TeamClusterToken, TeamMembership
from app.provisioning.schemas import (
    CommunityScriptRequest,
    CreateLxcRequest,
    CreateQemuRequest,
)

__all__ = [
    "run_quota_admission_for_request",
    "enqueue_create_lxc",
    "enqueue_create_qemu",
    "enqueue_community_script",
]


# ---------------------------------------------------------------------------
# Team-membership guard (T-04-04-01)
# ---------------------------------------------------------------------------


async def _require_team_membership(
    db: AsyncSession, *, user_id: int, team_id: int
) -> None:
    """Raise 403 unless ``user_id`` is a member of ``team_id``.

    Provisioning creates a NEW resource — there is no existing resource to run
    ``require_resource_access`` against. The route names the owning team in
    the request body; this guard is the cross-tenant defence (T-04-04-01).
    """
    row = (
        await db.execute(
            select(TeamMembership.team_id).where(
                TeamMembership.user_id == user_id,
                TeamMembership.team_id == team_id,
            )
        )
    ).first()
    if row is None:
        # Don't leak existence — same 403 whether the team doesn't exist OR
        # the principal is not a member (mirrors resolve_resource).
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team",
        )


# ---------------------------------------------------------------------------
# Team PVE pool resolution (Pitfall 5/7, CLAUDE.md #7)
# ---------------------------------------------------------------------------


async def _resolve_team_pool(
    db: AsyncSession, *, team_id: int, cluster_id: int
) -> str:
    """Return the team's PVE pool name from ``TeamClusterToken.poolid``.

    There is exactly one ``TeamClusterToken`` per ``(team_id, cluster_id)``
    (UNIQUE constraint). The pool name is READ from the ``poolid`` column —
    never reconstructed app-side (CLAUDE.md constraint #7 / Pitfall 5+7).
    """
    poolid = (
        await db.execute(
            select(TeamClusterToken.poolid).where(
                TeamClusterToken.team_id == team_id,
                TeamClusterToken.cluster_id == cluster_id,
            )
        )
    ).scalar_one_or_none()
    if poolid is None:
        # A team without a privsep token on the cluster should never reach a
        # create — the connector resolution above would already have failed.
        raise RuntimeError(
            f"no team_cluster_tokens row for team={team_id} "
            f"cluster={cluster_id} — cannot resolve the team PVE pool"
        )
    return poolid


# ---------------------------------------------------------------------------
# Quota admission — request-sized (sibling of clone.run_quota_admission)
# ---------------------------------------------------------------------------


async def run_quota_admission_for_request(
    db: AsyncSession,
    registry: Any,
    *,
    team_id: int,
    cluster_id: int,
    requested_cpu: int,
    requested_ram_bytes: int,
    requested_disk_bytes: int,
) -> None:
    """Run the Phase 2 quota admission check for a provisioning create.

    ``clone.run_quota_admission`` sizes from a source VM; this sibling sizes
    from the wizard's request directly. A ``would_exceed`` verdict is rejected
    409 BEFORE the VMID is reserved (Pitfall 6 — admission before reserve).
    """
    from app.quotas.admission import check_and_preview
    from app.quotas.schemas import QuotaPreviewRequest

    preview = await check_and_preview(
        db,
        registry,
        request=QuotaPreviewRequest(
            team_id=team_id,
            cluster_id=cluster_id,
            requested_cpu=requested_cpu,
            requested_ram_bytes=requested_ram_bytes,
            requested_disk_bytes=requested_disk_bytes,
            requested_count=1,
        ),
    )
    if preview.would_exceed:
        exceeded = [d.name for d in preview.dimensions if d.would_exceed]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "This would exceed your team's quota. Free up resources "
                    "or ask an administrator to raise the limit."
                ),
                "exceeded": exceeded,
            },
        )


# ---------------------------------------------------------------------------
# LXC create (LXC-05/06/07)
# ---------------------------------------------------------------------------


async def enqueue_create_lxc(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    cluster_id: int,
    request: CreateLxcRequest,
    registry: Any,
    source_ip: str | None,
) -> tuple[Job, int]:
    """Enqueue an ``lxc.create`` job — returns ``(job, reserved_vmid)``.

    Follows the ``enqueue_clone`` ordering: membership guard → connector →
    quota admission → reserve VMID → resolve pool → enqueue → audit → commit.
    """
    team_id = request.team_id
    actor_user_id = principal.user.id

    await _require_team_membership(db, user_id=actor_user_id, team_id=team_id)

    try:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id, db=db
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team on this cluster",
        ) from exc

    # Quota admission BEFORE the VMID is reserved (Pitfall 6).
    await run_quota_admission_for_request(
        db, registry,
        team_id=team_id, cluster_id=cluster_id,
        requested_cpu=request.cpu_cores,
        requested_ram_bytes=request.requested_ram_bytes,
        requested_disk_bytes=request.requested_disk_bytes,
    )

    vmid = await reserve_vmid(cluster_id=cluster_id, connector=connector)
    pool = await _resolve_team_pool(db, team_id=team_id, cluster_id=cluster_id)
    config = request.to_pve_config(pool=pool)

    payload = {
        "node": request.node,
        "vmid": vmid,
        "is_lxc": True,
        "config": config,
    }
    job = await enqueue_job(
        db, arq_pool,
        kind="lxc.create",
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
        action="lxc.create",
        target_type="lxc",
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "vmid": vmid, "hostname": request.hostname,
        },
    )
    await db.commit()
    return job, vmid


# ---------------------------------------------------------------------------
# VM create (VM-01 cloud-image / VM-02 template-clone / VM-03 blank+ISO /
# VM-04 vm-clone)
# ---------------------------------------------------------------------------


async def enqueue_create_qemu(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    cluster_id: int,
    request: CreateQemuRequest,
    registry: Any,
    source_ip: str | None,
    resolved: ResolvedResource | None = None,
) -> tuple[Job, int]:
    """Enqueue a ``vm.create.qemu`` (or, for a clone source, ``vm.clone``) job.

    Returns ``(job, reserved_vmid)``. The clone source kinds delegate to the
    existing ``clone.enqueue_clone`` — ``resolved`` is the source VM/template
    resolved by ``require_resource_access`` on the route (04-RESEARCH §VM-02/
    VM-04: reuse the Phase-3 clone path entirely; do not duplicate it).
    """
    team_id = request.team_id
    actor_user_id = principal.user.id

    await _require_team_membership(db, user_id=actor_user_id, team_id=team_id)

    # ---- Clone source kinds (VM-02 / VM-04) → reuse the Phase-3 clone path --
    if request.is_clone:
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A clone create needs the source resource resolved on "
                    "the route."
                ),
            )
        clone_req = CloneRequest(
            name=request.name,
            full=(request.clone_mode == "full"),
            target_node=request.node,
            target_storage=request.storage,
            new_vmid=None,
        )
        # enqueue_clone reserves the VMID itself and writes it to the payload.
        clone_job = await enqueue_clone(
            db, arq_pool,
            principal=principal,
            resolved=resolved,
            request=clone_req,
            registry=registry,
            source_ip=source_ip,
        )
        import json as _json

        newid = int(_json.loads(clone_job.payload)["newid"])
        return clone_job, newid

    # ---- Fresh create kinds (VM-01 cloud-image / VM-03 blank+ISO) ----------
    try:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id, db=db
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team on this cluster",
        ) from exc

    await run_quota_admission_for_request(
        db, registry,
        team_id=team_id, cluster_id=cluster_id,
        requested_cpu=request.cpu_cores or 0,
        requested_ram_bytes=request.requested_ram_bytes,
        requested_disk_bytes=request.requested_disk_bytes,
    )

    vmid = await reserve_vmid(cluster_id=cluster_id, connector=connector)
    pool = await _resolve_team_pool(db, team_id=team_id, cluster_id=cluster_id)
    config = request.to_pve_config(pool=pool)

    payload = {
        "node": request.node,
        "vmid": vmid,
        "is_lxc": False,
        "config": config,
    }
    job = await enqueue_job(
        db, arq_pool,
        kind="vm.create.qemu",
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
        action="vm.create",
        target_type="vm",
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "vmid": vmid, "name": request.name,
            "source_kind": request.source_kind,
        },
    )
    await db.commit()
    return job, vmid


# ---------------------------------------------------------------------------
# Community-script LXC create (LXC-03 — Plan 04-06, spike-gated)
# ---------------------------------------------------------------------------


def _resolve_ostemplate(entry: Any, *, storage: str) -> str:
    """Resolve the ``<storage>:vztmpl/<file>`` template volid for a script.

    The catalog entry's ``install_methods[0].resources`` carries the ``os`` +
    ``version`` (spike question 4); the GUI maps that pair onto the standard
    community-scripts vztmpl filename. ``storage`` is the template storage the
    wizard picked.
    """
    methods = entry.install_methods or []
    resources = methods[0].get("resources", {}) if methods else {}
    os_name = str(resources.get("os") or "debian").lower()
    version = str(resources.get("version") or "12")
    # The community-scripts naming convention — e.g. debian-12-standard,
    # ubuntu-24.04-standard, alpine-3.20-default.
    suffix = "default" if os_name == "alpine" else "standard"
    return f"{storage}:vztmpl/{os_name}-{version}-{suffix}_amd64.tar.zst"


async def enqueue_community_script(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    cluster_id: int,
    request: CommunityScriptRequest,
    registry: Any,
    source_ip: str | None,
) -> tuple[Job, int]:
    """Enqueue an ``lxc.community-script`` job — returns ``(job, reserved_vmid)``.

    Follows the exact ``enqueue_create_lxc`` ordering: membership guard →
    connector → quota admission (BEFORE reserve) → reserve VMID → resolve pool
    → build the two-stage payload → enqueue → audit → commit.

    The ``script_slug`` is validated against the catalog entry set — an unknown
    slug → 422 (threat T-04-06-01: only a known slug resolves to a script).
    The payload carries ``{node, vmid, config, script_slug, script_options}``;
    the worker's ``run_community_script`` runs the two stages.
    """
    from app.catalog import service as catalog_service

    team_id = request.team_id
    actor_user_id = principal.user.id

    await _require_team_membership(db, user_id=actor_user_id, team_id=team_id)

    # Validate the slug against the catalog — an unknown slug never resolves to
    # a script (threat T-04-06-01).
    entry = await catalog_service.get_entry(request.script_slug, db)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown community-script slug '{request.script_slug}'.",
        )

    try:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id, db=db
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team on this cluster",
        ) from exc

    # Quota admission BEFORE the VMID is reserved (Pitfall 6).
    await run_quota_admission_for_request(
        db, registry,
        team_id=team_id, cluster_id=cluster_id,
        requested_cpu=request.cpu_cores,
        requested_ram_bytes=request.requested_ram_bytes,
        requested_disk_bytes=request.requested_disk_bytes,
    )

    vmid = await reserve_vmid(cluster_id=cluster_id, connector=connector)
    pool = await _resolve_team_pool(db, team_id=team_id, cluster_id=cluster_id)
    ostemplate = _resolve_ostemplate(entry, storage=request.storage)
    config = request.to_pve_config(pool=pool, ostemplate=ostemplate)

    payload = {
        "node": request.node,
        "vmid": vmid,
        "is_lxc": True,
        "config": config,
        "script_slug": request.script_slug,
        "script_options": dict(request.script_options),
        # LXC-04 traceability — the install stage is fetched at this SHA.
        "commit_sha": entry.commit_sha,
        "application": entry.name,
    }
    job = await enqueue_job(
        db, arq_pool,
        kind="lxc.community-script",
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
        action="lxc.community-script",
        target_type="lxc",
        target_id=str(vmid),
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "vmid": vmid, "hostname": request.hostname,
            "script_slug": request.script_slug,
        },
    )
    await db.commit()
    return job, vmid
