"""Audit log — Phase 1 ships schema only; Plan 2-2 lands the writer.

**Pitfall 5 mitigation:** ``team_id`` is on this table from row 1. The
column is *nullable* because some system events (boot, first-run installer
seeding the admin) are not tenant-scoped — but every tenant-originated
event must populate it. The schema-invariant test asserts presence, not
non-null, and the allowlist documents this carve-out.

All FK columns use ``ON DELETE SET NULL`` so the audit chain survives the
deletion of any referenced entity. (Hard-deleting a user must not destroy
the historical record of what they did.)

Indexes are tuned for the two read patterns we know we want:
- "what did this team do recently" → ``(team_id, occurred_at)``
- "what did this user do recently" → ``(actor_user_id, occurred_at)``
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True,
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_pat_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal_access_tokens.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Pitfall 5: team_id present on every audit row; NULL only for
    # system-level events that are not tenant-scoped.
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    cluster_id: Mapped[int | None] = mapped_column(
        ForeignKey("clusters.id", ondelete="SET NULL"), nullable=True
    )
    # e.g. "vm.create.requested", "cluster.token.rotated".
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # "success" | "failure" | "pending"
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    source_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload_before: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    payload_after: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_audit_team_time", "team_id", "occurred_at"),
        Index("ix_audit_actor_time", "actor_user_id", "occurred_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<AuditLog id={self.id} action={self.action!r} "
            f"team={self.team_id} actor={self.actor_user_id} "
            f"result={self.result!r}>"
        )
