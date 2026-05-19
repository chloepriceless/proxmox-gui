"""Audit-retention cron tests (AUDIT-06, plan 05-03, D-06/D-07).

Task 1, TDD RED phase: tests written before the implementation.

Covers the five behaviours from the plan:
  1. out-of-window rows are archived to a .csv.gz and deleted; in-window rows stay.
  2. with no out-of-window rows, no file is written and nothing is deleted.
  3. the archive .csv.gz is valid gzip and decompresses to CSV with the same
     header as the user-facing export.
  4. rows are deleted only AFTER the .gz is closed (write-then-delete ordering).
  5. a per-row exception inside the sweep does not abort the whole run.
"""

from __future__ import annotations

import csv
import gzip
import inspect
import io
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_audit_row(session_factory, *, occurred_at: datetime, action: str):
    """Insert one AuditLog row with an explicit occurred_at (stored naive)."""
    from app.models import AuditLog

    async with session_factory() as session:
        session.add(
            AuditLog(
                action=action,
                target_type="vm",
                target_id="100",
                result="success",
                actor_user_id=None,
                team_id=None,
                # SQLite strips tzinfo — store naive UTC like the writer path.
                occurred_at=occurred_at.replace(tzinfo=None),
            )
        )
        await session.commit()


async def _count_audit(session_factory) -> int:
    from app.models import AuditLog

    async with session_factory() as session:
        return (await session.execute(select(func.count(AuditLog.id)))).scalar_one()


def _ctx(session_factory) -> dict:
    return {"sessionmaker": session_factory}


# ---------------------------------------------------------------------------
# Behaviour 1 — out-of-window rows archived + deleted, in-window rows kept
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roll_audit_log_archives_and_deletes_out_of_window_rows(
    session_factory, tmp_path, monkeypatch
):
    """roll_audit_log writes a .csv.gz of the out-of-window rows and deletes
    exactly those rows; in-window rows survive."""
    import app.audit.archive as archive
    from app.jobs.retention_cron import roll_audit_log

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")

    now = datetime.now(UTC)
    # 2 rows well outside the 365-day window, 1 row inside it.
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=400), action="vm.old.1"
    )
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=500), action="vm.old.2"
    )
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=10), action="vm.recent"
    )

    await roll_audit_log(_ctx(session_factory))

    # Only the in-window row remains.
    assert await _count_audit(session_factory) == 1
    async with session_factory() as session:
        from app.models import AuditLog

        remaining = (
            await session.execute(select(AuditLog.action))
        ).scalars().all()
    assert remaining == ["vm.recent"]

    # Exactly one archive file was written.
    files = list((tmp_path / "audit-archives").glob("*.csv.gz"))
    assert len(files) == 1

    # It contains both out-of-window rows and neither of the in-window rows.
    with gzip.open(files[0], "rt", encoding="utf-8") as fh:
        body = fh.read()
    assert "vm.old.1" in body
    assert "vm.old.2" in body
    assert "vm.recent" not in body


# ---------------------------------------------------------------------------
# Behaviour 2 — nothing out of window → no file, no deletion
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roll_audit_log_noop_when_nothing_out_of_window(
    session_factory, tmp_path, monkeypatch
):
    """With every row inside the retention window, no archive is written and
    no row is deleted."""
    import app.audit.archive as archive
    from app.jobs.retention_cron import roll_audit_log

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")

    now = datetime.now(UTC)
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=5), action="vm.fresh.1"
    )
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=30), action="vm.fresh.2"
    )

    await roll_audit_log(_ctx(session_factory))

    assert await _count_audit(session_factory) == 2
    archive_dir = tmp_path / "audit-archives"
    files = list(archive_dir.glob("*.csv.gz")) if archive_dir.exists() else []
    assert files == []


# ---------------------------------------------------------------------------
# Behaviour 3 — archive is valid gzip with the same header as the user export
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roll_audit_log_archive_header_matches_user_export(
    session_factory, tmp_path, monkeypatch
):
    """The archive decompresses to CSV whose header row equals the shared
    audit-export header (the row factored out of audit_csv_stream)."""
    import app.audit.archive as archive
    from app.audit.csv import audit_header_row
    from app.jobs.retention_cron import roll_audit_log

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")

    now = datetime.now(UTC)
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=800), action="vm.ancient"
    )

    await roll_audit_log(_ctx(session_factory))

    files = list((tmp_path / "audit-archives").glob("*.csv.gz"))
    assert len(files) == 1

    with gzip.open(files[0], "rt", encoding="utf-8") as fh:
        text = fh.read()
    # The BOM is the first character of the decompressed text.
    assert text[0] == "﻿"
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    assert rows[0] == audit_header_row()


# ---------------------------------------------------------------------------
# Behaviour 4 — write-then-delete ordering (verified by source inspection)
# ---------------------------------------------------------------------------


def test_roll_audit_log_deletes_only_after_archive_written():
    """The DELETE must appear after the write_audit_archive call in the source
    — never delete rows before the archive file is durable (T-05-03-03)."""
    import app.jobs.retention_cron as retention_cron

    src = inspect.getsource(retention_cron.roll_audit_log)
    write_idx = src.find("write_audit_archive")
    delete_idx = src.lower().find("delete")
    assert write_idx != -1, "roll_audit_log must call write_audit_archive"
    assert delete_idx != -1, "roll_audit_log must issue a DELETE"
    assert write_idx < delete_idx, (
        "write_audit_archive must be called BEFORE the DELETE "
        "(write-then-delete ordering)"
    )


# ---------------------------------------------------------------------------
# Behaviour 5 — a per-row failure does not abort the whole run
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roll_audit_log_survives_archive_failure(
    session_factory, tmp_path, monkeypatch, caplog
):
    """If write_audit_archive raises, roll_audit_log logs and returns cleanly —
    it never crashes the worker, and it does NOT delete the un-archived rows."""
    import app.audit.archive as archive
    import app.jobs.retention_cron as retention_cron
    from app.jobs.retention_cron import roll_audit_log

    monkeypatch.setattr(archive, "ARCHIVE_DIR", tmp_path / "audit-archives")

    now = datetime.now(UTC)
    await _seed_audit_row(
        session_factory, occurred_at=now - timedelta(days=900), action="vm.doomed"
    )

    async def _boom(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(retention_cron, "write_audit_archive", _boom)

    # Must not raise.
    await roll_audit_log(_ctx(session_factory))

    # The archive failed — the row must NOT have been deleted.
    assert await _count_audit(session_factory) == 1
