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

Phase 2 additions (Plan 02-01):
- ``ResourceCache`` dataclass with 30s TTL and asyncio.Lock for thundering-herd
  protection.
- ``pybreaker.CircuitBreaker`` per connector (3 failures → open, 30s reset).
  Auth errors are EXCLUDED from the breaker (config issue, not transient).
- ``_call_with_breaker`` helper mirrors ``_call`` but routes through the breaker;
  translates ``pybreaker.CircuitBreakerError`` → ``PVEUnreachable``.
- Six new read/write methods: ``list_resources``, ``get_vm_status``,
  ``get_vm_config``, ``set_vm_config``, ``rrddata``, ``pool_members``.
- Status attributes: ``last_seen_healthy``, ``last_error``, ``status``.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import pybreaker
import requests
from proxmoxer import AuthenticationError, ProxmoxAPI, ResourceException

from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable


@dataclass
class ResourceCache:
    """Per-connector 30s in-memory cache for ``/cluster/resources``.

    The ``lock`` serialises refresh so concurrent callers don't produce a
    thundering herd of PVE calls on cache miss (T-02-01-07).
    """

    snapshot: list[dict] | None = None
    fetched_at: float = 0.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    ttl: float = 30.0

    @property
    def is_fresh(self) -> bool:
        return self.snapshot is not None and (time.monotonic() - self.fetched_at) < self.ttl

    @property
    def is_stale(self) -> bool:
        return self.snapshot is not None and not self.is_fresh


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

        # Phase 2: circuit breaker (T-02-01-05). Auth errors do NOT trip the
        # breaker — they indicate a config problem, not transient reachability.
        # breaker open is mapped onto PVEUnreachable; see _call_with_breaker.
        # We exclude BOTH PVEAuthError (our wrapper) AND proxmoxer.AuthenticationError
        # (the raw exception raised inside asyncio.to_thread before translation)
        # because pybreaker evaluates the exclude list against the exception raised
        # *inside* the wrapped function — at that point it's still an AuthenticationError.
        self._breaker = pybreaker.CircuitBreaker(
            fail_max=3,
            reset_timeout=30,
            exclude=[PVEAuthError, AuthenticationError],
            name=f"pve-{host}",
        )
        self._resource_cache = ResourceCache()

        # Phase 2: health probe attributes (updated by health_probe_loop).
        self.last_seen_healthy: float | None = None
        self.last_error: str | None = None
        self.status: str = "untested"  # 'ok' | 'failed' | 'untested'

    # ------------------------------------------------------------------
    # Private executor bridges
    # ------------------------------------------------------------------

    async def _call(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
        """proxmoxer 2.3 has no async backend; bridge through the executor.

        Pitfall A3: every PVE call MUST go through this helper. The CI grep
        ``grep -q 'asyncio.to_thread' backend/app/clusters/connector.py``
        documents this in the acceptance criteria.

        Used for Phase-1 bootstrap calls that run outside the circuit breaker
        (one-time admin ops with their own exception handling at the call site).
        """
        return await asyncio.to_thread(fn, *args, **kwargs)

    async def _call_with_breaker(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
        """Wrap a sync proxmoxer call with the circuit breaker + asyncio.to_thread.

        pybreaker.call is SYNC: it raises CircuitBreakerError when open. We map
        that onto PVEUnreachable so callers only need the existing exception
        surface. PVEAuthError is excluded from the breaker (auth = config, not
        transient).
        """
        def _invoke() -> Any:
            return self._breaker.call(fn, *args, **kwargs)

        try:
            return await asyncio.to_thread(_invoke)
        except pybreaker.CircuitBreakerError as exc:
            raise PVEUnreachable("breaker open") from exc
        except AuthenticationError as exc:
            raise PVEAuthError(str(exc)) from exc
        except (ConnectionError, requests.ConnectionError) as exc:
            raise PVEUnreachable(str(exc)) from exc
        except ResourceException as exc:
            raise PVEAPIError(
                getattr(exc, "status_code", 0),
                getattr(exc, "content", "") or str(exc),
            ) from exc

    # ------------------------------------------------------------------
    # Read calls (Phase 1)
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
    # Read calls (Phase 2) — go through _call_with_breaker
    # ------------------------------------------------------------------

    async def list_resources(
        self, *, force_refresh: bool = False
    ) -> tuple[list[dict], bool]:
        """GET /cluster/resources?type=vm + type=lxc — merged, with 30s TTL cache.

        Returns (snapshot, is_stale). On breaker-open + stale cache present:
        returns (snapshot, True). On breaker-open + NO cache: raises PVEUnreachable.
        """
        cache = self._resource_cache
        async with cache.lock:
            if cache.is_fresh and not force_refresh:
                return cache.snapshot, False
            try:
                vms = await self._call_with_breaker(
                    self._client.cluster.resources.get, type="vm",
                )
                lxcs = await self._call_with_breaker(
                    self._client.cluster.resources.get, type="lxc",
                )
                cache.snapshot = (vms or []) + (lxcs or [])
                cache.fetched_at = time.monotonic()
                return cache.snapshot, False
            except PVEUnreachable:
                if cache.snapshot is not None:
                    return cache.snapshot, True
                raise

    async def get_vm_status(self, *, node: str, vmid: int, is_lxc: bool) -> dict:
        """GET /nodes/{node}/{qemu|lxc}/{vmid}/status/current."""
        fn = (
            self._client.nodes(node).lxc(vmid).status.current.get
            if is_lxc
            else self._client.nodes(node).qemu(vmid).status.current.get
        )
        return await self._call_with_breaker(fn)

    async def get_vm_config(self, *, node: str, vmid: int, is_lxc: bool) -> dict:
        """GET /nodes/{node}/{qemu|lxc}/{vmid}/config."""
        fn = (
            self._client.nodes(node).lxc(vmid).config.get
            if is_lxc
            else self._client.nodes(node).qemu(vmid).config.get
        )
        return await self._call_with_breaker(fn)

    # ------------------------------------------------------------------
    # Write calls (Phase 2) — go through _call_with_breaker
    # ------------------------------------------------------------------

    async def set_vm_config(
        self, *, node: str, vmid: int, is_lxc: bool, **fields: Any
    ) -> None:
        """PUT /nodes/{node}/{qemu|lxc}/{vmid}/config — tags + description writes only in Phase 2.

        After a successful write, invalidate the resource cache so the next
        list_resources() shows the post-write state.
        """
        fn = (
            self._client.nodes(node).lxc(vmid).config.put
            if is_lxc
            else self._client.nodes(node).qemu(vmid).config.put
        )
        await self._call_with_breaker(fn, **fields)
        # Cache invalidate happens via direct assignment (no separate lock pass —
        # the next list_resources() will lock + refresh).
        self._resource_cache.snapshot = None

    async def rrddata(
        self,
        *,
        node: str,
        vmid: int,
        is_lxc: bool,
        timeframe: str = "hour",
        cf: str = "AVERAGE",
    ) -> list[dict]:
        """GET /nodes/{node}/{qemu|lxc}/{vmid}/rrddata?timeframe=&cf= ."""
        if timeframe not in {"hour", "day", "week", "month", "year"}:
            raise ValueError(
                f"timeframe must be one of hour/day/week/month/year, got {timeframe!r}"
            )
        if cf not in {"AVERAGE", "MAX"}:
            raise ValueError(f"cf must be AVERAGE or MAX, got {cf!r}")
        fn = (
            self._client.nodes(node).lxc(vmid).rrddata.get
            if is_lxc
            else self._client.nodes(node).qemu(vmid).rrddata.get
        )
        return await self._call_with_breaker(fn, timeframe=timeframe, cf=cf)

    async def pool_members(self, *, poolid: str) -> list[dict]:
        """GET /pools/{poolid} — returns the 'members' array (empty list if absent)."""
        payload = await self._call_with_breaker(self._client.pools(poolid).get)
        return list(payload.get("members", [])) if isinstance(payload, dict) else []

    # ------------------------------------------------------------------
    # Pool lifecycle (tenant bootstrap — Phase 1, keep unchanged)
    # ------------------------------------------------------------------

    async def create_pool(self, poolid: str, comment: str = "") -> None:
        """``POST /pools`` — create a new resource pool."""
        await self._call(self._client.pools.post, poolid=poolid, comment=comment)

    async def delete_pool(self, poolid: str) -> None:
        """``DELETE /pools/{poolid}`` — best-effort cleanup helper."""
        await self._call(self._client.pools(poolid).delete)

    # ------------------------------------------------------------------
    # User + token lifecycle (per-tenant privsep — Phase 1, keep unchanged)
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
