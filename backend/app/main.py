"""FastAPI application factory + lifespan.

Plan 01 owns this module. Subsequent plans add routers (auth in Plan 05,
clusters in Plan 06, users/setup in Plan 07) via :func:`create_app`.

Lifespan responsibilities (in order):

1. Load the master key from ``settings.master_key_path`` if the file exists,
   else generate an ephemeral key with a ``UserWarning`` (dev mode).
2. ``install_cipher(cipher)`` — make the cipher available to
   :class:`~app.models._types.EncryptedSecret` before any DB session opens.
3. ``await run_migrations()`` — bring the schema to head (no-op until Plan 02
   lands ``alembic.ini``).
4. Yield (the app serves requests).
5. ``await engine.dispose()`` — drain the connection pool on shutdown.

The only route shipped in Plan 01 is ``/api/v1/health`` — an unauthenticated
liveness probe.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import warnings
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable
from app.clusters.registry import PVEConnectorRegistry
from app.config import settings
from app.core.cipher import SecretCipher
from app.core.db import engine, run_migrations
from app.models._types_init import install_cipher
from app.teams.bootstrap import BootstrapFailed

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Boot + teardown sequence — see module docstring."""
    # 1. Load (or fabricate) the master key.
    if settings.master_key_path.exists():
        cipher = SecretCipher.from_file(settings.master_key_path)
    else:
        warnings.warn(
            f"{settings.master_key_path} not found; using ephemeral master key "
            "(DEV/TEST ONLY — restarts will make any encrypted data unreadable).",
            stacklevel=2,
        )
        cipher = SecretCipher(secrets.token_bytes(32))

    # 2. Install before any DB session that touches EncryptedSecret columns.
    install_cipher(cipher)
    app.state.cipher = cipher

    # 3. Bring DB to head (no-op until Plan 02 lands alembic.ini).
    await run_migrations()

    # 4. Plan 06: per-cluster connector registry, lazy + invalidated on
    #    cluster edit/delete. Built lazily, lives on app.state.
    app.state.registry = PVEConnectorRegistry(
        cipher,
        async_sessionmaker(engine, expire_on_commit=False),
    )

    # 5. Plan 02-01: spawn one background /version probe per registered cluster
    #    so the UI's ClusterStatusPill reflects live reachability (CLUST-03).
    #    Best-effort: a single bad cluster row must not block app startup.
    try:
        from sqlalchemy import select

        from app.models import Cluster
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            result = await session.execute(select(Cluster.id))
            cluster_ids = [row[0] for row in result.all()]
            for cid in cluster_ids:
                try:
                    await app.state.registry.start_probe(cid, db=session, interval=15.0)
                except Exception as exc:  # noqa: BLE001
                    warnings.warn(
                        f"health probe failed to start for cluster {cid}: {exc}",
                        stacklevel=2,
                    )
    except Exception as exc:  # noqa: BLE001
        warnings.warn(
            f"cluster probe bootstrap skipped: {exc}",
            stacklevel=2,
        )

    # 6. Plan 03-01: arq Redis pool for the 202-enqueue contract + the
    #    Tasks-drawer pub/sub fan-out. The arq WORKER is a separate process
    #    (proxmox-gui-worker.service); the API process only needs a pool to
    #    enqueue jobs and to subscribe to the jobs:events channel.
    #    Best-effort: if Redis is unreachable the API still serves (the
    #    lifecycle routes Plan 02 adds will surface a clear 503).
    app.state.arq_pool = None
    app.state.jobs_event_pump_task = None
    try:
        from arq import create_pool
        from arq.connections import RedisSettings

        from app.jobs.events import jobs_event_pump

        app.state.arq_pool = await create_pool(
            RedisSettings(host="127.0.0.1", port=6379, database=0)
        )
        app.state.jobs_event_pump_task = asyncio.create_task(
            jobs_event_pump(app), name="jobs-event-pump"
        )
    except Exception as exc:  # noqa: BLE001 — Redis down must not block boot.
        warnings.warn(
            f"arq Redis pool unavailable; job queue disabled: {exc}",
            stacklevel=2,
        )

    # 7. Serve.
    try:
        yield
    finally:
        # 8. Cancel the jobs-event pump.
        pump_task = getattr(app.state, "jobs_event_pump_task", None)
        if pump_task is not None:
            pump_task.cancel()
            try:
                await pump_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        # 9. Close the arq Redis pool.
        arq_pool = getattr(app.state, "arq_pool", None)
        if arq_pool is not None:
            try:
                await arq_pool.aclose()
            except Exception:  # noqa: BLE001
                pass
        # 10. Stop all health probes before draining pool.
        try:
            await app.state.registry.stop_all_probes()
        except Exception:  # noqa: BLE001
            pass
        # 11. Drain pool.
        await engine.dispose()


def create_app() -> FastAPI:
    """Build a fresh FastAPI app. Tests use a per-test instance via the fixture."""
    app = FastAPI(
        title="Proxmox Self-Service GUI",
        version="0.1.0",
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    # TODO(Plan 06+): TrustedHostMiddleware once we know the deployed hostname
    # (Caddy upstream-only). Not active in dev.

    @app.get("/api/v1/health", tags=["health"], summary="Liveness probe")
    async def health() -> dict[str, str]:
        """Unauthenticated. Returns 200 if the process is up."""
        return {"status": "ok", "version": "0.1.0"}

    # Plan 06: PVE exception handlers — translate connector exceptions into
    # uniform HTTP responses. Service layer typically catches these locally
    # (e.g. test_cluster), but a stray bubble-up still gets a clean shape.
    @app.exception_handler(PVEUnreachable)
    async def _pve_unreachable_handler(_: Request, exc: PVEUnreachable) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"detail": "Couldn't reach that Proxmox URL."},
        )

    @app.exception_handler(PVEAuthError)
    async def _pve_auth_handler(_: Request, exc: PVEAuthError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Proxmox rejected that token."},
        )

    @app.exception_handler(PVEAPIError)
    async def _pve_api_handler(_: Request, exc: PVEAPIError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"detail": "Proxmox returned an unexpected error."},
        )

    @app.exception_handler(BootstrapFailed)
    async def _bootstrap_failed_handler(
        _: Request, exc: BootstrapFailed,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": (
                    f"Tenant bootstrap failed on cluster "
                    f"{exc.cluster_name!r}: {exc.original}"
                ),
            },
        )

    # Plan 01-05: auth + me + ssh-keys + tokens routers. Imports kept local to
    # the factory so test runs that don't need them aren't import-cycle penalised.
    from app.audit.routes import router as audit_router
    from app.auth.routes import router as auth_router
    from app.clusters.routes import router as clusters_router
    from app.inventory.routes import router as inventory_router
    from app.jobs.routes import router as jobs_router
    from app.jobs.ws import router as jobs_ws_router
    from app.lifecycle.backup_routes import router as backup_router
    from app.lifecycle.clone_migrate_routes import router as clone_migrate_router
    from app.lifecycle.resize_routes import router as resize_router
    from app.lifecycle.routes import router as lifecycle_router
    from app.lifecycle.snapshot_routes import router as snapshot_router
    from app.me.routes import router as me_router
    from app.pats.routes import router as pats_router
    from app.provisioning.routes import router as provisioning_router
    from app.quotas.routes import router as quotas_router
    from app.setup.routes import router as setup_router
    from app.ssh_keys.routes import router as ssh_keys_router
    from app.teams.routes import router as teams_router
    from app.users.routes import router as users_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(me_router, prefix="/api/v1/me", tags=["me"])
    app.include_router(
        ssh_keys_router, prefix="/api/v1/me/ssh-keys", tags=["ssh-keys"]
    )
    app.include_router(pats_router, prefix="/api/v1/me/tokens", tags=["tokens"])
    # Plan 06: cluster admin routes.
    app.include_router(
        clusters_router, prefix="/api/v1/clusters", tags=["clusters"]
    )
    # Plan 06: team admin routes.
    app.include_router(
        teams_router, prefix="/api/v1/teams", tags=["teams"]
    )
    # Plan 07: first-run setup wizard (open endpoints; no auth).
    app.include_router(
        setup_router, prefix="/api/v1/setup", tags=["setup"]
    )
    # Plan 07: admin user CRUD routes.
    app.include_router(
        users_router, prefix="/api/v1/users", tags=["users"]
    )
    # Plan 02-02: audit log read routes (AUDIT-03, AUDIT-04, AUDIT-05).
    app.include_router(audit_router, prefix="/api/v1/audit", tags=["audit"])
    # Plan 02-03: inventory read + tag/notes write routes (INV-01..08, TENT-06, API-05).
    app.include_router(inventory_router, prefix="/api/v1", tags=["inventory"])
    # Plan 02-04: quota CRUD + /me/quotas + admission preview (TENT-01..05 + API-05).
    app.include_router(quotas_router, prefix="/api/v1", tags=["quotas"])
    # Plan 03-02: power lifecycle routes — Start/Stop/Reboot/Shutdown/Delete +
    # bulk power, all returning 202 (LIFE-01..03, API-04).
    app.include_router(lifecycle_router, prefix="/api/v1", tags=["lifecycle"])
    # Plan 03-03: snapshot lifecycle routes — list (flat parent-pointer tree)
    # + create/rollback/delete, all mutations returning 202 (LIFE-04).
    app.include_router(snapshot_router, prefix="/api/v1", tags=["lifecycle"])
    # Plan 03-03: resize routes — resize-info (hotplug flags) + 202 resize
    # (CPU/RAM sync write, online disk grow, shrink rejected) (LIFE-08, LIFE-09).
    app.include_router(resize_router, prefix="/api/v1", tags=["lifecycle"])
    # Plan 03-04: backup routes — manual backup, file list, restore (in-place /
    # as-new), backup-schedule CRUD, global /backups page (LIFE-05..07).
    app.include_router(backup_router, prefix="/api/v1", tags=["lifecycle"])
    # Plan 03-04: clone / template-convert / migrate routes — all 202, with
    # VMID reservation + quota admission + migrate pre-flights (LIFE-10, LIFE-11).
    app.include_router(clone_migrate_router, prefix="/api/v1", tags=["lifecycle"])
    # Plan 04-04: provisioning create routes — LXC + VM create (LXC-05..07,
    # VM-01..04), all 202 returning the reserved VMID (D-04).
    app.include_router(provisioning_router, prefix="/api/v1", tags=["provisioning"])
    # Plan 03-02: jobs API (list/get/retry) + the Tasks-drawer WebSocket
    # (/api/v1/jobs, /api/v1/ws/jobs).
    app.include_router(jobs_router, prefix="/api/v1", tags=["jobs"])
    app.include_router(jobs_ws_router, prefix="/api/v1", tags=["jobs"])

    return app


#: Module-level app instance — uvicorn entry point: ``uvicorn app.main:app``.
app = create_app()
