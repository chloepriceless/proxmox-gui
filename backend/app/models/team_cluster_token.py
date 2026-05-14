"""Per-tenant privilege-separated PVE API tokens (D-01, D-02, Pitfall 7).

For every (team, cluster) pair there is exactly one privilege-separated PVE
API token — enforced by ``UNIQUE(team_id, cluster_id)``. Plan 06 mints these
during ``create_team`` / ``add_cluster``; the connector layer (Phase 2)
picks the right token at request time based on the cluster ID in the URL
path and the team membership of the requesting user.

The secret is encrypted at rest via the same :class:`EncryptedSecret`
TypeDecorator used by :class:`Cluster.api_token_secret`.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models._types import EncryptedSecret
from app.models.base import Base, TimestampMixin


class TeamClusterToken(Base, TimestampMixin):
    __tablename__ = "team_cluster_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    cluster_id: Mapped[int] = mapped_column(
        ForeignKey("clusters.id", ondelete="CASCADE"), nullable=False
    )
    # The PVE realm-qualified userid for this team on this cluster.
    # Format (Plan 06): "gui-team-<team_id>@pve".
    userid: Mapped[str] = mapped_column(String(128), nullable=False)
    # The token id under the above user. Format (Plan 06): "api".
    tokenid: Mapped[str] = mapped_column(String(64), nullable=False)
    # Fernet-encrypted at rest.
    token_secret: Mapped[str] = mapped_column(EncryptedSecret, nullable=False)
    # The PVE pool this team's resources live in. Format (Plan 06):
    # "gui-team-<team_id>".
    poolid: Mapped[str] = mapped_column(String(128), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "team_id", "cluster_id", name="uq_team_cluster_tokens_team_cluster"
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<TeamClusterToken team={self.team_id} cluster={self.cluster_id} "
            f"userid={self.userid!r}>"
        )
