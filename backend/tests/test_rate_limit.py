"""Rate-limiter tests — carryover ME-02 (Redis-backed relocation).

The limiter moved from ``app.auth.rate_limit`` to ``app.security.rate_limit``
and is re-implemented on Redis with a process-local in-memory fallback. These
tests exercise the public contract (which is unchanged) against whichever
backend is live in the test environment — Redis if reachable, the in-memory
fallback otherwise.
"""

from __future__ import annotations

import time

import pytest


def test_check_rate_allows_under_limit():
    """Attempts under the limit are allowed."""
    from app.security.rate_limit import _reset_for_tests, check_rate

    _reset_for_tests()
    key = "test:under"
    for _ in range(5):
        assert check_rate(key, limit=5, window=60.0) is True


def test_check_rate_blocks_over_limit():
    """The (limit+1)-th attempt within the window is blocked."""
    from app.security.rate_limit import _reset_for_tests, check_rate

    _reset_for_tests()
    key = "test:over"
    for _ in range(5):
        assert check_rate(key, limit=5, window=60.0) is True
    # 6th attempt → blocked.
    assert check_rate(key, limit=5, window=60.0) is False


def test_check_rate_window_expiry_releases_budget():
    """Attempts outside the sliding window no longer count."""
    from app.security.rate_limit import _reset_for_tests, check_rate

    _reset_for_tests()
    key = "test:window"
    # Tiny window so the test is fast.
    assert check_rate(key, limit=2, window=0.3) is True
    assert check_rate(key, limit=2, window=0.3) is True
    assert check_rate(key, limit=2, window=0.3) is False
    time.sleep(0.4)  # let the window slide past the first two attempts
    assert check_rate(key, limit=2, window=0.3) is True


def test_check_rate_keys_are_independent():
    """Different keys (e.g. different IPs) have independent budgets."""
    from app.security.rate_limit import _reset_for_tests, check_rate

    _reset_for_tests()
    assert check_rate("test:ip-a", limit=1, window=60.0) is True
    assert check_rate("test:ip-a", limit=1, window=60.0) is False
    # A different key is unaffected.
    assert check_rate("test:ip-b", limit=1, window=60.0) is True


def test_check_login_rate_default_budget():
    """check_login_rate enforces 10/60s per IP by default."""
    from app.security.rate_limit import _reset_for_tests, check_login_rate

    _reset_for_tests()
    ip = "203.0.113.7"
    for _ in range(10):
        assert check_login_rate(ip) is True
    assert check_login_rate(ip) is False


def test_relocated_module_exists_and_auth_shim_reexports():
    """ME-02: the limiter lives at app.security.rate_limit; the old
    app.auth.rate_limit path still re-exports the public names (shim)."""
    from app.auth import rate_limit as auth_shim
    from app.security import rate_limit as security_rl

    assert auth_shim.check_rate is security_rl.check_rate
    assert auth_shim.check_login_rate is security_rl.check_login_rate


def test_auth_routes_imports_from_security_package():
    """ME-02: auth/routes.py imports the limiter from its new home."""
    import inspect

    import app.auth.routes as routes

    src = inspect.getsource(routes)
    assert "from app.security.rate_limit import" in src


@pytest.mark.asyncio
async def test_login_rate_limit_429_still_enforced(client, session_factory):
    """End-to-end: the relocated limiter still produces a 429 after the
    threshold — the carryover relocation did not regress the behaviour."""
    from app.config import settings
    from tests.factories import make_user

    monkey_proxies = settings.trusted_proxies
    settings.trusted_proxies = ["127.0.0.1", "::1"]
    try:
        await make_user(
            session_factory, username="rl_target", password="testpass12345",
        )
        headers = {"X-Forwarded-For": "198.51.100.9"}
        last_status = None
        for _ in range(11):
            resp = await client.post(
                "/api/v1/auth/login",
                json={"username": "rl_target", "password": "wrong"},
                headers=headers,
            )
            last_status = resp.status_code
        assert last_status == 429
    finally:
        settings.trusted_proxies = monkey_proxies
