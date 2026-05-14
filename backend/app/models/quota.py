"""Quota rows — exactly one of (team_id, user_id) is set (D-08).

A quota row scopes either a *team* (the normal case for shared teams) or a
solo user via their *personal* team (when the user is not a member of any
shared team — see D-08's admission-control rule).

The CHECK constraint at the DB level enforces the XOR invariant:
``(team_id IS NOT NULL) <> (user_id IS NOT NULL)``. Attempting to insert a
row with both NULL or both NOT NULL raises ``IntegrityError`` — this is the
last line of defence for T-01-02-06 even if the service layer drops the
ball.

Nullable per-dimension columns mean "no limit on this dimension". Plan 2
ships the admission-control evaluator that consumes these rows.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Quota(Base):
    __tablename__ = "quotas"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Exactly one of these is set — see CHECK constraint below.
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
    )
    # NULL = no limit on this dimension.
    cpu_cores: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ram_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disk_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vm_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lxc_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        # D-08 XOR. T-01-02-06 mitigation.
        CheckConstraint(
            "(team_id IS NOT NULL) <> (user_id IS NOT NULL)",
            name="ck_quota_team_xor_user",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        scope = (
            f"team={self.team_id}" if self.team_id is not None else f"user={self.user_id}"
        )
        return f"<Quota id={self.id} {scope}>"
