"""phase 4: provisioning / networking / console schema.

Revision ID: 0006_phase4
Revises: 0005_phase3_backup_storage
Create Date: 2026-05-16

Changes — three new tables for the Phase-4 backend plans:

1. network_scope — per-team SDN/bridge scoping (NET-02). The admin grants a
   team access to one SDN VNet (or legacy bridge) per row; the provisioning
   wizard's network picker offers a team only its scoped networks. Composite
   UNIQUE on (team_id, cluster_id, network_kind, network_id).

2. catalog_pin — single-row global config (D-06). The community-scripts
   catalog is pinned to a commit SHA (CLAUDE.md #8); this row records the pin,
   the sync metadata, and the admin-editable curated-shortlist override.

3. notification_seen — per-user notification-bell unread cursor (D-23). One
   row per user; the bell is a derived view over the jobs table, so the only
   persisted state is a last-seen timestamp. UNIQUE on user_id.

Notes:
- This migration only creates tables (no SQLite ALTER) — op.create_table is
  DDL-safe on SQLite without the batch dance.
- Every constraint/index has an explicit name= (Plan 01-02 SUMMARY locked
  decision — anonymous constraints break round-trip downgrade in SQLite).
- Downgrade drops the three tables in reverse creation order.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_phase4"
down_revision: str | None = "0005_phase3_backup_storage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- network_scope: per-team SDN/bridge scoping (NET-02) ----
    op.create_table(
        "network_scope",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        sa.Column("network_kind", sa.String(16), nullable=False),
        sa.Column("network_id", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_network_scope"),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            name="fk_network_scope_team",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["clusters.id"],
            name="fk_network_scope_cluster",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "uq_network_scope_team_cluster_network",
        "network_scope",
        ["team_id", "cluster_id", "network_kind", "network_id"],
        unique=True,
    )

    # ---- catalog_pin: single-row global config (D-06) ----
    op.create_table(
        "catalog_pin",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("commit_sha", sa.String(40), nullable=False),
        sa.Column(
            "synced_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("synced_by_user_id", sa.Integer(), nullable=True),
        sa.Column("curated_overrides", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_catalog_pin"),
        sa.ForeignKeyConstraint(
            ["synced_by_user_id"],
            ["users.id"],
            name="fk_catalog_pin_user",
        ),
    )

    # ---- notification_seen: per-user unread cursor (D-23) ----
    op.create_table(
        "notification_seen",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "last_seen_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_notification_seen"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_notification_seen_user",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "user_id", name="uq_notification_seen_user"
        ),
    )


def downgrade() -> None:
    op.drop_table("notification_seen")
    op.drop_table("catalog_pin")
    op.drop_index(
        "uq_network_scope_team_cluster_network", table_name="network_scope"
    )
    op.drop_table("network_scope")
