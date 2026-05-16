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
from alembic.config import Config

from alembic import command

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


def test_upgrade_head_creates_all_business_tables(fresh_db: str) -> None:
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
        # Phase 3 (0004_phase3) — scheduled-backup table (LIFE-06).
        "backup_schedules",
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
    """Acceptance-criteria grep checks: the revision file must declare the
    expected revision id, mark itself as the root (``down_revision = None``),
    and include the named CHECK constraint + indexes the plan calls out."""
    import re

    rev = BACKEND_DIR / "alembic" / "versions" / "0001_initial.py"
    assert rev.exists()
    content = rev.read_text()
    # ``revision`` may carry a type annotation (revision: str = "...") or not.
    assert re.search(
        r'^\s*revision(?:\s*:\s*[^=]+)?\s*=\s*["\']0001_initial["\']',
        content,
        re.MULTILINE,
    ), "revision id is not '0001_initial'"
    assert re.search(
        r'^\s*down_revision(?:\s*:\s*[^=]+)?\s*=\s*None',
        content,
        re.MULTILINE,
    ), "down_revision is not None — 0001 must be the root"
    assert "ck_quota_team_xor_user" in content
    assert "ix_pats_lookup_prefix" in content


def test_0003_phase2_round_trip(fresh_db: str) -> None:
    """0001 → 0002 → 0003 upgrade then 0003 downgrade restores Phase-1+2 schema.

    Verifies:
    - After upgrade head: quotas table has a cluster_id column (PRAGMA table_info)
    - After upgrade head: uq_quotas_team_cluster index exists
    - After upgrade head: ix_audit_action_time index exists
    - After downgrade -1 (reverts 0003): cluster_id column gone from quotas
    - After downgrade -1: uq_quotas_team_cluster index gone
    - After downgrade -1: uq_quotas_team_id single-column unique restored
    """
    cfg = _make_config(fresh_db)

    # --- Upgrade to 0003 specifically (0001 → 0002 → 0003) ---
    # Pinned to 0003_phase2, not "head": head is now 0004_phase3, and a
    # `downgrade -1` from head would revert 0004 instead of the 0003 this
    # test targets.
    command.upgrade(cfg, "0003_phase2")

    engine = sa.create_engine(fresh_db)
    insp = sa.inspect(engine)

    # quotas.cluster_id column exists
    col_names = [c["name"] for c in insp.get_columns("quotas")]
    assert "cluster_id" in col_names, f"cluster_id missing from quotas; got {col_names}"

    # uq_quotas_team_cluster composite unique index exists
    quota_idx_names = {idx["name"] for idx in insp.get_indexes("quotas")}
    assert "uq_quotas_team_cluster" in quota_idx_names, (
        f"uq_quotas_team_cluster missing; got {quota_idx_names}"
    )

    # ix_audit_action_time filter index exists
    audit_idx_names = {idx["name"] for idx in insp.get_indexes("audit_log")}
    assert "ix_audit_action_time" in audit_idx_names, (
        f"ix_audit_action_time missing; got {audit_idx_names}"
    )

    # ix_audit_cluster_time filter index exists
    assert "ix_audit_cluster_time" in audit_idx_names, (
        f"ix_audit_cluster_time missing; got {audit_idx_names}"
    )

    engine.dispose()

    # --- Downgrade by 1 (reverts 0003 back to 0002) ---
    command.downgrade(cfg, "-1")

    engine2 = sa.create_engine(fresh_db)
    insp2 = sa.inspect(engine2)

    # cluster_id column gone
    col_names2 = [c["name"] for c in insp2.get_columns("quotas")]
    assert "cluster_id" not in col_names2, (
        f"cluster_id should be gone after downgrade; still in {col_names2}"
    )

    # uq_quotas_team_cluster index gone
    quota_idx_names2 = {idx["name"] for idx in insp2.get_indexes("quotas")}
    assert "uq_quotas_team_cluster" not in quota_idx_names2, (
        f"uq_quotas_team_cluster should be gone; still in {quota_idx_names2}"
    )

    # Phase-1 single-column unique constraint on team_id restored.
    # SQLite may store the UNIQUE as an inline table constraint (not a
    # standalone CREATE UNIQUE INDEX), so inspect().get_indexes() returns []
    # while PRAGMA index_list shows sqlite_autoindex_* entries.  We verify
    # the constraint exists via SQLite PRAGMA index_list, which reports both
    # explicit named indices AND auto-generated unique constraint indices
    # (origin='u' means from inline UNIQUE constraint).
    engine2_url = engine2.url
    engine2.dispose()
    engine3 = sa.create_engine(engine2_url)
    with engine3.connect() as conn:
        pragma_rows = conn.execute(sa.text("PRAGMA index_list('quotas')")).fetchall()
    # pragma_rows: (seq, name, unique, origin, partial)
    # origin='u' for table-definition UNIQUE, 'c' for CREATE INDEX
    unique_indices = [row for row in pragma_rows if row[2] == 1]  # unique=1
    # At minimum the team_id and user_id single-column uniques must be present
    # (either as named or sqlite_autoindex_* entries).
    assert len(unique_indices) >= 2, (
        f"Phase-1 UNIQUE constraints not restored after downgrade; "
        f"PRAGMA index_list: {pragma_rows}"
    )
    engine3.dispose()

    engine2.dispose()


# Tidy: make sure no leftover tmp DBs survive (CI cleanliness).
def teardown_module(_module) -> None:  # noqa: PT004
    for f in BACKEND_DIR.glob("tmp_test_migrate.db*"):
        try:
            os.remove(f)
        except OSError:
            pass
