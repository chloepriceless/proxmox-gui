"""phase 3: job-queue batch grouping + curated error + backup schedules.

Revision ID: 0004_phase3
Revises: 0003_phase2
Create Date: 2026-05-16

Changes:
1. jobs table: ADD two nullable columns.
   - batch_id (String(64), NULL) — D-11 bulk-action grouping. Bulk
     Start/Stop/Reboot fans out one Job row per VM; rows sharing a batch_id
     are grouped under one batch header in the Tasks drawer.
   - friendly_error (Text, NULL) — D-13 curated PVE-error message. The raw
     exitstatus stays in `error`; this holds the human-readable mapping.
   ADD index ix_jobs_batch_id on (batch_id) for the grouped-drawer query.

2. backup_schedules table: NEW. For LIFE-06 (scheduled backups). Plan 04
   populates it; we create the table now so the schema is stable across
   the rest of Phase 3. Simple "keep last N" retention (CONTEXT D-08; full
   PVE prune is the deferred enhancement).

Notes:
- SQLite ALTER goes through op.batch_alter_table (render_as_batch=True in
  env.py). op.create_index / op.create_table are DDL-safe on SQLite without
  the batch dance.
- Every constraint/index has an explicit name= (Plan 01-02 SUMMARY locked
  decision — anonymous constraints break round-trip downgrade in SQLite).
- Downgrade reverses every change in inverse order.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_phase3"
down_revision: str | None = "0003_phase2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- jobs: add batch_id + friendly_error columns ----
    with op.batch_alter_table("jobs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("batch_id", sa.String(64), nullable=True)
        )
        batch_op.add_column(
            sa.Column("friendly_error", sa.Text(), nullable=True)
        )

    # Created outside the batch block — op.create_index is DDL-safe on SQLite.
    op.create_index("ix_jobs_batch_id", "jobs", ["batch_id"])

    # ---- backup_schedules: new table (LIFE-06; Plan 04 populates) ----
    op.create_table(
        "backup_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("vmid", sa.Integer(), nullable=False),
        sa.Column(
            "is_lxc",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("node", sa.String(64), nullable=False),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        # values: daily | weekly
        sa.Column("frequency", sa.String(16), nullable=False),
        sa.Column(
            "keep_last",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("7"),
        ),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_run_state", sa.String(16), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_backup_schedules"),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["clusters.id"],
            name="fk_backup_schedules_cluster_id",
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            name="fk_backup_schedules_team_id",
        ),
        sa.UniqueConstraint(
            "cluster_id",
            "vmid",
            name="uq_backup_schedules_cluster_vmid",
        ),
    )
    op.create_index(
        "ix_backup_schedules_enabled", "backup_schedules", ["enabled"]
    )


def downgrade() -> None:
    op.drop_index("ix_backup_schedules_enabled", table_name="backup_schedules")
    op.drop_table("backup_schedules")
    op.drop_index("ix_jobs_batch_id", table_name="jobs")
    with op.batch_alter_table("jobs", schema=None) as batch_op:
        batch_op.drop_column("friendly_error")
        batch_op.drop_column("batch_id")
