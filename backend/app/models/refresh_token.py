"""Refresh tokens (D-11) with rotation-chain tracking.

The plaintext secret is never stored. ``token_hash`` is sha256 of the secret
the client holds in its httponly cookie. On every refresh the row is rotated:
the old row's ``revoked_at`` is set, a new row is inserted, and
``replaced_by_id`` on the old row points at the new row's id (self-FK).

This chain enables reuse detection (per Pitfall 22): if a revoked refresh
token is re-presented, the entire chain (and the user's other sessions if
desired) can be revoked.

The ``replaced_by_id`` FK uses ``ON DELETE SET NULL`` so historical rows
survive deletion of the newest row — important for audit replay.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # sha256 hex digest of the cookie value the client holds.
    token_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # Self-referential FK: when a token is rotated, point the old row at the
    # new row. ON DELETE SET NULL so deleting the newest row doesn't cascade
    # back through the chain.
    replaced_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("refresh_tokens.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    # AUTH-06: server-authoritative idle-timeout recency marker. Bumped on
    # every rotation (issue_refresh) and on a /auth/keepalive ping; the idle
    # check in consume_refresh refuses a refresh once
    # ``now - last_active_at > idle_timeout``. Nullable so the 0007 migration's
    # ADD COLUMN is SQLite-legal — the 0007 backfill sets every existing row
    # to its created_at, and the idle check is NULL-defensive (Pitfall 3).
    last_active_at: Mapped[datetime | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_refresh_tokens_expires", "expires_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<RefreshToken id={self.id} user={self.user_id} "
            f"revoked={self.revoked_at is not None}>"
        )
