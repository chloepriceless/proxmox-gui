"""Routes for the authenticated current user.

This router is mounted at ``/api/v1/me`` by :func:`app.main.create_app` with
``tags=["me"]``. Two endpoints in Plan 01-05:

- ``GET /`` — return the current :class:`~app.auth.schemas.MeResponse`. Works
  via either session cookie or Bearer PAT (D-12).
- ``POST /password`` — rotate the user's password; requires the current
  password + a 12+ char new password. CSRF-protected for cookie-mode sessions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.auth.refresh import hash_refresh
from app.auth.schemas import MeResponse, PasswordChangeRequest, TeamSummary
from app.core.db import get_db
from app.models import RefreshToken

router = APIRouter()


@router.get(
    "/",
    response_model=MeResponse,
    summary="Return the current user (cookie OR Bearer PAT)",
    operation_id="me_get",
)
async def me(
    principal: Principal = Depends(get_current_principal),
) -> MeResponse:
    # The User.teams relationship uses lazy="selectin" so the teams list
    # is already populated when we get here.
    return MeResponse(
        id=principal.user.id,
        username=principal.user.username,
        email=principal.user.email,
        is_admin=principal.user.is_admin,
        teams=[TeamSummary.model_validate(t) for t in principal.user.teams],
    )


@router.post(
    "/password",
    summary="Rotate the current user's password",
    operation_id="me_change_password",
    dependencies=[Depends(csrf_protect)],
)
async def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Verify current password, set new, revoke other sessions.

    The user's *current* refresh row is preserved (so they aren't logged out
    of the tab they're using). All other refresh rows are revoked — V3.5 /
    AUTH-07 hardening to evict any compromised secondary session.
    """
    # Determine the current refresh row id so we don't revoke our own session.
    keep_id: int | None = None
    refresh_cookie = request.cookies.get("refresh_token")
    if refresh_cookie:
        token_hash = hash_refresh(refresh_cookie)
        row = (
            await db.execute(
                select(RefreshToken).where(RefreshToken.token_hash == token_hash)
            )
        ).scalar_one_or_none()
        if row is not None:
            keep_id = row.id

    await service.change_password(
        db,
        user=principal.user,
        current=payload.current_password,
        new=payload.new_password,
        keep_session_id=keep_id,
    )
    return {"message": "Password updated. Other sessions revoked."}
