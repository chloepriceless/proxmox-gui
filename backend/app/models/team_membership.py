"""Team membership association table (D-05 many-to-many).

Composite primary key ``(team_id, user_id)`` makes membership an inherent
property of the (team, user) pair — no surrogate ``id`` to leak through.
``ON DELETE CASCADE`` on both sides ensures membership rows disappear when
the owning team or user does.

Note: this model intentionally does NOT use :class:`TimestampMixin` — only
``created_at`` is meaningful for memberships (you don't "update" a row, you
delete & re-insert). The mixin's ``updated_at`` would never change.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TeamMembership(Base):
    __tablename__ = "team_memberships"

    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        Index("ix_team_memberships_user", "user_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<TeamMembership team={self.team_id} user={self.user_id}>"
