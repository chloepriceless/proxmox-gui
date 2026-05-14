"""Team-quota CRUD service. /me/quotas aggregator."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.clusters.registry import PVEConnectorRegistry
from app.models import Cluster, Quota, Team, TeamClusterToken, TeamMembership
from app.quotas.schemas import (
    ClusterQuotaRow,
    MyQuotasResponse,
    MyTeamQuota,
    QuotaLimit,
    QuotaLimitsUpdate,
    QuotaUsagePresentable,
    TeamQuotaPage,
)
from app.quotas.usage import compute_team_usage

_GB = 1024**3


def _limit_from_row(row: Quota | None, cluster_id: int) -> QuotaLimit:
    if row is None:
        return QuotaLimit(cluster_id=cluster_id)
    return QuotaLimit(
        cluster_id=cluster_id,
        cpu_cores=row.cpu_cores,
        ram_gb=(row.ram_bytes // _GB) if row.ram_bytes is not None else None,
        disk_gb=(row.disk_bytes // _GB) if row.disk_bytes is not None else None,
        vm_count=row.vm_count,
    )


def _row_payload(row: Quota | None) -> dict:
    if row is None:
        return {
            "cpu_cores": None,
            "ram_bytes": None,
            "disk_bytes": None,
            "vm_count": None,
        }
    return {
        "cpu_cores": row.cpu_cores,
        "ram_bytes": row.ram_bytes,
        "disk_bytes": row.disk_bytes,
        "vm_count": row.vm_count,
    }


async def list_team_quotas(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    team_id: int,
) -> TeamQuotaPage:
    """Return per-cluster quota grid + current usage for a team."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    # Bound clusters for this team:
    tokens = (await db.execute(
        select(TeamClusterToken).where(TeamClusterToken.team_id == team_id)
    )).scalars().all()
    cluster_ids = [t.cluster_id for t in tokens]
    if cluster_ids:
        clusters = (await db.execute(
            select(Cluster).where(Cluster.id.in_(cluster_ids))
        )).scalars().all()
    else:
        clusters = []
    quota_rows = (await db.execute(
        select(Quota).where(Quota.team_id == team_id)
    )).scalars().all()
    quotas_by_cid = {q.cluster_id: q for q in quota_rows if q.cluster_id is not None}

    out_rows: list[ClusterQuotaRow] = []
    for c in clusters:
        usage = await compute_team_usage(db, registry, team_id=team_id, cluster_id=c.id)
        out_rows.append(ClusterQuotaRow(
            cluster_id=c.id,
            cluster_name=c.name,
            limit=_limit_from_row(quotas_by_cid.get(c.id), c.id),
            usage=QuotaUsagePresentable.from_bytes(usage),
        ))
    return TeamQuotaPage(team_id=team.id, team_name=team.name, rows=out_rows)


async def set_team_quotas(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
    team_id: int,
    payload: QuotaLimitsUpdate,
    source_ip: str | None,
    correlation_id: str | None = None,
) -> TeamQuotaPage:
    """Upsert per-cluster quota limits for a team; emit audit rows."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    # Defense-in-depth: every row's cluster must actually belong to this team.
    bound_clusters = {
        t[0]
        for t in (await db.execute(
            select(TeamClusterToken.cluster_id).where(TeamClusterToken.team_id == team_id)
        )).all()
    }
    for row in payload.rows:
        if row.cluster_id not in bound_clusters:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Team {team_id} is not bound to cluster {row.cluster_id}.",
            )

    # Pre-check: D-12 lower-below-current-usage protection (unless allow_over=True).
    if not payload.allow_over:
        for row in payload.rows:
            usage = await compute_team_usage(
                db, registry, team_id=team_id, cluster_id=row.cluster_id,
            )
            if (
                (row.cpu_cores is not None and usage.cpu_cores > row.cpu_cores)
                or (row.ram_gb is not None and usage.ram_bytes > row.ram_gb * _GB)
                or (row.disk_gb is not None and usage.disk_bytes > row.disk_gb * _GB)
                or (row.vm_count is not None
                    and (usage.vm_count + usage.lxc_count) > row.vm_count)
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "Current usage exceeds the new limit.",
                        "cluster_id": row.cluster_id,
                        "usage": QuotaUsagePresentable.from_bytes(usage).model_dump(),
                        "requested_limit": row.model_dump(),
                    },
                )

    # Upsert + audit per cluster. ONE transaction; commit at end.
    existing = (await db.execute(
        select(Quota).where(Quota.team_id == team_id)
    )).scalars().all()
    by_cluster = {q.cluster_id: q for q in existing if q.cluster_id is not None}

    for row in payload.rows:
        before = _row_payload(by_cluster.get(row.cluster_id))
        new_values = {
            "cpu_cores": row.cpu_cores,
            "ram_bytes": (row.ram_gb * _GB) if row.ram_gb is not None else None,
            "disk_bytes": (row.disk_gb * _GB) if row.disk_gb is not None else None,
            "vm_count": row.vm_count,
        }
        q = by_cluster.get(row.cluster_id)
        if q is None:
            q = Quota(
                team_id=team_id,
                cluster_id=row.cluster_id,
                **new_values,
                updated_at=datetime.utcnow(),
            )
            db.add(q)
        else:
            for k, v in new_values.items():
                setattr(q, k, v)
            q.updated_at = datetime.utcnow()
        await db.flush()  # ensure ID populated before audit row references it

        await audit_write(
            db,
            actor_user_id=principal.user.id,
            team_id=team_id,
            cluster_id=row.cluster_id,
            action="quota.update",
            target_type="quota",
            target_id=str(q.id),
            result="success",
            source_ip=source_ip,
            correlation_id=correlation_id,
            payload_before=before,
            payload_after=new_values,
        )

    await db.commit()
    return await list_team_quotas(db, registry, team_id=team_id)


def _sum_or_none(values: Iterable[int | None]) -> int | None:
    """Return Σ values if every value is non-None; else None (unlimited if any unbounded)."""
    total = 0
    for v in values:
        if v is None:
            return None
        total += v
    return total


async def get_my_quotas(
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    *,
    principal: Principal,
) -> MyQuotasResponse:
    """Return aggregate + per-cluster quotas for the principal's teams."""
    team_ids = [
        r[0]
        for r in (await db.execute(
            select(TeamMembership.team_id).where(
                TeamMembership.user_id == principal.user.id
            )
        )).all()
    ]
    if team_ids:
        teams = (await db.execute(
            select(Team).where(Team.id.in_(team_ids))
        )).scalars().all()
    else:
        teams = []
    out: list[MyTeamQuota] = []
    for team in teams:
        page = await list_team_quotas(db, registry, team_id=team.id)
        # Aggregate across clusters: sum, but None on any unbounded cluster.
        cpu = _sum_or_none(r.limit.cpu_cores for r in page.rows)
        ram = _sum_or_none(r.limit.ram_gb for r in page.rows)
        disk = _sum_or_none(r.limit.disk_gb for r in page.rows)
        count = _sum_or_none(r.limit.vm_count for r in page.rows)
        agg_usage = QuotaUsagePresentable(
            cpu_cores=sum(r.usage.cpu_cores for r in page.rows),
            ram_gb=sum(r.usage.ram_gb for r in page.rows),
            disk_gb=sum(r.usage.disk_gb for r in page.rows),
            vm_count=sum(r.usage.vm_count for r in page.rows),
            lxc_count=sum(r.usage.lxc_count for r in page.rows),
        )
        out.append(MyTeamQuota(
            team_id=team.id,
            team_name=team.name,
            clusters=page.rows,
            aggregate_limit=QuotaLimit(
                cluster_id=0,  # sentinel — UI uses team_id; cluster_id=0 means "aggregate"
                cpu_cores=cpu,
                ram_gb=ram,
                disk_gb=disk,
                vm_count=count,
            ),
            aggregate_usage=agg_usage,
        ))
    return MyQuotasResponse(teams=out)
