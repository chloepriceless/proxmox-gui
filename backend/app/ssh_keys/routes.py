"""``/api/v1/me/ssh-keys`` CRUD routes.

Mounted by :func:`app.main.create_app` with ``tags=["ssh-keys"]``. All routes
require :func:`~app.auth.dependencies.get_current_principal`; state-changing
routes additionally require :func:`~app.auth.dependencies.csrf_protect`.

Auth works in either mode (D-12 + D-13): a session cookie carries the user's
CSRF cookie + header pair; a Bearer ``pat_*`` skips CSRF entirely.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.core.db import get_db
from app.ssh_keys import service
from app.ssh_keys.schemas import (
    SshKeyCreate,
    SshKeyDetailResponse,
    SshKeyResponse,
)

router = APIRouter()


@router.get(
    "/",
    response_model=list[SshKeyResponse],
    summary="List the current user's SSH keys",
    operation_id="ssh_keys_list",
)
async def list_keys(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[SshKeyResponse]:
    rows = await service.list_ssh_keys(db, user_id=principal.user.id)
    return [SshKeyResponse.model_validate(r) for r in rows]


@router.get(
    "/{key_id}",
    response_model=SshKeyDetailResponse,
    summary="Get one SSH key (including the public-key text)",
    operation_id="ssh_keys_get",
)
async def get_key(
    key_id: int,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SshKeyDetailResponse:
    row = await service.get_ssh_key(db, key_id=key_id, user_id=principal.user.id)
    return SshKeyDetailResponse.model_validate(row)


@router.post(
    "/",
    response_model=SshKeyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an SSH public key to the current user",
    operation_id="ssh_keys_create",
    dependencies=[Depends(csrf_protect)],
)
async def create_key(
    payload: SshKeyCreate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SshKeyResponse:
    row = await service.add_ssh_key(
        db,
        user=principal.user,
        name=payload.name,
        public_key=payload.public_key,
    )
    await db.commit()
    return SshKeyResponse.model_validate(row)


@router.delete(
    "/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one of the current user's SSH keys",
    operation_id="ssh_keys_delete",
    dependencies=[Depends(csrf_protect)],
)
async def delete_key(
    key_id: int,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await service.delete_ssh_key(
        db, key_id=key_id, user_id=principal.user.id
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
