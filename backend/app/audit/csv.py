"""CSV export stream (02-RESEARCH §Pattern 7, T-02-02-06 DoS mitigation).

Streams rows one at a time -- never holds the full result set in memory.
Uses db.stream() for server-side cursor iteration. UTF-8 with BOM as the
first 3 bytes (Excel compatibility).
"""

from __future__ import annotations

import csv
import io
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.csv_safe import escape_cell
from app.audit.reader import (
    HARD_EXPORT_LIMIT,
    _apply_filters,
    _build_rbac_predicate,
    _my_team_ids,
)
from app.audit.schemas import AuditFilter
from app.auth.dependencies import Principal
from app.models import AuditLog, Cluster, Team, User

_BOM = "﻿"  # U+FEFF; written as 0xEF 0xBB 0xBF in UTF-8


async def audit_csv_stream(
    db: AsyncSession,
    *,
    principal: Principal,
    filters: AuditFilter,
) -> AsyncIterator[bytes]:
    """Yield bytes for a StreamingResponse. UTF-8 with BOM as first 3 bytes.

    Applies the same RBAC predicate as list_audit (T-02-02-02: CSV bypass
    mitigation). Hard limit of HARD_EXPORT_LIMIT rows (T-02-02-06).

    The route (routes.py) pre-checks count_export() and returns 409 if the
    count exceeds HARD_EXPORT_LIMIT before calling this generator.
    """
    my_teams = await _my_team_ids(db, user_id=principal.user.id)
    rbac = _build_rbac_predicate(principal, my_teams, filters.show_team_actions)

    base = (
        select(
            AuditLog.occurred_at,
            AuditLog.action,
            AuditLog.target_type,
            AuditLog.target_id,
            AuditLog.result,
            AuditLog.source_ip,
            AuditLog.correlation_id,
            AuditLog.error,
            User.username,
            Team.name,
            Cluster.name,
        )
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .outerjoin(Team, AuditLog.team_id == Team.id)
        .outerjoin(Cluster, AuditLog.cluster_id == Cluster.id)
        .where(rbac)
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        .limit(HARD_EXPORT_LIMIT)
    )
    base = _apply_filters(base, filters)

    # BOM first
    yield _BOM.encode("utf-8")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "timestamp",
            "action",
            "target_type",
            "target_id",
            "result",
            "source_ip",
            "correlation_id",
            "error",
            "actor_username",
            "team_name",
            "cluster_name",
        ]
    )
    yield buf.getvalue().encode("utf-8")
    buf.seek(0)
    buf.truncate()

    result = await db.stream(base)
    async for row in result:
        occurred_at, action, ttype, tid, res, ip, corr, err, actor, team, cluster = row
        writer.writerow(
            [
                escape_cell(occurred_at.isoformat() if occurred_at else ""),
                escape_cell(action),
                escape_cell(ttype),
                escape_cell(tid),
                escape_cell(res),
                escape_cell(ip),
                escape_cell(corr),
                escape_cell(err),
                escape_cell(actor),
                escape_cell(team),
                escape_cell(cluster),
            ]
        )
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate()
