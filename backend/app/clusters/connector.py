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
