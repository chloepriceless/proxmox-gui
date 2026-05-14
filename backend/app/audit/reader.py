"""Audit reader -- paginated list + RBAC predicate (AUDIT-02, AUDIT-03).

RBAC rules (D-17, Pitfall 11):
- Admin: no filter; sees all rows.
- Non-admin default (show_team_actions=False): actor_user_id == me.
- Non-admin with show_team_actions=True: actor_user_id == me
    OR team_id IN (my_team_ids).

The team_id scope (show_team_actions) is a server-side enforcement; the
client cannot bypass it. _my_team_ids re-queries on every request -- no
in-process cache, so team revocations propagate immediately (T-02-02-09
accept rationale: within the 15-min JWT window, re-query at every request).
"""

from __future__ import annotations

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.schemas import AuditEntry, AuditFilter
from app.auth.dependencies import Principal
from app.models import AuditLog, Cluster, Team, TeamMembership, User
from app.models.pat import PersonalAccessToken

#: Hard row limit for CSV export (T-02-02-06 DoS mitigation).
HARD_EXPORT_LIMIT = 50000


def _build_rbac_predicate(
    principal: Principal,
    my_team_ids: list[int],
    show_team_actions: bool,
):
    """Return a SQLAlchemy WHERE clause implementing D-17 + Pitfall 11.

    - Admin: tautology (1=1).
    - Non-admin default: actor_user_id == me.
    - Non-admin + show_team_actions: actor_user_id == me OR team_id IN my_teams.
    """
    if principal.user.is_admin:
        return text("1=1")
    me_clause = AuditLog.actor_user_id == principal.user.id
    if not show_team_actions or not my_team_ids:
        return me_clause
    team_clause = AuditLog.team_id.in_(my_team_ids)
    return or_(me_clause, team_clause)


async def _my_team_ids(db: AsyncSession, *, user_id: int) -> list[int]:
    """Return all team IDs the given user belongs to."""
    stmt = select(TeamMembership.team_id).where(TeamMembership.user_id == user_id)
    return [row[0] for row in (await db.execute(stmt)).all()]


def _apply_filters(stmt, filters: AuditFilter):
    """Apply AuditFilter predicates to a SELECT statement."""
    if filters.from_ is not None:
        stmt = stmt.where(AuditLog.occurred_at >= filters.from_)
    if filters.to is not None:
        stmt = stmt.where(AuditLog.occurred_at <= filters.to)
    if filters.action:
        stmt = stmt.where(AuditLog.action.in_(filters.action))
    if filters.user_id is not None:
        stmt = stmt.where(AuditLog.actor_user_id == filters.user_id)
    if filters.target_type:
        stmt = stmt.where(AuditLog.target_type.in_(filters.target_type))
    if filters.vmid is not None:
        stmt = stmt.where(AuditLog.target_id == str(filters.vmid))
    if filters.cluster_id is not None:
        stmt = stmt.where(AuditLog.cluster_id == filters.cluster_id)
    return stmt


async def list_audit(
    db: AsyncSession,
    *,
    principal: Principal,
    filters: AuditFilter,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[AuditEntry], int]:
    """Return a paginated list of audit entries scoped by RBAC + filters."""
    my_teams = await _my_team_ids(db, user_id=principal.user.id)
    rbac = _build_rbac_predicate(principal, my_teams, filters.show_team_actions)

    base = (
        select(
            AuditLog,
            User.username.label("actor_username"),
            Team.name.label("team_name"),
            Cluster.name.label("cluster_name"),
            PersonalAccessToken.lookup_prefix.label("actor_pat_prefix"),
        )
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .outerjoin(Team, AuditLog.team_id == Team.id)
        .outerjoin(Cluster, AuditLog.cluster_id == Cluster.id)
        .outerjoin(
            PersonalAccessToken,
            AuditLog.actor_pat_id == PersonalAccessToken.id,
        )
        .where(rbac)
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    )
    base = _apply_filters(base, filters)

    # Efficient count via subquery.
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    paged = base.limit(page_size).offset((page - 1) * page_size)
    rows = (await db.execute(paged)).all()

    entries: list[AuditEntry] = []
    for log, actor_username, team_name, cluster_name, actor_pat_prefix in rows:
        entries.append(
            AuditEntry(
                id=log.id,
                occurred_at=log.occurred_at,
                actor_username=actor_username,
                actor_pat_prefix=actor_pat_prefix,
                team_name=team_name,
                cluster_name=cluster_name,
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                result=log.result,
                source_ip=log.source_ip,
                correlation_id=log.correlation_id,
                payload_before=log.payload_before,
                payload_after=log.payload_after,
                error=log.error,
            )
        )
    return entries, int(total)


async def count_export(
    db: AsyncSession,
    *,
    principal: Principal,
    filters: AuditFilter,
) -> int:
    """Lightweight count for the disable-when-too-large UX (UI-SPEC §CsvExportButton).

    Applies the same RBAC predicate + filters as list_audit so the count is
    consistent with what the export would contain.
    """
    my_teams = await _my_team_ids(db, user_id=principal.user.id)
    rbac = _build_rbac_predicate(principal, my_teams, filters.show_team_actions)
    stmt = _apply_filters(
        select(func.count(AuditLog.id)).where(rbac),
        filters,
    )
    return int((await db.execute(stmt)).scalar_one())
