"""``/api/v1/users`` HTTP routes — admin-only.

Every route composes :func:`app.auth.dependencies.require_admin`. Mutating
routes additionally compose :func:`app.auth.dependencies.csrf_protect` for
cookie-session protection (PAT auth bypasses CSRF — see
``csrf_protect`` docstring).

The current admin's user id is read from the principal in each route and
forwarded as ``current_admin_user_id`` to the service layer for the
self-modification guards (T-01-07-03/04/05).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal,
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.core.db import get_db
from app.users import service
from app.users.schemas import (
    AdminPasswordRequest,
    MembershipAdd,
    UserCreate,
    UserCreateResponse,
    UserDetailResponse,
    UserResponse,
    UserUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response_model=list[UserResponse],
    summary="List all users (admin)",
    operation_id="users_list",
    dependencies=[Depends(require_admin)],
)
async def list_users(
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    users = await service.list_users(db)
    return [UserResponse.model_validate(u) for u in users]


@router.post(
    "/",
    response_model=UserCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user + auto-personal-team (admin)",
    operation_id="users_create",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserCreateResponse:
    user, personal_team = await service.create_user(
        db,
        username=payload.username,
        email=payload.email,
        password=payload.password,
        is_admin=payload.is_admin,
        team_ids=payload.team_ids,
    )
    # Re-fetch with selectinload to populate teams in the response.
    user = await service.get_user(db, user_id=user.id)
    return UserCreateResponse.model_validate({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "teams": user.teams,
        "personal_team_id": personal_team.id,
    })


@router.get(
    "/{user_id}",
    response_model=UserDetailResponse,
    summary="Read a single user (admin)",
    operation_id="users_get",
    dependencies=[Depends(require_admin)],
)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> UserDetailResponse:
    user = await service.get_user(db, user_id=user_id)
    return UserDetailResponse.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Patch a user — disable triggers session revocation (AUTH-07)",
    operation_id="users_patch",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def patch_user(
    user_id: int,
    payload: UserUpdate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # ``model_dump(exclude_unset=True)`` — only fields the caller actually
    # supplied participate. Differentiates "set to None" from "not present".
    payload_dict = payload.model_dump(exclude_unset=True)
    user = await service.update_user(
        db,
        user_id=user_id,
        payload=payload_dict,
        current_admin_user_id=principal.user.id,
    )
    # Re-fetch with selectinload for the response.
    user = await service.get_user(db, user_id=user.id)
    return UserResponse.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user (admin) — self-delete blocked",
    operation_id="users_delete",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def delete_user(
    user_id: int,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await service.delete_user(
        db,
        user_id=user_id,
        current_admin_user_id=principal.user.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Admin password reset
# ---------------------------------------------------------------------------


@router.post(
    "/{user_id}/password",
    summary="Admin sets a new password (revokes all the user's sessions)",
    operation_id="users_set_password",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def set_password(
    user_id: int,
    payload: AdminPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await service.set_user_password(
        db, user_id=user_id, new_password=payload.new_password,
    )
    return {"message": "Password updated. User sessions revoked."}


# ---------------------------------------------------------------------------
# Membership add/remove
# ---------------------------------------------------------------------------


@router.post(
    "/{user_id}/teams",
    status_code=status.HTTP_201_CREATED,
    summary="Add a user to a team (admin)",
    operation_id="users_add_team",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def add_team(
    user_id: int,
    payload: MembershipAdd,
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    membership = await service.add_user_to_team(
        db, user_id=user_id, team_id=payload.team_id,
    )
    return {"team_id": membership.team_id, "user_id": membership.user_id}


@router.delete(
    "/{user_id}/teams/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a user from a team (admin)",
    operation_id="users_remove_team",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def remove_team(
    user_id: int,
    team_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    await service.remove_user_from_team(
        db, user_id=user_id, team_id=team_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
