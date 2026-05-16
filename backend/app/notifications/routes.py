"""Notifications API — ``GET /notifications`` + ``POST /notifications/seen``.

The notification bell (UI-07) is a *derived view* over the existing ``jobs``
table (D-23) — there is no notification store. Both routes are team-scoped via
``service.list_notifications`` (which resolves the caller's teams the same way
``jobs/routes.jobs_list`` does); a user never sees another tenant's job
completions (T-04-14-03).

- ``GET /notifications`` — the recent terminal job events for the caller's
  teams + an ``unread_count`` derived from the per-user ``NotificationSeen``
  cursor.
- ``POST /notifications/seen`` — stamps the caller's cursor to now (CSRF-
  protected) and returns the refreshed feed so the bell can reset its badge
  in a single round-trip.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.core.db import get_db
from app.notifications import service

router = APIRouter()


class NotificationItem(BaseModel):
    """One completion in the bell feed — a terminal job row, projected.

    A subset of the jobs API's ``JobResponse``: just what the bell row needs
    (the state icon, the title, the timestamp, and enough identity to deep-link
    to the resource).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    state: str
    cluster_id: int | None = None
    team_id: int | None = None
    friendly_error: str | None = None
    created_at: datetime | None = None
    finished_at: datetime | None = None


class NotificationFeed(BaseModel):
    """``GET /notifications`` body — the derived feed + the unread count."""

    model_config = ConfigDict(from_attributes=True)

    items: list[NotificationItem]
    unread_count: int = 0


@router.get(
    "/notifications",
    response_model=NotificationFeed,
    summary="The notification-bell feed — recent task completions + unread count",
    operation_id="notifications_list",
)
async def notifications_list(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> NotificationFeed:
    feed = await service.list_notifications(db, user=principal.user)
    return NotificationFeed.model_validate(feed)


@router.post(
    "/notifications/seen",
    response_model=NotificationFeed,
    summary="Mark the notification feed seen — resets the unread count",
    operation_id="notifications_mark_seen",
    dependencies=[Depends(csrf_protect)],
)
async def notifications_mark_seen(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> NotificationFeed:
    await service.mark_seen(db, user=principal.user)
    feed = await service.list_notifications(db, user=principal.user)
    return NotificationFeed.model_validate(feed)
