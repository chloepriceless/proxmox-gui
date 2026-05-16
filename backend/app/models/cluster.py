"""Cluster ORM model — one row per Proxmox cluster managed by this portal.

The bootstrap API token is stored in :attr:`api_token_secret`, transparently
encrypted at rest via :class:`~app.models._types.EncryptedSecret` (Fernet,
D-15). Plan 06 owns the create/edit endpoints; Plan 06 also writes
per-tenant privilege-separated tokens to :class:`TeamClusterToken`.

The bootstrap token is only used to *provision* tenant tokens — it is NEVER
used for tenant-scoped operations (Pitfall 7).
"""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models._types import EncryptedSecret
from app.models.base import Base, TimestampMixin


class Cluster(Base, TimestampMixin):
    __tablename__ = "clusters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(
        Integer, nullable=False, default=8006, server_default="8006"
    )
    verify_ssl: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )
    # e.g. "root@pam" — the realm-qualified user that owns the bootstrap token.
    token_user: Mapped[str] = mapped_column(String(128), nullable=False)
    # e.g. "gui-bootstrap" — the token id under the bootstrap user.
    token_name: Mapped[str] = mapped_column(String(64), nullable=False)
    # Fernet-encrypted at rest. Plaintext value is the raw token secret.
    api_token_secret: Mapped[str] = mapped_column(EncryptedSecret, nullable=False)
    # Optional cert pinning — populated when verify_ssl=False but operator
    # wants TOFU-style pinning instead.
    tls_fingerprint: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # Admin-preset backup-capable storage (D-08); users pick retention, not
    # storage. When NULL the per-cluster backup endpoints are unavailable —
    # the backup service raises a 409 directing users to an administrator.
    backup_storage: Mapped[str | None] = mapped_column(
        String(128), nullable=True, default=None
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<Cluster id={self.id} name={self.name!r} host={self.host!r}>"
