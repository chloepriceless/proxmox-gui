"""``/api/v1/setup`` HTTP routes — first-run wizard backend.

NO authentication on either endpoint:

- ``GET /status`` is read-only and never reveals secrets — the predicate
  flags are usable by an unauthenticated frontend to render the wizard.
- ``POST /admin`` is open IFF :func:`app.setup.service.no_admin_yet`
  returns True. Once an admin exists the endpoint returns 409.

NO CSRF dependency on either endpoint: there is no session yet, so there
is no ``csrf_token`` cookie to compare against. The double-submit pattern
applies only to authenticated cookie-session routes.

There is intentionally NO ``/api/v1/setup/cluster`` route. Cluster
registration during the wizard goes through the authenticated admin's
session via :mod:`app.clusters.routes` (Plan 08's UI auto-logs-in after
the admin step and presents the cluster step as an authenticated screen).
This is per CONTEXT D-18 (lenient first-run): the only mandatory step is
admin creation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.setup import service
from app.setup.schemas import (
    SetupAdminRequest,
    SetupAdminResponse,
    SetupStatusResponse,
)

router = APIRouter()


@router.get(
    "/status",
    response_model=SetupStatusResponse,
    summary="First-run setup predicate flags (open endpoint)",
    operation_id="setup_status",
)
async def setup_status(
    db: AsyncSession = Depends(get_db),
) -> SetupStatusResponse:
    """Returns ``{no_admin_yet, cluster_count}``.

    Always 200. Open endpoint: the SPA needs to know whether to render
    the wizard before any user has logged in.
    """
    return SetupStatusResponse(
        no_admin_yet=await service.no_admin_yet(db),
        cluster_count=await service.cluster_count(db),
    )


@router.post(
    "/admin",
    response_model=SetupAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create the initial admin user (one-shot, gated on no_admin_yet)",
    operation_id="setup_create_admin",
)
async def setup_create_admin(
    payload: SetupAdminRequest,
    db: AsyncSession = Depends(get_db),
) -> SetupAdminResponse:
    """Create the very first admin + their personal team.

    Returns 409 if an admin already exists (one-shot endpoint). Returns
    422 on schema validation failure (password < 12, bad username, bad
    email).

    The frontend (Plan 08 wizard step 2) auto-logs-in via
    ``POST /api/v1/auth/login`` immediately after this 201.
    """
    user, team = await service.create_initial_admin(
        db,
        username=payload.username,
        email=payload.email,
        password=payload.password,
    )
    return SetupAdminResponse(
        user_id=user.id,
        personal_team_id=team.id,
        username=user.username,
    )
