"""Task 1 (TDD): AppSetting model + 0007_phase5 migration.

Behaviours under test (05-01-PLAN Task 1):

- The :class:`AppSetting` model imports and exposes the expected columns.
- ``tests/test_schema_invariants.py`` allowlist carries ``app_setting``.
- ``alembic upgrade head`` then ``downgrade -1`` round-trips on a fresh DB.
- After upgrade, an existing ``refresh_tokens`` row (created_at set,
  last_active_at NULL) has ``last_active_at`` backfilled to ``created_at``
  (Pitfall 3 — existing sessions must not instantly idle-expire).
"""

from __future__ import annotations

from pathlib import Path

import sqlalchemy as sa
from alembic.config import Config

from alembic import command

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def _make_config(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


# ---------------------------------------------------------------------------
# Model shape
# ---------------------------------------------------------------------------


def test_app_setting_model_has_expected_columns() -> None:
    """AppSetting exposes id, idle_timeout_minutes, audit_retention_days,
    updated_at, updated_by_user_id."""
    from app.models import AppSetting

    cols = set(AppSetting.__table__.columns.keys())
    expected = {
        "id",
        "idle_timeout_minutes",
        "audit_retention_days",
        "updated_at",
        "updated_by_user_id",
    }
    assert expected.issubset(cols), f"missing columns: {expected - cols}"
    assert AppSetting.__tablename__ == "app_setting"


def test_app_setting_is_allowlisted_in_schema_invariants() -> None:
    """app_setting carries no team_id, so it must be in the invariant
    allowlist with a documented rationale."""
    from tests.test_schema_invariants import ALLOWLIST

    assert "app_setting" in ALLOWLIST


def test_refresh_token_model_has_last_active_at() -> None:
    """RefreshToken gains the last_active_at column (nullable)."""
    from app.models import RefreshToken

    assert "last_active_at" in RefreshToken.__table__.columns.keys()


# ---------------------------------------------------------------------------
# 0007_phase5 migration
# ---------------------------------------------------------------------------


def test_0007_creates_app_setting_and_seeds_single_row(tmp_path: Path) -> None:
    db_url = f"sqlite:///{tmp_path / 'm.db'}"
    cfg = _make_config(db_url)
    command.upgrade(cfg, "head")

    engine = sa.create_engine(db_url)
    insp = sa.inspect(engine)
    assert "app_setting" in insp.get_table_names()

    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT id, idle_timeout_minutes, audit_retention_days "
                "FROM app_setting"
            )
        ).fetchall()
    assert rows == [(1, 30, 365)], f"unexpected seed row: {rows}"
    engine.dispose()


def test_0007_round_trips(tmp_path: Path) -> None:
    """upgrade head → downgrade -1 → upgrade head round-trips cleanly."""
    db_url = f"sqlite:///{tmp_path / 'm.db'}"
    cfg = _make_config(db_url)
    command.upgrade(cfg, "head")

    engine = sa.create_engine(db_url)
    insp = sa.inspect(engine)
    assert "app_setting" in insp.get_table_names()
    assert "last_active_at" in [
        c["name"] for c in insp.get_columns("refresh_tokens")
    ]
    engine.dispose()

    command.downgrade(cfg, "-1")
    engine = sa.create_engine(db_url)
    insp = sa.inspect(engine)
    assert "app_setting" not in insp.get_table_names()
    assert "last_active_at" not in [
        c["name"] for c in insp.get_columns("refresh_tokens")
    ]
    engine.dispose()

    command.upgrade(cfg, "head")


def test_0007_backfills_last_active_at_from_created_at(tmp_path: Path) -> None:
    """Pitfall 3: an existing refresh_tokens row must have last_active_at
    backfilled to created_at so it does not instantly idle-expire."""
    db_url = f"sqlite:///{tmp_path / 'm.db'}"
    cfg = _make_config(db_url)
    # Bring schema to 0006 (before last_active_at exists).
    command.upgrade(cfg, "0006_phase4")

    engine = sa.create_engine(db_url)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO users (id, username, email, password_hash, "
                "is_admin, is_active, created_at, updated_at) VALUES "
                "(1, 'u1', 'u1@example.com', 'x', 0, 1, "
                "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO refresh_tokens (id, user_id, token_hash, "
                "expires_at, created_at) VALUES "
                "(1, 1, 'hash-1', '2099-01-01 00:00:00', "
                "'2026-01-01 12:00:00')"
            )
        )
    engine.dispose()

    # Now apply 0007 — the backfill must run.
    command.upgrade(cfg, "head")

    engine = sa.create_engine(db_url)
    with engine.connect() as conn:
        row = conn.execute(
            sa.text(
                "SELECT created_at, last_active_at FROM refresh_tokens "
                "WHERE id = 1"
            )
        ).fetchone()
    engine.dispose()
    assert row is not None
    created_at, last_active_at = row
    assert last_active_at is not None, "last_active_at was not backfilled"
    assert str(last_active_at) == str(created_at), (
        f"last_active_at ({last_active_at}) != created_at ({created_at})"
    )
