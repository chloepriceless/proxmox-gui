"""phase 2: per-cluster quota scoping + audit log filter indices.

Revision ID: 0003_phase2
Revises: 0002_add_uq_one_admin
Create Date: 2026-05-14

Changes:
1. quotas table: ADD cluster_id (INTEGER, NULL, FK clusters.id ON DELETE CASCADE).
   DROP single-column UNIQUE constraints on team_id and user_id (from 0001:
     uq_quotas_team_id and uq_quotas_user_id -- declared as UniqueConstraint
     inside create_table in 0001_initial.py).
   ADD composite partial UNIQUE on (team_id, cluster_id) where team_id IS NOT NULL
     -- name uq_quotas_team_cluster.
   ADD composite partial UNIQUE on (user_id, cluster_id) where user_id IS NOT NULL
     -- name uq_quotas_user_cluster.
   D-09 + D-11 rationale: per-cluster scoping is the enforcement boundary.
   The aggregate (CONTEXT D-09) is computed at READ time from the rows.

2. audit_log table: ADD two indices for filter speed (AUDIT-03):
   - ix_audit_action_time: (action, occurred_at DESC) -- for action=... filter.
   - ix_audit_cluster_time: (cluster_id, occurred_at DESC) -- for per-cluster filter
     and for per-VM Activity tab (which filters by cluster_id + target_id).

Notes:
- SQLite ALTER goes through op.batch_alter_table (render_as_batch=True in env.py).
- Every constraint/index has an explicit name= (Plan 01-02 SUMMARY locked decision).
- Downgrade re-creates the Phase-1 single-column UNIQUE constraints on
  team_id / user_id (originally declared as UniqueConstraint inside
  create_table in 0001_initial.py, which SQLite stores as named constraints).
- schema-invariant allowlist already covers quotas via the
  team_id-XOR-user_id rationale (see tests/test_schema_invariants.py).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_phase2"
down_revision: str | None = "0002_add_uq_one_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- quotas: add cluster_id column + drop old single-col UNIQUEs + add
    #      new composite partial UNIQUE indices.
    # All done inside a single batch_alter_table call so SQLite can do the
    # table-recreate dance atomically (render_as_batch=True in env.py).
    with op.batch_alter_table("quotas", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "cluster_id",
                sa.Integer(),
                nullable=True,
            )
        )
        # Drop Phase-1 single-column UNIQUE constraints declared as
        # UniqueConstraint("team_id", name="uq_quotas_team_id") and
        # UniqueConstraint("user_id", name="uq_quotas_user_id") in 0001_initial.
        batch_op.drop_constraint("uq_quotas_team_id", type_="unique")
        batch_op.drop_constraint("uq_quotas_user_id", type_="unique")
        # Add FK to clusters.id (batch mode handles the FK addition).
        batch_op.create_foreign_key(
            "fk_quotas_cluster_id",
            "clusters",
            ["cluster_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # ---- quotas: add per-cluster composite partial UNIQUE indices.
    # Created outside batch_alter_table since op.create_index is DDL-safe on
    # SQLite (no ALTER involved).
    op.create_index(
        "uq_quotas_team_cluster",
        "quotas",
        ["team_id", "cluster_id"],
        unique=True,
        sqlite_where=sa.text("team_id IS NOT NULL"),
        postgresql_where=sa.text("team_id IS NOT NULL"),
    )
    op.create_index(
        "uq_quotas_user_cluster",
        "quotas",
        ["user_id", "cluster_id"],
        unique=True,
        sqlite_where=sa.text("user_id IS NOT NULL"),
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )

    # ---- audit_log: filter indices for AUDIT-03 ----
    op.create_index(
        "ix_audit_action_time",
        "audit_log",
        ["action", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_audit_cluster_time",
        "audit_log",
        ["cluster_id", sa.text("occurred_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_cluster_time", table_name="audit_log")
    op.drop_index("ix_audit_action_time", table_name="audit_log")
    op.drop_index("uq_quotas_user_cluster", table_name="quotas")
    op.drop_index("uq_quotas_team_cluster", table_name="quotas")

    # Restore Phase-1 single-column UNIQUE constraints and drop cluster_id.
    with op.batch_alter_table("quotas", schema=None) as batch_op:
        batch_op.drop_constraint("fk_quotas_cluster_id", type_="foreignkey")
        batch_op.drop_column("cluster_id")
        # Re-create Phase-1 named single-column UNIQUE constraints.
        batch_op.create_unique_constraint("uq_quotas_team_id", ["team_id"])
        batch_op.create_unique_constraint("uq_quotas_user_id", ["user_id"])
