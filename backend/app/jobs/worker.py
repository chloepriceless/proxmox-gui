"""arq worker — ``WorkerSettings`` + ``on_startup``/``on_shutdown`` hooks.

The worker is a SEPARATE process from the API (D-17):
``deploy/systemd/proxmox-gui-worker.service`` runs
``arq app.jobs.worker.WorkerSettings``. This module is never imported by
``app.main``.

``on_startup`` opens the app DB engine, installs the cipher (the worker
process needs it to decrypt cluster tokens — same as the API process), builds
a ``PVEConnectorRegistry``, stores everything on ``ctx``, and runs the orphan
reaper (LIFE-14 — on every boot, no exceptions).

``max_tries=1`` on every job function disables arq's own retry: Phase-3 retry
is USER-driven (D-16) — a fresh job is enqueued; arq must not silently re-run a
non-idempotent op like ``clone`` (Pitfall 12).

NOTE: Plans 02/03/04 register the real ``vm.*`` job functions in ``functions``
and the scheduled-backup cron in ``cron_jobs``.
"""

from __future__ import annotations

import logging

from arq import func
from arq.connections import RedisSettings

from app.jobs.functions import noop_job, run_power_action
from app.jobs.reaper import reap_orphans
from app.jobs.snapshot_functions import (
    run_snapshot_create,
    run_snapshot_delete,
    run_snapshot_rollback,
)

logger = logging.getLogger(__name__)


async def on_startup(ctx: dict) -> None:
    """Open the DB engine, install the cipher, build the registry, reap.

    ``ctx`` already carries ``ctx['redis']`` (the arq pool). We add:
    - ``engine`` — the async SQLAlchemy engine.
    - ``sessionmaker`` — an ``async_sessionmaker`` bound to it.
    - ``registry`` — the ``PVEConnectorRegistry`` (per-team connectors).
    - ``arq_pool`` — alias of ``ctx['redis']`` so reaper/poller code reads a
      stable key.
    """
    import secrets
    import warnings

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.clusters.registry import PVEConnectorRegistry
    from app.config import settings
    from app.core.cipher import SecretCipher
    from app.core.db import engine
    from app.models._types_init import install_cipher

    # The worker process decrypts cluster tokens, so it needs the same cipher
    # the API process installs in its lifespan (see app/main.py).
    if settings.master_key_path.exists():
        cipher = SecretCipher.from_file(settings.master_key_path)
    else:
        warnings.warn(
            f"{settings.master_key_path} not found; worker using an ephemeral "
            "master key (DEV/TEST ONLY — encrypted data will be unreadable).",
            stacklevel=2,
        )
        cipher = SecretCipher(secrets.token_bytes(32))
    install_cipher(cipher)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    registry = PVEConnectorRegistry(cipher, sessionmaker)

    ctx["engine"] = engine
    ctx["sessionmaker"] = sessionmaker
    ctx["registry"] = registry
    # The reaper/poller read ctx['arq_pool']; arq stores its pool at ctx['redis'].
    ctx["arq_pool"] = ctx.get("redis")

    # LIFE-14: reconcile orphaned jobs on every boot, no exceptions.
    try:
        await reap_orphans(ctx)
    except Exception as exc:  # noqa: BLE001 — a reaper failure must not stop
        # the worker from coming up and accepting new jobs.
        logger.error("orphan reaper failed on startup: %s", exc)


async def on_shutdown(ctx: dict) -> None:
    """Drain the DB connection pool on worker shutdown."""
    engine = ctx.get("engine")
    if engine is not None:
        await engine.dispose()


class WorkerSettings:
    """arq worker configuration — the ``arq`` CLI reads these attributes.

    Plan 03-01 registered the internal ``noop`` placeholder. Plan 03-02 adds
    the first real job functions: ``vm.power`` and ``vm.delete`` both route
    through ``run_power_action``. Plans 03/04 add the remaining ``vm.*`` kinds.

    ``max_tries=1`` on every entry disables arq's own retry — Phase-3 retry is
    user-driven (D-16); arq must never silently re-run a power/delete op.
    """

    functions = [
        # max_tries=1 — arq must NOT auto-retry (D-16; user-driven retry).
        func(noop_job, name='internal.noop', max_tries=1, timeout=30),
        func(run_power_action, name='vm.power', max_tries=1, timeout=120),
        func(run_power_action, name='vm.delete', max_tries=1, timeout=120),
        # Plan 03-03: snapshot lifecycle (timeouts per RESEARCH §Pattern 1).
        func(run_snapshot_create, name='vm.snapshot.create', max_tries=1, timeout=600),
        func(run_snapshot_rollback, name='vm.snapshot.rollback', max_tries=1, timeout=900),
        func(run_snapshot_delete, name='vm.snapshot.delete', max_tries=1, timeout=300),
    ]
    cron_jobs: list = []  # Plan 04 adds the scheduled-backup cron.
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = RedisSettings(host="127.0.0.1", port=6379, database=0)
    max_jobs = 6
    job_timeout = 14400  # 4h ceiling; per-func timeouts override.
    keep_result = 3600  # arq's own result-key TTL (DB row is the truth).
    health_check_interval = 30
