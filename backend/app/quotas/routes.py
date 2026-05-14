"""Quota HTTP surface — TENT-01..05 + API-05.

Route order matters: POST /quotas/preview (fixed segment) MUST be declared
BEFORE any parameterised route, per the route-order rule in 02-PATTERNS.md.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal,
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.models import TeamMembership
from app.quotas import admission, service
from app.quotas.schemas import (
    MyQuotasResponse,
    QuotaLimitsUpdate,
    QuotaPreview,
    QuotaPreviewRequest,
    TeamQuotaPage,
)

router = APIRouter()


def _get_registry(request: Request) -> PVEConnectorRegistry:
    """Extract the connector registry from app.state, building on demand for tests."""
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine

        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False)
        )
        request.app.state.registry = registry
    return registry


# ----------------------------------------------------------------------------
# POST /quotas/preview — fixed segment BEFORE parameterised routes
# ----------------------------------------------------------------------------


@router.post(
    "/quotas/preview",
    response_model=QuotaPreview,
    summary="Quota admission preview (no reservation in Phase 2)",
    operation_id="quotas_preview",
    dependencies=[Depends(csrf_protect)],
)
async def post_quota_preview(
    request: Request,
    payload: QuotaPreviewRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> QuotaPreview:
    """Preview whether a provisioning request would exceed team quota.

    Non-admin users may only preview for their own teams.
    Admin users may preview for any team.
    """
    if not principal.user.is_admin:
        my_teams = {
            r[0]
            for r in (await db.execute(
                select(TeamMembership.team_id).where(
                    TeamMembership.user_id == principal.user.id
                )
            )).all()
        }
        if payload.team_id not in my_teams:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No access to that team's quota.",
            )
    return await admission.check_and_preview(db, registry, request=payload)


# ----------------------------------------------------------------------------
# GET /teams/{team_id}/quotas
# ----------------------------------------------------------------------------


@router.get(
    "/teams/{team_id}/quotas",
    response_model=TeamQuotaPage,
    summary="Per-cluster quota grid + current usage for a team (admin)",
    operation_id="quotas_team_get",
    dependencies=[Depends(require_admin)],
)
async def get_team_quotas(
    team_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> TeamQuotaPage:
    return await service.list_team_quotas(db, registry, team_id=team_id)


# ----------------------------------------------------------------------------
# PUT /teams/{team_id}/quotas
# ----------------------------------------------------------------------------


@router.put(
    "/teams/{team_id}/quotas",
    response_model=TeamQuotaPage,
    summary="Upsert per-cluster quota limits for a team (admin)",
    operation_id="quotas_team_put",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def put_team_quotas(
    request: Request,
    payload: QuotaLimitsUpdate,
    team_id: int = Path(..., ge=1),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> TeamQuotaPage:
    return await service.set_team_quotas(
        db,
        registry,
        principal=principal,
        team_id=team_id,
        payload=payload,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


# ----------------------------------------------------------------------------
# GET /me/quotas
# ----------------------------------------------------------------------------


@router.get(
    "/me/quotas",
    response_model=MyQuotasResponse,
    summary="Aggregate + per-cluster quotas for the principal's teams",
    operation_id="quotas_me_get",
)
async def get_my_quotas_route(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> MyQuotasResponse:
    return await service.get_my_quotas(db, registry, principal=principal)
