"""``/api/v1/admin/settings`` HTTP routes — DB-backed runtime settings (D-01).

Two routes on the single-row ``app_setting`` resource:

- ``GET /``   — read the current settings. ``require_admin`` only.
- ``PATCH /`` — partial update. ``require_admin`` + ``csrf_protect`` (mutating
  route — same gating rule as the clusters router).

The PATCH route pulls ``source_ip`` and ``correlation_id`` off the request so
the service can write an attributable ``settings.update`` audit row.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal,
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.settings import service
from app.settings.schemas import SettingsResponse, SettingsUpdate

router = APIRouter()


@router.get(
    "/",
    response_model=SettingsResponse,
    summary="Read the runtime settings (idle timeout, audit retention)",
    operation_id="settings_get",
    dependencies=[Depends(require_admin)],
)
async def get_settings(
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    row = await service.get_app_setting(db)
    return SettingsResponse.model_validate(row)


@router.patch(
    "/",
    response_model=SettingsResponse,
    summary="Update the runtime settings (admin)",
    operation_id="settings_patch",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def patch_settings(
    request: Request,
    payload: SettingsUpdate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    row = await service.update_settings(
        db,
        payload=payload,
        principal=principal,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )
    return SettingsResponse.model_validate(row)
