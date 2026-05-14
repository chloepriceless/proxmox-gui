"""End-to-end Alembic migration tests for revision 0001_initial.

These tests run the *real* migration against an on-disk SQLite database
(``./tmp_test_migrate.db``, cleaned up after each test) — not the in-memory
DB used elsewhere — because:

1. ``alembic.command.upgrade`` opens its own sync engine; sharing an
   ``aiosqlite:///:memory:`` URL across processes would not work.
2. We want the verification to use exactly the same code path that the app
   uses at boot (``app/core/db.py::run_migrations`` → sync Alembic API).

Invariants verified:
- ``alembic upgrade head`` builds the full schema.
- Running it twice does NOT error (idempotency of the Alembic ``head``
  pointer — the second invocation should be a no-op).
- ``alembic downgrade base`` removes every Phase-1 table, leaving only
  ``alembic_version``.

The tests pass an absolute path to the migration script directory because
the conftest may change cwd between test runs; ``alembic.ini`` itself uses
a relative ``script_location``.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


@pytest.fixture
def fresh_db(tmp_path: Path) -> str:
    """Return a sqlite URL pointing at a freshly-created empty file."""
    db_file = tmp_path / "migrate_test.db"
    return f"sqlite:///{db_file}"


def _make_config(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    # Resolve script_location relative to the backend dir, since pytest's
    # cwd is not necessarily backend/.
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def test_alembic_ini_exists() -> None:
    assert ALEMBIC_INI.exists(), f"missing {ALEMBIC_INI}"


def test_upgrade_head_creates_all_eleven_tables(fresh_db: str) -> None:
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")

    engine = sa.create_engine(fresh_db)
    table_names = set(sa.inspect(engine).get_table_names())
    expected = {
        "users",
        "teams",
        "team_memberships",
        "clusters",
        "team_cluster_tokens",
        "ssh_keys",
        "personal_access_tokens",
        "refresh_tokens",
        "audit_log",
        "quotas",
        "jobs",
    }
    assert expected.issubset(table_names), (
        f"missing tables: {expected - table_names}"
    )
    # alembic_version is created by Alembic itself.
    assert "alembic_version" in table_names
    # And nothing unexpected.
    business = {n for n in table_names if n != "alembic_version"}
    assert business == expected, f"unexpected extras: {business - expected}"
    engine.dispose()


def test_upgrade_head_is_idempotent(fresh_db: str) -> None:
    """Running ``upgrade head`` twice MUST succeed — the second is a no-op."""
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")
    # No exception expected on second invocation.
    command.upgrade(cfg, "head")
    # And the schema must be unchanged.
    engine = sa.create_engine(fresh_db)
    assert "users" in sa.inspect(engine).get_table_names()
    engine.dispose()


def test_downgrade_to_base_removes_all_tables(fresh_db: str) -> None:
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    engine = sa.create_engine(fresh_db)
    remaining = set(sa.inspect(engine).get_table_names())
    # Only the alembic_version housekeeping table may remain.
    business = {n for n in remaining if n != "alembic_version"}
    assert business == set(), (
        f"downgrade left tables behind: {business}"
    )
    engine.dispose()


def test_quota_xor_check_is_enforced(fresh_db: str) -> None:
    """Inserting a quota row violating the XOR raises IntegrityError."""
    cfg = _make_config(fresh_db)
    command.upgrade(cfg, "head")

    engine = sa.create_engine(fresh_db)
    # SQLite needs PRAGMA foreign_keys = ON to enforce FKs at all, but
    # CHECK constraints are always on. Confirm by attempting both invalid
    # cases.
    with engine.begin() as conn:
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(
                sa.text(
                    "INSERT INTO quotas (team_id, user_id, updated_at) "
                    "VALUES (NULL, NULL, CURRENT_TIMESTAMP)"
                )
            )
    with engine.begin() as conn:
        # Seed a team and user so the FK targets exist.
        conn.execute(
            sa.text(
                "INSERT INTO teams (id, name, personal, is_active, "
                "created_at, updated_at) VALUES "
                "(1, 'team-a', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO users (id, username, email, password_hash, "
                "is_admin, is_active, created_at, updated_at) VALUES "
                "(1, 'u1', 'u1@example.com', 'x', 0, 1, "
                "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(
                sa.text(
                    "INSERT INTO quotas (team_id, user_id, updated_at) "
                    "VALUES (1, 1, CURRENT_TIMESTAMP)"
                )
            )
    engine.dispose()


def test_env_py_sets_render_as_batch() -> None:
    """Pitfall A1: SQLite ALTER COLUMN crashes without batch mode."""
    env_py = BACKEND_DIR / "alembic" / "env.py"
    assert env_py.exists()
    content = env_py.read_text()
    assert "render_as_batch=True" in content
    assert "compare_type=True" in content


def test_revision_file_exists_with_correct_ids() -> None:
    rev = BACKEND_DIR / "alembic" / "versions" / "0001_initial.py"
    assert rev.exists()
    content = rev.read_text()
    assert 'revision = "0001_initial"' in content or "revision = '0001_initial'" in content
    assert "down_revision = None" in content
    assert "ck_quota_team_xor_user" in content
    assert "ix_pats_lookup_prefix" in content


# Tidy: make sure no leftover tmp DBs survive (CI cleanliness).
def teardown_module(_module) -> None:  # noqa: PT004
    for f in BACKEND_DIR.glob("tmp_test_migrate.db*"):
        try:
            os.remove(f)
        except OSError:
            pass
