"""Admin user CRUD service layer (Plan 01-07 Task 2).

Owns the AUTH-07 + AUTH-08 contract:

- :func:`create_user` — insert + auto-personal-team + optional shared-team
  memberships. Personal-team naming follows D-05 (``personal-<user_id>``).
- :func:`list_users` / :func:`get_user` — selectinload teams.
- :func:`update_user` — field-by-field; on ``is_active`` True→False
  transition calls :func:`app.auth.service.revoke_user_sessions` (T-01-07-06).
  On ``team_ids`` payload, REPLACES non-personal memberships.
- :func:`delete_user` — single-transaction atomic delete (HI-03):
  inline-revokes refresh tokens + PATs, deletes the personal team, then
  the user, all in one ``await db.commit()``. A mid-flow exception leaves
  the entire operation rolled back; no half-deleted ghost accounts.
- :func:`set_user_password` — admin password reset; revokes sessions.
- :func:`add_user_to_team` / :func:`remove_user_from_team` — membership
  CRUD (rejects personal teams — D-05).

Self-modification guard (T-01-07-03/04/05) lives at the route layer where
``current_admin_user_id`` is bound from the principal — but the service
functions accept the id and enforce the rule, so direct callers (admin
CLI scripts, tests) get the same protection.

All mutating service functions commit their own transactions before
returning, mirroring the pattern Plan 05 established (see
``app.auth.service.revoke_user_sessions`` docstring).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.service import revoke_user_sessions
from app.core.passwords import hash_password
from app.models import PersonalAccessToken, RefreshToken, Team, TeamMembership, User
from app.teams import service as teams_service

# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def create_user(
    db: AsyncSession,
    *,
    username: str,
    email: str,
    password: str,
    is_admin: bool = False,
    team_ids: list[int] | None = None,
) -> tuple[User, Team]:
    """Insert a User + their personal Team + optional shared memberships.

    Personal team naming: ``personal-<user_id>`` (D-05). No PVE bootstrap on
    personal teams. IN-02 + ME-01: the personal team is created via
    :func:`teams_service.create_team_for_admin_bootstrap`, which flushes but
    does NOT commit — so the User, the personal Team, the personal-team
    membership and any shared memberships all land in ONE atomic transaction
    committed once at the end. The Phase-1 path called ``create_team`` which
    committed mid-flight, leaving a window where a crash could orphan a team.

    Shared-team memberships in ``team_ids``:

    - Each id MUST refer to an existing non-personal team. Personal
      team_ids are rejected with 422 (D-05).
    - Memberships are inserted in the same transaction as the user.

    Raises:
        HTTPException(409): username/email uniqueness violation.
        HTTPException(422): team_ids contains a personal team or unknown id.
    """
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        is_admin=is_admin,
        is_active=True,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from exc

    # D-05 + IN-02: auto-create the personal team via the no-commit internal
    # bootstrap path so the whole User + Team + membership operation commits
    # atomically below (ME-01).
    personal_team = await teams_service.create_team_for_admin_bootstrap(
        db,
        name=f"personal-{user.id}",
    )
    db.add(TeamMembership(team_id=personal_team.id, user_id=user.id))

    # Optional shared-team memberships.
    if team_ids:
        await _add_shared_memberships(db, user_id=user.id, team_ids=team_ids)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from exc
    await db.refresh(user)
    await db.refresh(personal_team)
    return user, personal_team


async def _add_shared_memberships(
    db: AsyncSession, *, user_id: int, team_ids: list[int],
) -> None:
    """Validate + insert TeamMembership rows for shared teams only.

    Validation rules:
    - Each team must exist (404 → 422 here since the request body is the
      problem, not the URL).
    - Each team must NOT be personal (D-05).
    """
    if not team_ids:
        return
    teams = (
        await db.execute(select(Team).where(Team.id.in_(team_ids)))
    ).scalars().all()
    if len(teams) != len(set(team_ids)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="One or more team_ids do not exist",
        )
    for team in teams:
        if team.personal:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Cannot add user to personal team "
                    f"(team_id={team.id}); personal teams have immutable "
                    "membership (D-05)"
                ),
            )
    # Idempotent: skip rows that already exist.
    for team in teams:
        existing = await db.get(TeamMembership, (team.id, user_id))
        if existing is None:
            db.add(TeamMembership(team_id=team.id, user_id=user_id))


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


async def list_users(db: AsyncSession) -> list[User]:
    """All users with their teams eagerly loaded."""
    result = await db.execute(
        select(User).options(selectinload(User.teams)).order_by(User.id)
    )
    return list(result.scalars().all())


async def get_user(db: AsyncSession, *, user_id: int) -> User:
    """Single user + teams. 404 if not found."""
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.teams))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found",
        )
    return user


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


async def update_user(
    db: AsyncSession,
    *,
    user_id: int,
    payload: dict[str, Any],
    current_admin_user_id: int,
) -> User:
    """Apply ``payload`` (already ``model_dump(exclude_unset=True)``) to user.

    Self-guard (T-01-07-03/04): admin cannot toggle ``is_admin`` or
    ``is_active`` on themselves.

    Side effects:
    - On ``is_active`` True→False transition, call
      :func:`app.auth.service.revoke_user_sessions` synchronously.
    - On ``team_ids`` present, REPLACE non-personal memberships.

    Raises:
        HTTPException(404): user not found.
        HTTPException(422): self-guard violation OR personal team in team_ids.
    """
    user = await get_user(db, user_id=user_id)

    # Self-guard.
    if user_id == current_admin_user_id:
        if "is_admin" in payload or "is_active" in payload:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot modify your own admin/active state",
            )

    # Detect the True→False transition BEFORE applying the change.
    is_active_being_disabled = (
        "is_active" in payload
        and payload["is_active"] is False
        and user.is_active is True
    )

    # Apply scalar fields.
    for field in ("email", "is_admin", "is_active"):
        if field in payload:
            setattr(user, field, payload[field])

    # team_ids: REPLACE semantics on non-personal memberships.
    if "team_ids" in payload and payload["team_ids"] is not None:
        await _replace_shared_memberships(
            db, user_id=user_id, team_ids=payload["team_ids"],
        )

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        ) from exc

    # AUTH-07 / T-01-07-06: revoke synchronously inside this transaction.
    # revoke_user_sessions commits on its own; that commit picks up the
    # pending user UPDATE too (single transaction commit).
    if is_active_being_disabled:
        await revoke_user_sessions(db, user_id=user_id)
    else:
        await db.commit()
    await db.refresh(user)
    return user


async def _replace_shared_memberships(
    db: AsyncSession, *, user_id: int, team_ids: list[int],
) -> None:
    """Replace the user's non-personal memberships with ``team_ids``.

    Personal-team membership row is preserved (never touched). Validation
    matches :func:`_add_shared_memberships` (404→422 on unknown team,
    422 on personal team in the list).
    """
    # Look up which of the user's current memberships are non-personal.
    current_rows = (
        await db.execute(
            select(TeamMembership, Team)
            .join(Team, Team.id == TeamMembership.team_id)
            .where(TeamMembership.user_id == user_id)
        )
    ).all()
    current_non_personal_ids = {
        m.team_id for m, t in current_rows if not t.personal
    }
    desired_set = set(team_ids)

    # Validate desired teams.
    if desired_set:
        teams = (
            await db.execute(select(Team).where(Team.id.in_(desired_set)))
        ).scalars().all()
        if len(teams) != len(desired_set):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="One or more team_ids do not exist",
            )
        for team in teams:
            if team.personal:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        "Cannot add user to personal team "
                        f"(team_id={team.id}); personal teams have immutable "
                        "membership (D-05)"
                    ),
                )

    # Remove memberships no longer desired.
    to_remove = current_non_personal_ids - desired_set
    if to_remove:
        await db.execute(
            delete(TeamMembership)
            .where(
                TeamMembership.user_id == user_id,
                TeamMembership.team_id.in_(to_remove),
            )
        )

    # Add new memberships.
    to_add = desired_set - current_non_personal_ids
    for team_id in to_add:
        db.add(TeamMembership(team_id=team_id, user_id=user_id))


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


async def delete_user(
    db: AsyncSession,
    *,
    user_id: int,
    current_admin_user_id: int,
) -> None:
    """Delete a user. Self-delete is blocked (T-01-07-05).

    HI-03 fix: this used to call :func:`revoke_user_sessions` (which
    commits its own transaction) BEFORE deleting the personal team and
    the user (which then committed again). An exception between those
    two commits left a "half-deleted ghost" — sessions revoked, user
    row still present. We now perform everything in a single transaction
    that commits exactly once at the end:

    Order of operations:

    1. Self-guard check.
    2. Inline-revoke refresh tokens (bulk UPDATE).
    3. Inline-revoke PATs (bulk UPDATE).
    4. Delete the user's personal team (the cascade on team_memberships
       handles the membership row).
    5. Delete the user — FK ON DELETE CASCADE handles refresh_tokens,
       PATs, ssh_keys, and remaining team_memberships.
    6. ``await db.commit()`` — single barrier. If anything between (2)
       and (5) raises, the session is rolled back and NO partial state
       is persisted.

    Audit-event semantics (revocations + delete) collapse into one
    DB-visible state transition, which is the correct shape for the
    Phase-2 audit log to record.
    """
    if user_id == current_admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot delete yourself",
        )

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found",
        )

    now = datetime.now(UTC)

    # Inline revocations — no intermediate commit (HI-03).
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    await db.execute(
        update(PersonalAccessToken)
        .where(
            PersonalAccessToken.user_id == user_id,
            PersonalAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )

    # Find and delete the user's personal team.
    personal_team = (
        await db.execute(
            select(Team)
            .join(TeamMembership, TeamMembership.team_id == Team.id)
            .where(
                TeamMembership.user_id == user_id,
                Team.personal.is_(True),
            )
        )
    ).scalar_one_or_none()
    if personal_team is not None:
        await db.delete(personal_team)

    await db.delete(user)
    # Single commit — the entire delete+revoke is atomic.
    await db.commit()


# ---------------------------------------------------------------------------
# Admin password reset
# ---------------------------------------------------------------------------


async def set_user_password(
    db: AsyncSession,
    *,
    user_id: int,
    new_password: str,
) -> None:
    """Admin-initiated password reset.

    The admin does NOT supply the user's old password (T-01-07-08 — recovery
    flow accepted by design). After the new hash is written, all sessions
    are revoked so the user MUST log in with the new password.
    """
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found",
        )
    user.password_hash = hash_password(new_password)
    await db.flush()
    # revoke_user_sessions commits — picks up the password_hash UPDATE too.
    await revoke_user_sessions(db, user_id=user_id)


# ---------------------------------------------------------------------------
# Membership add/remove
# ---------------------------------------------------------------------------


async def add_user_to_team(
    db: AsyncSession, *, user_id: int, team_id: int,
) -> TeamMembership:
    """Add a user to a (shared) team. Personal teams rejected (D-05)."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found",
        )
    if team.personal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personal teams have immutable membership (D-05)",
        )
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found",
        )

    existing = await db.get(TeamMembership, (team_id, user_id))
    if existing is not None:
        return existing

    membership = TeamMembership(team_id=team_id, user_id=user_id)
    db.add(membership)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.get(TeamMembership, (team_id, user_id))
        if existing is not None:
            return existing
        raise
    return membership


async def remove_user_from_team(
    db: AsyncSession, *, user_id: int, team_id: int,
) -> None:
    """Remove a user from a (shared) team. Personal teams rejected (D-05)."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found",
        )
    if team.personal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personal teams have immutable membership (D-05)",
        )
    membership = await db.get(TeamMembership, (team_id, user_id))
    if membership is None:
        # Idempotent: deleting an absent row is fine.
        return
    await db.delete(membership)
    await db.commit()
