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

    # 5. Serve.
    try:
        yield
    finally:
        # 6. Drain pool.
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
    from app.auth.routes import router as auth_router
    from app.clusters.routes import router as clusters_router
    from app.me.routes import router as me_router
    from app.pats.routes import router as pats_router
    from app.setup.routes import router as setup_router
    from app.ssh_keys.routes import router as ssh_keys_router
    from app.teams.routes import router as teams_router

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

    return app


#: Module-level app instance — uvicorn entry point: ``uvicorn app.main:app``.
app = create_app()
