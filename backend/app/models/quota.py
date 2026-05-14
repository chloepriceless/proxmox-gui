"""Quota rows -- exactly one of (team_id, user_id) is set (D-08).

A quota row scopes either a *team* (the normal case for shared teams) or a
solo user via their *personal* team (when the user is not a member of any
shared team -- see D-08's admission-control rule).

Phase 2 adds per-cluster scoping (D-09 + D-11): ``cluster_id`` joins the
row, and the UNIQUE constraints move from single-column (team_id alone,
user_id alone) to composite partial uniques:

- ``uq_quotas_team_cluster`` UNIQUE(team_id, cluster_id) WHERE team_id IS NOT NULL
- ``uq_quotas_user_cluster`` UNIQUE(user_id, cluster_id) WHERE user_id IS NOT NULL

The aggregate across clusters (used by the Sidebar Quota Indicator, D-07) is
computed at READ time from the set of per-cluster rows; admin sets limits
per-cluster, not as a separate aggregate cap. One row with cluster_id=NULL
represents an unclustered / global limit (fallback for pre-Phase-2 data).

The CHECK constraint at the DB level enforces the XOR invariant:
``(team_id IS NOT NULL) <> (user_id IS NOT NULL)``. Attempting to insert a
row with both NULL or both NOT NULL raises ``IntegrityError`` -- this is the
last line of defence for T-01-02-06 even if the service layer drops the
ball.

Nullable per-dimension columns mean "no limit on this dimension". Plan 2
ships the admission-control evaluator that consumes these rows.

schema-invariant allowlist: quotas already covered via the
team_id-XOR-user_id rationale (see tests/test_schema_invariants.py);
the cluster_id addition does not change the allowlist reasoning -- quotas
still require exactly one of team_id / user_id.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Quota(Base):
    __tablename__ = "quotas"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Exactly one of these is set -- see CHECK constraint below.
    # NOTE: unique=True removed here; UNIQUE moves to composite partial
    # indices in __table_args__ (uq_quotas_team_cluster / uq_quotas_user_cluster).
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Phase 2: per-cluster quota scope (D-09 + D-11).
    # NULL = global / unclustered limit (fallback for pre-Phase-2 data).
    cluster_id: Mapped[int | None] = mapped_column(
        ForeignKey("clusters.id", ondelete="CASCADE"),
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
        # Phase 2 composite partial UNIQUE indices (D-09 + D-11).
        # Partial WHERE clauses ensure NULL cluster_id rows don't collide.
        Index(
            "uq_quotas_team_cluster",
            "team_id",
            "cluster_id",
            unique=True,
            sqlite_where=text("team_id IS NOT NULL"),
            postgresql_where=text("team_id IS NOT NULL"),
        ),
        Index(
            "uq_quotas_user_cluster",
            "user_id",
            "cluster_id",
            unique=True,
            sqlite_where=text("user_id IS NOT NULL"),
            postgresql_where=text("user_id IS NOT NULL"),
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        scope = (
            f"team={self.team_id}" if self.team_id is not None else f"user={self.user_id}"
        )
        return f"<Quota id={self.id} {scope} cluster={self.cluster_id}>"
