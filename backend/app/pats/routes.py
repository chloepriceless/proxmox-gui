"""``/api/v1/me/tokens`` PAT CRUD routes.

Mounted by :func:`app.main.create_app` with ``tags=["tokens"]``. All routes
require a session-mode principal (cookie). **PAT-authenticated requests are
explicitly rejected** — a PAT cannot manage other PATs (T-01-05-10
elevation-of-privilege mitigation).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.core.db import get_db
from app.models import PersonalAccessToken
from app.pats import service
from app.pats.schemas import PATCreate, PATListItem, PATMintResponse

router = APIRouter()


def _reject_pat_auth(principal: Principal) -> None:
    """T-01-05-10: PAT cannot manage PATs."""
    if principal.via_pat:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PAT cannot manage tokens",
        )


def _prefix_preview(row: PersonalAccessToken) -> str:
    """Return ``"pat_<first-8-of-lookup_prefix>..."`` — never a full secret."""
    return f"pat_{row.lookup_prefix[:8]}..."


def _to_list_item(row: PersonalAccessToken) -> PATListItem:
    return PATListItem(
        id=row.id,
        name=row.name,
        prefix_preview=_prefix_preview(row),
        expires_at=row.expires_at,
        last_used_at=row.last_used_at,
        revoked_at=row.revoked_at,
        created_at=row.created_at,
    )


@router.get(
    "/",
    response_model=list[PATListItem],
    summary="List the current user's PATs (metadata only)",
    operation_id="tokens_list",
)
async def list_tokens(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[PATListItem]:
    _reject_pat_auth(principal)
    rows = (
        await db.execute(
            select(PersonalAccessToken)
            .where(PersonalAccessToken.user_id == principal.user.id)
            .order_by(PersonalAccessToken.created_at, PersonalAccessToken.id)
        )
    ).scalars().all()
    return [_to_list_item(r) for r in rows]


@router.post(
    "/",
    response_model=PATMintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Mint a new PAT — plaintext returned ONCE",
    operation_id="tokens_create",
    dependencies=[Depends(csrf_protect)],
)
async def create_token(
    payload: PATCreate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> PATMintResponse:
    _reject_pat_auth(principal)
    minted = await service.mint_pat(
        db,
        user=principal.user,
        name=payload.name,
        expires_at=payload.expires_at,
    )
    await db.commit()
    return PATMintResponse(
        id=minted.row.id,
        name=minted.row.name,
        expires_at=minted.row.expires_at,
        plaintext=minted.plaintext,
        created_at=minted.row.created_at,
    )


@router.delete(
    "/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a PAT",
    operation_id="tokens_delete",
    dependencies=[Depends(csrf_protect)],
)
async def delete_token(
    token_id: int,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _reject_pat_auth(principal)
    await service.revoke_pat(
        db, pat_id=token_id, user_id=principal.user.id
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
