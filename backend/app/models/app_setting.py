"""DB-backed runtime settings — a single-row global config table (D-01).

The Phase-5 admin Settings page (D-01) is backed by this one-row table. It is
the canonical home for the idle-session-timeout value (D-02, default 30 min)
and the audit-log retention value (D-06, default 1 year / 365 days). An admin
edits these via ``PATCH /api/v1/admin/settings`` and the change takes effect
without a service restart (the API caches the row in-process and invalidates
the cache on write — see :mod:`app.settings.service`).

``app_setting`` is a GLOBAL config table — it is NOT tenant data and does NOT
carry a ``team_id``. There is exactly one row (``id == 1``), shared by every
team and every cluster; idle timeout and audit retention are operator policy,
not per-tenant configuration. It IS allow-listed in
``tests/test_schema_invariants.py``.

schema-invariant ALLOWLIST: ``app_setting`` is allow-listed (no ``team_id``).
Rationale — global operator config: the idle-timeout and audit-retention
values are not tenant-scoped; one row, cluster-agnostic, shared by every team.
These are operator configuration, not tenant data.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppSetting(Base):
    __tablename__ = "app_setting"

    # Always 1 — this is a single-row table.
    id: Mapped[int] = mapped_column(primary_key=True)
    # D-02: idle-session-timeout window in minutes (default 30).
    idle_timeout_minutes: Mapped[int] = mapped_column(
        nullable=False,
        server_default=text("30"),
    )
    # D-06: audit-log retention window in days (default 365 = 1 year).
    audit_retention_days: Mapped[int] = mapped_column(
        nullable=False,
        server_default=text("365"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    # The admin who last changed a setting — nullable for the migration-seeded
    # row that ships with no human actor.
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", name="fk_app_setting_user"),
        nullable=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<AppSetting id={self.id} "
            f"idle_timeout_minutes={self.idle_timeout_minutes} "
            f"audit_retention_days={self.audit_retention_days}>"
        )
