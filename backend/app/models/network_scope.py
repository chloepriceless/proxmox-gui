"""Per-team SDN/bridge network scoping — NET-02 (Phase 4).

An admin grants a team access to one SDN VNet (or a legacy bridge) by
inserting a ``network_scope`` row. The provisioning wizard's network picker
then offers a team only the networks it has been scoped to. Without a row a
team sees no SDN networks (the legacy-bridge fallback, NET-04, is the v1
floor).

One row per (team, cluster, network_kind, network_id) — enforced by the
``uq_network_scope_team_cluster_network`` composite UNIQUE index. ``team_id``
+ ``cluster_id`` carry the tenant + cluster scope; ``network_kind`` is
``"sdn-vnet"`` or ``"bridge"``; ``network_id`` is the VNet name or the bridge
name.

schema-invariant ALLOWLIST: this table is NOT allow-listed — it is
team-scoped by nature and carries ``team_id``. Tenant isolation is the
table's entire purpose (NET-02): the row IS the per-team grant. The
schema-invariant test (``tests/test_schema_invariants.py``) therefore needs
no allowlist entry for it — the ``team_id`` column satisfies the invariant
directly.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NetworkScope(Base):
    __tablename__ = "network_scope"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE", name="fk_network_scope_team"),
        nullable=False,
    )
    cluster_id: Mapped[int] = mapped_column(
        ForeignKey(
            "clusters.id", ondelete="CASCADE", name="fk_network_scope_cluster"
        ),
        nullable=False,
    )
    # "sdn-vnet" | "bridge".
    network_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    # The SDN VNet name or the legacy bridge name (e.g. "vmbr0").
    network_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        Index(
            "uq_network_scope_team_cluster_network",
            "team_id",
            "cluster_id",
            "network_kind",
            "network_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<NetworkScope id={self.id} team={self.team_id} "
            f"cluster={self.cluster_id} {self.network_kind}:{self.network_id}>"
        )
