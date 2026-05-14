"""First-run wizard service layer (Plan 01-07 Task 1).

The two service functions are deliberately small:

- :func:`no_admin_yet` — single SELECT COUNT, used by both the status
  endpoint and the create-admin endpoint as its precondition gate.
- :func:`create_initial_admin` — re-checks the predicate inside the same
  transaction that inserts the admin row (T-01-07-01 race mitigation),
  hashes the password, inserts the User row, and creates the matching
  personal Team via :func:`app.teams.service.create_team` with
  ``registry=None`` and ``auto_bootstrap=False`` (Plan 06's
  WARNING-6 signature accommodates this — there are no clusters at
  first-run).

The personal team naming convention is ``personal-<user_id>`` per
01-RESEARCH.md §Anti-Patterns and matches what
:func:`tests.factories.make_user` already produces.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.passwords import hash_password
from app.models import Cluster, Team, TeamMembership, User
from app.teams import service as teams_service


async def no_admin_yet(db: AsyncSession) -> bool:
    """True iff zero rows in ``users`` have ``is_admin=True``.

    The predicate is intentionally narrow: the very first admin is what
    closes the open setup window. Disabled admins still count — once an
    operator exists, a fresh install can only be obtained by re-running
    the helper-script (which delivers a fresh DB).
    """
    count = await db.scalar(
        select(func.count()).select_from(User).where(User.is_admin.is_(True))
    )
    return (count or 0) == 0


async def cluster_count(db: AsyncSession) -> int:
    """Number of registered clusters (regardless of ``is_active``).

    Surfaced in the wizard status response so the frontend can show
    ``"Step 3: Register a cluster (optional)"`` with appropriate copy
    when at least one cluster is already registered.
    """
    n = await db.scalar(select(func.count()).select_from(Cluster))
    return int(n or 0)


async def create_initial_admin(
    db: AsyncSession,
    *,
    username: str,
    email: str,
    password: str,
) -> tuple[User, Team]:
    """Create the very first admin + their personal team.

    Precondition: :func:`no_admin_yet` returns True. We re-check inside
    the transaction (T-01-07-01) so a concurrent second request observes
    the row and gets 409.

    Side effects (all in one transaction):

    1. Insert User(is_admin=True, is_active=True).
    2. Create personal Team via
       :func:`app.teams.service.create_team` with ``registry=None`` and
       ``auto_bootstrap=False`` (no clusters at first-run; the
       WARNING-6 signature in Plan 06 explicitly accommodates this).
    3. Insert TeamMembership row binding the admin to the personal team.

    Raises:
        HTTPException(409): an admin already exists, OR the username/email
            uniqueness constraint fires.
    """
    if not await no_admin_yet(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Initial setup already completed",
        )

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        is_admin=True,
        is_active=True,
    )
    db.add(user)
    try:
        await db.flush()  # populate user.id for the personal-team name
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from exc

    # D-05 personal team — no PVE bootstrap (no clusters; even if there
    # were, personal teams skip bootstrap per Plan 06's create_team).
    # Plan 06 accepts ``registry=None`` when ``auto_bootstrap=False``.
    team = await teams_service.create_team(
        db,
        registry=None,
        name=f"personal-{user.id}",
        personal=True,
        _internal=True,
        auto_bootstrap=False,
    )

    db.add(TeamMembership(team_id=team.id, user_id=user.id))
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from exc
    await db.refresh(user)
    await db.refresh(team)
    return user, team
