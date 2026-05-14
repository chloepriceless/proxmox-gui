"""Refresh-token persistence + rotation with chain-replay detection.

Refresh tokens are stored HASHED (sha256 of the cookie value), not
Fernet-encrypted, because the server only needs to look them up — it never
needs to display the plaintext again. The hash alone provides revocation
without the operational cost of a symmetric reversal.

Rotation flow (Pattern 5 from 01-RESEARCH.md):

1. Client sends the refresh cookie.
2. Server hashes it, looks up the row.
3. If missing → :class:`InvalidRefresh`.
4. If ``expires_at`` is in the past → :class:`InvalidRefresh` (and we mark
   the row revoked for cleanliness).
5. If ``revoked_at`` is set AND ``replaced_by_id`` is also set, this is a
   **replay** of a token that has already been rotated. We walk the chain
   forward, revoke every node, and raise :class:`ReplayDetected`. The
   caller MUST surface this as a 401 + clear cookies.
6. Otherwise (revoked-but-not-replaced, e.g., via logout) → :class:`InvalidRefresh`.

This matches Threat T-01-05-02 mitigation in the plan's threat model.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken


class InvalidRefresh(Exception):
    """Refresh token is unusable (missing / expired / revoked-via-logout)."""


class ReplayDetected(InvalidRefresh):
    """A revoked token whose chain was already rotated has been re-presented.

    Distinct from :class:`InvalidRefresh` so the route layer can return a
    pointed error message ("session compromised") AND so future audit-log
    writers (Phase 2) can record this differently from a benign expiry.
    """


def hash_refresh(secret: str) -> str:
    """sha256 hex digest of the refresh token plaintext.

    Returns a 64-char lowercase hex string — matches the ``token_hash`` column
    type (``String(128)``).
    """
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


async def issue_refresh(
    db: AsyncSession,
    *,
    user_id: int,
    user_agent: str | None,
    ip: str | None,
    expires_at: datetime,
    replaced_from: RefreshToken | None = None,
) -> tuple[str, RefreshToken]:
    """Insert a fresh refresh token row.

    Returns the plaintext secret + the persisted :class:`RefreshToken` row.
    Caller MUST set the cookie with the secret and must NOT log it.

    If ``replaced_from`` is provided, the old row's ``revoked_at`` is set to
    now and its ``replaced_by_id`` is updated to point at the new row — this
    establishes the chain used for replay detection in
    :func:`consume_refresh`.
    """
    secret = secrets.token_urlsafe(48)
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh(secret),
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip,
    )
    db.add(row)
    await db.flush()  # populate row.id for the chain pointer below

    if replaced_from is not None:
        replaced_from.revoked_at = datetime.now(UTC)
        replaced_from.replaced_by_id = row.id
        await db.flush()

    return secret, row


async def consume_refresh(
    db: AsyncSession,
    *,
    secret: str,
) -> RefreshToken:
    """Resolve + validate a refresh cookie value to its row.

    Raises:
        InvalidRefresh: row missing / expired / revoked (not replayed).
        ReplayDetected: row revoked AND already replaced — replay attack.

    On a successful return the caller MUST immediately call
    :func:`issue_refresh` with ``replaced_from=<returned row>`` to rotate.
    """
    token_hash = hash_refresh(secret)
    row = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
    ).scalar_one_or_none()

    if row is None:
        raise InvalidRefresh("not found")

    now = datetime.now(UTC)
    # expires_at may be stored as naive (SQLite strips tzinfo). Normalise.
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if expires_at < now:
        # Best-effort revoke for hygiene; tolerate races with concurrent revoke.
        if row.revoked_at is None:
            row.revoked_at = now
            await db.flush()
        raise InvalidRefresh("expired")

    if row.revoked_at is not None:
        if row.replaced_by_id is not None:
            # Replay of an already-rotated token: revoke the entire chain.
            # COMMIT the revocation here — the caller will raise an HTTP error,
            # and ``get_db`` rolls back on exception. Without an explicit
            # commit the revocations would be lost and a subsequent replay
            # would not see the chain as dead.
            await _revoke_chain(db, head=row)
            await db.commit()
            raise ReplayDetected("session compromised")
        raise InvalidRefresh("revoked")

    return row


async def _revoke_chain(db: AsyncSession, *, head: RefreshToken) -> None:
    """Walk the ``replaced_by_id`` chain forward from ``head`` and revoke
    every reachable row (idempotently). ``head`` itself is already revoked,
    so we walk from ``head.replaced_by_id``.

    Termination: every row has at most one ``replaced_by_id`` (FK to a single
    row), and rotation never creates cycles (a fresh row's ``replaced_by_id``
    is always None at creation time). The walk halts when ``replaced_by_id``
    is None or the row is already revoked.
    """
    now = datetime.now(UTC)
    visited: set[int] = {head.id}
    cursor_id: int | None = head.replaced_by_id

    while cursor_id is not None and cursor_id not in visited:
        visited.add(cursor_id)
        row = await db.get(RefreshToken, cursor_id)
        if row is None:
            break
        if row.revoked_at is None:
            row.revoked_at = now
        cursor_id = row.replaced_by_id

    # Defense in depth: also revoke any sibling chain reachable backwards
    # (a forked rotation should never happen, but if it did the entire family
    # should die). We don't walk backwards explicitly because RefreshToken
    # only has the forward pointer; the head row itself is the leftmost
    # known compromised node.
    await db.flush()


async def revoke_all_for_user(
    db: AsyncSession,
    *,
    user_id: int,
    except_id: int | None = None,
) -> int:
    """Mass-revoke every non-revoked refresh row for ``user_id``.

    Returns the number of rows affected. ``except_id`` (optional) skips one
    row — used by ``change_password`` so the user's current session survives.
    """
    now = datetime.now(UTC)
    stmt = (
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    if except_id is not None:
        stmt = stmt.where(RefreshToken.id != except_id)
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount or 0


def compute_expires_at(ttl_seconds: int) -> datetime:
    """Helper for the route layer — returns ``now + ttl_seconds`` (UTC)."""
    return datetime.now(UTC) + timedelta(seconds=ttl_seconds)
