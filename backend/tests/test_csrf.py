"""CSRF double-submit middleware tests (D-13).

- Cookie-session state-changing request WITHOUT a matching ``X-CSRF-Token``
  header → 403.
- Cookie-session state-changing request WITH a matching header → passes
  (gets through to the handler).
- Bearer ``pat_*`` request without CSRF → passes (PATs bypass CSRF by D-13).
- GET / HEAD / OPTIONS → no CSRF requirement.
"""

from __future__ import annotations

import pytest

from tests.factories import login_as, make_user


@pytest.mark.asyncio
async def test_state_change_without_csrf_header_returns_403(
    client, session_factory
):
    """POST /api/v1/me/password is state-changing and requires CSRF.

    Without ``X-CSRF-Token`` header the request must fail with 403.
    """
    await make_user(session_factory, username="csrf_a", password="testpass12345")
    cookies = await login_as(client, username="csrf_a", password="testpass12345")

    response = await client.post(
        "/api/v1/me/password",
        cookies=cookies,
        json={"current_password": "testpass12345", "new_password": "newpasswd1234"},
    )
    assert response.status_code == 403
    assert "csrf" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_state_change_with_matching_csrf_header_passes(
    client, session_factory
):
    await make_user(session_factory, username="csrf_b", password="testpass12345")
    cookies = await login_as(client, username="csrf_b", password="testpass12345")

    csrf = cookies["csrf_token"]
    response = await client.post(
        "/api/v1/me/password",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"current_password": "testpass12345", "new_password": "newpasswd1234"},
    )
    # Either 200 (password changed) — CSRF gate passed.
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_get_request_does_not_require_csrf(client, session_factory):
    await make_user(session_factory, username="csrf_c", password="testpass12345")
    cookies = await login_as(client, username="csrf_c", password="testpass12345")

    # GET /api/v1/me/ with no X-CSRF-Token header — must succeed.
    response = await client.get("/api/v1/me/", cookies=cookies)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_pat_request_bypasses_csrf(client, session_factory):
    """A request authenticated via ``Authorization: Bearer pat_*`` must NOT
    require CSRF — there's no cookie to forge. D-13 explicitly excludes PAT
    from the CSRF check.
    """
    user = await make_user(
        session_factory, username="csrf_d", password="testpass12345"
    )
    # Create a PAT directly via the service (avoid relying on the routes for
    # this isolation test — Task 2's tests cover routes-vs-service end-to-end).
    from app.pats.service import mint_pat

    async with session_factory() as session:
        # Reattach user to this session.
        from sqlalchemy import select

        from app.models import User

        u = (
            await session.execute(select(User).where(User.id == user.id))
        ).scalar_one()
        minted = await mint_pat(session, user=u, name="csrf_test", expires_at=None)
        await session.commit()
    pat_value = minted.plaintext

    # State-changing POST via PAT — NO csrf header, NO cookie. Must succeed
    # (we use POST /api/v1/me/ssh-keys with valid ed25519 to verify).
    ed25519_pub = (
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAh0fJZ1nVbXopY5b4mYpL3iPv9eqJjr"
        "+tPaCEX5g6Bf csrf-test"
    )
    response = await client.post(
        "/api/v1/me/ssh-keys/",
        headers={"Authorization": f"Bearer {pat_value}"},
        json={"name": "csrf-pat-key", "public_key": ed25519_pub},
    )
    # 201 expected — no CSRF gate, valid PAT auth.
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_bearer_non_pat_rejected_with_401(client, session_factory):
    """A Bearer token that does NOT match ``pat_*`` is rejected at the
    dependency layer (Pitfall A8) — protects against accidental
    JWT-via-Bearer being accepted as a session.
    """
    response = await client.get(
        "/api/v1/me/",
        headers={"Authorization": "Bearer eyJhbGc-not-a-pat-prefix"},
    )
    assert response.status_code == 401
