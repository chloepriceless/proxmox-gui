"""phase 5: polish & operational hardening schema.

Revision ID: 0007_phase5
Revises: 0006_phase4
Create Date: 2026-05-19

Changes — the single Phase-5 schema migration:

1. app_setting — single-row global config (D-01). Backs the admin Settings
   page; canonical home for the idle-timeout value (D-02, default 30 min) and
   the audit-retention value (D-06, default 365 days). The single row
   (id == 1) is seeded by this migration so the API never has to special-case
   a missing row.

2. refresh_tokens.last_active_at — server-authoritative idle-timeout recency
   marker (AUTH-06). Added nullable (SQLite ADD COLUMN cannot carry a
   constraint), then BACKFILLED from created_at for every existing row
   (Pitfall 3 — without the backfill a deploy would instantly idle-expire
   every active session and trigger a re-auth flood).

Notes:
- Unlike 0006 (which only created tables), this migration ALTERs an existing
  table — ``refresh_tokens`` — so the ``op.batch_alter_table`` SQLite batch
  dance is mandatory. Plain ``op.add_column`` would crash on SQLite.
- Every constraint/index carries an explicit ``name=`` (locked decision —
  anonymous constraints break round-trip downgrade in SQLite).
- Downgrade reverses the order: drop the column first, then drop the table.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_phase5"
down_revision: str | None = "0006_phase4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- app_setting: single-row global config (D-01) ----
    op.create_table(
        "app_setting",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "idle_timeout_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("30"),
        ),
        sa.Column(
            "audit_retention_days",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("365"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_app_setting"),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"],
            ["users.id"],
            name="fk_app_setting_user",
        ),
    )
    # Seed the single row — D-02 (idle 30 min) + D-06 (retention 365 days).
    op.execute(
        "INSERT INTO app_setting (id, idle_timeout_minutes, "
        "audit_retention_days) VALUES (1, 30, 365)"
    )

    # ---- refresh_tokens.last_active_at: idle-timeout recency (AUTH-06) ----
    # SQLite ADD COLUMN must go through batch mode.
    with op.batch_alter_table("refresh_tokens") as batch_op:
        batch_op.add_column(
            sa.Column("last_active_at", sa.DateTime(), nullable=True)
        )
    # Pitfall 3 — backfill so existing sessions do not instantly idle-expire.
    op.execute(
        "UPDATE refresh_tokens SET last_active_at = created_at "
        "WHERE last_active_at IS NULL"
    )


def downgrade() -> None:
    # Reverse order: drop the column first, then the table.
    with op.batch_alter_table("refresh_tokens") as batch_op:
        batch_op.drop_column("last_active_at")
    op.drop_table("app_setting")
