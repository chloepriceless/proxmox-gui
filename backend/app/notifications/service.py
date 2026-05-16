"""Notification-feed service — a *derived view* over the ``jobs`` table (D-23).

The notification bell surfaces task *completions* only (D-22) — the feed is
the recent terminal (``succeeded`` / ``failed``) rows of the existing ``jobs``
table, scoped to the caller's teams exactly as ``jobs/service.list_jobs`` does.
There is NO separate notification store: the only persisted state is the
per-user ``NotificationSeen`` cursor, and the unread count is simply the number
of feed rows newer than that cursor.

Transaction discipline mirrors ``jobs/service.py`` — ``mark_seen`` is the only
writer and it owns its commit.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.inventory.access import _team_ids_for_user
from app.jobs import service as jobs_service
from app.models import Job, NotificationSeen, User

#: Terminal job states the bell surfaces — completions only (D-22). In-flight
#: states (``pending`` / ``claimed`` / ``running``) are deliberately excluded.
TERMINAL_STATES: frozenset[str] = frozenset({"succeeded", "failed"})

#: How many recent terminal rows the feed carries (bell panel is scrollable but
#: bounded — mirrors the jobs drawer's 50-row trim).
FEED_LIMIT = 50


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _as_aware(value: datetime | None) -> datetime | None:
    """Treat a naive DB timestamp as UTC so cursor comparisons never crash.

    SQLite stores ``CURRENT_TIMESTAMP`` without a tz; ``created_at`` /
    ``last_seen_at`` come back naive. Comparing a naive and an aware datetime
    raises — normalise both ends to aware-UTC before any ``>`` comparison.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


async def _get_seen_cursor(
    db: AsyncSession, *, user_id: int
) -> NotificationSeen | None:
    """Return the caller's NotificationSeen row (the unread cursor), or None."""
    result = await db.execute(
        select(NotificationSeen).where(NotificationSeen.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_notifications(db: AsyncSession, *, user: User) -> dict:
    """Return the caller's derived completions feed + the unread count.

    The feed is the recent terminal ``jobs`` rows for the user's teams (D-22 —
    completions only, in-flight excluded). ``unread_count`` is the number of
    feed rows with a ``created_at`` newer than the caller's ``NotificationSeen``
    cursor; with no cursor row yet every feed row counts as unread.
    """
    team_ids = await _team_ids_for_user(db, user_id=user.id)
    # Read recent jobs straight from the jobs table (D-23 — no new storage),
    # then keep only the terminal ones. The fetch is widened so the terminal
    # filter still yields a full page even when in-flight rows are interleaved.
    recent = await jobs_service.list_recent_jobs(
        db, team_ids, limit=FEED_LIMIT * 4
    )
    feed: list[Job] = [
        j for j in recent if j.state in TERMINAL_STATES
    ][:FEED_LIMIT]

    cursor = await _get_seen_cursor(db, user_id=user.id)
    last_seen = _as_aware(cursor.last_seen_at) if cursor is not None else None

    if last_seen is None:
        unread_count = len(feed)
    else:
        unread_count = sum(
            1
            for j in feed
            if (created := _as_aware(j.created_at)) is not None
            and created > last_seen
        )

    return {"items": feed, "unread_count": unread_count}


async def mark_seen(db: AsyncSession, *, user: User) -> None:
    """Upsert the caller's NotificationSeen cursor to now — clears the count.

    One row per user (UNIQUE(user_id)); an existing row is updated in place so
    re-opening the bell never spawns a duplicate cursor.
    """
    cursor = await _get_seen_cursor(db, user_id=user.id)
    now = _utcnow()
    if cursor is None:
        db.add(NotificationSeen(user_id=user.id, last_seen_at=now))
    else:
        cursor.last_seen_at = now
    await db.commit()
