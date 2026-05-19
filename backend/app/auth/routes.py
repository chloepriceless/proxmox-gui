"""``/api/v1/auth/{login,refresh,logout}`` HTTP routes.

The router is mounted by :func:`app.main.create_app` with ``prefix="/api/v1/auth"``
and ``tags=["auth"]``. Cookies follow D-09 / D-13:

- ``access_token``: httpOnly, Secure (when ``cookie_secure=True``), SameSite=Lax,
  ``max_age = access_token_ttl_seconds``, ``path="/"`` so every route sees it.
- ``refresh_token``: same flags, ``max_age = refresh_token_ttl_seconds``,
  ``path="/api/v1/auth"`` — scoped so unrelated routes never even receive it.
- ``csrf_token``: ``httpOnly=False`` (the SPA's JS must read it), Secure,
  SameSite=Lax, ``max_age = refresh_token_ttl_seconds``, ``path="/"``.

The refresh route is exempt from the project's CSRF dependency because the
``refresh_token`` cookie is itself httpOnly — presence is sufficient and a
forged cross-site request can't read it back to fake a header. Documented
inline.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.security.rate_limit import check_login_rate
from app.auth.refresh import (
    IdleExpired,
    InvalidRefresh,
    ReplayDetected,
    hash_refresh,
)
from app.auth.schemas import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RefreshResponse,
)
from app.config import settings
from app.core.db import get_db
from app.models import RefreshToken

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _client_ip(request: Request) -> str:
    """Best-effort client IP for the rate-limit bucket key.

    HI-01 fix: ``X-Forwarded-For`` is honoured ONLY when the TCP peer is
    in :attr:`Settings.trusted_proxies`. Without this guard, an external
    client could forge ``X-Forwarded-For: 1.2.3.4`` on every request and
    each one would look like a different source IP, defeating the 10/60s
    per-IP login rate limit (T-01-05-08).

    In the default single-LXC + Caddy topology, Caddy speaks to the API
    over localhost — the operator sets ``PROXMOX_GUI_TRUSTED_PROXIES``
    to ``["127.0.0.1", "::1"]`` in the systemd unit's environment, and
    the leftmost ``X-Forwarded-For`` token (the original client) is used.
    With the default empty list, the direct TCP peer is always returned,
    which is the safe-by-default behaviour.

    Take only the FIRST value (left-most) per RFC 7239 / common reverse-
    proxy convention — the rest are downstream proxies.
    """
    if request.client is not None and request.client.host in settings.trusted_proxies:
        fwd = request.headers.get("X-Forwarded-For")
        if fwd:
            first = fwd.split(",")[0].strip()
            if first:
                return first
    if request.client is not None:
        return request.client.host
    return "unknown"


def _set_session_cookies(
    response: Response, *, access: str, refresh: str, csrf: str
) -> None:
    """Set the three session cookies per D-09 + D-13."""
    # Cookie attrs shared by access + refresh (both httpOnly).
    secure = settings.cookie_secure
    samesite = settings.cookie_samesite

    response.set_cookie(
        "access_token",
        access,
        max_age=settings.access_token_ttl_seconds,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        max_age=settings.refresh_token_ttl_seconds,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/api/v1/auth",
    )
    # CSRF cookie is JS-readable (D-13) — httpOnly=False so the SPA can copy
    # it into the X-CSRF-Token header on state-changing requests.
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf,
        max_age=settings.refresh_token_ttl_seconds,
        httponly=False,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def _clear_session_cookies(response: Response) -> None:
    """Clear all three cookies with ``Max-Age=0`` (browser-side deletion)."""
    # Path on each cookie must match what was set, otherwise the browser will
    # ignore the deletion (subtle bug — see RFC 6265 §5.4).
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate with username + password",
    operation_id="auth_login",
)
async def login_route(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Login route — intentionally NOT behind ``Depends(csrf_protect)``.

    LO-03: a reader might expect a CSRF dependency here and its absence is
    deliberate. **No CSRF on login — no session cookie exists yet to forge.**
    The CSRF double-submit defence compares a cookie value against a header;
    before login there is no ``csrf_token`` cookie, so there is nothing an
    attacker could forge a request *with*. CSRF protection begins the moment
    ``_set_session_cookies`` mints the trio below.

    CSRF-cookie rotation: every successful ``/refresh`` re-mints the
    ``csrf_token`` cookie (``_set_session_cookies`` is called there too), so
    the token rotates in lock-step with the refresh-token rotation chain — a
    captured CSRF token is only valid until the next refresh (CSRF Q4).
    """
    ip = _client_ip(request)
    if not check_login_rate(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts; please wait and retry",
        )

    user_agent = request.headers.get("User-Agent")

    result = await service.login(
        db,
        username=payload.username,
        password=payload.password,
        user_agent=user_agent,
        ip=ip,
    )
    _set_session_cookies(
        response,
        access=result.access_token,
        refresh=result.refresh_token,
        csrf=result.csrf_token,
    )
    return LoginResponse(
        user_id=result.user.id,
        username=result.user.username,
        email=result.user.email,
        is_admin=result.user.is_admin,
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Rotate the session — issue a fresh access + refresh pair",
    operation_id="auth_refresh",
)
async def refresh_route(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> RefreshResponse:
    """Refresh route exemptions:

    - **No CSRF dependency.** The ``refresh_token`` cookie is itself httpOnly
      so a cross-site forged request can submit it but cannot READ it back to
      fake an ``X-CSRF-Token`` header. The cookie's mere presence + sameSite=Lax
      is the gate. (CSRF Q4 resolution: rotate CSRF on every successful refresh —
      which this route DOES via ``_set_session_cookies``.)
    - **No rate limit gate.** Refresh is implicit (browser-driven); user-visible
      retries are bounded by the access token TTL anyway.
    """
    refresh_cookie = request.cookies.get("refresh_token")
    if not refresh_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    user_agent = request.headers.get("User-Agent")
    ip = _client_ip(request)

    try:
        result = await service.refresh(
            db,
            refresh_secret=refresh_cookie,
            user_agent=user_agent,
            ip=ip,
        )
    except ReplayDetected:
        # T-01-05-02: cascade-revoke happened in consume_refresh. Clear the
        # client's cookies and tell them in plain language.
        _clear_session_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session compromised — log in again.",
        ) from None
    except IdleExpired:
        # AUTH-06 / D-03: idle timeout. IdleExpired is a subclass of
        # InvalidRefresh, so this arm MUST precede the broader one below.
        # The detail string is a stable machine token (not prose) so the SPA
        # can distinguish an idle expiry — show the re-auth modal (D-03) —
        # from a generic invalid-token silent logout.
        _clear_session_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="session_idle_expired",
        ) from None
    except InvalidRefresh:
        _clear_session_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalid or expired",
        ) from None

    _set_session_cookies(
        response,
        access=result.access_token,
        refresh=result.refresh_token,
        csrf=result.csrf_token,
    )
    return RefreshResponse(refreshed_at=datetime.now(UTC))


@router.post(
    "/keepalive",
    summary='Extend the session idle window ("Stay signed in")',
    operation_id="auth_keepalive",
)
async def keepalive_route(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """D-04 — the "Stay signed in" ping behind the idle countdown warning.

    Bumps the live refresh row's ``last_active_at`` so the AUTH-06 idle gate
    in :func:`app.auth.refresh.consume_refresh` sees a fresh session. This
    does NOT rotate the token (no :func:`issue_refresh`) — it is far cheaper
    than burning a rotation and the cookie value stays valid.

    CSRF-exempt for the same reason ``/refresh`` is: the ``refresh_token``
    cookie is httpOnly + SameSite=Lax, so a cross-site forged request can
    submit it but cannot read it back, and this route mints no credential.

    Returns 401 if the cookie is missing or the row is unknown/revoked
    (Threat T-05-01-02 — keepalive cannot forge a session).
    """
    refresh_cookie = request.cookies.get("refresh_token")
    if not refresh_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    token_hash = hash_refresh(refresh_cookie)
    row = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalid or expired",
        )

    row.last_active_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True}


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Log out — revoke the refresh row and clear cookies",
    operation_id="auth_logout",
)
async def logout_route(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LogoutResponse:
    """Idempotent: an unauthenticated client hitting this route still gets 200.

    Plan 07 will compose this with the audit-log writer once Phase-2 ships
    it; for now we just revoke + clear.
    """
    refresh_cookie = request.cookies.get("refresh_token")
    await service.logout(db, refresh_secret=refresh_cookie)
    _clear_session_cookies(response)
    return LogoutResponse()
