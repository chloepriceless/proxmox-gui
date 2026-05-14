"""add unique partial index uq_one_admin on users(is_admin) WHERE is_admin

Revision ID: 0002_add_uq_one_admin
Revises: 0001_initial
Create Date: 2026-05-14

Closes BL-02 (TOCTOU race on first-run admin creation, threat T-01-07-01).

``setup/service.py:create_initial_admin`` pre-checks ``no_admin_yet`` and then
inserts the admin row, but the check and the insert are two separate
statements in the same SQLite session. With SQLite's default
``journal_mode=WAL`` and ``NORMAL`` synchronous mode, two concurrent HTTP
requests to ``POST /api/v1/setup/admin`` can both pass ``no_admin_yet``
before either's INSERT commits, yielding two admin rows.

This migration adds a unique *partial* index that only covers rows where
``is_admin = 1``. The second concurrent INSERT therefore violates the index
and raises ``IntegrityError`` at commit time — which the existing
``except IntegrityError`` block in ``create_initial_admin`` already maps to
HTTP 409. The race is turned from "accept-both" into "accept-one /
reject-one with 409", which is the correct one-shot setup semantics.

Notes:

- The partial WHERE clause is rendered using ``sqlite_where`` /
  ``postgresql_where`` so the same index DDL is portable. SQLite supports
  partial indexes since 3.8.0 (we target 3.40+ via Python 3.12's bundled
  pysqlite); PostgreSQL has always supported them.
- ``render_as_batch=True`` in ``alembic/env.py`` is harmless for index
  creation — Alembic only invokes batch mode for ALTER COLUMN operations.
- The index name is referenced in tests; do not rename without updating
  ``tests/test_setup.py`` and ``tests/test_migrations.py``.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_add_uq_one_admin"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "uq_one_admin",
        "users",
        ["is_admin"],
        unique=True,
        sqlite_where=sa.text("is_admin = 1"),
        postgresql_where=sa.text("is_admin = true"),
    )


def downgrade() -> None:
    op.drop_index("uq_one_admin", table_name="users")
