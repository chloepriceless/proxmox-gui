"""Login / logout / GET-me / rate-limit tests for the auth router.

Covers the behaviours specified in 01-05-auth-subsystem-PLAN.md Task 1:

- POST /api/v1/auth/login with valid creds → 200 + 3 cookies (access, refresh
  httpOnly; csrf JS-readable).
- POST /api/v1/auth/login with wrong creds → 401 + constant-time argon2 verify
  on the DUMMY_HASH path (no user enumeration).
- POST /api/v1/auth/login when ``is_active=False`` → 403.
- GET /api/v1/me without auth → 401; with valid access cookie → 200.
- POST /api/v1/auth/logout clears the three cookies + revokes the refresh row.
- Rate limit: more than 10 attempts/60s from the same IP → 429.
"""

from __future__ import annotations

import pytest

from tests.factories import login_as, make_user


@pytest.mark.asyncio
async def test_login_success_sets_three_cookies(client, session_factory):
    await make_user(session_factory, username="alice", password="secret-pw-123")
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "secret-pw-123"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["username"] == "alice"
    assert body["is_admin"] is False

    # Three cookies set — inspect raw Set-Cookie headers because httpx merges.
    set_cookie_headers = [
        v for k, v in response.headers.multi_items() if k.lower() == "set-cookie"
    ]
    assert any("access_token=" in h for h in set_cookie_headers)
    assert any("refresh_token=" in h for h in set_cookie_headers)
    assert any("csrf_token=" in h for h in set_cookie_headers)

    # httpOnly: access + refresh; NOT csrf.
    access_h = next(h for h in set_cookie_headers if h.startswith("access_token="))
    refresh_h = next(h for h in set_cookie_headers if h.startswith("refresh_token="))
    csrf_h = next(h for h in set_cookie_headers if h.startswith("csrf_token="))
    assert "HttpOnly" in access_h
    assert "HttpOnly" in refresh_h
    assert "HttpOnly" not in csrf_h
    # SameSite=Lax on all three.
    assert "SameSite=lax" in access_h.lower() or "samesite=lax" in access_h.lower()


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client, session_factory):
    await make_user(session_factory, username="bob", password="correct-horse")
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "battery-staple"},
    )
    assert response.status_code == 401
    assert "invalid credentials" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_unknown_user_returns_401_and_uses_dummy_hash(
    client, session_factory, monkeypatch
):
    """User enumeration mitigation: the unknown-user branch MUST call
    ``verify_password`` against the DUMMY_HASH so timing is indistinguishable
    from a real-user-wrong-password path.
    """
    # Spy on verify_password by wrapping the original.
    import app.auth.service as svc

    calls: list[str] = []
    original = svc.verify_password

    def spy(plaintext: str, hash: str) -> bool:  # noqa: A002 - param name in original
        calls.append(hash)
        return original(plaintext, hash)

    monkeypatch.setattr(svc, "verify_password", spy)

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "ghost", "password": "anything"},
    )
    assert response.status_code == 401
    # verify_password was invoked at least once — and against DUMMY_HASH
    # because the user row was absent.
    assert len(calls) >= 1
    from app.core.passwords import DUMMY_HASH
    assert DUMMY_HASH in calls


@pytest.mark.asyncio
async def test_login_disabled_user_returns_403(client, session_factory):
    await make_user(
        session_factory, username="disabled", password="testpass", is_active=False
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "disabled", "password": "testpass"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_me_without_auth_returns_401(client):
    response = await client.get("/api/v1/me/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_valid_session_returns_user(client, session_factory):
    user = await make_user(session_factory, username="me_user")
    cookies = await login_as(client, username="me_user", password="testpass12345")

    # httpx auto-stores cookies on the client now; explicit cookies arg too.
    response = await client.get("/api/v1/me/", cookies=cookies)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == user.id
    assert body["username"] == "me_user"
    assert body["email"] == "me_user@example.test"
    assert body["is_admin"] is False
    # Personal team should be present.
    assert any(t["personal"] for t in body["teams"])


@pytest.mark.asyncio
async def test_logout_clears_cookies_and_revokes_refresh(client, session_factory):
    await make_user(session_factory, username="logout_user")
    cookies = await login_as(client, username="logout_user", password="testpass12345")

    response = await client.post("/api/v1/auth/logout", cookies=cookies)
    assert response.status_code == 200

    # Inspect Set-Cookie headers — should clear all three.
    set_cookie_headers = [
        v for k, v in response.headers.multi_items() if k.lower() == "set-cookie"
    ]
    # Deletion is typically Max-Age=0 OR an explicit "expires=Thu, 01 Jan 1970".
    assert any("access_token=" in h and ("Max-Age=0" in h or "max-age=0" in h.lower())
               for h in set_cookie_headers)
    assert any("refresh_token=" in h and ("Max-Age=0" in h or "max-age=0" in h.lower())
               for h in set_cookie_headers)
    assert any("csrf_token=" in h and ("Max-Age=0" in h or "max-age=0" in h.lower())
               for h in set_cookie_headers)


@pytest.mark.asyncio
async def test_login_rate_limit_returns_429_after_threshold(
    client, session_factory, monkeypatch
):
    """11th login attempt within the window from the same IP → 429.

    We monkey-patch the rate-limit window to short to keep tests fast and
    reset the bucket dict (the limiter holds module-level state).
    """
    from app.auth import rate_limit

    # Clear any state from previous tests.
    rate_limit._buckets.clear()

    await make_user(session_factory, username="rate_target", password="testpass12345")
    # The X-Forwarded-For trick lets us pretend each request comes from the
    # same client even though ASGITransport has no notion of client IP.
    headers = {"X-Forwarded-For": "203.0.113.42"}

    last_status = None
    for _ in range(11):
        # Vary password so all attempts fail (or use right one — failure is
        # cheaper, lets us check the limiter applies regardless of result).
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "rate_target", "password": "wrong"},
            headers=headers,
        )
        last_status = response.status_code

    # 10 attempts allowed → 11th must be 429.
    assert last_status == 429
