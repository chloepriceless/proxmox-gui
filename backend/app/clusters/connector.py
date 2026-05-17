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

        # Phase 4 (Plan 04-08): the console relay's upstream WebSocket leg
        # (``console/proxy.py``) opens ``wss://{host}:{port}/.../vncwebsocket``
        # directly — proxmoxer does not do WebSocket — so it needs the host /
        # port / TLS posture. ``ProxmoxAPI`` consumes these in its constructor
        # and does not re-expose them; we keep our own copy as the single
        # source of truth for the relay (spike 04-03 §5).
        self.host: str = host
        self.port: int = port
        self.verify_ssl: bool = verify_ssl
        self.tls_fingerprint: str | None = tls_fingerprint

    def invalidate_resource_cache(self) -> None:
        """Drop the cached ``/cluster/resources`` snapshot — the next read
        re-fetches from PVE.

        Mutating connector calls already do this inline. The public method
        exists so the API-side job-event pump can invalidate this process's
        cache when the *worker* process completes a mutating job (the worker
        only invalidates its own connector caches; Redis job events are the
        sole cross-process signal).
        """
        self._resource_cache.snapshot = None

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
        """GET /cluster/resources?type=vm — returns both qemu + lxc, 30s TTL.

        PVE's `/cluster/resources` ``type`` param accepts only
        ``vm|storage|node|sdn``. ``type=vm`` returns BOTH QEMU VMs and LXCs
        (PVE collapses both under "virtual machines" for this endpoint —
        each item carries its actual ``type`` of ``qemu`` or ``lxc``).
        An earlier version of this method made a second call with
        ``type=lxc`` which PVE rejects with 400 "parameter verification
        failed" — verified live against PVE 9.1.4.

        Returns (snapshot, is_stale). On breaker-open + stale cache present:
        returns (snapshot, True). On breaker-open + NO cache: raises PVEUnreachable.
        """
        cache = self._resource_cache
        async with cache.lock:
            if cache.is_fresh and not force_refresh:
                return cache.snapshot, False
            try:
                items = await self._call_with_breaker(
                    self._client.cluster.resources.get, type="vm",
                )
                cache.snapshot = items or []
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

    async def pool_exists(self, poolid: str) -> bool:
        """True if a resource pool ``poolid`` already exists on the cluster."""
        pools = await self._call(self._client.pools.get)
        return any(p.get("poolid") == poolid for p in (pools or []))

    # ------------------------------------------------------------------
    # User + token lifecycle (per-tenant privsep — Phase 1, keep unchanged)
    # ------------------------------------------------------------------

    async def create_user(self, userid: str, comment: str = "") -> None:
        """``POST /access/users`` — create a PVE user (usually ``...@pve``)."""
        await self._call(self._client.access.users.post, userid=userid, comment=comment)

    async def delete_user(self, userid: str) -> None:
        """``DELETE /access/users/{userid}`` — best-effort cleanup helper."""
        await self._call(self._client.access.users(userid).delete)

    async def user_exists(self, userid: str) -> bool:
        """True if PVE user ``userid`` already exists on the cluster."""
        users = await self._call(self._client.access.users.get)
        return any(u.get("userid") == userid for u in (users or []))

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

    async def token_exists(self, userid: str, tokenid: str) -> bool:
        """True if API token ``{userid}!{tokenid}`` already exists.

        Assumes ``userid`` exists — call :meth:`user_exists` first.
        """
        tokens = await self._call(self._client.access.users(userid).token.get)
        return any(t.get("tokenid") == tokenid for t in (tokens or []))

    async def delete_token(self, userid: str, tokenid: str) -> None:
        """``DELETE /access/users/{userid}/token/{tokenid}``.

        PVE never re-reveals a token's secret, so an adopted-but-stale token
        must be deleted and minted afresh to obtain a usable value.
        """
        await self._call(self._client.access.users(userid).token(tokenid).delete)

    async def set_pool_acl(
        self, poolid: str, *, userid: str, role: str, tokenid: str | None = None,
    ) -> None:
        """``PUT /access/acl`` — grant ``role`` on ``/pool/{poolid}``.

        The role is ALWAYS granted to the user ``users=userid``. If
        ``tokenid`` is also given, the same role is additionally granted to
        the token principal ``{userid}!{tokenid}``.

        D-01: a privsep token carries its own ACL, but its *effective*
        permissions are the INTERSECTION of the owning user's rights and
        the token's own rights. Granting only the token — with a
        permission-less user — yields an empty intersection: the token then
        sees nothing and ``/cluster/resources`` returns nodes only. Bootstrap
        must therefore grant BOTH the user and the token, which is why this
        method always emits ``users=`` and adds ``tokens=`` on top.

        Phase 1 always uses role ``PVEVMAdmin`` (D-02 + D-06). PVE 9
        narrowed ``PVEVMUser`` to read+power only — the write-side perms
        (``VM.Config.*``) moved to ``PVEVMAdmin``, which is what
        self-service tenants need.
        """
        kwargs: dict[str, object] = {
            "path": f"/pool/{poolid}",
            "roles": role,
            "propagate": 1,
            "users": userid,
        }
        if tokenid is not None:
            kwargs["tokens"] = f"{userid}!{tokenid}"
        await self._call(self._client.access.acl.put, **kwargs)

    # ------------------------------------------------------------------
    # Lifecycle mutating + polling calls (Phase 3, Plan 03-01)
    #
    # Every method routes through ``_call_with_breaker`` so it inherits the
    # circuit breaker + the uniform PVEUnreachable/PVEAuthError/PVEAPIError
    # surface (RESEARCH §"All proxmoxer I/O through _call_with_breaker").
    # The ``fn = (... lxc ... if is_lxc else ... qemu ...)`` branch shape
    # mirrors ``get_vm_status``. Mutating calls invalidate the resource
    # cache (``self._resource_cache.snapshot = None``).
    #
    # The root-only lock-override parameter (Pitfall 17 / T-03-01-04) is
    # never sent — the GUI uses privsep tokens, so no method exposes it.
    # ------------------------------------------------------------------

    async def vm_power(
        self, *, node: str, vmid: int, is_lxc: bool, action: str
    ) -> str:
        """POST /nodes/{node}/{qemu|lxc}/{vmid}/status/{action} — returns a UPID.

        ``action`` ∈ {start, stop, reboot, shutdown}. ``stop`` is force-stop;
        ``shutdown`` is graceful ACPI.
        """
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        fn = getattr(base.status, action).post
        upid = await self._call_with_breaker(fn)
        self._resource_cache.snapshot = None
        return upid

    async def vm_delete(self, *, node: str, vmid: int, is_lxc: bool) -> str:
        """DELETE /nodes/{node}/{qemu|lxc}/{vmid} with purge=1 — returns a UPID.

        ``purge=1`` also drops the VM from backup/replication jobs. The
        root-only lock-override parameter is never passed (privsep tokens).
        """
        fn = (
            self._client.nodes(node).lxc(vmid).delete
            if is_lxc
            else self._client.nodes(node).qemu(vmid).delete
        )
        upid = await self._call_with_breaker(fn, purge=1)
        self._resource_cache.snapshot = None
        return upid

    async def vncproxy(self, *, node: str, vmid: int, is_lxc: bool) -> dict:
        """POST /nodes/{node}/{qemu|lxc}/{vmid}/vncproxy — mint a console ticket (spike 04-03).

        Returns the raw PVE response dict — ``{ticket, port, user, cert, upid}``
        (``password`` is optional/deprecated and never present for a pure-VNC
        websocket upgrade). The caller (the console relay) needs only ``ticket``
        and ``port``. ``websocket=1`` is always passed — it is the spike-confirmed
        request param for the websocket upgrade and is harmless on every guest
        type.

        This is a synchronous *mint*, not a long-running resource mutation: it
        returns data directly (not a UPID) and so does NOT clear the resource
        cache. The ~30-40s ticket lifetime is why it is minted on click only
        (CON-02, Pitfall 3).
        """
        base = self._client.nodes(node)
        ep = (base.lxc(vmid) if is_lxc else base.qemu(vmid)).vncproxy
        return await self._call_with_breaker(ep.post, websocket=1)

    async def task_status(self, *, node: str, upid: str) -> dict:
        """GET /nodes/{node}/tasks/{upid}/status.

        Returns ``{"status": "running"|"stopped", "exitstatus": "<str>", ...}``.
        ``exitstatus`` is present only when ``status == "stopped"``.
        """
        fn = self._client.nodes(node).tasks(upid).status.get
        return await self._call_with_breaker(fn)

    async def task_log(self, *, node: str, upid: str, limit: int = 200) -> str:
        """GET /nodes/{node}/tasks/{upid}/log — joined into a single string.

        ``Tasks.decode_log`` joins the JSON log-line array into a plain
        string for the "Show technical details" panel.
        """
        from proxmoxer.tools import Tasks

        fn = self._client.nodes(node).tasks(upid).log.get
        raw = await self._call_with_breaker(fn, limit=limit)
        return Tasks.decode_log(raw)

    async def snapshot_list(
        self, *, node: str, vmid: int, is_lxc: bool
    ) -> list[dict]:
        """GET /nodes/{node}/{qemu|lxc}/{vmid}/snapshot — sync snapshot list.

        Each item carries a ``parent`` field; the tree is built from it.
        """
        fn = (
            self._client.nodes(node).lxc(vmid).snapshot.get
            if is_lxc
            else self._client.nodes(node).qemu(vmid).snapshot.get
        )
        result = await self._call_with_breaker(fn)
        return list(result or [])

    async def snapshot_create(
        self,
        *,
        node: str,
        vmid: int,
        is_lxc: bool,
        snapname: str,
        description: str = "",
        vmstate: bool = False,
    ) -> str:
        """POST .../snapshot — create a snapshot, returns a UPID.

        ``vmstate=1`` includes RAM state (qemu only).
        """
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        kwargs: dict[str, Any] = {"snapname": snapname}
        if description:
            kwargs["description"] = description
        if vmstate and not is_lxc:
            kwargs["vmstate"] = 1
        upid = await self._call_with_breaker(base.snapshot.post, **kwargs)
        self._resource_cache.snapshot = None
        return upid

    async def snapshot_rollback(
        self, *, node: str, vmid: int, is_lxc: bool, name: str
    ) -> str:
        """POST .../snapshot/{name}/rollback — destructive, returns a UPID."""
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        fn = base.snapshot(name).rollback.post
        upid = await self._call_with_breaker(fn)
        self._resource_cache.snapshot = None
        return upid

    async def snapshot_delete(
        self, *, node: str, vmid: int, is_lxc: bool, name: str
    ) -> str:
        """DELETE .../snapshot/{name} — idempotent, returns a UPID."""
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        fn = base.snapshot(name).delete
        upid = await self._call_with_breaker(fn)
        self._resource_cache.snapshot = None
        return upid

    async def vzdump(
        self,
        *,
        node: str,
        vmid: int,
        storage: str,
        mode: str = "snapshot",
        compress: str = "zstd",
    ) -> str:
        """POST /nodes/{node}/vzdump — manual backup, returns a UPID.

        A PBS target is just a ``storage`` whose type is ``pbs`` — same call.
        """
        fn = self._client.nodes(node).vzdump.post
        return await self._call_with_breaker(
            fn, vmid=vmid, storage=storage, mode=mode, compress=compress
        )

    async def restore(
        self,
        *,
        node: str,
        vmid: int,
        archive: str,
        is_lxc: bool,
        force: bool = False,
        storage: str | None = None,
    ) -> str:
        """POST /nodes/{node}/{qemu|lxc} restoring from an archive — UPID.

        ``force=1`` + the same vmid overwrites in place (data-loss op).
        """
        kwargs: dict[str, Any] = {"vmid": vmid}
        if force:
            kwargs["force"] = 1
        if storage:
            kwargs["storage"] = storage
        if is_lxc:
            kwargs["ostemplate"] = archive
            kwargs["restore"] = 1
            fn = self._client.nodes(node).lxc.post
        else:
            kwargs["archive"] = archive
            fn = self._client.nodes(node).qemu.post
        upid = await self._call_with_breaker(fn, **kwargs)
        self._resource_cache.snapshot = None
        return upid

    async def resize_disk(
        self, *, node: str, vmid: int, is_lxc: bool, disk: str, size: str
    ) -> Any:
        """PUT .../resize — grow a disk (sync). ``size`` is a delta (``+10G``).

        Shrink is rejected app-side; never send a smaller absolute size.
        """
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        result = await self._call_with_breaker(base.resize.put, disk=disk, size=size)
        self._resource_cache.snapshot = None
        return result

    async def clone(
        self,
        *,
        node: str,
        vmid: int,
        newid: int,
        name: str | None = None,
        full: bool = True,
        target: str | None = None,
        storage: str | None = None,
        is_lxc: bool = False,
    ) -> str:
        """POST .../clone — clone a VM/LXC, returns a UPID.

        ``full=1`` full clone, ``full=0`` linked clone.
        """
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        kwargs: dict[str, Any] = {"newid": newid, "full": int(full)}
        if name:
            kwargs["name"] = name
        if target:
            kwargs["target"] = target
        if storage:
            kwargs["storage"] = storage
        upid = await self._call_with_breaker(base.clone.post, **kwargs)
        self._resource_cache.snapshot = None
        return upid

    async def to_template(self, *, node: str, vmid: int) -> str:
        """POST /nodes/{node}/qemu/{vmid}/template — qemu-only (A7), UPID.

        Template conversion is one-way and qemu-only in Phase 3.
        """
        fn = self._client.nodes(node).qemu(vmid).template.post
        upid = await self._call_with_breaker(fn)
        self._resource_cache.snapshot = None
        return upid

    async def migrate(
        self,
        *,
        node: str,
        vmid: int,
        is_lxc: bool,
        target: str,
        online: bool = False,
        bwlimit: int | None = None,
    ) -> str:
        """POST .../migrate — migrate to another node, returns a UPID.

        ``online=1`` live migration. ``bwlimit`` is in KiB/s (0 = unlimited).
        """
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        kwargs: dict[str, Any] = {"target": target, "online": int(online)}
        if bwlimit is not None:
            kwargs["bwlimit"] = bwlimit
        upid = await self._call_with_breaker(base.migrate.post, **kwargs)
        self._resource_cache.snapshot = None
        return upid

    async def cluster_status(self) -> list[dict]:
        """GET /cluster/status — sync. Find the ``type=='cluster'`` item to
        read ``quorate`` for the migration/write quorum pre-flight."""
        result = await self._call_with_breaker(self._client.cluster.status.get)
        return list(result or [])

    async def cluster_nextid(self) -> int:
        """GET /cluster/nextid — sync. NOT atomic on older PVE (Pitfall 1);
        callers add an app-level reservation/lock."""
        result = await self._call_with_breaker(self._client.cluster.nextid.get)
        return int(result)

    async def list_nodes(self) -> list[dict]:
        """GET /nodes — the cluster's node list.

        Used to pick a representative node for cluster-wide queries (e.g. the
        backup-storage admin picker — PVE storage definitions are cluster-wide
        so any node's ``/storage`` list is representative).
        """
        result = await self._call_with_breaker(self._client.nodes.get)
        return list(result or [])

    async def node_storages(
        self, *, node: str, content: str = "backup"
    ) -> list[dict]:
        """GET /nodes/{node}/storage?content= — sync storage list.

        Used for the backup-storage admin picker (D-08) and restore-archive
        listing.
        """
        fn = self._client.nodes(node).storage.get
        result = await self._call_with_breaker(fn, content=content)
        return list(result or [])

    async def storage_content(
        self, *, node: str, storage: str, content: str = "backup",
        vmid: int | None = None,
    ) -> list[dict]:
        """GET /nodes/{node}/storage/{storage}/content — backup-file listing.

        Filters to ``content=backup`` and, when ``vmid`` is given, to that
        VM's archives. Each item carries ``volid``/``ctime``/``size``/
        ``format`` (D-08 keep-last-N retention reads ``ctime`` to find the
        oldest files).
        """
        fn = self._client.nodes(node).storage(storage).content.get
        kwargs: dict[str, Any] = {"content": content}
        if vmid is not None:
            kwargs["vmid"] = vmid
        result = await self._call_with_breaker(fn, **kwargs)
        return list(result or [])

    async def delete_storage_content(
        self, *, node: str, storage: str, volid: str
    ) -> Any:
        """DELETE /nodes/{node}/storage/{storage}/content/{volid}.

        Deletes one backup file — used by the keep-last-N prune and the
        explicit "Delete backup file" action (D-08).
        """
        fn = self._client.nodes(node).storage(storage).content(volid).delete
        return await self._call_with_breaker(fn)

    # ------------------------------------------------------------------
    # Provisioning create + download + node-fit calls (Phase 4, Plan 04-04)
    #
    # Same convention as the Phase-3 lifecycle calls above: every method
    # routes through ``_call_with_breaker``; mutating creates invalidate the
    # resource cache; reads do not. The root-only lock-override parameter is
    # never sent — provisioning runs as the per-team privsep token.
    # ------------------------------------------------------------------

    async def create_qemu(self, *, node: str, vmid: int, **config: Any) -> str:
        """POST /nodes/{node}/qemu — create a VM, returns a UPID.

        ``config`` carries the full proxmoxer kwargs the provisioning service
        translated from the wizard (``cores``/``memory``/``net0``/``ide2``/
        ``pool``/...). PVE creates the VM atomically from this single call
        (RESEARCH Pitfall 8) — there is no second mutating step.
        """
        fn = self._client.nodes(node).qemu.post
        upid = await self._call_with_breaker(fn, vmid=vmid, **config)
        self._resource_cache.snapshot = None
        return upid

    async def create_lxc(
        self, *, node: str, vmid: int, ostemplate: str, **config: Any
    ) -> str:
        """POST /nodes/{node}/lxc — create a container, returns a UPID.

        ``ostemplate`` is the ``<storage>:vztmpl/<file>`` template volid;
        ``config`` carries the remaining proxmoxer kwargs (``cores``/
        ``memory``/``rootfs``/``net0``/``unprivileged``/``features``/``pool``).
        """
        fn = self._client.nodes(node).lxc.post
        upid = await self._call_with_breaker(
            fn, vmid=vmid, ostemplate=ostemplate, **config
        )
        self._resource_cache.snapshot = None
        return upid

    async def download_url(
        self,
        *,
        node: str,
        storage: str,
        content: str,
        url: str,
        filename: str,
        **opts: Any,
    ) -> str:
        """POST /nodes/{node}/storage/{storage}/download-url — returns a UPID.

        PVE fetches the file (ISO / cloud image / vztmpl) directly to its own
        storage and returns a UPID — the GUI never proxies the bytes
        (Pitfall 7). ``content`` is the PVE content type (``iso`` / ``vztmpl``
        / ``import``). The endpoint segment carries a hyphen, so it is reached
        via the call-style path step ``storage(storage)("download-url")``.
        """
        fn = self._client.nodes(node).storage(storage)("download-url").post
        upid = await self._call_with_breaker(
            fn, content=content, url=url, filename=filename, **opts
        )
        self._resource_cache.snapshot = None
        return upid

    async def storages_for_content(
        self, *, node: str, content: str
    ) -> list[dict]:
        """GET /nodes/{node}/storage?content= — content-type-filtered storages.

        Lists the storages on ``node`` whose ``content`` capability list
        includes ``content`` (``iso`` / ``images`` / ``vztmpl``) — the
        content-type filter the provisioning wizard dropdowns need so a user
        can only target a storage that actually accepts the artifact type
        (Pitfall 16 — picking an ``images``-only storage for an ISO fails on
        PVE).

        PVE's ``?content=`` query already filters server-side; the result is
        ALSO filtered app-side on each row's ``content`` token list — a
        belt-and-braces guard against PVE versions/back-ends that return the
        unfiltered list. This is a pure read: it routes through
        ``_call_with_breaker`` but does NOT clear the resource cache.
        """
        fn = self._client.nodes(node).storage.get
        result = await self._call_with_breaker(fn, content=content)
        out: list[dict] = []
        for store in list(result or []):
            tokens = {
                t.strip()
                for t in str(store.get("content", "")).split(",")
                if t.strip()
            }
            if content in tokens:
                out.append(store)
        return out

    async def list_iso_content(self, *, node: str) -> list[dict]:
        """Enumerate the ISO volumes present across the node's ISO storages.

        Reads the node's ``content=iso``-capable storages (Pitfall 16) and,
        for each, lists its ``content=iso`` volumes. Each returned row carries
        ``volid`` / ``filename`` (derived from the volid tail) / ``size`` /
        ``storage``. This is a pure read — it does NOT clear the resource
        cache.
        """
        storages = await self.storages_for_content(node=node, content="iso")
        out: list[dict] = []
        for store in storages:
            storage_name = store.get("storage")
            if not storage_name:
                continue
            fn = (
                self._client.nodes(node)
                .storage(storage_name)
                .content.get
            )
            vols = await self._call_with_breaker(fn, content="iso")
            for vol in list(vols or []):
                volid = vol.get("volid", "")
                # The volid tail after the last '/' is the on-disk filename.
                filename = volid.rsplit("/", 1)[-1] if volid else ""
                out.append(
                    {
                        "volid": volid,
                        "filename": filename,
                        "size": int(vol.get("size") or 0),
                        "storage": storage_name,
                        "format": vol.get("format"),
                    }
                )
        return out

    async def node_resources(self) -> list[dict]:
        """GET /cluster/resources?type=node — per-node CPU/RAM capacity.

        Returns the ``type=node`` rows of ``/cluster/resources``, each
        carrying ``maxcpu``/``cpu``/``maxmem``/``mem`` — the live free-capacity
        figures the provisioning wizard's node-fit hint reads (VM-09/VM-10).
        This is a pure read: it routes through ``_call_with_breaker`` but does
        NOT clear the resource cache.
        """
        result = await self._call_with_breaker(
            self._client.cluster.resources.get, type="node"
        )
        return list(result or [])

    # ------------------------------------------------------------------
    # SDN / legacy-bridge read calls (Phase 4, Plan 04-07 — spike 04-02)
    #
    # The read-API contract is pinned by ``04-SPIKE-sdn.md`` §7. Every method
    # routes through ``_call_with_breaker`` (same convention as the Phase-3
    # lifecycle reads above); these are PURE reads and do NOT clear the
    # resource cache.
    #
    # RBAC (spike §7, load-bearing): the per-team privsep token CANNOT
    # enumerate SDN — ``GET /cluster/sdn`` → ``403 SDN.Audit`` and
    # ``GET /nodes/{node}/network`` → ``[]`` for that token. The networks
    # service therefore drives these reads with the CLUSTER-ADMIN connector
    # (``registry.get``) and applies per-team scoping APP-SIDE. These methods
    # are connector-level and token-agnostic — the caller picks the connector.
    # ------------------------------------------------------------------

    async def sdn_zones(self) -> list[dict]:
        """GET /cluster/sdn/zones — the SDN zone list (spike §1).

        No ``pending``/``running`` query param, so each item carries its
        ``state``/``pending`` annotation (spike §2). Each zone carries
        ``ipam`` (the IPAM id — empty/absent ⇒ DHCP-only), ``dhcp``,
        ``type``, ``bridge``, ``nodes`` and ``state``. IPAM is a ZONE
        property, not a VNet property — the service joins a VNet's ``zone``
        to this list to learn whether the VNet has an IPAM.
        """
        result = await self._call_with_breaker(self._client.cluster.sdn.zones.get)
        return list(result or [])

    async def sdn_vnets(self) -> list[dict]:
        """GET /cluster/sdn/vnets — the SDN VNet list (spike §1).

        No ``pending``/``running`` query param, so each item carries its
        ``state``/``pending`` annotation. Each VNet carries ``vnet`` (the
        name), ``zone`` (the zone-link field — the IPAM-association join
        key), ``tag`` (VLAN tag / VXLAN VNI), ``type`` and ``state``. A VNet
        is USABLE only when ``state`` is empty/absent (spike §2, Pitfall 8).
        """
        result = await self._call_with_breaker(self._client.cluster.sdn.vnets.get)
        return list(result or [])

    async def sdn_subnets(self, *, vnet: str) -> list[dict]:
        """GET /cluster/sdn/vnets/{vnet}/subnets — the VNet's subnet list.

        Each subnet object carries the CIDR plus ``gateway`` and
        ``dhcp-range`` — enough for the NET-03 app-side free-IP computation
        (spike §3).
        """
        fn = self._client.cluster.sdn.vnets(vnet).subnets.get
        result = await self._call_with_breaker(fn)
        return list(result or [])

    async def sdn_ipam_status(self, *, ipam: str) -> list[dict]:
        """GET /cluster/sdn/ipams/{ipam}/status — the allocated-IP set.

        Returns an array of every IP the IPAM has recorded as allocated
        (spike §3, IPAM FREE-IP option b). The service computes the lowest
        unallocated host address from this set + the subnet CIDR. Skip this
        call entirely when the VNet's zone has no ``ipam`` (DHCP-only degrade).
        """
        fn = self._client.cluster.sdn.ipams(ipam).status.get
        result = await self._call_with_breaker(fn)
        return list(result or [])

    async def node_bridges(self, *, node: str) -> list[dict]:
        """GET /nodes/{node}/network?type=any_bridge — legacy Linux/OVS bridges.

        ``type=any_bridge`` includes OVS bridges (``type=bridge`` omits them)
        — the spike's LEGACY BRIDGE READ verdict (§5). The bridge list is
        per-node; the networks service dedups by ``iface`` across nodes for
        the cluster-wide picker. Each item carries ``iface``, ``type``,
        ``cidr``, ``gateway``, ``bridge_vlan_aware``, ``active``.
        """
        fn = self._client.nodes(node).network.get
        result = await self._call_with_breaker(fn, type="any_bridge")
        return list(result or [])

    # ------------------------------------------------------------------
    # In-container command execution (Phase 4, Plan 04-06 — spike 04-01)
    #
    # CRITICAL: there is NO PVE REST endpoint for running a command inside an
    # LXC. ``POST /nodes/{node}/lxc/{vmid}/status/exec`` returns 501 Not
    # Implemented on PVE 9.1.2 (confirmed live — 04-SPIKE-community-scripts.md
    # §3). proxmoxer is a thin REST wrapper, so it CANNOT expose ``pct exec``.
    #
    # The spike's verdict — ``EXEC MECHANISM: pct exec (CLI) over SSH`` — is
    # authoritative: ``lxc_exec`` SSHes to the PVE *node* and runs the CLI
    # ``pct exec <vmid> -- <command>``. The GUI LXC reaches the PVE host on
    # port 22 (confirmed open in the spike's live probe). Output is delivered
    # in chunks off the SSH channel (``pct exec`` is synchronous, not a
    # UPID-polled PVE task).
    #
    # The SSH transport here shells out to the OS ``ssh`` binary via
    # ``asyncio.create_subprocess_exec`` — no extra Python SSH dependency, the
    # subprocess stdout is a live byte stream the worker forwards to the Tasks
    # drawer chunk-by-chunk (D-08). ``StrictHostKeyChecking=accept-new`` TOFU-
    # pins the node's host key on first contact.
    # ------------------------------------------------------------------

    async def lxc_exec(
        self,
        *,
        node: str,
        vmid: int,
        command: list[str],
        stdin_data: str | None = None,
        env: dict[str, str] | None = None,
        on_output: Any = None,
        timeout: float = 3600.0,  # noqa: ASYNC109 — passthrough to the sync subprocess.wait
    ) -> dict:
        """Run a command inside a running LXC — mechanism per 04-SPIKE-community-scripts.md.

        There is NO PVE REST endpoint for this (confirmed: POST
        ``.../lxc/{vmid}/status/exec`` → 501 on PVE 9.1.2). This SSHes to the
        PVE *node* and invokes the CLI ``pct exec <vmid> -- <command>``.

        ``command`` is a list — every element is a discrete argument and is
        passed through the SSH transport without shell interpolation on the
        GUI side (threat T-04-06-01: no command injection via catalog slug /
        script options). ``stdin_data`` is fed to the in-container process's
        stdin (the spike's whiptail-bypass affirmative stdin — e.g. ``"y\\n"``
        repeated). ``env`` exports environment variables on the node side
        before the ``pct exec`` (the ``build.func`` env block — spike §2.1).

        ``on_output`` — if given — is an awaitable called with each decoded
        output chunk as it arrives (D-08 — streamed to the Tasks drawer).

        Returns ``{"exit_code": int, "output": str}``: the combined
        stdout/stderr and the process exit code. This routes through
        ``_call_with_breaker`` so an unreachable node surfaces the uniform
        ``PVEUnreachable``. It runs a command inside an already-created
        container — it does NOT clear the resource cache.
        """
        return await self._call_with_breaker(
            self._ssh_pct_exec,
            node=node,
            vmid=vmid,
            command=command,
            stdin_data=stdin_data,
            env=env,
            on_output=on_output,
            timeout=timeout,
        )

    def _ssh_pct_exec(
        self,
        *,
        node: str,
        vmid: int,
        command: list[str],
        stdin_data: str | None,
        env: dict[str, str] | None,
        on_output: Any,
        timeout: float,
    ) -> dict:
        """Synchronous SSH ``pct exec`` shell-out — invoked via the executor.

        ``_call_with_breaker`` runs this in ``asyncio.to_thread`` (proxmoxer's
        own convention). The OS ``ssh`` client is the transport; the node-side
        shell exports ``env`` then runs ``pct exec <vmid> -- <command>``.
        """
        import shlex
        import subprocess

        # Build the node-side shell command. Each env var and each pct-exec
        # argument is shell-quoted exactly once with shlex.quote — the env
        # block + the install command can never break out into the node shell
        # (threat T-04-06-01).
        env_prefix = ""
        if env:
            env_prefix = " ".join(
                f"{key}={shlex.quote(str(value))}" for key, value in env.items()
            )
            env_prefix = f"export {env_prefix}; " if env_prefix else ""
        pct_args = " ".join(shlex.quote(arg) for arg in command)
        remote_cmd = f"{env_prefix}pct exec {int(vmid)} -- {pct_args}"

        ssh_argv = [
            "ssh",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "BatchMode=yes",
            "-o", f"ConnectTimeout={int(min(timeout, 30))}",
            f"root@{node}",
            remote_cmd,
        ]

        chunks: list[str] = []
        proc = subprocess.Popen(  # noqa: S603 — argv list, no shell=True
            ssh_argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if stdin_data is not None and proc.stdin is not None:
            try:
                proc.stdin.write(stdin_data)
                proc.stdin.flush()
            except (BrokenPipeError, OSError):
                pass
        if proc.stdin is not None:
            try:
                proc.stdin.close()
            except OSError:
                pass

        # Read the combined stream line-buffered — each line is a chunk
        # forwarded to the Tasks drawer (D-08 — chunked output delivery).
        if proc.stdout is not None:
            for line in proc.stdout:
                chunks.append(line)
                if on_output is not None:
                    try:
                        on_output(line)
                    except Exception:  # noqa: BLE001 — a drawer push failure
                        # must never abort the install.
                        pass
        try:
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
            chunks.append(f"\n[lxc_exec timed out after {timeout}s]\n")
        return {"exit_code": proc.returncode or 0, "output": "".join(chunks)}

    async def unlock(self, *, node: str, vmid: int, is_lxc: bool) -> Any:
        """Best-effort plain unlock — clears the ``lock`` config field.

        RESEARCH Open Question Q1: a privsep ``PVEVMAdmin`` token *may* be
        able to clear a plain lock via ``config.put(lock='')``; some PVE
        versions reject any ``config.put`` on a locked VM. The root-only
        lock-override parameter is never sent. A PVE rejection surfaces as
        a normal ``PVEAPIError`` through ``_call_with_breaker`` — the caller
        maps it to the curated "VM is locked" message.
        """
        base = (
            self._client.nodes(node).lxc(vmid)
            if is_lxc
            else self._client.nodes(node).qemu(vmid)
        )
        result = await self._call_with_breaker(base.config.put, lock="")
        self._resource_cache.snapshot = None
        return result
