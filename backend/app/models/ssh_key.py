"""SSH public keys belonging to users (AUTH-05).

Plan 06's VM-create flow consumes these via Cloud-Init. The fingerprint is
``SHA256:<base64>`` over the OpenSSH-wire-format public key (per Plan 07's
parser), indexed for deduplication and "key already in use" admin lookups.

This table is user-scoped, not team-scoped: SSH keys are personal artefacts.
The audit_log/team-isolation invariant is satisfied because SSH keys appear
under ``actor_user_id`` in audit events; they never reference a team_id.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SshKey(Base):
    __tablename__ = "ssh_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)  # OpenSSH text
    # "SHA256:..." — see 01-RESEARCH.md §SSH key parse with fingerprint.
    fingerprint: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_ssh_keys_user_name"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<SshKey id={self.id} user={self.user_id} name={self.name!r}>"
