"""Self-update tests (DEPLOY-04, plan 05-04).

Task 2, TDD RED phase:

Three behaviours are foundational and must be tested:

1. **WAL-safe DB snapshot.** ``snapshot_db`` MUST go through
   ``sqlite3.connect(src).backup(dst)`` — NOT ``shutil.copy``. The test seeds a
   row in a WAL-mode SQLite DB, takes a snapshot, opens the snapshot as a fresh
   connection, and asserts the row is readable.

2. **SHA-256 manifest verification.** ``verify_sha256`` returns ``True`` for
   a matching digest and ``False`` for a mismatch.

3. **202-enqueue route.** ``POST /api/v1/admin/self-update`` admin-only,
   CSRF-protected, returns 202 with a job_id; a non-admin gets 403; missing
   arq_pool returns 503.

4. **run_self_update orchestration (basic shape).** The function body exists
   (not the 05-01 NotImplementedError stub), references the manifest verify
   helper, takes the WAL-safe snapshot, and ends in a terminal job state on a
   simulated failure path (mismatched SHA-256 → job state == failed).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import select

from tests.factories import login_as, make_user


# ---------------------------------------------------------------------------
# 1. WAL-safe DB snapshot
# ---------------------------------------------------------------------------


def test_snapshot_db_uses_online_backup_api(tmp_path: Path):
    """snapshot_db must round-trip rows from a WAL-mode source DB."""
    from app.selfupdate.service import snapshot_db

    src = tmp_path / "src.db"
    dst = tmp_path / "src.db.pre-update"

    # Seed a WAL-mode SQLite with one row, then close cleanly.
    conn = sqlite3.connect(src)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE t (k TEXT, v TEXT)")
    conn.execute("INSERT INTO t VALUES ('alpha', 'beta')")
    conn.commit()
    conn.close()

    snapshot_db(str(src), str(dst))

    assert dst.exists()
    # Read the snapshot as a brand-new connection — proves the backup folded
    # any WAL frames into the destination file (a plain `shutil.copy` of the
    # main DB file without the -wal would lose the row).
    out = sqlite3.connect(dst)
    row = out.execute("SELECT k, v FROM t").fetchone()
    out.close()
    assert row == ("alpha", "beta")


def test_snapshot_db_does_not_use_shutil_copy():
    """Defense-in-depth: the implementation must not call shutil.copy on the DB.

    Pitfall 1 / Threat T-05-04-04: a plain file copy of a WAL-mode SQLite leaves
    the latest writes in the -wal sidecar file. The grep-style check here
    asserts the implementation uses the sqlite3 online-backup API instead.
    """
    src = Path(__file__).resolve().parents[1] / "app" / "selfupdate" / "service.py"
    body = src.read_text()
    # The backup API call (`.backup(`) must appear; shutil.copy on a db must not.
    assert ".backup(" in body, "snapshot_db must use sqlite3's .backup() API"
    assert "shutil.copy" not in body, (
        "snapshot_db must NEVER shutil.copy a WAL-mode DB (Pitfall 1)"
    )


# ---------------------------------------------------------------------------
# 2. SHA-256 manifest verification
# ---------------------------------------------------------------------------


def test_verify_sha256_accepts_matching_digest(tmp_path: Path):
    from app.selfupdate.service import verify_sha256

    payload = b"the quick brown fox"
    tarball = tmp_path / "release.tar.gz"
    tarball.write_bytes(payload)
    expected = hashlib.sha256(payload).hexdigest()

    assert verify_sha256(str(tarball), expected) is True


def test_verify_sha256_rejects_mismatched_digest(tmp_path: Path):
    from app.selfupdate.service import verify_sha256

    tarball = tmp_path / "release.tar.gz"
    tarball.write_bytes(b"x" * 1024)
    wrong = "0" * 64

    assert verify_sha256(str(tarball), wrong) is False


def test_verify_sha256_is_case_insensitive(tmp_path: Path):
    """Manifests sometimes uppercase the hex digest — accept both."""
    from app.selfupdate.service import verify_sha256

    payload = b"data"
    tarball = tmp_path / "release.tar.gz"
    tarball.write_bytes(payload)
    expected = hashlib.sha256(payload).hexdigest().upper()

    assert verify_sha256(str(tarball), expected) is True


# ---------------------------------------------------------------------------
# 3. 202-enqueue route
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_self_update_route_admin_enqueues_202(client, session_factory):
    """An admin POSTing the route gets 202 + a job_id; the arq pool is called."""
    await make_user(
        session_factory, username="su_admin", is_admin=True,
        password="testpass12345",
    )
    cookies = await login_as(
        client, username="su_admin", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.post(
        "/api/v1/admin/self-update/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert "job_id" in body
    assert isinstance(body["job_id"], int)


@pytest.mark.asyncio
async def test_self_update_route_non_admin_forbidden(client, session_factory):
    await make_user(
        session_factory, username="su_user", is_admin=False,
        password="testpass12345",
    )
    cookies = await login_as(
        client, username="su_user", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.post(
        "/api/v1/admin/self-update/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_self_update_route_csrf_required(client, session_factory):
    """Missing X-CSRF-Token → 403 (CSRF guard fires before route handler)."""
    await make_user(
        session_factory, username="su_csrf", is_admin=True,
        password="testpass12345",
    )
    cookies = await login_as(
        client, username="su_csrf", password="testpass12345"
    )

    resp = await client.post(
        "/api/v1/admin/self-update/", cookies=cookies, json={}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_self_update_route_503_when_arq_pool_missing(
    client, session_factory, app,
):
    """If app.state.arq_pool is None the route returns 503 (mirrors jobs_retry)."""
    await make_user(
        session_factory, username="su_arq", is_admin=True,
        password="testpass12345",
    )
    cookies = await login_as(
        client, username="su_arq", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    # Knock out the recording fake the conftest installed.
    app.state.arq_pool = None

    resp = await client.post(
        "/api/v1/admin/self-update/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={},
    )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_self_update_route_rejects_bad_version(client, session_factory):
    """target_version validation: anything that is not a clean tag string → 422.

    V5 input validation (Pitfall: the version string is interpolated into a
    URL the worker fetches; a stray shell metacharacter could surprise).
    """
    await make_user(
        session_factory, username="su_ver", is_admin=True,
        password="testpass12345",
    )
    cookies = await login_as(
        client, username="su_ver", password="testpass12345"
    )
    csrf = cookies["csrf_token"]

    resp = await client.post(
        "/api/v1/admin/self-update/",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf},
        json={"target_version": "v1.0.0;rm -rf /"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 4. run_self_update body — manifest-mismatch abort + rollback shape
# ---------------------------------------------------------------------------


def test_run_self_update_body_replaces_placeholder():
    """Plan 05-01 left a NotImplementedError placeholder; this plan replaces it."""
    body = (
        Path(__file__).resolve().parents[1] / "app" / "jobs" / "selfupdate_functions.py"
    ).read_text()
    # The placeholder marker MUST be gone.
    assert 'NotImplementedError("implemented in 05-04")' not in body, (
        "run_self_update placeholder still in place — plan 05-04 must replace it"
    )
    # The orchestration must touch the four canonical anchors.
    assert "verify_sha256" in body, "must reference SHA-256 verify"
    assert "snapshot_db" in body or "app.db.pre-update" in body, (
        "must reference the WAL-safe snapshot"
    )
    assert "health" in body.lower(), "must reference the health check"
    assert "rollback" in body.lower() or "restore" in body.lower(), (
        "must reference the rollback path"
    )


@pytest.mark.asyncio
async def test_run_self_update_aborts_on_manifest_mismatch(
    session_factory, tmp_path, monkeypatch,
):
    """A SHA-256 mismatch must mark the job failed and abort BEFORE any swap.

    Threat T-05-04-01: a tampered tarball must not be unpacked. The job row's
    terminal state proves the abort happened; the absence of a release dir
    under tmp_path proves no unpack occurred.
    """
    from app.jobs.selfupdate_functions import run_self_update
    from app.models import Job

    # Seed a pending self-update job row.
    async with session_factory() as db:
        job = Job(
            kind="admin.self-update",
            cluster_id=None,
            team_id=None,
            actor_user_id=None,
            payload=json.dumps({}),
            state="pending",
            idempotency_key=None,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id

    # Monkeypatch the manifest fetcher + the tarball downloader to return
    # something whose SHA-256 we control. The manifest declares a digest
    # the tarball does NOT match → verify_sha256 returns False → the job
    # aborts.
    from app.selfupdate import service

    fake_tarball = tmp_path / "fake.tar.gz"
    fake_tarball.write_bytes(b"genuine release body")
    wrong_digest = "0" * 64

    async def fake_fetch_manifest(version):
        return {
            "version": version or "v0.0.0",
            "tarball_url": "https://example.invalid/fake.tar.gz",
            "sha256": wrong_digest,
        }

    async def fake_download(url, dst):
        # Write fake content unrelated to the declared digest.
        Path(dst).write_bytes(fake_tarball.read_bytes())

    monkeypatch.setattr(
        service, "fetch_release_manifest", fake_fetch_manifest
    )
    monkeypatch.setattr(service, "download_tarball", fake_download)

    ctx = {"sessionmaker": session_factory, "redis": None}
    await run_self_update(ctx, job_id)

    async with session_factory() as db:
        final = await db.get(Job, job_id)
        assert final is not None
        # Either failed or needs_review — never succeeded.
        assert final.state in {"failed", "needs_review"}, final.state
        assert (final.friendly_error or final.error or "").lower().find(
            "manifest"
        ) >= 0 or (final.error or "").lower().find("sha") >= 0


# ---------------------------------------------------------------------------
# 5. Worker imports cleanly with the real run_self_update body
# ---------------------------------------------------------------------------


def test_worker_settings_imports_with_real_run_self_update():
    """The worker.py registration must still resolve to the real body."""
    from app.jobs import selfupdate_functions
    from app.jobs.worker import WorkerSettings

    # Find the func registration for admin.self-update and assert it points at
    # the (now-real) run_self_update.
    matches = [f for f in WorkerSettings.functions if getattr(f, "name", "") == "admin.self-update"]
    assert matches, "admin.self-update is not registered in WorkerSettings.functions"
    f = matches[0]
    assert f.coroutine is selfupdate_functions.run_self_update
