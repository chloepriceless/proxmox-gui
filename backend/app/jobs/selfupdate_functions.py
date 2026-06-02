"""arq job function for self-update (DEPLOY-04, plan 05-04).

The orchestration body that plan 05-01 left as a NotImplementedError stub.

**Runs in the WORKER process** (a separate systemd unit) so the API restart in
step 5 of the update sequence (RESEARCH §Pattern 5) kills the API but leaves
the worker — the auto-rollback on a failed health check (D-11) can still run
because the orchestrator is alive (Pitfall 2 / Threat T-05-04-08).

Sequence (RESEARCH §Pattern 5 — VERBATIM, do not improvise):

  1. Fetch the release manifest + tarball over HTTPS.
  2. ``verify_sha256`` the tarball against the manifest — abort on mismatch
     (D-10 / closes carryover ME-03).
  3. WAL-safe DB snapshot → ``app.db.pre-update`` (Pitfall 1).
  4. Stage + invoke ``deploy/lxc/update.sh`` (Task 1) — unpack into
     ``releases/<tag>/``, ``pip install -e backend``, use the COMMITTED
     ``frontend/build/``, ``alembic upgrade head``, atomic symlink swap.
  5. ``systemctl restart proxmox-gui-api proxmox-gui-frontend`` — the API dies
     here; the worker (us) keeps running because we are on a separate unit.
  6. Poll the new API ``GET /api/v1/health`` for up to ~60s.
  7. Healthy → mark the job done, then ``systemctl restart proxmox-gui-worker``
     LAST (the worker re-execs onto the new release; the job row is already
     in its terminal state, so a successor worker reading the row sees
     "succeeded" and does nothing).
  8. Unhealthy → auto-rollback (D-11): restore ``app.db`` from
     ``app.db.pre-update``, repoint the ``current`` symlink to the previous
     release dir, restart the API, mark the job failed.

Persistent state invariants (Pitfall 7 / Threat T-05-04-03):
- ``/etc/proxmox-gui/`` and ``/var/lib/proxmox-gui/`` are NEVER mutated except
  the deliberate ``alembic upgrade head`` (in step 4) which writes to
  ``app.db`` AND the deliberate ``snapshot_db`` (in step 3) and
  ``restore_db`` (in step 8) which write the pre-update snapshot file. The
  master key, JWT secret, PAT pepper, and GUI SSH private key are read-only
  for this job and survive every update.
- The swap (step 6, symlink repoint) only ever points ``current`` somewhere
  inside ``/opt/proxmox-gui/releases/`` — never anywhere else. We assert this
  before doing the repoint.

systemctl privilege: the unprivileged ``proxmox-gui`` user cannot
``systemctl restart`` system units without explicit polkit/sudo. ``bootstrap.sh``
lays down a SCOPED sudoers entry permitting the verb+unit combination
exactly. We invoke ``sudo -n systemctl restart <unit>`` here; the ``-n``
forbids password prompting so a sudoers misconfiguration fails fast rather
than hanging.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from app.jobs.service import finish_job, get_job, update_job
# Note: import the selfupdate.service MODULE (not its symbols) so tests can
# monkeypatch fetch_release_manifest / download_tarball without having to
# also patch this module's namespace. Each call below goes through the
# module-attribute lookup at call time.
from app.selfupdate import service as selfupdate_service
from app.selfupdate.service import snapshot_db, verify_sha256

logger = logging.getLogger(__name__)

# Layout — must match deploy/lxc/bootstrap.sh + deploy/lxc/update.sh.
APP_HOME = "/opt/proxmox-gui"
RELEASES_DIR = f"{APP_HOME}/releases"
CURRENT_LINK = f"{APP_HOME}/current"
DATA_DIR = "/var/lib/proxmox-gui"
APP_DB = f"{DATA_DIR}/app.db"
PRE_UPDATE_DB = f"{DATA_DIR}/app.db.pre-update"
STAGING_DIR = f"{DATA_DIR}/staging"
UPDATE_SH = "deploy/lxc/update.sh"

# Health-check loop — total budget ~60s with 2s polls.
HEALTH_CHECK_URL = "http://127.0.0.1:8000/api/v1/health"
HEALTH_CHECK_ATTEMPTS = 30
HEALTH_CHECK_INTERVAL_S = 2.0

# Restartable units (Threat T-05-04-05 — scoped sudoers permits exactly these).
UNIT_API = "proxmox-gui-api.service"
UNIT_FRONTEND = "proxmox-gui-frontend.service"
UNIT_WORKER = "proxmox-gui-worker.service"


# ---------------------------------------------------------------------------
# Pure helpers (testable without a real PVE / systemd / network)
# ---------------------------------------------------------------------------


async def _systemctl_restart(unit: str) -> tuple[int, str]:
    """``sudo -n systemctl restart <unit>``. Returns (rc, stderr-tail).

    ``-n`` forbids password prompting — a sudoers misconfiguration fails
    immediately rather than hanging on stdin.
    """
    proc = await asyncio.create_subprocess_exec(
        "sudo", "-n", "systemctl", "restart", unit,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _stdout, stderr = await proc.communicate()
    return proc.returncode or 0, stderr.decode("utf-8", "replace")


async def _wait_for_health() -> bool:
    """Poll ``/api/v1/health`` up to HEALTH_CHECK_ATTEMPTS × interval.

    Returns True on a 200; False if the budget elapses. The worker is on
    127.0.0.1; the API listens on 127.0.0.1:8000 (see proxmox-gui-api.service).
    """
    import urllib.request

    def _probe_once() -> bool:
        try:
            with urllib.request.urlopen(  # noqa: S310 — localhost only
                HEALTH_CHECK_URL, timeout=2
            ) as resp:
                return resp.status == 200
        except Exception:  # noqa: BLE001 — any error = not healthy yet
            return False

    for _ in range(HEALTH_CHECK_ATTEMPTS):
        if await asyncio.to_thread(_probe_once):
            return True
        await asyncio.sleep(HEALTH_CHECK_INTERVAL_S)
    return False


def _current_release_target() -> str | None:
    """``readlink /opt/proxmox-gui/current`` — the active release dir."""
    try:
        return os.readlink(CURRENT_LINK)
    except OSError:
        return None


def _assert_inside_releases(path: str) -> None:
    """Pitfall 7 / Threat T-05-04-03 invariant — every swap target is under
    /opt/proxmox-gui/releases/. Never /etc, never /var/lib, never anywhere
    else. A traversal-laced manifest cannot trick us into pointing ``current``
    at the master-key directory.
    """
    real = os.path.realpath(path)
    releases_real = os.path.realpath(RELEASES_DIR)
    if not real.startswith(releases_real + os.sep) and real != releases_real:
        raise RuntimeError(
            f"refusing to repoint current: {real!r} is outside {releases_real!r}"
        )


def _repoint_current(target: str) -> None:
    """``ln -sfn target /opt/proxmox-gui/current`` — atomic rename(2)."""
    _assert_inside_releases(target)
    # Use a sibling tempfile + rename so the swap is atomic (no window where
    # `current` is missing). The `ln -sfn` CLI does the same dance.
    tmp = f"{CURRENT_LINK}.new"
    if os.path.lexists(tmp):
        os.remove(tmp)
    os.symlink(target, tmp)
    os.replace(tmp, CURRENT_LINK)


def _restore_db_snapshot() -> None:
    """Step 8 rollback — copy the pre-update snapshot back over app.db.

    The snapshot was taken with the sqlite3 online-backup API (WAL-safe), so
    restoring it is a plain ``shutil.copy``: the snapshot file is a complete,
    self-contained DB (no WAL sidecar to worry about). After restore, also
    remove any lingering ``-wal`` / ``-shm`` companion files so the API
    starts fresh against the restored main file.
    """
    if not Path(PRE_UPDATE_DB).exists():
        raise RuntimeError(
            f"cannot restore: snapshot {PRE_UPDATE_DB} is missing"
        )
    shutil.copy(PRE_UPDATE_DB, APP_DB)
    for suffix in ("-wal", "-shm"):
        sidecar = Path(f"{APP_DB}{suffix}")
        if sidecar.exists():
            sidecar.unlink()


# ---------------------------------------------------------------------------
# The orchestration entry point
# ---------------------------------------------------------------------------


async def run_self_update(ctx: dict, job_id: int) -> None:
    """Self-update orchestration entry point (DEPLOY-04, plan 05-04).

    Runs in the WORKER process. Replaces the 05-01 NotImplementedError stub.

    See module docstring for the verbatim 8-step sequence.
    """
    sessionmaker = ctx["sessionmaker"]

    # ---- Step 1-2: fetch + verify ----------------------------------------
    async with sessionmaker() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("run_self_update: job %s not found", job_id)
            return
        if job.state in {"succeeded", "failed", "needs_review"}:
            return
        await update_job(
            db, job_id, state="claimed", started_at=datetime.now(UTC)
        )
        await db.commit()
        job = await get_job(db, job_id)

    if job is None:
        return

    payload = json.loads(job.payload) if job.payload else {}
    target_version = payload.get("target_version")

    previous_release_target = _current_release_target()
    pre_update_snapshot_taken = False

    try:
        logger.info(
            "self-update: fetching manifest for version=%s", target_version
        )
        manifest = await selfupdate_service.fetch_release_manifest(target_version)
        version = manifest.get("version") or target_version or "unknown"
        tarball_url = manifest["tarball_url"]
        expected_sha256 = manifest["sha256"]

        # Download into the staging dir (created if missing).
        os.makedirs(STAGING_DIR, exist_ok=True)
        tarball_path = os.path.join(STAGING_DIR, f"{version}.tar.gz")
        logger.info("self-update: downloading %s", tarball_url)
        await selfupdate_service.download_tarball(tarball_url, tarball_path)

        logger.info("self-update: verifying SHA-256")
        if not verify_sha256(tarball_path, expected_sha256):
            # Threat T-05-04-01 — tampered tarball or wrong manifest. Abort
            # BEFORE any unpack / DB snapshot / symlink swap.
            raise RuntimeError(
                f"release tarball SHA-256 manifest mismatch for {version}"
            )

        # ---- Step 3: WAL-safe DB snapshot --------------------------------
        if Path(APP_DB).exists():
            logger.info("self-update: snapshotting %s → %s", APP_DB, PRE_UPDATE_DB)
            snapshot_db(APP_DB, PRE_UPDATE_DB)
            pre_update_snapshot_taken = True

        # ---- Step 4-6: invoke deploy/lxc/update.sh -----------------------
        # update.sh handles unpack + per-release venv + pip install +
        # alembic upgrade head + atomic `ln -sfn` symlink swap + systemd unit
        # refresh + restart of api + frontend. It expects RELEASE_TAG and
        # RELEASE_TARBALL in the env.
        #
        # Locate update.sh: prefer the version inside the just-downloaded
        # tarball (the new code) so a worker job that runs while the on-disk
        # tree is mid-swap still finds a valid update.sh.
        update_sh_path = await _locate_update_sh(tarball_path)

        env = {**os.environ, "RELEASE_TAG": version, "RELEASE_TARBALL": tarball_path}
        logger.info("self-update: invoking %s", update_sh_path)
        proc = await asyncio.create_subprocess_exec(
            "bash", update_sh_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                f"update.sh failed rc={proc.returncode}: "
                f"{stderr.decode('utf-8', 'replace')[-500:]}"
            )
        logger.info("self-update: update.sh succeeded for %s", version)

        # update.sh has already restarted the api + frontend units. We are
        # the worker — still on the old release until step 7.

        # ---- Step 6: health check ----------------------------------------
        logger.info("self-update: polling /api/v1/health up to ~60s")
        healthy = await _wait_for_health()

        if not healthy:
            # ---- Step 8: rollback ----------------------------------------
            raise RuntimeError("post-update health check failed")

        # ---- Step 7: success — restart worker LAST -----------------------
        logger.info("self-update: healthy; marking job succeeded")
        async with sessionmaker() as db:
            await finish_job(db, job_id, state="succeeded")
            await db.commit()

        logger.info("self-update: restarting worker (we are now stale)")
        rc, err = await _systemctl_restart(UNIT_WORKER)
        if rc != 0:
            # Not fatal — the next systemd cycle will get us — but log it.
            logger.warning(
                "self-update: worker restart returned rc=%s err=%s", rc, err
            )
        # The next line may never execute (the worker is being restarted),
        # which is fine — the job row is already terminal.
        return

    except Exception as exc:  # noqa: BLE001 — every failure routes through rollback
        logger.error("self-update: failed: %s", exc, exc_info=True)
        await _rollback(
            job_id, sessionmaker,
            error=str(exc),
            previous_release_target=previous_release_target,
            pre_update_snapshot_taken=pre_update_snapshot_taken,
        )


async def _locate_update_sh(tarball_path: str) -> str:
    """Extract just deploy/lxc/update.sh from the verified tarball so we run
    THE NEW VERSION of the update routine — not a stale on-disk copy."""
    tmp = tempfile.mkdtemp(prefix="proxmox-gui-update-", dir=STAGING_DIR)
    proc = await asyncio.create_subprocess_exec(
        "tar", "-xzf", tarball_path, "-C", tmp, "--strip-components=1",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"failed to extract tarball: {stderr.decode('utf-8', 'replace')[-200:]}"
        )
    update_sh = os.path.join(tmp, UPDATE_SH)
    if not os.path.exists(update_sh):
        # Fall back to the on-disk copy (the currently-installed release).
        update_sh = os.path.join(CURRENT_LINK, UPDATE_SH)
    if not os.path.exists(update_sh):
        raise RuntimeError(
            f"update.sh not found in tarball or at {CURRENT_LINK}/{UPDATE_SH}"
        )
    return update_sh


async def _rollback(
    job_id: int,
    sessionmaker,
    *,
    error: str,
    previous_release_target: str | None,
    pre_update_snapshot_taken: bool,
) -> None:
    """D-11 auto-rollback — restore DB + repoint symlink + restart api.

    Best-effort: every step is wrapped in try/except so a downstream failure
    cannot mask the original cause. The job row is ALWAYS marked failed at
    the end with the rollback-step error appended.
    """
    rollback_log: list[str] = []

    # Step 8a: restore the DB snapshot if we took one.
    if pre_update_snapshot_taken:
        try:
            _restore_db_snapshot()
            rollback_log.append("db: restored from app.db.pre-update")
        except Exception as exc:  # noqa: BLE001
            rollback_log.append(f"db restore failed: {exc}")

    # Step 8b: repoint the symlink back to the prior release dir if we have one.
    if previous_release_target:
        try:
            _repoint_current(previous_release_target)
            rollback_log.append(f"symlink: repointed to {previous_release_target}")
        except Exception as exc:  # noqa: BLE001
            rollback_log.append(f"symlink revert failed: {exc}")

    # Step 8c: restart the api so it picks up the restored DB + previous code.
    try:
        rc, err = await _systemctl_restart(UNIT_API)
        if rc != 0:
            rollback_log.append(f"api restart rc={rc}: {err.strip()[-200:]}")
        else:
            rollback_log.append("api: restarted on rolled-back release")
    except Exception as exc:  # noqa: BLE001
        rollback_log.append(f"api restart raised: {exc}")

    # Step 8d: also restart the frontend so it serves the rolled-back assets.
    try:
        rc, err = await _systemctl_restart(UNIT_FRONTEND)
        if rc != 0:
            rollback_log.append(f"frontend restart rc={rc}: {err.strip()[-200:]}")
    except Exception as exc:  # noqa: BLE001
        rollback_log.append(f"frontend restart raised: {exc}")

    # Mark the job failed (or needs_review if rollback itself partially failed).
    combined = "; ".join(rollback_log) or "no rollback steps taken"
    async with sessionmaker() as db:
        await finish_job(
            db,
            job_id,
            state="failed",
            error=error,
            friendly=(
                "Self-update failed and was rolled back. "
                f"Rollback: {combined}"
            ),
        )
        await db.commit()
    logger.error(
        "self-update: rollback complete for job %s — %s", job_id, combined
    )
