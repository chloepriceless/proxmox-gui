"""TOCTOU-safe quota admission via SQLite BEGIN IMMEDIATE (Pattern 3 + Pitfall 5).

Phase 2 ships this primitive ready for Phase 3 to consume from the create
flows. The /quotas/preview endpoint exercises the read path (no reservation
row is inserted in Phase 2 because there is no create flow yet).
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clusters.registry import PVEConnectorRegistry
from app.models import Quota
from app.quotas.schemas import (
    QuotaDimension,
    QuotaPreview,
    QuotaPreviewRequest,
)
from app.quotas.usage import compute_team_usage


def _dim(name: str, current: int, requested: int, limit: int | None) -> QuotaDimension:
    if limit is None:
        return QuotaDimension(
            name=name,
            current=current,
            requested=requested,
            limit=None,
            headroom=None,
            would_exceed=False,
        )
    proposed = current + requested
    return QuotaDimension(
        name=name,
        current=current,
        requested=requested,
        limit=limit,
        headroom=max(0, limit - proposed),
        would_exceed=proposed > limit,
    )


async def check_and_preview(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    request: QuotaPreviewRequest,
) -> QuotaPreview:
    """Return a QuotaPreview without reserving anything (Phase 2 carveout).

    Phase 3 will land a sibling ``check_and_reserve`` that INSERTs a
    reservations row inside the same BEGIN IMMEDIATE transaction.
    """
    try:
        await db.execute(text("BEGIN IMMEDIATE"))
    except OperationalError as exc:
        # Pitfall 5 (02-RESEARCH): even with busy_timeout=5000, BEGIN IMMEDIATE
        # can return SQLITE_BUSY. Surface as 503 + retry advice.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="quota check is contended; retry the request.",
        ) from exc
    try:
        # Resolve the Quota row (team-scoped only in Phase 2 — D-11).
        row = (await db.execute(
            select(Quota).where(
                Quota.team_id == request.team_id,
                Quota.cluster_id == request.cluster_id,
            )
        )).scalar_one_or_none()
        # Compute current usage from PVE.
        usage = await compute_team_usage(
            db, registry, team_id=request.team_id, cluster_id=request.cluster_id,
        )
        dims = [
            _dim("cpu", usage.cpu_cores, request.requested_cpu,
                 row.cpu_cores if row else None),
            _dim("ram_bytes", usage.ram_bytes, request.requested_ram_bytes,
                 row.ram_bytes if row else None),
            _dim("disk_bytes", usage.disk_bytes, request.requested_disk_bytes,
                 row.disk_bytes if row else None),
            _dim("count", usage.vm_count + usage.lxc_count,
                 request.requested_count, row.vm_count if row else None),
        ]
        would_exceed = any(d.would_exceed for d in dims)
        # Commit (no rows changed, but BEGIN IMMEDIATE held the write lock).
        await db.commit()
        return QuotaPreview(would_exceed=would_exceed, dimensions=dims)
    except Exception:
        await db.rollback()
        raise
