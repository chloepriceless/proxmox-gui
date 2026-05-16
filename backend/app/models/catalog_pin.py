"""Community-scripts catalog pin — a single-row global config table (D-06).

The community-scripts catalog is pinned to a specific commit SHA (CLAUDE.md
constraint #8 — never run an unpinned script). This table holds exactly one
row: the currently-pinned commit, when it was synced, who synced it, and the
admin-editable curated-shortlist override (D-06).

``catalog_pin`` is a GLOBAL config table — it is NOT tenant data and does NOT
carry a ``team_id``. The catalog (and its pin) is shared across every team and
every cluster; the community-scripts repo is the same upstream for everyone.
It IS allow-listed in ``tests/test_schema_invariants.py``.

schema-invariant ALLOWLIST: ``catalog_pin`` is allow-listed (no ``team_id``).
Rationale — global config: the community-scripts catalog pin is not
tenant-scoped; one row, cluster-agnostic, shared by every team. The pin is
operator configuration, not tenant data.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CatalogPin(Base):
    __tablename__ = "catalog_pin"

    id: Mapped[int] = mapped_column(primary_key=True)
    # The 40-char community-scripts repo commit SHA the catalog is pinned to.
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    synced_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    # The admin who last synced the catalog — nullable for the bundled
    # snapshot.json floor row that ships with no human actor (D-05).
    synced_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", name="fk_catalog_pin_user"),
        nullable=True,
    )
    # JSON text — the admin-editable curated-shortlist override (D-06). NULL
    # means "use the bundled curated map verbatim".
    curated_overrides: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return (
            f"<CatalogPin id={self.id} commit_sha={self.commit_sha[:8]!r} "
            f"synced_at={self.synced_at}>"
        )
