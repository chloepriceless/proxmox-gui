---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/pyproject.toml
  - backend/app/clusters/connector.py
  - backend/app/clusters/registry.py
  - backend/app/clusters/health.py
  - backend/app/clusters/errors.py
  - backend/app/main.py
  - backend/tests/test_connector.py
  - backend/tests/test_connector_cache.py
  - backend/tests/test_registry_for_team.py
  - backend/tests/test_health_probe.py
  - backend/tests/fixtures/pve_responses.py
autonomous: true
requirements:
  - CLUST-02
  - CLUST-03
  - CLUST-04
user_setup: []

must_haves:
  truths:
    - "PVEConnector wraps every PVE call with a pybreaker.CircuitBreaker; auth errors do NOT trip the breaker."
    - "PVEConnector exposes list_resources(), get_vm_status(), get_vm_config(), set_vm_config(), rrddata(), pool_members() — every method goes through asyncio.to_thread (Pitfall A3 invariant preserved)."
    - "list_resources() serves from a 30s in-memory ResourceCache; on breaker-open, returns the last good snapshot with is_stale=True."
    - "PVEConnectorRegistry exposes get_for_team(cluster_id, team_id, *, db) returning a connector built from team_cluster_tokens (NOT the bootstrap token); cached by (team_id, cluster_id)."
    - "A background asyncio.Task per registered cluster polls /version every 15s, updating connector.last_seen_healthy + connector.status ∈ {'ok','failed'}."
    - "When PVEUnreachable bubbles up and no cache exists, the request returns 502; when stale cache exists, request returns 200 with is_stale=True."
  artifacts:
    - path: "backend/app/clusters/connector.py"
      provides: "ResourceCache dataclass; CircuitBreaker integration; list_resources/get_vm_status/get_vm_config/set_vm_config/rrddata/pool_members methods"
      contains: "class ResourceCache"
    - path: "backend/app/clusters/registry.py"
      provides: "get_for_team(cluster_id, team_id, *, db) cached by (team_id, cluster_id)"
      contains: "async def get_for_team"
    - path: "backend/app/clusters/health.py"
      provides: "health_probe_loop(connector, *, interval=15.0); start_probe_for / stop_probe_for on registry"
      contains: "async def health_probe_loop"
  key_links:
    - from: "backend/app/clusters/connector.py"
      to: "pybreaker"
      via: "self._breaker.call inside asyncio.to_thread"
      pattern: "self\\._breaker\\.call\\("
    - from: "backend/app/clusters/registry.py"
      to: "TeamClusterToken model"
      via: "SELECT by (team_id, cluster_id) UNIQUE constraint"
      pattern: "TeamClusterToken"
    - from: "backend/app/main.py"
      to: "health.health_probe_loop"
      via: "lifespan spawns asyncio.Task per registered cluster"
      pattern: "asyncio\\.create_task"
---

<objective>
Extend the Phase 1 PVEConnector + Registry with a 30s in-memory ResourceCache, pybreaker-backed CircuitBreaker, six new read/write methods needed by Phase 2 (list_resources, get_vm_status, get_vm_config, set_vm_config, rrddata, pool_members), per-team-token connector resolution, and a per-cluster background health probe.

Purpose: every other Phase 2 plan depends on these primitives. Inventory reads (Plan 02-03) call list_resources()/get_vm_status()/rrddata(); tag + notes writes call set_vm_config(); quota usage (Plan 02-04) calls list_resources() filtered by pool. Without breaker + cache, an unreachable cluster would hard-fail every page load — D-03 / CLUST-04 "degrade don't fail" depends on this.

Output: backend connector + registry surface ready for consumption by 02-03 + 02-04; pybreaker added to pyproject; ResourceCache + health probe wired into the FastAPI lifespan; all unit tests pass via FakeProxmox.
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/research/PITFALLS.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md
@backend/app/clusters/connector.py
@backend/app/clusters/registry.py
@backend/app/clusters/errors.py
@backend/app/main.py
@backend/tests/test_connector.py
@backend/tests/fixtures/pve_responses.py
@backend/app/models/team_cluster_token.py

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From backend/app/clusters/connector.py (Phase 1 — existing methods):
```python
class PVEConnector:
    def __init__(self, *, host: str, port: int, token_user: str,
                 token_name: str, token_value: str, verify_ssl: bool,
                 tls_fingerprint: str | None = None) -> None: ...
    async def _call(self, fn, *args, **kwargs): ...   # asyncio.to_thread bridge
    async def version(self) -> dict: ...
    async def validate(self) -> None: ...
    async def create_pool(self, poolid: str, comment: str = "") -> None: ...
    async def delete_pool(self, poolid: str) -> None: ...
    async def create_user(self, userid: str, comment: str = "") -> None: ...
    async def delete_user(self, userid: str) -> None: ...
    async def create_token(self, userid: str, tokenid: str, *, privsep: bool = True) -> dict: ...
    async def set_pool_acl(self, poolid: str, *, userid: str, role: str) -> None: ...
```

From backend/app/clusters/errors.py:
```python
class PVEAuthError(Exception): ...
class PVEUnreachable(Exception): ...
class PVEAPIError(Exception):
    def __init__(self, status_code: int, content: str) -> None: ...
```

From backend/app/clusters/registry.py (Phase 1):
```python
class PVEConnectorRegistry:
    def __init__(self, cipher, session_factory): ...
    async def get(self, cluster_id: int, *, db: AsyncSession | None = None) -> PVEConnector: ...
    def invalidate(self, cluster_id: int) -> None: ...
    def clear_all(self) -> None: ...
```

From backend/app/models/team_cluster_token.py:
```python
class TeamClusterToken(Base, TimestampMixin):
    __tablename__ = "team_cluster_tokens"
    id: int
    team_id: int                # FK teams.id
    cluster_id: int             # FK clusters.id
    userid: str                 # e.g. "gui-team-42@pve"
    tokenid: str                # e.g. "api"
    token_secret: str           # EncryptedSecret (Fernet); decrypted on load
    poolid: str                 # e.g. "gui-team-42"
    # UNIQUE(team_id, cluster_id) — guaranteed at most one row per pair.
```

From backend/tests/test_connector.py — FakeProxmox + patch pattern (verbatim):
```python
def _make_fake(responses):
    return FakeProxmox(responses=responses)

@pytest.mark.asyncio
async def test_version_returns_mocked_payload():
    from app.clusters.connector import PVEConnector
    fake = _make_fake({"version.get": VERSION_OK})
    with patch("app.clusters.connector.ProxmoxAPI", return_value=fake):
        conn = PVEConnector(host="pve.test", port=8006,
                            token_user="root@pam", token_name="api",
                            token_value="x", verify_ssl=False)
        result = await conn.version()
    assert result == VERSION_OK["data"]
    assert fake.calls[0] == ("version.get", (), {})
```

From pybreaker 1.4.1 (new dep — pinned):
```python
breaker = pybreaker.CircuitBreaker(
    fail_max=3,                       # 3 consecutive failures → open
    reset_timeout=30,                 # 30s before half-open probe
    exclude=[PVEAuthError],           # auth errors don't trip (config issue)
    name="pve-{host}",
)
breaker.call(fn, *args, **kwargs)     # sync; raises CircuitBreakerError when open
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add pybreaker; extend PVEConnector with ResourceCache + circuit breaker + six new methods; add tests via FakeProxmox</name>
  <files>backend/pyproject.toml, backend/app/clusters/connector.py, backend/app/clusters/errors.py, backend/tests/test_connector.py, backend/tests/test_connector_cache.py, backend/tests/fixtures/pve_responses.py</files>
  <read_first>
    - backend/app/clusters/connector.py (full file — Phase 1 surface; KEEP existing methods and their exception-translation block verbatim)
    - backend/app/clusters/errors.py (so PVEUnreachable + PVEAuthError + PVEAPIError stay unchanged; CircuitBreakerError will be translated INTO PVEUnreachable)
    - backend/tests/test_connector.py (FakeProxmox + ProxmoxAPI patching pattern; new tests reuse this fixture style)
    - backend/tests/fixtures/pve_responses.py (where VERSION_OK + other fixtures live; add new fixtures here)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §Pattern 1 (per-cluster connector with cache + circuit breaker — verbatim implementation reference) and §Pattern 6 (tag write) and §Pattern 5 (set_notes via description)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md §`backend/app/clusters/connector.py` extension guidance
  </read_first>
  <behavior>
    - list_resources() with fresh cache returns (snapshot, False) without hitting PVE the second time within 30s.
    - list_resources() with no cache + PVE auth error raises PVEAuthError (NOT through breaker — exclude=[PVEAuthError]).
    - list_resources() with no cache + 3 consecutive PVEUnreachable failures opens breaker; subsequent call raises PVEUnreachable("breaker open").
    - list_resources() with stale cache (>30s old) AND breaker open returns (cached_snapshot, True).
    - list_resources(force_refresh=True) bypasses the freshness check.
    - get_vm_status(node, vmid, is_lxc): for is_lxc=False calls client.nodes(node).qemu(vmid).status.current.get; for is_lxc=True calls .lxc(vmid).status.current.get.
    - get_vm_config(node, vmid, is_lxc): config.get on qemu OR lxc path; same pattern.
    - set_vm_config(node, vmid, is_lxc, **kwargs): config.put on qemu OR lxc; invalidates self._resource_cache.snapshot = None after success.
    - rrddata(node, vmid, is_lxc, timeframe, cf): rrddata.get with timeframe + cf query params; validate timeframe ∈ {"hour","day","week","month","year"} and cf ∈ {"AVERAGE","MAX"} → ValueError otherwise.
    - pool_members(poolid): client.pools(poolid).get; returns the "members" list when present.
    - asyncio.Lock inside ResourceCache prevents thundering herd on cache miss (verified with a test that fires N concurrent list_resources() and asserts exactly 1 PVE call).
  </behavior>
  <action>
Step 1 — pyproject.toml. Add `pybreaker==1.4.1` to the `[project].dependencies` list, immediately after `httpx==0.28.1`. Keep alphabetical-by-import-needs ordering (pybreaker imported by connector.py).

Step 2 — errors.py. No structural change; ensure existing 3 exception classes remain. Add a one-line comment above PVEUnreachable noting `"breaker open is mapped onto this; see connector._call_with_breaker"`.

Step 3 — connector.py. PRESERVE every Phase 1 method (`version`, `validate`, `create_pool`, `delete_pool`, `create_user`, `delete_user`, `create_token`, `set_pool_acl`) and the `_call` helper (Pitfall A3 invariant — do NOT route those existing tenant-bootstrap calls through the breaker; they run during one-time bootstrap and have their own exception handling).

Add at module top:
```python
import time
from dataclasses import dataclass, field
import pybreaker
```

Inside class PVEConnector:

(a) Add to __init__ AFTER `self._client = ProxmoxAPI(...)`:
```python
self._breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    exclude=[PVEAuthError],
    name=f"pve-{host}",
)
self._resource_cache = ResourceCache()
self.last_seen_healthy: float | None = None
self.last_error: str | None = None
self.status: str = "untested"  # 'ok' | 'failed' | 'untested'
```

(b) Add ResourceCache dataclass at module-level BEFORE class PVEConnector:
```python
@dataclass
class ResourceCache:
    snapshot: list[dict] | None = None
    fetched_at: float = 0.0
    lock: "asyncio.Lock" = field(default_factory=lambda: asyncio.Lock())
    ttl: float = 30.0

    @property
    def is_fresh(self) -> bool:
        return self.snapshot is not None and (time.monotonic() - self.fetched_at) < self.ttl

    @property
    def is_stale(self) -> bool:
        return self.snapshot is not None and not self.is_fresh
```

(c) Add `_call_with_breaker` method (mirrors `_call` but routes through breaker; translates pybreaker.CircuitBreakerError → PVEUnreachable; translates AuthenticationError / requests.ConnectionError / ResourceException identically to `version()`):
```python
async def _call_with_breaker(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
    """Wrap a sync proxmoxer call with the circuit breaker + asyncio.to_thread.

    pybreaker.call is SYNC: it raises CircuitBreakerError when open. We map
    that onto PVEUnreachable so callers only need the existing exception
    surface. PVEAuthError is excluded from the breaker (auth = config, not
    transient).
    """
    def _invoke():
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
```

(d) Add six new methods AFTER the existing `validate()` and BEFORE the Phase-1 tenant-bootstrap methods (`create_pool` etc.) — keep "Read calls" / "Write calls" comment dividers. Each method has the docstring listing the exact PVE path:

```python
async def list_resources(self, *, force_refresh: bool = False) -> tuple[list[dict], bool]:
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
        if is_lxc else
        self._client.nodes(node).qemu(vmid).status.current.get
    )
    return await self._call_with_breaker(fn)

async def get_vm_config(self, *, node: str, vmid: int, is_lxc: bool) -> dict:
    """GET /nodes/{node}/{qemu|lxc}/{vmid}/config."""
    fn = (
        self._client.nodes(node).lxc(vmid).config.get
        if is_lxc else
        self._client.nodes(node).qemu(vmid).config.get
    )
    return await self._call_with_breaker(fn)

async def set_vm_config(self, *, node: str, vmid: int, is_lxc: bool, **fields: Any) -> None:
    """PUT /nodes/{node}/{qemu|lxc}/{vmid}/config — tags + description writes only in Phase 2.

    After a successful write, invalidate the resource cache so the next
    list_resources() shows the post-write state.
    """
    fn = (
        self._client.nodes(node).lxc(vmid).config.put
        if is_lxc else
        self._client.nodes(node).qemu(vmid).config.put
    )
    await self._call_with_breaker(fn, **fields)
    # Cache invalidate happens via direct assignment (no separate lock pass —
    # the next list_resources() will lock + refresh).
    self._resource_cache.snapshot = None

async def rrddata(self, *, node: str, vmid: int, is_lxc: bool,
                  timeframe: str = "hour", cf: str = "AVERAGE") -> list[dict]:
    """GET /nodes/{node}/{qemu|lxc}/{vmid}/rrddata?timeframe=&cf= ."""
    if timeframe not in {"hour", "day", "week", "month", "year"}:
        raise ValueError(f"timeframe must be one of hour/day/week/month/year, got {timeframe!r}")
    if cf not in {"AVERAGE", "MAX"}:
        raise ValueError(f"cf must be AVERAGE or MAX, got {cf!r}")
    fn = (
        self._client.nodes(node).lxc(vmid).rrddata.get
        if is_lxc else
        self._client.nodes(node).qemu(vmid).rrddata.get
    )
    return await self._call_with_breaker(fn, timeframe=timeframe, cf=cf)

async def pool_members(self, *, poolid: str) -> list[dict]:
    """GET /pools/{poolid} — returns the 'members' array (empty list if absent)."""
    payload = await self._call_with_breaker(self._client.pools(poolid).get)
    return list(payload.get("members", [])) if isinstance(payload, dict) else []
```

Step 4 — fixtures/pve_responses.py. Add fixtures used by the new tests. Append (do NOT replace existing):
```python
CLUSTER_RESOURCES_VM = [
    {"vmid": 100, "name": "vm-prod-1", "type": "qemu", "node": "pve-01",
     "status": "running", "maxcpu": 4, "maxmem": 4294967296, "maxdisk": 53687091200,
     "tags": "prod;web", "pool": "gui-team-42"},
    {"vmid": 101, "name": "vm-prod-2", "type": "qemu", "node": "pve-02",
     "status": "stopped", "maxcpu": 2, "maxmem": 2147483648, "maxdisk": 21474836480,
     "tags": "", "pool": "gui-team-42"},
]
CLUSTER_RESOURCES_LXC = [
    {"vmid": 200, "name": "lxc-a", "type": "lxc", "node": "pve-01",
     "status": "running", "maxcpu": 1, "maxmem": 1073741824, "maxdisk": 10737418240,
     "tags": "infra", "pool": "gui-team-42"},
]
VM_STATUS_RUNNING = {"data": {"status": "running", "uptime": 12345, "cpu": 0.12,
                              "mem": 1234567890, "maxmem": 4294967296,
                              "netin": 100, "netout": 200, "diskread": 50, "diskwrite": 60}}
VM_CONFIG = {"data": {"name": "vm-prod-1", "cores": 4, "memory": 4096,
                      "tags": "prod;web", "description": "test VM"}}
RRD_HOUR = {"data": [
    {"time": 1700000000, "cpu": 0.12, "mem": 1234567890, "maxmem": 4294967296,
     "disk": 50, "maxdisk": 53687091200, "netin": 100, "netout": 200,
     "diskread": 50, "diskwrite": 60},
    {"time": 1700000060, "cpu": 0.15, "mem": 1300000000, "maxmem": 4294967296,
     "disk": 50, "maxdisk": 53687091200, "netin": 110, "netout": 210,
     "diskread": 55, "diskwrite": 65},
]}
POOL_GUI_TEAM_42 = {"data": {"comment": "team 42 pool",
    "members": [
        {"vmid": 100, "node": "pve-01", "type": "qemu", "id": "qemu/100"},
        {"vmid": 101, "node": "pve-02", "type": "qemu", "id": "qemu/101"},
        {"vmid": 200, "node": "pve-01", "type": "lxc",  "id": "lxc/200"},
    ]}}
```
Note: keep the existing `VERSION_OK` and any tenant-bootstrap fixtures untouched.

Step 5 — tests. Append to `backend/tests/test_connector.py` tests for `list_resources()` happy path, cache-hit-no-extra-PVE-call, `get_vm_status` qemu vs lxc, `get_vm_config`, `set_vm_config` invalidates cache, `rrddata` timeframe validation, `pool_members` shape. Reuse FakeProxmox + `with patch("app.clusters.connector.ProxmoxAPI", return_value=fake)` pattern verbatim. Each test asserts `fake.calls[i] == ("expected.attribute.path", positional_args, kwargs)` to confirm we hit the right PVE endpoint.

Step 6 — `backend/tests/test_connector_cache.py` (NEW). Tests:
1. `test_list_resources_serves_from_cache_within_30s` — call twice; assert fake.calls only has 2 entries (one for vm, one for lxc — the second list_resources call is cache hit).
2. `test_list_resources_force_refresh_bypasses_cache` — call once, then with force_refresh=True; assert 4 PVE calls.
3. `test_breaker_opens_after_three_unreachable_failures` — make FakeProxmox raise `requests.ConnectionError` 3 times; 4th call must raise PVEUnreachable("breaker open"). Use `fake.queue_error("cluster.resources.get", requests.ConnectionError("boom"))` style; if the FakeProxmox helper doesn't support queued errors, extend it minimally inside the fixtures module to do so.
4. `test_breaker_open_with_stale_cache_returns_stale` — populate cache once; then queue errors; on next list_resources, assert (snapshot, True) returned without raising.
5. `test_auth_error_does_not_trip_breaker` — raise `proxmoxer.AuthenticationError` repeatedly; assert each call surfaces PVEAuthError and breaker fail_counter stays at 0 (introspect `connector._breaker.fail_counter`).
6. `test_concurrent_list_resources_only_fetches_once` — wrap 5 concurrent `asyncio.create_task(conn.list_resources())`; assert fake.calls length is exactly 2 (one vm + one lxc), not 10.

Step 7 — pyproject.toml exact line: `"pybreaker==1.4.1",` inserted after `"httpx==0.28.1",` in the `dependencies` list.

For the test `_make_fake({...})` calls the new tests do, ensure the responses dict maps attribute-chain strings to the data the chain returns. E.g. `"cluster.resources.get"` → list (NOT wrapped in `{"data": ...}` because proxmoxer 2.x already unwraps `data`). Validate by reading the FakeProxmox impl in `backend/tests/fixtures/pve_responses.py`; mirror existing fixtures' wrapping conventions.
  </action>
  <verify>
    <automated>cd backend && uv sync && uv run pytest tests/test_connector.py tests/test_connector_cache.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "pybreaker==1.4.1" backend/pyproject.toml` returns exactly 1 line.
    - `grep -nE "class ResourceCache" backend/app/clusters/connector.py` returns exactly 1 match.
    - `grep -nE "async def list_resources|async def get_vm_status|async def get_vm_config|async def set_vm_config|async def rrddata|async def pool_members|async def _call_with_breaker" backend/app/clusters/connector.py` returns exactly 7 matches.
    - `grep -n "pybreaker.CircuitBreaker(" backend/app/clusters/connector.py` returns at least 1 match.
    - `grep -n "exclude=\[PVEAuthError\]" backend/app/clusters/connector.py` returns 1 match (auth-error breaker exemption — non-negotiable).
    - `grep -nE "self\._resource_cache\.snapshot = None" backend/app/clusters/connector.py` returns at least 1 match (cache invalidate after set_vm_config).
    - `grep -nE "asyncio\.to_thread" backend/app/clusters/connector.py` shows ≥ 2 matches (existing `_call` + new `_call_with_breaker`).
    - `cd backend && uv run pytest tests/test_connector.py tests/test_connector_cache.py -x` exits 0.
    - test_connector_cache.py contains all 6 listed test function names: `grep -nE "def (test_list_resources_serves_from_cache_within_30s|test_list_resources_force_refresh_bypasses_cache|test_breaker_opens_after_three_unreachable_failures|test_breaker_open_with_stale_cache_returns_stale|test_auth_error_does_not_trip_breaker|test_concurrent_list_resources_only_fetches_once)" backend/tests/test_connector_cache.py` returns exactly 6 matches.
  </acceptance_criteria>
  <done>
    - All Phase-1 PVEConnector methods preserved unchanged; existing Phase 1 tests still pass.
    - Six new methods callable through `_call_with_breaker`; auth errors documented as breaker-excluded.
    - ResourceCache + asyncio.Lock thundering-herd protection covered by a regression test.
    - pybreaker pinned to 1.4.1; `uv sync` installs it cleanly.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend PVEConnectorRegistry with get_for_team(); add health probe module + lifespan wiring</name>
  <files>backend/app/clusters/registry.py, backend/app/clusters/health.py, backend/app/main.py, backend/tests/test_registry_for_team.py, backend/tests/test_health_probe.py</files>
  <read_first>
    - backend/app/clusters/registry.py (full Phase 1 file — ADD new method, keep existing `get()` + `invalidate()` + `clear_all()` unchanged)
    - backend/app/models/team_cluster_token.py (TeamClusterToken schema; UNIQUE(team_id, cluster_id))
    - backend/app/main.py (Phase 1 lifespan — registry is built on app.state; ADD probe task management here)
    - backend/tests/test_tenant_bootstrap.py (existing patterns for FakeProxmox + per-team-token DB rows)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md §Pattern 2 (per-cluster health probe — verbatim implementation)
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-PATTERNS.md §`backend/app/clusters/registry.py` extension guidance
    - .planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md Pitfall 8 (personal-team-token availability — Plan 01-06 mints tokens for all teams including personal; verify before failing)
  </read_first>
  <behavior>
    - registry.get_for_team(cluster_id=10, team_id=42, db=session) on first call SELECTs team_cluster_tokens row by (team_id=42, cluster_id=10), builds a PVEConnector with token_user=row.userid, token_name=row.tokenid, token_value=row.token_secret (decrypted by EncryptedSecret TypeDecorator). Caches by (42, 10) key.
    - Second call with same (team_id, cluster_id) returns the cached connector without DB hit.
    - Missing row → raises LookupError(f"no team_cluster_tokens row for team={team_id} cluster={cluster_id}").
    - invalidate_for_team(team_id, cluster_id) drops the (team_id, cluster_id) entry.
    - registry.start_probe(connector, cluster_id, *, interval=15.0) spawns an asyncio.Task that calls connector.version() every interval; updates connector.last_seen_healthy + connector.status + connector.last_error. Stored in `self._probes: dict[int, asyncio.Task]`.
    - registry.stop_probe(cluster_id) cancels + awaits the task.
    - registry.stop_all_probes() cancels every probe (called on app shutdown).
    - On startup (lifespan), AFTER the registry is built, iterate active clusters and start one probe per cluster (best-effort; if a single probe fails to start, log + continue).
    - On shutdown, stop_all_probes is awaited BEFORE engine.dispose().
  </behavior>
  <action>
Step 1 — `backend/app/clusters/registry.py`. KEEP existing __init__, get(), invalidate(), clear_all() unchanged. ADD:

```python
# AT TOP — extend imports
import asyncio
from app.models import TeamClusterToken
from sqlalchemy import select
```

Inside `__init__`, AFTER the existing `self._connectors: dict[int, PVEConnector] = {}`:
```python
self._team_connectors: dict[tuple[int, int], PVEConnector] = {}
self._probes: dict[int, asyncio.Task] = {}
```

Add method:
```python
async def get_for_team(
    self,
    *,
    cluster_id: int,
    team_id: int,
    db: AsyncSession | None = None,
) -> PVEConnector:
    """Return the per-team privsep connector for (team, cluster).

    UNIQUE(team_id, cluster_id) on team_cluster_tokens guarantees at most
    one row per pair. The Phase 1 D-02 auto-bootstrap mints a token row for
    every team (including personal teams) on every active cluster — so a
    missing row is a genuine error, not a "no quota yet" case.
    """
    key = (team_id, cluster_id)
    if key in self._team_connectors:
        return self._team_connectors[key]

    stmt = select(TeamClusterToken).where(
        TeamClusterToken.team_id == team_id,
        TeamClusterToken.cluster_id == cluster_id,
    )
    if db is not None:
        result = await db.execute(stmt)
    else:
        async with self._session_factory() as session:
            result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        raise LookupError(
            f"no team_cluster_tokens row for team={team_id} cluster={cluster_id}"
        )

    # We also need the Cluster row for host/port/verify_ssl/tls_fingerprint —
    # those live on clusters, not team_cluster_tokens.
    from app.models import Cluster
    if db is not None:
        cluster_row = await db.get(Cluster, cluster_id)
    else:
        async with self._session_factory() as session:
            cluster_row = await session.get(Cluster, cluster_id)
    if cluster_row is None:
        raise LookupError(f"cluster {cluster_id} not found")

    connector = PVEConnector(
        host=cluster_row.host,
        port=cluster_row.port,
        token_user=row.userid,
        token_name=row.tokenid,
        token_value=row.token_secret,
        verify_ssl=cluster_row.verify_ssl,
        tls_fingerprint=cluster_row.tls_fingerprint,
    )
    self._team_connectors[key] = connector
    return connector

def invalidate_for_team(self, *, team_id: int, cluster_id: int) -> None:
    """Drop the cached per-team connector (no-op if absent)."""
    self._team_connectors.pop((team_id, cluster_id), None)
```

Extend `clear_all()`:
```python
def clear_all(self) -> None:
    """Drop every cached connector — useful for tests."""
    self._connectors.clear()
    self._team_connectors.clear()
    # NOTE: probe tasks must be stopped via stop_all_probes() separately —
    # asyncio cancellation needs an awaitable context.
```

Add probe management methods on the registry class (so a single object owns connector cache + probe lifecycle):
```python
async def start_probe(
    self,
    cluster_id: int,
    *,
    db: AsyncSession | None = None,
    interval: float = 15.0,
) -> None:
    """Spawn a background asyncio.Task probing /version every `interval`s.

    No-op if a probe already runs for `cluster_id`.
    """
    if cluster_id in self._probes:
        return
    from app.clusters.health import health_probe_loop
    connector = await self.get(cluster_id, db=db)
    task = asyncio.create_task(
        health_probe_loop(connector, interval=interval),
        name=f"pve-probe-{cluster_id}",
    )
    self._probes[cluster_id] = task

async def stop_probe(self, cluster_id: int) -> None:
    """Cancel + await the probe for `cluster_id` (no-op if absent)."""
    task = self._probes.pop(cluster_id, None)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

async def stop_all_probes(self) -> None:
    """Cancel + await every probe — used in app shutdown + test teardown."""
    for cluster_id in list(self._probes.keys()):
        await self.stop_probe(cluster_id)
```

Step 2 — `backend/app/clusters/health.py` (NEW):
```python
"""Per-cluster background health probe (Pattern 2 in 02-RESEARCH.md).

Polls GET /version every `interval` seconds and updates the connector's
last_seen_healthy / last_error / status fields. Owned by the registry; the
registry's start_probe / stop_probe / stop_all_probes manage task lifecycle.
"""

from __future__ import annotations

import asyncio
import time

from app.clusters.connector import PVEConnector
from app.clusters.errors import PVEAPIError, PVEAuthError, PVEUnreachable


async def health_probe_loop(
    connector: PVEConnector,
    *,
    interval: float = 15.0,
) -> None:
    """Forever loop. Cancellation via task.cancel() is the only exit path."""
    while True:
        try:
            await connector.version()
            connector.last_seen_healthy = time.monotonic()
            connector.last_error = None
            connector.status = "ok"
        except (PVEUnreachable, PVEAuthError, PVEAPIError) as exc:
            connector.last_error = str(exc)
            connector.status = "failed"
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — defensive; never let probe die silently
            connector.last_error = f"probe error: {exc}"
            connector.status = "failed"
        await asyncio.sleep(interval)
```

Step 3 — `backend/app/main.py` lifespan. AFTER the existing `app.state.registry = PVEConnectorRegistry(...)` block, BEFORE `yield`:
```python
    # Plan 02-01: spawn one background /version probe per registered cluster
    # so the UI's ClusterStatusPill reflects live reachability (CLUST-03).
    # Best-effort: a single bad cluster row must not block app startup.
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
```

In the `finally:` block, BEFORE `await engine.dispose()`:
```python
        try:
            await app.state.registry.stop_all_probes()
        except Exception:  # noqa: BLE001
            pass
```

Step 4 — `backend/tests/test_registry_for_team.py` (NEW). Tests:
1. `test_get_for_team_returns_connector_with_team_token` — seed cluster + team + team_cluster_tokens row via factories; call registry.get_for_team(cluster_id=..., team_id=..., db=session); assert returned connector's ProxmoxAPI was constructed with `user=row.userid, token_name=row.tokenid, token_value=row.token_secret`. Use `with patch("app.clusters.connector.ProxmoxAPI") as mock_api` to inspect the constructor kwargs.
2. `test_get_for_team_caches_by_team_cluster_pair` — call twice; assert second call has no new DB query (use `db_event_listener` or simpler: assert `result.scalar_one_or_none` was called once via a wrapper) OR assert the returned object identity is unchanged (`a is b`).
3. `test_get_for_team_missing_row_raises_lookuperror` — call without seeding the team_cluster_tokens row; assert `LookupError` with the expected message.
4. `test_invalidate_for_team_drops_entry` — call, then invalidate, then call again; assert a NEW connector identity is returned (different ProxmoxAPI constructor call count).

Step 5 — `backend/tests/test_health_probe.py` (NEW). Tests:
1. `test_health_probe_updates_status_on_success` — FakeProxmox with VERSION_OK; spawn `health_probe_loop(connector, interval=0.05)` task; wait 0.15s; cancel; assert `connector.status == "ok"` AND `connector.last_seen_healthy is not None` AND `connector.last_error is None`.
2. `test_health_probe_records_error_on_unreachable` — FakeProxmox raising `requests.ConnectionError`; same loop; assert `connector.status == "failed"` AND `connector.last_error` contains the error string.
3. `test_registry_start_probe_then_stop_probe` — start; assert task in `registry._probes`; stop; assert removed; assert task is cancelled.
4. `test_registry_stop_all_probes_cancels_every_task` — start 2 probes; stop_all; assert both cancelled and dict empty.

All tests use `asyncio.wait_for(asyncio.sleep(...), timeout=1.0)` patterns to avoid hangs; every spawned probe must be cancelled in a test fixture teardown OR explicitly.
  </action>
  <verify>
    <automated>cd backend && uv run pytest tests/test_registry_for_team.py tests/test_health_probe.py tests/test_connector.py tests/test_tenant_bootstrap.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "async def get_for_team|def invalidate_for_team|async def start_probe|async def stop_probe|async def stop_all_probes" backend/app/clusters/registry.py` returns exactly 5 matches.
    - `grep -n "self._team_connectors:" backend/app/clusters/registry.py` returns 1 match.
    - `grep -n "tuple\[int, int\]" backend/app/clusters/registry.py` returns at least 1 match (cache key type).
    - `grep -n "async def health_probe_loop" backend/app/clusters/health.py` returns 1 match.
    - `grep -n "connector.last_seen_healthy = time.monotonic()" backend/app/clusters/health.py` returns 1 match.
    - `grep -n "asyncio.CancelledError" backend/app/clusters/health.py` returns at least 1 match (cancellation re-raised).
    - `grep -n "stop_all_probes" backend/app/main.py` returns 1 match (called in lifespan finally).
    - `grep -n "start_probe" backend/app/main.py` returns at least 1 match.
    - `cd backend && uv run pytest tests/test_registry_for_team.py tests/test_health_probe.py -x` exits 0.
    - All pre-existing tests still pass: `cd backend && uv run pytest tests/test_connector.py tests/test_tenant_bootstrap.py -x` exits 0.
  </acceptance_criteria>
  <done>
    - registry.get_for_team works against seeded team_cluster_tokens rows and caches correctly.
    - health probe runs in background, updates connector.status / .last_seen_healthy / .last_error.
    - lifespan starts probes on boot for every active cluster and stops them on shutdown (no leaked tasks).
    - All Phase 1 connector + registry tests still green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| FastAPI → Proxmox VE | Backend → PVE over HTTPS; per-cluster API token credential crosses here. Phase 2 reads use per-team privsep tokens (D-01 from Plan 01-06). |
| Process boundary (in-RAM cache) | ResourceCache + breaker state are in-process; survive request boundaries but not restarts. |
| Async-thread boundary | asyncio.to_thread bridges sync proxmoxer → async FastAPI. pybreaker thread-safety is the load-bearing assumption (A3 in 02-RESEARCH). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01-01 | Information Disclosure | PVE token leaked through error message | mitigate | `PVEUnreachable("breaker open")` and exception translations in `_call_with_breaker` re-raise the existing Phase 1 exception types; the bootstrap token from cluster.api_token_secret is NEVER included in connector exception strings. Verified by reading exception translation block. |
| T-02-01-02 | Tampering | Stale cache served after team-membership revocation | accept | ResourceCache is per-cluster, not per-user. Cache returns ALL pool members the PVE token can see; per-request RBAC happens at the SERVICE layer (Plan 02-03 + 02-04), which re-evaluates membership on every request. Cache itself is a tenancy-neutral primitive. |
| T-02-01-03 | DoS | Probe loop thrashing on a broken cluster | mitigate | `interval=15.0` minimum; pybreaker `reset_timeout=30s` makes probe fail-fast when breaker is open; status writes are O(1) attribute assignments. Cancellation on shutdown verified by `test_registry_stop_all_probes_cancels_every_task`. |
| T-02-01-04 | Elevation of Privilege | get_for_team returns a connector built with the wrong team's token | mitigate | UNIQUE(team_id, cluster_id) on team_cluster_tokens (Plan 01-06) + cache key `(team_id, cluster_id)` (tuple) — wrong key cannot match a different team's row. Unit test `test_get_for_team_returns_connector_with_team_token` asserts the connector was constructed with the row's own userid/tokenid/token_secret. |
| T-02-01-05 | Tampering | CircuitBreakerError swallowed; bad cluster keeps receiving traffic | mitigate | `_call_with_breaker` maps CircuitBreakerError → PVEUnreachable; existing FastAPI exception handler in main.py returns 502 for PVEUnreachable. Tested by `test_breaker_opens_after_three_unreachable_failures`. |
| T-02-01-06 | Information Disclosure | Probe task leaks PVE host in app logs | accept | `connector.last_error = str(exc)` may include PVE host string. Logs go to stderr / structured logging only — never to API responses. Phase 5 polish ticket would scrub. |
| T-02-01-07 | DoS | Thundering herd on cache miss (N concurrent requests → N PVE calls) | mitigate | `ResourceCache.lock` (asyncio.Lock) serializes refresh; explicit regression test `test_concurrent_list_resources_only_fetches_once` asserts exactly 2 PVE calls (1 vm + 1 lxc) for 5 concurrent callers. |

All threats above are HIGH-or-LOWER severity; none are HIGH-and-Open. Phase 2 ASVS L1 floor satisfied for this plan's surface area.
</threat_model>

<verification>
- All Task 1 + Task 2 automated checks pass (pybreaker pinned; new connector methods + tests green; registry per-team-token resolution + health probe tests green).
- Pre-existing Phase 1 tests remain green: `cd backend && uv run pytest tests/test_connector.py tests/test_tenant_bootstrap.py tests/test_clusters.py tests/test_models_metadata.py -x` exits 0.
- `cd backend && uv run ruff check app/clusters/ tests/test_connector_cache.py tests/test_registry_for_team.py tests/test_health_probe.py` exits 0.
- Manual smoke (operator's call — Plan 02-07): `uvicorn app.main:app --reload` boots without errors; logs show "health probe started for cluster N" for each registered cluster.
</verification>

<success_criteria>
- pybreaker 1.4.1 installed; importable from connector.py.
- PVEConnector exposes 6 new methods + `_call_with_breaker` + ResourceCache dataclass + last_seen_healthy/last_error/status attributes.
- PVEConnectorRegistry exposes get_for_team + invalidate_for_team + start_probe/stop_probe/stop_all_probes.
- backend/app/clusters/health.py exists with health_probe_loop.
- main.py lifespan starts a probe per active cluster on boot and stops all on shutdown.
- Every new method has at least one unit test using FakeProxmox; cache + breaker + thundering-herd regressions all have dedicated tests.
- Auth errors are explicitly excluded from the breaker via `exclude=[PVEAuthError]`.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-01-connector-extension-SUMMARY.md` describing:
- What changed in connector.py / registry.py / main.py
- Decisions (e.g. why CircuitBreakerError → PVEUnreachable; cache-after-write invalidate strategy; probe interval default)
- Test count delta + which fixtures were added
- Any Pitfall 8 verification result (personal teams have team_cluster_tokens rows after Phase 1 bootstrap — confirmed/not)
</output>
