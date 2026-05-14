"""End-to-end route tests for GET /api/v1/audit and GET /api/v1/audit/export.csv."""

from __future__ import annotations

import pytest

from tests.factories import login_as, make_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_audit_row(
    session_factory,
    *,
    actor_user_id: int | None = None,
    team_id: int | None = None,
    action: str = "vm.tag.add",
    result: str = "success",
    error: str | None = None,
    target_id: str | None = "100",
):
    """Insert an AuditLog row directly for test setup."""
    from datetime import datetime, timezone

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.models import AuditLog

    async with session_factory() as session:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            team_id=team_id,
            action=action,
            target_type="vm",
            target_id=target_id,
            result=result,
            error=error,
            occurred_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        session.add(entry)
        await session.commit()


async def _make_pat(client, cookies: dict) -> str:
    """Mint a PAT via the API and return the raw token string."""
    csrf = cookies["csrf_token"]
    resp = await client.post(
        "/api/v1/me/tokens",
        json={"name": "audit-test-pat", "expires_in_days": 30},
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 201, f"PAT mint failed: {resp.text}"
    return resp.json()["token"]


# ---------------------------------------------------------------------------
# Auth gate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_audit_requires_auth(client) -> None:
    """GET /api/v1/audit without credentials returns 401."""
    response = await client.get("/api/v1/audit/")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Admin sees all
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_audit_admin_returns_all(client, session_factory) -> None:
    """Admin can see all audit rows and response matches AuditPage shape."""
    admin = await make_user(
        session_factory, username="auditadmin", password="adminpass12345", is_admin=True
    )
    cookies = await login_as(client, username="auditadmin", password="adminpass12345")

    other = await make_user(
        session_factory, username="auditother", password="otherpass12345"
    )

    await _seed_audit_row(session_factory, actor_user_id=admin.id, action="vm.tag.add")
    await _seed_audit_row(session_factory, actor_user_id=other.id, action="vm.delete")

    response = await client.get("/api/v1/audit/", cookies=cookies)
    assert response.status_code == 200

    data = response.json()
    assert "rows" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert data["total"] >= 2


# ---------------------------------------------------------------------------
# Non-admin RBAC
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_audit_non_admin_filters_to_own(client, session_factory) -> None:
    """Non-admin user only sees their own audit rows by default."""
    me = await make_user(session_factory, username="auditme", password="mepass12345")
    other = await make_user(
        session_factory, username="auditother2", password="otherpass12345"
    )
    cookies = await login_as(client, username="auditme", password="mepass12345")

    await _seed_audit_row(session_factory, actor_user_id=me.id, action="vm.tag.add")
    await _seed_audit_row(session_factory, actor_user_id=other.id, action="vm.delete")

    response = await client.get("/api/v1/audit/", cookies=cookies)
    assert response.status_code == 200

    data = response.json()
    # Non-admin should only see their own rows
    for row in data["rows"]:
        assert row["actor_username"] == "auditme", (
            f"Non-admin saw another user's row: {row}"
        )


# ---------------------------------------------------------------------------
# PAT auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_audit_pat_auth_works(client, session_factory) -> None:
    """Bearer PAT authentication works for GET /api/v1/audit."""
    me = await make_user(
        session_factory, username="auditpatuser", password="patpass12345"
    )
    cookies = await login_as(client, username="auditpatuser", password="patpass12345")

    pat_token = await _make_pat(client, cookies)
    await _seed_audit_row(session_factory, actor_user_id=me.id, action="vm.notes.update")

    # Use Bearer token (no cookies)
    response = await client.get(
        "/api/v1/audit/",
        headers={"Authorization": f"Bearer {pat_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_export_csv_returns_text_csv_with_bom(client, session_factory) -> None:
    """GET /api/v1/audit/export.csv returns text/csv with UTF-8 BOM."""
    admin = await make_user(
        session_factory,
        username="csvadmin",
        password="csvadminpass12345",
        is_admin=True,
    )
    cookies = await login_as(client, username="csvadmin", password="csvadminpass12345")

    await _seed_audit_row(session_factory, actor_user_id=admin.id, action="vm.create")

    response = await client.get("/api/v1/audit/export.csv", cookies=cookies)
    assert response.status_code == 200

    # Check BOM
    assert response.content[:3] == b"\xef\xbb\xbf", (
        f"Expected UTF-8 BOM, got {response.content[:3]!r}"
    )

    # Check Content-Disposition header
    disp = response.headers.get("content-disposition", "")
    assert "attachment" in disp, f"Expected attachment in Content-Disposition: {disp}"

    # Check media type
    ct = response.headers.get("content-type", "")
    assert "text/csv" in ct, f"Expected text/csv content-type, got: {ct}"


@pytest.mark.asyncio
async def test_export_csv_too_many_rows_returns_409(
    client, session_factory, monkeypatch
) -> None:
    """Export with row count > HARD_EXPORT_LIMIT returns 409 with detail."""
    admin = await make_user(
        session_factory,
        username="csvlimitadmin",
        password="csvlimitpass12345",
        is_admin=True,
    )
    cookies = await login_as(
        client, username="csvlimitadmin", password="csvlimitpass12345"
    )

    # Seed 3 rows
    for i in range(3):
        await _seed_audit_row(
            session_factory,
            actor_user_id=admin.id,
            action=f"vm.limit.{i}",
            target_id=str(i),
        )

    # Patch the limit to 2 so 3 rows exceeds it
    import app.audit.reader as reader_module
    import app.audit.routes as routes_module

    monkeypatch.setattr(reader_module, "HARD_EXPORT_LIMIT", 2)
    monkeypatch.setattr(routes_module, "HARD_EXPORT_LIMIT", 2)

    response = await client.get("/api/v1/audit/export.csv", cookies=cookies)
    assert response.status_code == 409, f"Expected 409, got {response.status_code}"
    body = response.json()
    assert "limit" in body.get("detail", {}), f"Expected limit in detail: {body}"


@pytest.mark.asyncio
async def test_csv_filter_chained_with_action(client, session_factory) -> None:
    """action= query param filters rows in CSV export."""
    admin = await make_user(
        session_factory,
        username="csvfilteradmin",
        password="csvfilterpass12345",
        is_admin=True,
    )
    cookies = await login_as(
        client, username="csvfilteradmin", password="csvfilterpass12345"
    )

    await _seed_audit_row(
        session_factory, actor_user_id=admin.id, action="vm.create", target_id="1"
    )
    await _seed_audit_row(
        session_factory, actor_user_id=admin.id, action="vm.delete", target_id="2"
    )
    await _seed_audit_row(
        session_factory, actor_user_id=admin.id, action="quota.update", target_id="3"
    )

    response = await client.get(
        "/api/v1/audit/export.csv?action=vm.create",
        cookies=cookies,
    )
    assert response.status_code == 200
    text = response.content.decode("utf-8-sig")
    assert "vm.create" in text
    assert "vm.delete" not in text
    assert "quota.update" not in text
