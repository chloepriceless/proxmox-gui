"""Auth business logic — login / refresh / logout / password change.

The HTTP layer (routes.py) is intentionally thin: cookie-setting + status
codes only. All credential checks, hashing, token-row writes, and the
revocation hook for Plan 07 live here.

Threat-model notes:

- :func:`login` ALWAYS calls :func:`verify_password` (either against the
  real row's hash or against :data:`app.core.passwords.DUMMY_HASH` when the
  user doesn't exist). This collapses the cache-miss timing path into the
  cache-hit timing path, mitigating user enumeration (T-01-05-01).
- :func:`refresh` consumes via :func:`app.auth.refresh.consume_refresh`
  which surfaces :class:`ReplayDetected` for chain replay (T-01-05-02).
- :func:`change_password` verifies the *current* password before rotating,
  then revokes every other refresh row (V3.5 session termination) so a
  compromised secondary session can't survive a real-user password rotation.
- :func:`revoke_user_sessions` is the Plan-07 hook called from
  ``disable_user`` — revokes both refresh tokens and PATs in one transaction.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

# Re-exported for tests / consumers — ``InvalidRefresh`` is the broader base
# class and ``ReplayDetected`` extends it.
from app.auth.refresh import (
    InvalidRefresh,  # noqa: E402,F401
    ReplayDetected,  # noqa: F401 - re-exported for routes
    compute_expires_at,
    consume_refresh,
    issue_refresh,
    revoke_all_for_user,
)
from app.config import settings
from app.core.csrf import mint_csrf_token
from app.core.jwt import issue_access_token
from app.core.passwords import DUMMY_HASH, hash_password, verify_password
from app.models import PersonalAccessToken, RefreshToken, User


@dataclass
class LoginResult:
    """Bag-of-secrets returned from :func:`login` and :func:`refresh`.

    The route layer copies these into cookies + a response body. Nothing
    here is persisted — the rotation chain lives in the DB row produced by
    :func:`issue_refresh`.
    """

    user: User
    access_token: str
    refresh_token: str  # plaintext — set cookie + discard
    refresh_row: RefreshToken
    csrf_token: str


async def login(
    db: AsyncSession,
    *,
    username: str,
    password: str,
    user_agent: str | None,
    ip: str | None,
) -> LoginResult:
    """Authenticate ``(username, password)`` and mint a fresh session.

    Raises:
        HTTPException(401): unknown user OR wrong password.
        HTTPException(403): user exists but ``is_active=False``.
    """
    user = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()

    if user is None:
        # T-01-05-01: keep the cache-miss path indistinguishable from a
        # wrong-password path — same number of argon2 verifications.
        verify_password(password, DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )

    access = issue_access_token(user.id, is_admin=user.is_admin)
    refresh_secret, refresh_row = await issue_refresh(
        db,
        user_id=user.id,
        user_agent=user_agent,
        ip=ip,
        expires_at=compute_expires_at(settings.refresh_token_ttl_seconds),
    )
    csrf = mint_csrf_token()
    await db.commit()

    return LoginResult(
        user=user,
        access_token=access,
        refresh_token=refresh_secret,
        refresh_row=refresh_row,
        csrf_token=csrf,
    )


async def refresh(
    db: AsyncSession,
    *,
    refresh_secret: str,
    user_agent: str | None,
    ip: str | None,
) -> LoginResult:
    """Rotate a refresh token: revoke old row, issue new pair.

    Raises:
        InvalidRefresh: row missing / expired / revoked.
        ReplayDetected: token was already rotated — caller MUST clear cookies.

    On replay, the entire chain is revoked (see
    :func:`app.auth.refresh.consume_refresh`).
    """
    # consume_refresh raises ReplayDetected (a subclass of InvalidRefresh)
    # on chain replay; both should be surfaced as 401 by the route layer.
    row = await consume_refresh(db, secret=refresh_secret)

    # Load the owning user — must still be active.
    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        # Mark the row revoked so a future read doesn't keep accepting it.
        row.revoked_at = datetime.now(UTC)
        await db.commit()
        raise InvalidRefresh("user disabled")

    access = issue_access_token(user.id, is_admin=user.is_admin)
    new_secret, new_row = await issue_refresh(
        db,
        user_id=user.id,
        user_agent=user_agent,
        ip=ip,
        expires_at=compute_expires_at(settings.refresh_token_ttl_seconds),
        replaced_from=row,
    )
    csrf = mint_csrf_token()
    await db.commit()

    return LoginResult(
        user=user,
        access_token=access,
        refresh_token=new_secret,
        refresh_row=new_row,
        csrf_token=csrf,
    )


async def logout(
    db: AsyncSession,
    *,
    refresh_secret: str | None,
) -> None:
    """Idempotent logout — revoke the refresh row if present.

    T-01-05-12: a missing / expired / unknown refresh secret is silently
    treated as "already logged out". The route layer always clears cookies
    and returns 200; the audit log (Phase 2) will record the attempt.
    """
    if not refresh_secret:
        return

    from app.auth.refresh import hash_refresh

    token_hash = hash_refresh(refresh_secret)
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()


async def change_password(
    db: AsyncSession,
    *,
    user: User,
    current: str,
    new: str,
    keep_session_id: int | None,
) -> None:
    """Verify ``current`` password, then rotate.

    Side effects:
    - ``user.password_hash`` rewritten to a fresh argon2id digest of ``new``.
    - Every refresh token for the user is revoked EXCEPT ``keep_session_id``
      (the row backing the user's current cookie). V3.5 / session-termination
      hardening.

    Raises:
        HTTPException(403): ``current`` is wrong.
    """
    if not verify_password(current, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(new)
    await db.flush()

    await revoke_all_for_user(db, user_id=user.id, except_id=keep_session_id)
    await db.commit()


async def revoke_user_sessions(
    db: AsyncSession,
    *,
    user_id: int,
) -> None:
    """Plan-07 hook — revoke every session credential the user holds.

    Called from ``disable_user`` (Plan 07's user-admin route). Revokes:

    - All non-revoked refresh tokens for ``user_id``.
    - All non-revoked PATs for ``user_id``.

    AUTH-07 mandates that disabling a user invalidates live sessions
    immediately.
    """
    await revoke_all_for_user(db, user_id=user_id)

    await db.execute(
        update(PersonalAccessToken)
        .where(
            PersonalAccessToken.user_id == user_id,
            PersonalAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
