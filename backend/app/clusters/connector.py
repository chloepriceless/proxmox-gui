"""Per-cluster Proxmox API client (Pattern 7 in 01-RESEARCH.md).

Wraps the synchronous ``proxmoxer.ProxmoxAPI`` with ``asyncio.to_thread`` so
the event loop is never blocked on PVE I/O (Pitfall A3 — non-negotiable).

Phase 1 scope (Plan 06): ``version`` / ``validate`` + the six tenant-bootstrap
calls (``create_pool``, ``delete_pool``, ``create_user``, ``delete_user``,
``create_token``, ``set_pool_acl``). Phase 2/3 will add the read/write API
and a circuit breaker on top of this primitive.

D-03: the bootstrap token (``token_user`` + ``token_name`` + ``token_value``)
is Administrator-level. Per-tenant privilege-separated tokens minted into
``team_cluster_tokens`` use a DIFFERENT connector path that Phase 2 will
introduce; this Phase-1 class is bootstrap-only.

Authorization format: ``Authorization: PVEAPIToken=USER@REALM!TOKENID=UUID``
— proxmoxer builds this automatically from ``user=``, ``token_name=``,
``token_value=``.
"""

from __future__ import annotations

import asyncio
from typing import Any

import requests
from proxmoxer import AuthenticationError, ProxmoxAPI, ResourceException

from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable


class PVEConnector:
    """Per-cluster Proxmox API client wrapper.

    Use the registry (:class:`app.clusters.registry.PVEConnectorRegistry`)
    to acquire connectors keyed by cluster_id in production code. Direct
    instantiation is fine for one-shot validation flows (the dry-run
    ``POST /api/v1/clusters/test`` builds a transient connector).
    """

    def __init__(
        self,
        *,
        host: str,
        port: int,
        token_user: str,
        token_name: str,
        token_value: str,
        verify_ssl: bool,
        tls_fingerprint: str | None = None,
    ) -> None:
        # Phase 1 limitation: per-cluster TLS fingerprint pinning is deferred
        # to Phase 5 polish. Refuse the combination explicitly so operators
        # don't believe pinning is active when it isn't.
        if tls_fingerprint and not verify_ssl:
            raise NotImplementedError(
                "Per-cluster TLS fingerprint pinning is Phase 5 polish; in "
                "Phase 1 use verify_ssl=True with a trusted CA or accept "
                "verify_ssl=False without fingerprint."
            )
        self._client = ProxmoxAPI(
            host,
            port=port,
            user=token_user,
            token_name=token_name,
            token_value=token_value,
            verify_ssl=verify_ssl,
            timeout=10,
        )

    # ------------------------------------------------------------------
    # Private executor bridge
    # ------------------------------------------------------------------

    async def _call(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
        """proxmoxer 2.3 has no async backend; bridge through the executor.

        Pitfall A3: every PVE call MUST go through this helper. The CI grep
        ``grep -q 'asyncio.to_thread' backend/app/clusters/connector.py``
        documents this in the acceptance criteria.
        """
        return await asyncio.to_thread(fn, *args, **kwargs)

    # ------------------------------------------------------------------
    # Read calls
    # ------------------------------------------------------------------

    async def version(self) -> dict:
        """``GET /version`` — returns ``{"version": ..., "release": ..., "repoid": ...}``."""
        try:
            return await self._call(self._client.version.get)
        except AuthenticationError as exc:
            raise PVEAuthError(str(exc)) from exc
        except (ConnectionError, requests.ConnectionError) as exc:
            raise PVEUnreachable(str(exc)) from exc
        except ResourceException as exc:
            raise PVEAPIError(
                getattr(exc, "status_code", 0),
                getattr(exc, "content", "") or str(exc),
            ) from exc

    async def validate(self) -> None:
        """Raises if the token can't reach ``/version``.

        Translates proxmoxer exceptions to the local hierarchy so callers can
        rely on a uniform error surface.
        """
        # version() already does the exception translation.
        await self.version()

    # ------------------------------------------------------------------
    # Pool lifecycle (tenant bootstrap)
    # ------------------------------------------------------------------

    async def create_pool(self, poolid: str, comment: str = "") -> None:
        """``POST /pools`` — create a new resource pool."""
        await self._call(self._client.pools.post, poolid=poolid, comment=comment)

    async def delete_pool(self, poolid: str) -> None:
        """``DELETE /pools/{poolid}`` — best-effort cleanup helper."""
        await self._call(self._client.pools(poolid).delete)

    # ------------------------------------------------------------------
    # User + token lifecycle (per-tenant privsep)
    # ------------------------------------------------------------------

    async def create_user(self, userid: str, comment: str = "") -> None:
        """``POST /access/users`` — create a PVE user (usually ``...@pve``)."""
        await self._call(self._client.access.users.post, userid=userid, comment=comment)

    async def delete_user(self, userid: str) -> None:
        """``DELETE /access/users/{userid}`` — best-effort cleanup helper."""
        await self._call(self._client.access.users(userid).delete)

    async def create_token(
        self, userid: str, tokenid: str, *, privsep: bool = True,
    ) -> dict:
        """``POST /access/users/{userid}/token/{tokenid}``.

        Returns the full payload — most importantly ``{"value": "<secret>"}``
        which the caller must persist Fernet-encrypted into
        ``team_cluster_tokens.token_secret``.

        D-01: ``privsep=True`` is the entire point of the per-tenant model —
        the token's permissions are NOT the user's, only what the pool ACL
        grants.
        """
        return await self._call(
            self._client.access.users(userid).token(tokenid).post,
            privsep=int(privsep),
        )

    async def set_pool_acl(
        self, poolid: str, *, userid: str, role: str,
    ) -> None:
        """``PUT /access/acl`` — grant ``role`` on ``/pool/{poolid}`` to ``userid``.

        Phase 1 always uses role ``PVEVMUser`` (D-02 + D-06).
        """
        await self._call(
            self._client.access.acl.put,
            path=f"/pool/{poolid}",
            users=userid,
            roles=role,
            propagate=1,
        )
