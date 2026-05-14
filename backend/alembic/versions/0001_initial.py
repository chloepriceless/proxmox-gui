"""initial Phase-1 schema (11 tables)

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-14

Lands the full Phase-1 schema in a single revision. Each table mirrors the
SQLAlchemy ORM definitions in :mod:`app.models` exactly; column types, FK
behaviours, indexes, and CHECK constraints are reproduced literally.

The migration is written by hand rather than via Alembic autogenerate
because:

- EncryptedSecret is a TypeDecorator over LargeBinary; autogenerate would
  render the *decorator* class name. We render the *underlying* SQLA type
  (``sa.LargeBinary``) here so the migration is portable across changes
  to the decorator's docstring / type annotations.
- The Quota CHECK constraint syntax (``(x IS NOT NULL) <> (y IS NOT NULL)``)
  needs SQLite-friendly spelling.
- The downgrade path drops tables in dependency-reverse order so FK
  enforcement under ``PRAGMA foreign_keys = ON`` does not bite us.

References:
- 01-RESEARCH.md §Schema Sketch
- 01-CONTEXT.md D-01, D-02, D-05, D-08, D-11, D-15
- PITFALLS.md Pitfall 2, 5, 7, 12, 22
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "is_admin", sa.Boolean(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=False)

    # ------------------------------------------------------------------
    # teams
    # ------------------------------------------------------------------
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column(
            "personal", sa.Boolean(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("name", name="uq_teams_name"),
    )
    op.create_index("ix_teams_personal", "teams", ["personal"], unique=False)

    # ------------------------------------------------------------------
    # clusters
    # ------------------------------------------------------------------
    op.create_table(
        "clusters",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column(
            "port", sa.Integer(), nullable=False, server_default=sa.text("8006")
        ),
        sa.Column(
            "verify_ssl",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column("token_user", sa.String(length=128), nullable=False),
        sa.Column("token_name", sa.String(length=64), nullable=False),
        # EncryptedSecret is a TypeDecorator over LargeBinary — render the
        # underlying SQL type so the migration is decorator-agnostic.
        sa.Column("api_token_secret", sa.LargeBinary(), nullable=False),
        sa.Column("tls_fingerprint", sa.String(length=255), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("name", name="uq_clusters_name"),
    )

    # ------------------------------------------------------------------
    # team_memberships (D-05 many-to-many; composite PK)
    # ------------------------------------------------------------------
    op.create_table(
        "team_memberships",
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            ondelete="CASCADE",
            name="fk_team_memberships_team",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_team_memberships_user",
        ),
        sa.PrimaryKeyConstraint("team_id", "user_id", name="pk_team_memberships"),
    )
    op.create_index(
        "ix_team_memberships_user", "team_memberships", ["user_id"], unique=False
    )

    # ------------------------------------------------------------------
    # team_cluster_tokens (D-01, D-02 — one privsep token per (team, cluster))
    # ------------------------------------------------------------------
    op.create_table(
        "team_cluster_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        sa.Column("userid", sa.String(length=128), nullable=False),
        sa.Column("tokenid", sa.String(length=64), nullable=False),
        sa.Column("token_secret", sa.LargeBinary(), nullable=False),
        sa.Column("poolid", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            ondelete="CASCADE",
            name="fk_team_cluster_tokens_team",
        ),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["clusters.id"],
            ondelete="CASCADE",
            name="fk_team_cluster_tokens_cluster",
        ),
        sa.UniqueConstraint(
            "team_id",
            "cluster_id",
            name="uq_team_cluster_tokens_team_cluster",
        ),
    )

    # ------------------------------------------------------------------
    # ssh_keys (AUTH-05)
    # ------------------------------------------------------------------
    op.create_table(
        "ssh_keys",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("fingerprint", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_ssh_keys_user",
        ),
        sa.UniqueConstraint("user_id", "name", name="uq_ssh_keys_user_name"),
    )
    op.create_index(
        "ix_ssh_keys_fingerprint", "ssh_keys", ["fingerprint"], unique=False
    )

    # ------------------------------------------------------------------
    # personal_access_tokens (API-02)
    # ------------------------------------------------------------------
    op.create_table(
        "personal_access_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("lookup_prefix", sa.String(length=16), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_pats_user",
        ),
        sa.UniqueConstraint("user_id", "name", name="uq_pats_user_name"),
    )
    op.create_index(
        "ix_pats_lookup_prefix",
        "personal_access_tokens",
        ["lookup_prefix"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # refresh_tokens (D-11)
    # ------------------------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("replaced_by_id", sa.Integer(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_refresh_tokens_user",
        ),
        sa.ForeignKeyConstraint(
            ["replaced_by_id"],
            ["refresh_tokens.id"],
            ondelete="SET NULL",
            name="fk_refresh_tokens_replaced_by",
            # Self-referential FK. SQLite needs the table to exist already,
            # which it does within the same create_table call.
        ),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index(
        "ix_refresh_tokens_user", "refresh_tokens", ["user_id"], unique=False
    )
    op.create_index(
        "ix_refresh_tokens_expires",
        "refresh_tokens",
        ["expires_at"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # audit_log (Pitfall 5 — team_id from row 1, nullable for system events)
    # ------------------------------------------------------------------
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_pat_id", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("cluster_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=True),
        sa.Column("target_id", sa.String(length=128), nullable=True),
        sa.Column("result", sa.String(length=32), nullable=False),
        sa.Column("source_ip", sa.String(length=64), nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
        sa.Column("payload_before", sa.Text(), nullable=True),
        sa.Column("payload_after", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_audit_actor_user",
        ),
        sa.ForeignKeyConstraint(
            ["actor_pat_id"],
            ["personal_access_tokens.id"],
            ondelete="SET NULL",
            name="fk_audit_actor_pat",
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            ondelete="SET NULL",
            name="fk_audit_team",
        ),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["clusters.id"],
            ondelete="SET NULL",
            name="fk_audit_cluster",
        ),
    )
    op.create_index(
        "ix_audit_log_occurred_at", "audit_log", ["occurred_at"], unique=False
    )
    op.create_index(
        "ix_audit_team_time",
        "audit_log",
        ["team_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_audit_actor_time",
        "audit_log",
        ["actor_user_id", "occurred_at"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # quotas (D-08 — team XOR user)
    # ------------------------------------------------------------------
    op.create_table(
        "quotas",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("cpu_cores", sa.Integer(), nullable=True),
        sa.Column("ram_bytes", sa.Integer(), nullable=True),
        sa.Column("disk_bytes", sa.Integer(), nullable=True),
        sa.Column("vm_count", sa.Integer(), nullable=True),
        sa.Column("lxc_count", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
            ondelete="CASCADE",
            name="fk_quotas_team",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_quotas_user",
        ),
        sa.UniqueConstraint("team_id", name="uq_quotas_team_id"),
        sa.UniqueConstraint("user_id", name="uq_quotas_user_id"),
        # D-08 XOR. T-01-02-06 mitigation.
        sa.CheckConstraint(
            "(team_id IS NOT NULL) <> (user_id IS NOT NULL)",
            name="ck_quota_team_xor_user",
        ),
    )

    # ------------------------------------------------------------------
    # jobs (Pitfall 12 — idempotency_key; Pitfall 2 — upid persisted first)
    # ------------------------------------------------------------------
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column(
            "state",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("cluster_id", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("upid", sa.String(length=255), nullable=True),
        sa.Column("upid_node", sa.String(length=64), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["cluster_id"], ["clusters.id"], name="fk_jobs_cluster"
        ),
        sa.ForeignKeyConstraint(
            ["team_id"], ["teams.id"], name="fk_jobs_team"
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"], name="fk_jobs_actor_user"
        ),
        sa.UniqueConstraint(
            "idempotency_key", name="uq_jobs_idempotency_key"
        ),
    )
    op.create_index("ix_jobs_state", "jobs", ["state"], unique=False)
    op.create_index(
        "ix_jobs_team_created", "jobs", ["team_id", "created_at"], unique=False
    )


def downgrade() -> None:
    """Drop every Phase-1 table in reverse dependency order.

    The order is important under ``PRAGMA foreign_keys = ON`` (which the
    app's PRAGMA listener turns on): a table cannot be dropped while another
    table's FK references it.
    """
    # Reverse of upgrade(): drop dependents before parents.
    op.drop_index("ix_jobs_team_created", table_name="jobs")
    op.drop_index("ix_jobs_state", table_name="jobs")
    op.drop_table("jobs")

    op.drop_table("quotas")

    op.drop_index("ix_audit_actor_time", table_name="audit_log")
    op.drop_index("ix_audit_team_time", table_name="audit_log")
    op.drop_index("ix_audit_log_occurred_at", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_index("ix_refresh_tokens_expires", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index(
        "ix_pats_lookup_prefix", table_name="personal_access_tokens"
    )
    op.drop_table("personal_access_tokens")

    op.drop_index("ix_ssh_keys_fingerprint", table_name="ssh_keys")
    op.drop_table("ssh_keys")

    op.drop_table("team_cluster_tokens")

    op.drop_index("ix_team_memberships_user", table_name="team_memberships")
    op.drop_table("team_memberships")

    op.drop_table("clusters")

    op.drop_index("ix_teams_personal", table_name="teams")
    op.drop_table("teams")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
