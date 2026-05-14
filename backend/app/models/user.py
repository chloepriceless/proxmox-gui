"""User ORM model.

A ``User`` is the authentication identity (AUTH-01, AUTH-02). Tenants are
expressed via :class:`~app.models.team.Team` membership — every user has a
personal team (created by Plan 07) plus any number of shared teams.

Per CLAUDE.md / Pitfall 5, business rows do not point at ``users.id``
directly; they point at ``teams.id``. The only places where ``user_id`` is
the natural owner are personal artefacts (SSH keys, PATs, refresh tokens)
and the actor side of the audit log.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.team import Team


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )

    # Many-to-many via team_memberships association table (D-05).
    # ``lazy="selectin"`` is acceptable here because user→teams lookups are
    # bounded (admin UI lists at most ~tens per user).
    teams: Mapped[list[Team]] = relationship(
        "Team",
        secondary="team_memberships",
        back_populates="members",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<User id={self.id} username={self.username!r} admin={self.is_admin}>"
