"""``/api/v1/teams`` HTTP routes — admin-only.

All mutating routes compose ``Depends(require_admin)`` and
``Depends(csrf_protect)``; read routes only require admin.

The cluster connector registry is read off ``app.state.registry`` for the
auto-bootstrap path on ``POST /``. See :mod:`app.teams.bootstrap`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import csrf_protect, require_admin
from app.clusters.registry import PVEConnectorRegistry
from app.clusters.routes import get_registry
from app.core.db import get_db
from app.teams import service
from app.teams.schemas import (
    MembershipCreate,
    TeamCreate,
    TeamDetailResponse,
    TeamResponse,
    TeamUpdate,
    UserSummary,
)

router = APIRouter()


# ----------------------------------------------------------------------------
# CRUD
# ----------------------------------------------------------------------------


@router.post(
    "/",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a team and auto-bootstrap on every active cluster",
    operation_id="teams_create",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def create_team(
    payload: TeamCreate,
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(get_registry),
) -> TeamResponse:
    team = await service.create_team(
        db, registry=registry,
        name=payload.name, auto_bootstrap=True,
    )
    return TeamResponse.model_validate({
        "id": team.id, "name": team.name, "personal": team.personal,
        "is_active": team.is_active, "member_count": 0,
        "created_at": team.created_at, "updated_at": team.updated_at,
    })


@router.get(
    "/",
    response_model=list[TeamResponse],
    summary="List all teams",
    operation_id="teams_list",
    dependencies=[Depends(require_admin)],
)
async def list_teams(
    db: AsyncSession = Depends(get_db),
) -> list[TeamResponse]:
    rows = await service.list_teams(db)
    return [
        TeamResponse.model_validate({
            "id": team.id, "name": team.name, "personal": team.personal,
            "is_active": team.is_active, "member_count": count,
            "created_at": team.created_at, "updated_at": team.updated_at,
        })
        for team, count in rows
    ]


@router.get(
    "/{team_id}",
    response_model=TeamDetailResponse,
    summary="Read a single team with its members",
    operation_id="teams_get",
    dependencies=[Depends(require_admin)],
)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
) -> TeamDetailResponse:
    team, members = await service.get_team_with_members(db, team_id=team_id)
    return TeamDetailResponse.model_validate({
        "id": team.id, "name": team.name, "personal": team.personal,
        "is_active": team.is_active, "member_count": len(members),
        "created_at": team.created_at, "updated_at": team.updated_at,
        "members": [UserSummary.model_validate(m) for m in members],
    })


@router.patch(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Patch a team (name / is_active only — personal is immutable)",
    operation_id="teams_patch",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def patch_team(
    team_id: int,
    payload: TeamUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    team = await service.update_team(
        db, team_id=team_id, name=payload.name, is_active=payload.is_active,
    )
    # Re-compute member_count for the response.
    rows = await service.list_teams(db)
    count = next((c for t, c in rows if t.id == team_id), 0)
    return TeamResponse.model_validate({
        "id": team.id, "name": team.name, "personal": team.personal,
        "is_active": team.is_active, "member_count": count,
        "created_at": team.created_at, "updated_at": team.updated_at,
    })


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a team (refuses if any cluster bindings exist — D-04)",
    operation_id="teams_delete",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def delete_team(
    team_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    registry = getattr(request.app.state, "registry", None)
    await service.delete_team(db, registry, team_id=team_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------------------
# Membership
# ----------------------------------------------------------------------------


@router.post(
    "/{team_id}/members",
    status_code=status.HTTP_201_CREATED,
    summary="Add a user to a team (idempotent)",
    operation_id="teams_add_member",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def add_member(
    team_id: int,
    payload: MembershipCreate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    membership = await service.add_member(
        db, team_id=team_id, user_id=payload.user_id,
    )
    return {"team_id": membership.team_id, "user_id": membership.user_id}


@router.delete(
    "/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a user from a team",
    operation_id="teams_remove_member",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def remove_member(
    team_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    await service.remove_member(db, team_id=team_id, user_id=user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
