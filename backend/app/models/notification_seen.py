"""Per-user notification-bell unread cursor — D-23 (Phase 4).

The notification bell is a *derived view* over the existing ``jobs`` table —
there is no separate notification store (D-23). The only persisted state is a
per-user "last seen" timestamp: the unread count is the number of recent job
rows newer than ``last_seen_at``. Opening the bell stamps ``last_seen_at`` to
"now", clearing the count.

One row per user — enforced by ``UNIQUE(user_id)``.

schema-invariant ALLOWLIST: ``notification_seen`` is allow-listed (no
``team_id``). Rationale — per-user row: the notification bell's unread cursor
is owned by a single user; ``user_id`` is the tenant boundary here, exactly as
for ``refresh_tokens`` / ``ssh_keys`` / ``personal_access_tokens``. There is
no ``team_id`` because notifications are per-user, not per-team — a user in
multiple teams still has one bell.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotificationSeen(Base):
    __tablename__ = "notification_seen"

    id: Mapped[int] = mapped_column(primary_key=True)
    # One row per user — the unread-cursor owner.
    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id", ondelete="CASCADE", name="fk_notification_seen_user"
        ),
        nullable=False,
        unique=True,
    )
    # The cursor — recent job rows newer than this are "unread".
    last_seen_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<NotificationSeen id={self.id} user={self.user_id} "
            f"last_seen_at={self.last_seen_at}>"
        )
