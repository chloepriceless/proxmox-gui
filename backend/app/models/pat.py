"""Personal Access Tokens for the REST API (API-02).

A PAT authenticates a user-bound HTTP request without a cookie. Format:
``pat_<12-char-prefix><opaque-secret>``. Lookup is a two-step process to
keep verification constant-time:

1. ``lookup_prefix`` (indexed) selects the candidate row(s).
2. ``token_hash = sha256(pepper + token)`` is compared in constant time.

The plaintext secret is never stored. The pepper lives in
``settings.pat_pepper`` (loaded at boot from ``/etc/proxmox-gui/pat.pepper``
or env). Plan 05 owns the issuance + verification routes.

User-scoped, not team-scoped (PATs belong to the human, not a team).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PersonalAccessToken(Base):
    __tablename__ = "personal_access_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # First 12 chars after the ``pat_`` prefix — indexed for fast lookup.
    lookup_prefix: Mapped[str] = mapped_column(
        String(16), nullable=False, index=True
    )
    # sha256(pepper + full_token) — hex digest, 64 chars; bigger string to
    # leave room for future algorithm upgrades.
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_pats_user_name"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<PersonalAccessToken id={self.id} user={self.user_id} "
            f"name={self.name!r}>"
        )
