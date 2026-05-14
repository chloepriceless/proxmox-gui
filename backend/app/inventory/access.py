"""Resource-access RBAC (TENT-06).

Resolves a (cluster_id, vmid) pair to the principal's *owning* team — that is,
the team whose privsep token's poolid matches the resource's `pool` field as
reported by `/cluster/resources`.

Pitfall 11 (RESEARCH PITFALLS.md): NEVER filter in Python. The PVE token's ACL
already filters /cluster/resources — but we ALSO assert pool match here as
defense-in-depth, because the cluster registry may not have minted the token
with strict-enough ACL (T-02-03-04 mitigation).
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Path, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, get_current_principal
from app.clusters.connector import PVEConnector
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.models import Cluster, TeamClusterToken, TeamMembership


@dataclass
class ResolvedResource:
    cluster: Cluster
    team_id: int
    poolid: str
    connector: PVEConnector
    vm_item: dict  # raw PVE /cluster/resources row
    is_stale: bool


async def _team_ids_for_user(db: AsyncSession, *, user_id: int) -> list[int]:
    rows = await db.execute(
        select(TeamMembership.team_id).where(TeamMembership.user_id == user_id)
    )
    return [r[0] for r in rows.all()]


async def _team_tokens_for_cluster(
    db: AsyncSession,
    *,
    team_ids: list[int],
    cluster_id: int,
) -> list[TeamClusterToken]:
    if not team_ids:
        return []
    rows = await db.execute(
        select(TeamClusterToken).where(
            TeamClusterToken.cluster_id == cluster_id,
            TeamClusterToken.team_id.in_(team_ids),
        )
    )
    return list(rows.scalars().all())


def _get_registry(request: Request) -> PVEConnectorRegistry:
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        # Fallback for tests that don't run the full lifespan.
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine

        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False)
        )
        request.app.state.registry = registry
    return registry


async def resolve_resource(
    *,
    db: AsyncSession,
    registry: PVEConnectorRegistry,
    principal: Principal,
    cluster_id: int,
    vmid: int,
) -> ResolvedResource:
    cluster = await db.get(Cluster, cluster_id)
    if cluster is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    tokens = await _team_tokens_for_cluster(
        db,
        team_ids=user_team_ids,
        cluster_id=cluster_id,
    )
    # Admin still has to operate THROUGH a team-token (one of the admin's own
    # teams — usually the personal team). If admin has no team membership on
    # this cluster, fall through to 403.
    for tok in tokens:
        connector = await registry.get_for_team(
            cluster_id=cluster_id,
            team_id=tok.team_id,
            db=db,
        )
        snapshot, is_stale = await connector.list_resources()
        for item in snapshot:
            if int(item.get("vmid", 0)) != vmid:
                continue
            if item.get("pool") != tok.poolid:
                continue
            return ResolvedResource(
                cluster=cluster,
                team_id=tok.team_id,
                poolid=tok.poolid,
                connector=connector,
                vm_item=item,
                is_stale=is_stale,
            )
    # Don't leak existence: same 403 whether the VM doesn't exist OR is in a
    # tenant the principal can't see (T-02-03-01).
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No access to that resource",
    )


async def require_resource_access(
    cluster_id: int = Path(..., ge=1),
    vmid: int = Path(..., ge=1),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> ResolvedResource:
    return await resolve_resource(
        db=db,
        registry=registry,
        principal=principal,
        cluster_id=cluster_id,
        vmid=vmid,
    )
