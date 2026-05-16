"""phase 3: per-cluster admin backup-storage designation.

Revision ID: 0005_phase3_backup_storage
Revises: 0004_phase3
Create Date: 2026-05-16

Changes:
1. clusters table: ADD backup_storage (String(128), NULL) — D-08. The admin
   designates one backup-capable storage per cluster; users then pick only
   retention (keep-last-N), never storage. NULL means backups are disabled
   for the cluster and the backup endpoints surface a 409.

Notes:
- Two migrations split file ownership cleanly across plans: 0004_phase3
  (Plan 03-01) added the jobs columns + the backup_schedules table; 0005
  (Plan 03-04) adds this single clusters column.
- SQLite ALTER goes through op.batch_alter_table (render_as_batch=True in
  env.py).
- Downgrade reverses the change.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_phase3_backup_storage"
down_revision: str | None = "0004_phase3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("clusters", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("backup_storage", sa.String(128), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("clusters", schema=None) as batch_op:
        batch_op.drop_column("backup_storage")
