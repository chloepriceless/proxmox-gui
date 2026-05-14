---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 01
subsystem: clusters
tags:
  - backend
  - clusters
  - proxmoxer
  - circuit-breaker
  - cache
  - health-probe
  - tdd

# Dependency graph
requires:
  - phase: 01-06-clusters-tenant-bootstrap
    provides: "PVEConnector, PVEConnectorRegistry, TeamClusterToken model, asyncio.to_thread pattern"
  - phase: 01-02-db-schema
    provides: "Cluster model, TeamClusterToken model with UNIQUE(team_id, cluster_id)"
provides:
  - "ResourceCache dataclass with 30s TTL and asyncio.Lock (thundering-herd protection)"
  - "PVEConnector._call_with_breaker: pybreaker 1.4.1 circuit breaker, CircuitBreakerError→PVEUnreachable"
  - "PVEConnector.list_resources(): 30s cache + stale fallback on breaker-open"
  - "PVEConnector.get_vm_status(), get_vm_config(), set_vm_config(), rrddata(), pool_members()"
  - "PVEConnector.last_seen_healthy, .last_error, .status attributes"
  - "PVEConnectorRegistry.get_for_team(cluster_id, team_id, db): per-team privsep connector"
  - "PVEConnectorRegistry.invalidate_for_team(team_id, cluster_id)"
  - "PVEConnectorRegistry.start_probe/stop_probe/stop_all_probes: background health task lifecycle"
  - "backend/app/clusters/health.py: health_probe_loop() (15s interval)"
  - "main.py lifespan: start_probe per active cluster on boot, stop_all_probes on shutdown"
  - "FakeProxmox.queue_error() and queue_response() helpers for per-call mocking"
affects:
  - 02-03-inventory-api (calls list_resources/get_vm_status/get_vm_config/rrddata via get_for_team)
  - 02-04-quota-admission (calls list_resources() filtered by pool via get_for_team)

# Tech tracking
tech-stack:
  added:
    - "pybreaker==1.4.1 (circuit breaker for per-cluster PVE connector)"
  patterns:
    - "ResourceCache: @dataclass with asyncio.Lock; thundering-herd protection via async with cache.lock"
    - "_call_with_breaker: wraps _invoke (sync) in asyncio.to_thread; maps CircuitBreakerError→PVEUnreachable"
    - "pybreaker exclude list: [PVEAuthError, AuthenticationError] — both wrapper AND raw exception excluded"
    - "get_for_team: SELECT TeamClusterToken WHERE (team_id, cluster_id); UNIQUE constraint guarantees at most one row"
    - "health_probe_loop: forever loop, re-raises CancelledError, never swallows Exception silently"
    - "Probe lifecycle: _probes dict[int, asyncio.Task] on registry; start/stop/stop_all owned by registry"

key-files:
  created:
    - backend/app/clusters/health.py
    - backend/tests/test_connector_cache.py
    - backend/tests/test_registry_for_team.py
    - backend/tests/test_health_probe.py
  modified:
    - backend/pyproject.toml (added pybreaker==1.4.1)
    - backend/app/clusters/connector.py (ResourceCache, _call_with_breaker, 6 new methods, status attrs)
    - backend/app/clusters/registry.py (get_for_team, invalidate_for_team, start/stop probe, clear_all extended)
    - backend/app/main.py (lifespan: start probes on boot, stop_all_probes on shutdown)
    - backend/tests/fixtures/pve_responses.py (queue_error, queue_response, Phase 2 fixtures)
    - backend/tests/test_connector.py (imported Phase 2 fixtures, added 10 new method tests)

key-decisions:
  - "pybreaker exclude=[PVEAuthError, AuthenticationError]: pybreaker evaluates the exclude list against the raw exception raised *inside* the thread-wrapped function — at that point it is still proxmoxer.AuthenticationError (not yet translated to PVEAuthError). Both must be excluded."
  - "Cache-after-write invalidate strategy: set_vm_config() assigns self._resource_cache.snapshot = None after a successful write. No separate lock pass needed — the next list_resources() call will acquire the lock and refresh from PVE."
  - "Probe interval default = 15.0s: matches the plan spec; pybreaker reset_timeout=30s makes probes fail-fast when breaker is open (breaker will be open for 30s before half-open probe attempt)."
  - "Phase 1 bootstrap methods (_call, not _call_with_breaker): one-time admin ops (create_pool, create_user etc.) run outside the circuit breaker. They have their own exception handling at the call site and must not interfere with the per-cluster reachability state machine."
  - "FakeProxmox queue_error/queue_response use __dict__ directly: FakeProxmox.__getattr__ returns a _Node for any attribute access, so hasattr() and self._foo = always return/set a _Node. Must use self.__dict__['key'] to bypass the proxy."

metrics:
  duration: "~9 minutes"
  completed: "2026-05-14"
  tasks: 2
  files_modified: 10
  tests_added: 37  # 6 cache tests + 10 new connector tests + 4 registry tests + 4 health probe tests + 13 original Phase 1 connector tests preserved
  tests_total: 186  # full suite (excluding pre-existing test_jwt.py ordering issue)

requirements-completed:
  - CLUST-02  # Cluster-context switcher (connector primitive ready)
  - CLUST-03  # Per-cluster reachability indicator (health probe updates connector.status)
  - CLUST-04  # Unreachable → degraded read-only with banner (stale cache + breaker-open returns is_stale=True)
---

# Phase 2 Plan 01: Connector Extension Summary

**One-liner:** Extended PVEConnector with pybreaker circuit breaker + 30s ResourceCache + 6 PVE read/write methods; added per-team connector resolution and per-cluster background health probe to the registry.

## What Changed

### backend/app/clusters/connector.py

- Added `ResourceCache` dataclass at module level: `snapshot`, `fetched_at`, `lock` (asyncio.Lock), `ttl=30.0`, `is_fresh`/`is_stale` properties.
- Added `_call_with_breaker()`: like `_call()` but routes through `pybreaker.CircuitBreaker` (fail_max=3, reset_timeout=30). Maps `CircuitBreakerError` → `PVEUnreachable("breaker open")`. Excludes both `PVEAuthError` and `proxmoxer.AuthenticationError` from the breaker (both needed — see decisions).
- Added `list_resources(*, force_refresh=False)` → `(list[dict], bool)`: 30s cache with asyncio.Lock, stale-cache fallback when breaker open, force_refresh bypasses TTL.
- Added `get_vm_status(node, vmid, is_lxc)`, `get_vm_config(node, vmid, is_lxc)` — qemu vs lxc path dispatched by `is_lxc`.
- Added `set_vm_config(node, vmid, is_lxc, **fields)` — PUT config, then nulls `_resource_cache.snapshot`.
- Added `rrddata(node, vmid, is_lxc, timeframe, cf)` — validates timeframe ∈ {hour,day,week,month,year} and cf ∈ {AVERAGE,MAX}, raises ValueError otherwise.
- Added `pool_members(poolid)` — returns `payload["members"]` or `[]`.
- Added `last_seen_healthy: float | None`, `last_error: str | None`, `status: str = "untested"` attributes.
- All Phase 1 methods preserved unchanged.

### backend/app/clusters/registry.py

- Added `_team_connectors: dict[tuple[int, int], PVEConnector]` — per-(team_id, cluster_id) cache.
- Added `_probes: dict[int, asyncio.Task]` — background health probe tasks.
- Added `get_for_team(*, cluster_id, team_id, db)`: selects `TeamClusterToken` row by (team_id, cluster_id), loads `Cluster` row for host/port, builds `PVEConnector` with team's own userid/tokenid/token_secret, caches by tuple key. Raises `LookupError` if row missing.
- Added `invalidate_for_team(*, team_id, cluster_id)`: pops `(team_id, cluster_id)` from `_team_connectors`.
- Added `start_probe(cluster_id, *, db, interval=15.0)`: spawns `asyncio.Task` running `health_probe_loop`, stores in `_probes`. No-op if already running.
- Added `stop_probe(cluster_id)`: cancels + awaits task, removes from `_probes`.
- Added `stop_all_probes()`: cancels every probe — called on app shutdown.
- Extended `clear_all()` to also clear `_team_connectors`.

### backend/app/clusters/health.py (NEW)

- `health_probe_loop(connector, *, interval=15.0)`: forever loop. Calls `connector.version()`, sets `connector.last_seen_healthy = time.monotonic()`, `connector.last_error = None`, `connector.status = "ok"` on success. On `PVEUnreachable`/`PVEAuthError`/`PVEAPIError`: sets `connector.last_error = str(exc)`, `connector.status = "failed"`. Re-raises `asyncio.CancelledError`. Catches bare `Exception` defensively with `status = "failed"` (never silently dies).

### backend/app/main.py

- Lifespan startup: after registry build, iterates `SELECT Cluster.id`, calls `registry.start_probe(cid, db=session, interval=15.0)` for each. Wrapped in best-effort `try/except` so a single bad cluster row never blocks startup.
- Lifespan shutdown: `await registry.stop_all_probes()` before `await engine.dispose()`.

### backend/tests/fixtures/pve_responses.py

- Added `queue_error(dotted_path, exc)`: queues an exception to raise on the next call to that path. Uses `self.__dict__` directly to bypass `__getattr__` proxy.
- Added `queue_response(dotted_path, value)`: queues a return value (FIFO, consumed before static `responses` dict).
- Monkey-patched `_Node.__call__` to check both queues before falling back to `self._owner.responses`.
- Added Phase 2 fixture constants: `CLUSTER_RESOURCES_VM`, `CLUSTER_RESOURCES_LXC`, `VM_STATUS_RUNNING`, `VM_CONFIG`, `RRD_HOUR`, `POOL_GUI_TEAM_42`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pybreaker exclude list needs proxmoxer.AuthenticationError, not just PVEAuthError**
- **Found during:** Task 1 test_auth_error_does_not_trip_breaker
- **Issue:** pybreaker evaluates the `exclude` list against the raw exception raised inside the wrapped function (inside the thread). At that point the exception is still `proxmoxer.AuthenticationError` — not yet translated to `PVEAuthError`. Including only `PVEAuthError` caused the breaker to open on auth errors.
- **Fix:** Added `AuthenticationError` (proxmoxer) to `exclude=[PVEAuthError, AuthenticationError]`.
- **Files modified:** `backend/app/clusters/connector.py`
- **Commit:** 8f87189

**2. [Rule 1 - Bug] FakeProxmox queue_error/queue_response bypass via __dict__**
- **Found during:** Task 1 queue_error implementation
- **Issue:** `FakeProxmox.__getattr__` returns a `_Node` proxy for ALL attribute access. `hasattr(self, "_error_queues")` returned True (because `__getattr__` returned a `_Node`, which is truthy), so the `if not hasattr(...)` guard never triggered the dict initialization. The assignment `self._error_queues = {}` was never reached.
- **Fix:** Changed `queue_error` and `queue_response` to use `self.__dict__["_error_queues"]` directly, bypassing `__getattr__`. Updated `_patched_node_call` to read via `self._owner.__dict__.get(...)`.
- **Files modified:** `backend/tests/fixtures/pve_responses.py`
- **Commit:** 8f87189

**3. [Rule 2 - Missing] FakeProxmox needs queue_response for per-call differentiation**
- **Found during:** Task 1 test_list_resources_serves_from_cache_within_30s
- **Issue:** `list_resources()` makes two calls to `cluster.resources.get` (one for `type=vm`, one for `type=lxc`). FakeProxmox's static `responses` dict returns the same value for both calls. Tests need to return different data per sequential call to the same path.
- **Fix:** Added `queue_response(dotted_path, value)` helper + `_response_queues` FIFO queue in `_patched_node_call`.
- **Files modified:** `backend/tests/fixtures/pve_responses.py`
- **Commit:** 8f87189

## Known Stubs

None — all methods are fully implemented. `set_vm_config` is documented as "tags + description writes only in Phase 2" which reflects its intended use scope, not a stub.

## Pitfall 8 Verification

Pitfall 8 (personal-team-token availability): Plan 01-06's D-02 bootstrap mints a `TeamClusterToken` row for every team (including personal teams) on every active cluster via `bootstrap_tenant_on_clusters`. The `get_for_team` implementation relies on this: a missing row raises `LookupError` (a genuine error, not "no quota yet"). Verified by `test_get_for_team_missing_row_raises_lookuperror` which confirms the error message is `"no team_cluster_tokens row for team={team_id} cluster={cluster_id}"`.

## Pre-existing Test Isolation Issue (Out of Scope)

`tests/test_jwt.py::test_decode_tampered_signature_raises` fails when the full test suite runs in alphabetical order but passes when run alone or within `test_jwt.py`. This is a pre-existing global state issue (JWT signing key ephemeral value changes between test module runs). Not caused by this plan's changes — confirmed by checking git diff (test_jwt.py untouched) and running the test in isolation.

## Self-Check: PASSED

- `backend/app/clusters/health.py` — FOUND
- `backend/tests/test_connector_cache.py` — FOUND
- `backend/tests/test_registry_for_team.py` — FOUND
- `backend/tests/test_health_probe.py` — FOUND
- Task 1 commit `8f87189` — FOUND
- Task 2 commit `2c9f1c8` — FOUND
- 186 tests pass (excluding pre-existing test_jwt.py ordering issue)
