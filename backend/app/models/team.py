"""Team ORM model — the primary tenant boundary (D-05).

Every user has exactly one *personal* team (``personal=True``) plus zero or
more *shared* teams. Business rows reference ``teams.id`` via ``team_id``;
this is the multi-tenant invariant from CLAUDE.md / Pitfall 5.

**Personal team name format** (per 01-RESEARCH.md §Anti-Patterns):
``personal-<user_id>`` — NOT ``<username>-personal``. The name is stable
across username changes because D-05 requires personal teams be immutable.
Plan 07's ``create_user`` flow is responsible for assigning this exact
name; this model only encodes the discriminator column.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    # D-05: personal teams are immutable + auto-managed; shared teams are
    # user-managed. ``personal`` is the discriminator. Indexed because the
    # admin UI filters on it constantly.
    personal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0", index=True
    )
    # D-04: an admin can disable a team (cascades to its members losing access
    # without losing membership rows).
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )

    members: Mapped[list[User]] = relationship(
        "User",
        secondary="team_memberships",
        back_populates="teams",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        kind = "personal" if self.personal else "shared"
        return f"<Team id={self.id} name={self.name!r} kind={kind}>"
