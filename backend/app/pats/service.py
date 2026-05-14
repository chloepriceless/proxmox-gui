"""PAT issuance + resolution (Pattern 6 from 01-RESEARCH.md).

Storage shape:

- ``lookup_prefix`` — first 12 chars of the token body (after the ``pat_``
  prefix). Indexed for ~O(1) candidate lookup.
- ``token_hash`` — ``sha256(pat_pepper + full_token).hexdigest()``. The
  pepper is loaded from ``/etc/proxmox-gui/pat.pepper`` (Plan 04 ships the
  generator).

Constant-time properties:

- The DB index narrows the candidate set by ``lookup_prefix``, typically to
  one row. Within that set, :func:`secrets.compare_digest` is used for the
  hash compare (T-01-05-07).
- Plaintext value is shown to the user ONCE on creation. The route layer
  returns it in the POST response; subsequent GETs return only the metadata
  + a non-secret ``prefix_preview`` (first 8 chars after ``pat_``).
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import PersonalAccessToken, User

# Constant — also referenced by app.auth.dependencies for the Bearer regex.
PAT_PREFIX = "pat_"
LOOKUP_PREFIX_LEN = 12


@dataclass
class MintedPAT:
    """Returned from :func:`mint_pat`.

    ``plaintext`` is shown to the client ONCE. ``row`` is the persisted
    ORM object (caller may render its ``id`` / ``created_at`` etc.).
    """

    plaintext: str
    row: PersonalAccessToken


def _hash_pat(plaintext: str) -> str:
    """``sha256(pat_pepper || plaintext).hexdigest()`` — 64 lowercase hex chars."""
    h = hashlib.sha256()
    h.update(settings.pat_pepper.encode("utf-8"))
    h.update(plaintext.encode("utf-8"))
    return h.hexdigest()


async def mint_pat(
    db: AsyncSession,
    *,
    user: User,
    name: str,
    expires_at: datetime | None,
) -> MintedPAT:
    """Generate a new PAT and persist its hash + prefix.

    The caller MUST surface the returned plaintext in the API response
    exactly once. The DB row contains only the hash + indexed lookup prefix.

    Raises:
        HTTPException(409): a PAT with that name already exists for this user.
        HTTPException(422): ``expires_at`` is in the past.
    """
    if expires_at is not None:
        # Normalise to UTC-aware for comparison.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="expires_at must be in the future",
            )

    # Reject duplicate (user_id, name) early — UQ would catch this too but
    # the explicit 409 is a nicer DX than the generic IntegrityError.
    existing = (
        await db.execute(
            select(PersonalAccessToken).where(
                PersonalAccessToken.user_id == user.id,
                PersonalAccessToken.name == name,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A token with that name already exists",
        )

    body = secrets.token_urlsafe(18)  # ≈24 url-safe chars
    plaintext = f"{PAT_PREFIX}{body}"
    lookup_prefix = body[:LOOKUP_PREFIX_LEN]
    token_hash = _hash_pat(plaintext)

    row = PersonalAccessToken(
        user_id=user.id,
        name=name,
        lookup_prefix=lookup_prefix,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(row)
    await db.flush()

    return MintedPAT(plaintext=plaintext, row=row)


async def resolve_pat(
    db: AsyncSession,
    *,
    token: str,
) -> User | None:
    """Look up a PAT by plaintext value, returning the owning user or None.

    Returns None for any failure mode (bad prefix, no row, revoked, expired,
    hash mismatch). Constant-time within the prefix candidate set via
    :func:`secrets.compare_digest`. Updates ``last_used_at`` on a hit.
    """
    if not token.startswith(PAT_PREFIX):
        return None
    body = token[len(PAT_PREFIX):]
    if not body:
        return None
    lookup_prefix = body[:LOOKUP_PREFIX_LEN]

    candidates = (
        await db.execute(
            select(PersonalAccessToken)
            .where(PersonalAccessToken.lookup_prefix == lookup_prefix)
            .options(selectinload(PersonalAccessToken.user))  # type: ignore[arg-type]
            if hasattr(PersonalAccessToken, "user")
            else select(PersonalAccessToken).where(
                PersonalAccessToken.lookup_prefix == lookup_prefix
            )
        )
    ).scalars().all()

    target_hash = _hash_pat(token)
    now = datetime.now(UTC)

    for c in candidates:
        if c.revoked_at is not None:
            continue
        if c.expires_at is not None:
            exp = c.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=UTC)
            if exp < now:
                continue
        # Constant-time hash compare (T-01-05-07).
        if not secrets.compare_digest(c.token_hash, target_hash):
            continue

        # Best-effort last_used_at update. If a concurrent revoke races, the
        # update is a no-op; we still return the user because the row was
        # valid at decision time.
        await db.execute(
            update(PersonalAccessToken)
            .where(PersonalAccessToken.id == c.id)
            .values(last_used_at=now)
        )
        await db.flush()

        # Load the user (PersonalAccessToken has no `user` relationship in
        # the Phase-1 model — fetch by id).
        user = await db.get(User, c.user_id)
        if user is None or not user.is_active:
            return None
        return user

    return None


async def revoke_pat(
    db: AsyncSession,
    *,
    pat_id: int,
    user_id: int,
) -> None:
    """Set ``revoked_at`` on a PAT owned by ``user_id``.

    Raises ``HTTPException(404)`` if the row doesn't exist OR is owned by a
    different user — same response shape, never leaks cross-user existence
    (T-01-05-11).
    """
    now = datetime.now(UTC)
    result = await db.execute(
        update(PersonalAccessToken)
        .where(
            PersonalAccessToken.id == pat_id,
            PersonalAccessToken.user_id == user_id,
            PersonalAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    if (result.rowcount or 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found",
        )
    await db.flush()
