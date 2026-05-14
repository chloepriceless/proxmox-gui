"""SQLAlchemy declarative base + shared mixins.

Plan 02 (db-schema) lands the concrete model classes. This module ships only
the :class:`Base` and :class:`TimestampMixin` that every model will subclass.

NOTE: Plan 01 deliberately does NOT create ``app/models/__init__.py``. That
file is owned by Plan 02, which uses it to re-export the model classes. Plan
01 application code imports directly from this module (``app.models.base``).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for every ORM model."""


class TimestampMixin:
    """Adds ``created_at`` and ``updated_at`` columns.

    Both columns default to ``CURRENT_TIMESTAMP`` server-side. ORM-level
    ``onupdate`` is *not* used here because some tables update via direct
    ``UPDATE ...`` statements that bypass the ORM event listener; Plan 02's
    migrations will add ``ON UPDATE`` triggers where required.
    """

    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
