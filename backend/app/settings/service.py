"""Runtime-settings service — lazy-loaded single row + in-process cache.

The ``app_setting`` table holds exactly one row (``id == 1``). Reads are hot
(the idle check in :func:`app.auth.refresh.consume_refresh` calls
:func:`get_setting` on every token refresh) so the row is cached in a
module-level ``_cache``.

Cache invariant (RESEARCH §Pattern 3): each process owns its own cache. The
API process invalidates ``_cache`` on every :func:`update_settings` write. The
arq WORKER process does NOT share this module state — the worker reads the
``app_setting`` row directly from the DB on each cron run, so there is no
cross-process invalidation problem and no IPC is needed.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.models import AppSetting
from app.settings.schemas import SettingsUpdate

# Module-level per-process cache of the single app_setting row. The API
# invalidates this on write; the worker never touches it (see module docstring).
_cache: AppSetting | None = None


def _row_payload(row: AppSetting) -> dict:
    """Snapshot the mutable settings fields for the audit before/after diff."""
    return {
        "idle_timeout_minutes": row.idle_timeout_minutes,
        "audit_retention_days": row.audit_retention_days,
    }


async def get_app_setting(db: AsyncSession) -> AppSetting:
    """Return the single :class:`AppSetting` row (id=1), lazy-loading + caching.

    NULL-defensive: if the row is somehow missing (a DB that predates the
    0007 seed, or a test schema built from ``Base.metadata`` without the seed),
    return a default-valued, un-persisted instance so callers never crash.
    """
    global _cache
    if _cache is not None:
        return _cache
    row = await db.get(AppSetting, 1)
    if row is None:
        # Defensive fallback — D-02 / D-06 defaults. NOT persisted here.
        row = AppSetting(
            id=1,
            idle_timeout_minutes=30,
            audit_retention_days=365,
            updated_at=datetime.now(UTC),
        )
    _cache = row
    return row


async def get_setting(db: AsyncSession, key: str) -> int:
    """Convenience reader — returns a single integer setting by attribute name.

    Used by the auth idle check (``idle_timeout_minutes``) and the
    audit-retention cron (``audit_retention_days``).
    """
    return int(getattr(await get_app_setting(db), key))


async def update_settings(
    db: AsyncSession,
    *,
    payload: SettingsUpdate,
    principal: Principal,
    source_ip: str | None,
    correlation_id: str | None = None,
) -> AppSetting:
    """Apply a partial settings update, audit it, and invalidate the cache.

    Only the keys present in the PATCH body (``exclude_unset``) are written.
    Writes a ``settings.update`` audit row with before/after payloads
    (Threat T-05-01-05 — every runtime-config change is attributable).
    """
    global _cache
    row = await db.get(AppSetting, 1)
    if row is None:
        # The single row should exist (migration seeds it); create it if a
        # pre-0007 DB or a metadata-built test schema is missing it.
        row = AppSetting(
            id=1, idle_timeout_minutes=30, audit_retention_days=365
        )
        db.add(row)
        await db.flush()

    before = _row_payload(row)

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(row, key, value)
    row.updated_at = datetime.now(UTC)
    row.updated_by_user_id = principal.user.id
    await db.flush()

    after = _row_payload(row)

    await audit_write(
        db,
        actor_user_id=principal.user.id,
        team_id=None,  # global config — no team
        cluster_id=None,
        action="settings.update",
        target_type="settings",
        target_id="1",
        result="success",
        source_ip=source_ip,
        correlation_id=correlation_id,
        payload_before=before,
        payload_after=after,
    )

    await db.commit()
    # Invalidate the per-process cache so the next read reflects the write.
    _cache = None
    return row
