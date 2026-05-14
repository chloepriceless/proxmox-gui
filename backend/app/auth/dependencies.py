"""Auth dependencies — ``get_current_principal`` (cookie OR Bearer PAT),
``require_admin``, ``csrf_protect``.

Pattern 4 from 01-RESEARCH.md. Three semantic invariants every later route
in the project relies on:

1. **D-12:** PATs use the ``Authorization: Bearer pat_*`` header. The prefix
   ``pat_`` is a hard gate — anything that doesn't match the
   ``^pat_[A-Za-z0-9_-]+$`` shape is rejected 401 (Pitfall A8: a stray JWT
   passed as Bearer must NOT be accepted as a session credential).
2. **D-13:** ``csrf_protect`` enforces the double-submit pattern for
   cookie-session state-changing requests. PAT-authenticated requests skip
   the check entirely because there is no cookie to forge.
3. The dependency layer is the SINGLE place that constructs a
   :class:`Principal`. No route should hand-roll auth.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.jwt import decode_access_token
from app.models import User

#: Strict shape match for the PAT prefix portion of an Authorization header.
#: The body uses ``secrets.token_urlsafe`` which only produces
#: ``[A-Za-z0-9_-]``; allowing anything else would weaken Pitfall A8.
_PAT_BEARER_RE = re.compile(r"^pat_[A-Za-z0-9_-]{8,}$")


@dataclass
class Principal:
    """An authenticated identity + the mechanism used to authenticate it.

    Routes that care about CSRF behaviour query ``via_pat``; routes that need
    admin gating query ``user.is_admin`` (or use :func:`require_admin`).
    """

    user: User
    mode: Literal["session", "pat"]

    @property
    def via_pat(self) -> bool:
        return self.mode == "pat"


async def get_current_principal(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Principal:
    """Resolve the request to an authenticated :class:`Principal`.

    Resolution order:

    1. ``Authorization: Bearer pat_*`` — looked up via
       :func:`app.pats.service.resolve_pat`.
    2. ``access_token`` cookie — decoded via JWT.

    Raises:
        HTTPException(401): no recognised credentials, or credentials invalid.
        HTTPException(401): user row missing or ``is_active=False``.
    """
    # 1. Bearer first (explicit beats implicit).
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
        if not _PAT_BEARER_RE.match(token):
            # Pitfall A8: refuse to fall through to cookie auth — a malformed
            # Bearer is an explicit (failed) auth attempt; rejecting it
            # eliminates JWT-via-Bearer ambiguity.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported auth scheme",
            )
        # Lazy import to avoid an import cycle (pats imports auth.dependencies
        # for csrf_protect / Principal).
        from app.pats.service import resolve_pat

        user = await resolve_pat(db, token=token)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid PAT",
            )
        return Principal(user=user, mode="pat")

    # 2. Cookie-based session.
    access = request.cookies.get("access_token")
    if access:
        try:
            payload = decode_access_token(access)
        except Exception as exc:  # noqa: BLE001 — collapse all jwt errors to 401
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session",
            ) from exc
        # ``sub`` is the user id (string). Coerce to int defensively.
        try:
            user_id = int(payload["sub"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session payload",
            ) from exc

        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or disabled",
            )
        return Principal(user=user, mode="session")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


async def require_admin(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    """Gate a route to admin users only.

    Plan 06 (clusters) and Plan 07 (users/teams) compose this on every
    mutating admin route.
    """
    if not principal.user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin required",
        )
    return principal


async def csrf_protect(
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> None:
    """Double-submit CSRF check (D-13).

    Bypasses:
    - Bearer PAT auth (no cookie to forge).
    - Safe methods (GET / HEAD / OPTIONS).

    Otherwise the request MUST carry an ``X-CSRF-Token`` header whose value
    equals the ``csrf_token`` cookie. Comparison is constant-time via
    :func:`app.core.csrf.verify_csrf`.
    """
    if principal.via_pat:
        return
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return

    from app.config import settings  # local import — keep module top minimal
    from app.core.csrf import verify_csrf

    cookie_value = request.cookies.get(settings.csrf_cookie_name)
    header_value = request.headers.get("X-CSRF-Token")
    if not verify_csrf(cookie_value, header_value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF check failed",
        )
