"""Backup-schedule ORM model — LIFE-06 (scheduled backups).

This model maps the ``backup_schedules`` table that the ``0004_phase3``
migration (Plan 03-01) already created — Plan 03-04 only adds the ORM class;
the schema landed in Phase 3 Plan 01 so it is stable across the whole phase.

**D-08 (simple keep-last-N retention).** A schedule carries a ``keep_last``
count; the arq cron (``app/jobs/backups_cron.py``) fires due schedules and the
backup job's success path prunes the VM's backup files down to the last N
(oldest-first). PVE's full prune model — calendar events, vzdump.conf — is the
*deferred* enhancement; this model intentionally stays simple.

**D-06 (Backups surfaces).** Two consumers read these rows: the per-VM
"Backups" tab (``GET .../backup-schedule``) and the global ``/backups`` page
(``GET /backups/schedules`` — team-scoped). One schedule per ``(cluster, vmid)``
pair, enforced by ``uq_backup_schedules_cluster_vmid`` in the migration.

Column types and FK target names mirror the ``0004_phase3`` migration exactly.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BackupSchedule(Base):
    __tablename__ = "backup_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    cluster_id: Mapped[int] = mapped_column(
        ForeignKey("clusters.id", name="fk_backup_schedules_cluster_id"),
        nullable=False,
    )
    # The owning team — scheduled-backup cron jobs carry this so the audit
    # trail attributes the job to a tenant (T-03-04-08).
    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", name="fk_backup_schedules_team_id"),
        nullable=False,
    )
    vmid: Mapped[int] = mapped_column(Integer, nullable=False)
    is_lxc: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    node: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("1")
    )
    # values: "daily" | "weekly".
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)
    # D-08: keep the last N backup files; the prune deletes the rest.
    keep_last: Mapped[int] = mapped_column(
        Integer, nullable=False, default=7, server_default=text("7")
    )
    last_run_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_run_state: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        Index("ix_backup_schedules_enabled", "enabled"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<BackupSchedule id={self.id} cluster_id={self.cluster_id} "
            f"vmid={self.vmid} frequency={self.frequency!r} "
            f"enabled={self.enabled}>"
        )
