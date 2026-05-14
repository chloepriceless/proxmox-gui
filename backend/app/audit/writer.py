"""Audit writer -- synchronous-before-return (D-20, AUDIT-01).

CONTRACT (do not deviate): this function FLUSHES the new AuditLog row but does
NOT COMMIT. The CALLER owns the transaction commit. The Phase 1 service-layer
locked decision ("commit-before-raise" -- 01-05 SUMMARY) applies: when the
caller plans to RAISE after this call (failure-path audit), the caller MUST
``await db.commit()`` BEFORE raising, otherwise ``get_db`` rolls back and the
audit row is lost.

Pitfall 6 (02-RESEARCH): if caller forgets to commit AFTER calling
audit_write on the success path, the row is rolled back. Service tests for
every consumer assert audit_log row presence after BOTH success and failure
paths.

Best-effort semantics: callers that want audit failures to be non-fatal should
catch exceptions from audit_write, log them, and continue. A flush failure
leaves the caller's transaction in an aborted state, so the caller must also
rollback before continuing.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def audit_write(
    db: AsyncSession,
    *,
    actor_user_id: int | None,
    actor_pat_id: int | None = None,
    team_id: int | None,
    cluster_id: int | None,
    action: str,
    target_type: str | None,
    target_id: str | None,
    result: str,  # "success" | "failure" | "pending"
    source_ip: str | None,
    correlation_id: str | None = None,
    payload_before: dict[str, Any] | None = None,
    payload_after: dict[str, Any] | None = None,
    error: str | None = None,
) -> AuditLog:
    """Flush a new AuditLog row into the caller's transaction.

    Returns the populated AuditLog (with .id assigned post-flush) so tests
    can assert on it; production callers usually ignore the return value.

    NEVER commits -- the caller owns the transaction.
    """
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_pat_id=actor_pat_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        source_ip=source_ip,
        correlation_id=correlation_id,
        payload_before=(
            json.dumps(payload_before, default=str)
            if payload_before is not None
            else None
        ),
        payload_after=(
            json.dumps(payload_after, default=str)
            if payload_after is not None
            else None
        ),
        error=error,
    )
    db.add(entry)
    await db.flush()
    return entry
