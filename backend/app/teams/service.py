"""Team CRUD + membership service layer.

The headline function is :func:`create_team`, which enforces D-02
(auto-bootstrap on every active cluster) and D-05 (personal teams are
auto-managed by the ``create_user`` flow, never via this API).

IN-02 fix: the Phase-1 ``_internal=True`` flag (a fragile caller convention
that bypassed the ``personal=True`` public-API guard) is gone. It is replaced
by two distinct, intention-revealing functions:

- :func:`create_team` — the public path. Rejects ``personal`` outright,
  optionally auto-bootstraps, and commits.
- :func:`create_team_for_admin_bootstrap` — the internal personal-team path
  used by ``setup/service.py`` and ``users/service.py``. It does NOT commit
  (the caller owns the transaction — ME-01) and never bootstraps.

WARNING-7 fix: ``delete_team`` enforces D-04 option-a — 409 if any
``team_cluster_tokens`` row references the team. We never call
``teardown_tenant_on_clusters`` from here; the operator must explicitly
unbind the team from every cluster (Phase 2 endpoint) before delete.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Team, TeamClusterToken, TeamMembership, User
from app.teams.bootstrap import bootstrap_tenant_on_clusters

if TYPE_CHECKING:
    from app.clusters.registry import PVEConnectorRegistry as ConnectorRegistry


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def create_team_for_admin_bootstrap(
    db: AsyncSession,
    *,
    name: str,
) -> Team:
    """Create a personal team WITHOUT committing — internal bootstrap path.

    IN-02 + ME-01: the no-commit, no-registry, no-bootstrap personal-team
    creation used by :mod:`app.setup.service` (first-run admin) and
    :mod:`app.users.service` (every ``create_user``). It replaces the old
    ``create_team(personal=True, _internal=True)`` flag dance.

    The function only ``flush()``es the row (so ``team.id`` is populated for a
    follow-up ``TeamMembership``); **the caller owns the transaction commit**.
    This is what lets the caller wrap user + personal-team + membership in a
    single atomic transaction (ME-01) — no mid-flight commit can leave a
    half-created tenant behind.

    Personal teams never auto-bootstrap (D-06 personal-pool semantics are
    deferred), so no registry is needed.

    Args:
        db: Active session — the row is flushed, NOT committed.
        name: Team name (e.g. ``personal-<user_id>``). Must be unique.

    Returns:
        The flushed (un-committed) Team row.

    Raises:
        HTTPException(409): name uniqueness violation.
    """
    team = Team(name=name, personal=True, is_active=True)
    db.add(team)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with that name already exists.",
        ) from exc
    return team


async def create_team(
    db: AsyncSession,
    registry: ConnectorRegistry | None = None,
    *,
    name: str,
    auto_bootstrap: bool = True,
) -> Team:
    """Insert a shared Team row, optionally auto-bootstrapping every cluster.

    IN-02: this is the **public** team-creation path only. It can never create
    a personal team — those go through :func:`create_team_for_admin_bootstrap`.
    The Phase-1 ``personal`` / ``_internal`` parameters are gone.

    Args:
        db: Active session — caller's transaction is committed inside this
            function on success.
        registry: Per-cluster connector cache. May be ``None`` for callers
            that don't bootstrap. If ``None`` and ``auto_bootstrap`` is True
            and at least one active cluster exists, raises (developer error).
        name: Team name. Must be unique (DB UNIQUE constraint enforces).
        auto_bootstrap: Run :func:`bootstrap_tenant_on_clusters` after the
            team row is flushed.

    Returns:
        The persisted Team row.

    Raises:
        HTTPException(409): name uniqueness violation.
        BootstrapFailed: PVE bootstrap failed; DB transaction rolled back.
    """
    team = Team(name=name, personal=False, is_active=True)
    db.add(team)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with that name already exists.",
        ) from exc

    # D-02: auto-bootstrap on every active cluster (shared teams only).
    if auto_bootstrap:
        # If registry is None we must verify there are no active clusters
        # — otherwise we'd silently skip bootstrap and create a half-tenant.
        if registry is None:
            n_clusters = await db.scalar(
                select(func.count())
                .select_from(_active_clusters_subquery())
            )
            if n_clusters and n_clusters > 0:
                raise RuntimeError(
                    "create_team(auto_bootstrap=True) requires a registry "
                    "when active clusters exist (got registry=None)"
                )
        else:
            try:
                await bootstrap_tenant_on_clusters(
                    db, registry, team=team, comment=name,
                )
            except Exception:
                # Roll back team row + any inserted token rows.
                await db.rollback()
                raise

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with that name already exists.",
        ) from exc
    await db.refresh(team)
    return team


def _active_clusters_subquery():
    """SELECT id FROM clusters WHERE is_active. Local helper to avoid an
    import cycle (clusters service imports teams package via routes
    eventually).
    """
    from app.models import Cluster
    return select(Cluster.id).where(Cluster.is_active.is_(True)).subquery()


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


async def update_team(
    db: AsyncSession,
    *,
    team_id: int,
    name: str | None = None,
    is_active: bool | None = None,
) -> Team:
    """Patch a team. Personal teams are read-only (D-05)."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.personal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personal teams are immutable",
        )
    if name is not None:
        team.name = name
    if is_active is not None:
        team.is_active = is_active
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with that name already exists.",
        ) from exc
    await db.refresh(team)
    return team


# ---------------------------------------------------------------------------
# Delete (D-04 option-a — 409 if bound)
# ---------------------------------------------------------------------------


async def delete_team(
    db: AsyncSession,
    registry: ConnectorRegistry | None = None,  # noqa: ARG001 — kept for symmetry / future
    *,
    team_id: int,
) -> None:
    """Delete a team, refusing if any cluster bindings exist (D-04).

    No PVE teardown — operator unbinds first via Phase-2 endpoint.

    Personal teams cannot be deleted (D-05).
    """
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.personal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personal teams cannot be deleted",
        )

    bound_count = await db.scalar(
        select(func.count())
        .select_from(TeamClusterToken)
        .where(TeamClusterToken.team_id == team_id)
    )
    if bound_count and bound_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Team has active cluster bindings — remove from clusters "
                "first (phase-2 endpoint, manual cleanup in v1)"
            ),
        )

    await db.delete(team)
    await db.commit()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


async def list_teams(db: AsyncSession) -> list[tuple[Team, int]]:
    """All teams + member counts. Returns ``[(team, count), ...]``."""
    # Subquery: per-team member count.
    count_sq = (
        select(
            TeamMembership.team_id,
            func.count(TeamMembership.user_id).label("member_count"),
        )
        .group_by(TeamMembership.team_id)
        .subquery()
    )
    result = await db.execute(
        select(Team, func.coalesce(count_sq.c.member_count, 0))
        .outerjoin(count_sq, Team.id == count_sq.c.team_id)
        .order_by(Team.id)
    )
    return [(team, int(count)) for team, count in result.all()]


async def get_team_with_members(
    db: AsyncSession, *, team_id: int,
) -> tuple[Team, list[User]]:
    """Single team + materialised member list."""
    team = await db.get(
        Team, team_id, options=[selectinload(Team.members)],
    )
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team, list(team.members)


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------


async def add_member(
    db: AsyncSession, *, team_id: int, user_id: int,
) -> TeamMembership:
    """Add a user to a team. Idempotent on PK conflict."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if team.personal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personal team membership is immutable",
        )

    # Idempotency: try insert, swallow IntegrityError on PK conflict.
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


async def remove_member(
    db: AsyncSession, *, team_id: int, user_id: int,
) -> None:
    """Remove a user from a team. 422 on personal-team attempts (D-05)."""
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.personal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Personal team membership is immutable",
        )
    membership = await db.get(TeamMembership, (team_id, user_id))
    if membership is None:
        # Idempotent: deleting an absent row is fine.
        return
    await db.delete(membership)
    await db.commit()
