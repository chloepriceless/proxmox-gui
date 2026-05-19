"""Task 2 (TDD): DB-backed runtime Settings service + admin GET/PATCH routes.

Behaviours under test (05-01-PLAN Task 2):

- GET /api/v1/admin/settings as admin → 200 with idle_timeout_minutes=30,
  audit_retention_days=365 (the migration-seeded defaults).
- GET /api/v1/admin/settings as a non-admin → 403.
- PATCH /api/v1/admin/settings {idle_timeout_minutes: 45} as admin → 200 with
  the new value; a follow-up GET returns 45 (cache invalidated).
- PATCH with idle_timeout_minutes=0 → 422 (ge=1 bound).
- PATCH writes an audit_log row action="settings.update" carrying
  payload_before / payload_after.
- get_setting(db, "idle_timeout_minutes") returns 45 after the PATCH.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import AppSetting, AuditLog
from tests.factories import login_as, make_user


async def _seed_setting_row(session_factory) -> None:
    """The in-memory test schema is built from Base.metadata, not migrations,
    so seed the single app_setting row the migration would otherwise create."""
    async with session_factory() as session:
        existing = await session.get(AppSetting, 1)
        if existing is None:
            session.add(
                AppSetting(
                    id=1, idle_timeout_minutes=30, audit_retention_days=365
                )
            )
            await session.commit()


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """The settings service caches the row per-process; reset between tests."""
    try:
        from app.settings import service as settings_service
    except ImportError:
        yield
        return
    settings_service._cache = None
    yield
    settings_service._cache = None


# ---------------------------------------------------------------------------
# GET /api/v1/admin/settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_settings_admin_returns_defaults(client, session_factory):
    await _seed_setting_row(session_factory)
    await make_user(session_factory, username="set_admin", is_admin=True)
    cookies = await login_as(
        client, username="set_admin", password="testpass12345"
    )

    resp = await client.get("/api/v1/admin/settings/", cookies=cookies)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["idle_timeout_minutes"] == 30
    assert body["audit_retention_days"] == 365


@pytest.mark.asyncio
async def test_get_settings_non_admin_forbidden(client, session_factory):
    await _seed_setting_row(session_factory)
    await make_user(session_factory, username="set_user", is_admin=False)
    cookies = await login_as(
        client, username="set_user", password="testpass12345"
    )

    resp = await client.get("/api/v1/admin/settings/", cookies=cookies)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /api/v1/admin/settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_settings_updates_value_and_invalidates_cache(
    client, session_factory
):
    await _seed_setting_row(session_factory)
    await make_user(session_factory, username="set_patch", is_admin=True)
    cookies = await login_as(
        client, username="set_patch", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.patch(
        "/api/v1/admin/settings/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"idle_timeout_minutes": 45},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["idle_timeout_minutes"] == 45

    # Follow-up GET must reflect the new value (cache invalidated).
    follow = await client.get("/api/v1/admin/settings/", cookies=cookies)
    assert follow.status_code == 200
    assert follow.json()["idle_timeout_minutes"] == 45
    # The untouched field is unchanged.
    assert follow.json()["audit_retention_days"] == 365


@pytest.mark.asyncio
async def test_patch_settings_rejects_zero_idle_timeout(
    client, session_factory
):
    await _seed_setting_row(session_factory)
    await make_user(session_factory, username="set_zero", is_admin=True)
    cookies = await login_as(
        client, username="set_zero", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.patch(
        "/api/v1/admin/settings/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"idle_timeout_minutes": 0},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_patch_settings_writes_audit_row(client, session_factory):
    await _seed_setting_row(session_factory)
    await make_user(session_factory, username="set_audit", is_admin=True)
    cookies = await login_as(
        client, username="set_audit", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.patch(
        "/api/v1/admin/settings/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"audit_retention_days": 90},
    )
    assert resp.status_code == 200, resp.text

    async with session_factory() as session:
        audit = (
            await session.execute(
                select(AuditLog).where(AuditLog.action == "settings.update")
            )
        ).scalar_one_or_none()
        assert audit is not None
        assert audit.payload_before is not None
        assert audit.payload_after is not None
        assert "365" in audit.payload_before
        assert "90" in audit.payload_after


# ---------------------------------------------------------------------------
# Service: get_setting is callable from other modules
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_setting_returns_updated_value(client, session_factory):
    from app.settings.service import get_setting

    await _seed_setting_row(session_factory)
    await make_user(session_factory, username="set_svc", is_admin=True)
    cookies = await login_as(
        client, username="set_svc", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.patch(
        "/api/v1/admin/settings/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"idle_timeout_minutes": 45},
    )
    assert resp.status_code == 200, resp.text

    async with session_factory() as session:
        value = await get_setting(session, "idle_timeout_minutes")
    assert value == 45
