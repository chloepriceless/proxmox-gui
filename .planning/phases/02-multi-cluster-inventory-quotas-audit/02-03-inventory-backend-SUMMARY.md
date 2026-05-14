---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 03
subsystem: inventory
tags: [inventory, rbac, audit, rrd, tags, notes, tdd]
dependency_graph:
  requires: [02-01-connector-extension, 02-02-audit-schema-writer]
  provides: [inventory-read-api, inventory-write-api, rbac-resolve-resource]
  affects: [02-04-quotas-backend, 02-05-frontend-inventory]
tech_stack:
  added: []
  patterns:
    - pool-match defense-in-depth (RBAC TENT-06 mitigation)
    - commit-before-raise (audit-on-failure discipline)
    - stale-cache graceful degradation (circuit breaker open path)
    - token-scrub before audit persistence
    - queue_response FakeProxmox pattern for dual-call list_resources
key_files:
  created:
    - backend/app/inventory/__init__.py
    - backend/app/inventory/schemas.py
    - backend/app/inventory/rrd.py
    - backend/app/inventory/access.py
    - backend/app/inventory/service.py
    - backend/app/inventory/routes.py
    - backend/tests/test_inventory_access.py
    - backend/tests/test_inventory_list.py
    - backend/tests/test_inventory_detail.py
    - backend/tests/test_inventory_rrd.py
    - backend/tests/test_inventory_tags.py
    - backend/tests/test_inventory_notes.py
  modified:
    - backend/app/main.py
    - backend/tests/fixtures/pve_responses.py
decisions:
  - id: D-INV-01
    description: "resolve_resource returns 403 (not 404) whether VM doesn't exist or belongs to a different tenant — avoids cross-tenant existence leaks (T-02-03-01)"
  - id: D-INV-02
    description: "config.put for tags/description does NOT return a UPID — confirmed by PVE API contract, so no job queue needed for these micro-mutations (per Assumption A2 in 02-RESEARCH)"
  - id: D-INV-03
    description: "actor_pat_id propagation deferred — Principal does not yet expose pat_id; audit rows have actor_pat_id=NULL for PAT-auth tag/notes writes; tracked as Phase 3 follow-up"
  - id: D-INV-04
    description: "FakeProxmox queue_response pattern established for tests needing different responses per call (type=vm call gets VMs, type=lxc call gets empty list)"
metrics:
  duration_minutes: 90
  completed_date: "2026-05-14"
  tasks_completed: 2
  tests_added: 28
  files_created: 12
  files_modified: 2
---

# Phase 02 Plan 03: Inventory Backend Summary

Inventory read/write API with per-team privsep RBAC, stale-cache awareness, audit on every mutation, and token-scrubbing — pool-match defense-in-depth enforced both at list and per-resource access layers.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 RED | Failing tests: access, list, detail, rrd | `27be3df` | test_inventory_access.py, test_inventory_list.py, test_inventory_detail.py, test_inventory_rrd.py |
| 1 GREEN | Schemas, RBAC access dep, RRD util, read service | `e76e070` | inventory/schemas.py, access.py, rrd.py, service.py (read path) |
| 2 RED | Failing tests: tags routes, notes routes | `bc0024f` | test_inventory_tags.py, test_inventory_notes.py |
| 2 GREEN | Inventory routes, write service, main.py wiring | `bd97b55` | inventory/routes.py, service.py (write path), main.py, pve_responses.py |

## Architecture

### resolve_resource / require_resource_access

```python
@dataclass
class ResolvedResource:
    cluster: Cluster
    team_id: int
    poolid: str
    connector: PVEConnector
    vm_item: dict       # raw /cluster/resources row
    is_stale: bool
```

Used as `Depends(require_resource_access)` on all per-VM routes. Queries user's `TeamMembership` rows, then `TeamClusterToken` rows for the given cluster, then iterates connector snapshots asserting `vm_item.pool == tok.poolid` (defense-in-depth per T-02-03-04).

### Endpoints Delivered

| Route | Method | Auth |
|-------|--------|------|
| `/api/v1/me/inventory` | GET | cookie or Bearer PAT |
| `/api/v1/clusters/{id}/inventory` | GET | cookie or Bearer PAT |
| `/api/v1/clusters/{id}/vms/{vmid}` | GET | cookie or Bearer PAT |
| `/api/v1/clusters/{id}/lxcs/{vmid}` | GET | cookie or Bearer PAT |
| `/api/v1/clusters/{id}/vms/{vmid}/rrd` | GET | cookie or Bearer PAT |
| `/api/v1/clusters/{id}/lxcs/{vmid}/rrd` | GET | cookie or Bearer PAT |
| `/api/v1/clusters/{id}/vms/{vmid}/tags` | PUT | cookie+CSRF or Bearer PAT |
| `/api/v1/clusters/{id}/lxcs/{vmid}/tags` | PUT | cookie+CSRF or Bearer PAT |
| `/api/v1/clusters/{id}/vms/{vmid}/notes` | PUT | cookie+CSRF or Bearer PAT |
| `/api/v1/clusters/{id}/lxcs/{vmid}/notes` | PUT | cookie+CSRF or Bearer PAT |

## Decisions Made

1. **D-INV-01 — 403 for existence leaks:** `resolve_resource` raises `HTTPException(403, "No access to that resource")` whether the VM doesn't exist OR belongs to a tenant the principal can't see. Differentiating would leak tenant existence.

2. **D-INV-02 — config.put does NOT return UPID:** Confirmed by PVE API contract that `PUT /nodes/{node}/qemu/{vmid}/config` for tag/description changes returns `null` (not a UPID task string). No job queue needed for these micro-mutations; the change is synchronous. This is consistent with Assumption A2 in 02-RESEARCH.md.

3. **D-INV-03 — actor_pat_id deferred:** `Principal` does not currently expose the PAT row id. Audit rows for PAT-authenticated tag/notes writes have `actor_pat_id=NULL`. The user identity (`actor_user_id`) is correct. Phase 3 should add `pat_id: int | None` to `Principal` and plumb it through `audit_write`. Tracked in deferred-items.

4. **D-INV-04 — FakeProxmox queue_response:** `PVEConnector.list_resources()` calls `cluster.resources.get` twice (type=vm, then type=lxc). Tests use `fake.queue_response("cluster.resources.get", vm_list)` + `fake.queue_response("cluster.resources.get", [])` to give each call the correct slice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong User model field names in test seed helpers**
- **Found during:** Task 1 RED (tests failed to seed data with AttributeError)
- **Issue:** Test seeds used `hashed_password` (nonexistent field) instead of `password_hash`, and omitted `username` (required). These were artifacts of incorrect field assumptions in test authoring.
- **Fix:** All seed helpers rewritten to use `User(username=..., email=..., password_hash=..., is_active=..., is_admin=...)` matching the actual ORM model.
- **Files modified:** All 6 test_inventory_*.py files
- **Commit:** `bd97b55`

**2. [Rule 1 - Bug] Duplicate inventory items from FakeProxmox dual-call pattern**
- **Found during:** Task 1 GREEN (test_list_inventory_for_cluster_filters_by_pool was returning 2 items instead of 1)
- **Issue:** `PVEConnector.list_resources()` calls `cluster.resources.get` twice (type=vm, type=lxc). The FakeProxmox default response-dict returned the same VM list for both calls, doubling items.
- **Fix:** Switched all list tests to `fake.queue_response()` pattern to give vm and lxc calls different responses.
- **Files modified:** test_inventory_list.py, test_inventory_detail.py, test_inventory_notes.py
- **Commit:** `bd97b55`

**3. [Rule 3 - Blocking] `app.state.registry` AttributeError in tests without lifespan**
- **Found during:** Task 2 RED (HTTP integration tests failed with AttributeError on `_get_registry`)
- **Issue:** Test harness doesn't run the FastAPI lifespan, so `app.state.registry` is never set. The plan's `access.py` template had a bare `return request.app.state.registry` with no fallback.
- **Fix:** Added the same fallback pattern used in `clusters/routes.py` to BOTH `access.py` and `routes.py`:
  ```python
  registry = getattr(request.app.state, "registry", None)
  if registry is None:
      from sqlalchemy.ext.asyncio import async_sessionmaker
      from app.core.db import engine
      registry = PVEConnectorRegistry(None, async_sessionmaker(engine, expire_on_commit=False))
      request.app.state.registry = registry
  ```
- **Files modified:** app/inventory/access.py, app/inventory/routes.py
- **Commit:** `bd97b55`

**4. [Rule 1 - Bug] Ruff F841 unused-variable assignments in 3 test files**
- **Found during:** Task 2 ruff check (ruff --fix resolved 15/18 issues automatically)
- **Issue:** 3 F841 violations (assigned result of async calls to variables then never used) that ruff --fix couldn't handle: `resolved_ok = await resolve_resource(...)`, `cluster_id_2 = cluster2.id`, `user_other = await make_user(...)`
- **Fix:** Converted to bare `await` calls or removed unused variable bindings.
- **Files modified:** test_inventory_access.py, test_inventory_list.py, test_inventory_tags.py
- **Commit:** `bd97b55`

## Known PAT Propagation Gap

`actor_pat_id` in `AuditLog` is always `NULL` for PAT-authenticated tag/notes writes in this plan. The `Principal` dataclass doesn't expose the underlying `PAT` row id. The existing `test_put_tags_pat_auth_bypasses_csrf` test verifies that PAT auth bypasses CSRF and the audit row has the correct `actor_user_id` — but `actor_pat_id` is unchecked.

**Resolution path:** In Phase 3, extend `Principal` with `pat_id: int | None` and propagate it through all service calls to `audit_write`. This is a documentation gap, not a security gap (user identity is correct).

## Threat Mitigations Verified

| Threat ID | Status | Verification |
|-----------|--------|-------------|
| T-02-03-01 | Mitigated | `test_resolve_resource_403_when_pool_mismatch` — 403 with same body for both cross-tenant and nonexistent VM |
| T-02-03-02 | Mitigated | `test_list_inventory_for_cluster_filters_by_pool` — pool filter applied after per-team token fetch |
| T-02-03-03 | Mitigated | `test_put_tags_invalid_regex_returns_422_no_audit` — PVE_TAG_RE blocks XSS-capable characters |
| T-02-03-04 | Mitigated | Pool-match assertion in `resolve_resource` even when connector returned item |
| T-02-03-05 | Accepted | No rate limiting in Phase 2; tracked for Phase 5 |
| T-02-03-06 | Mitigated | `test_put_tags_pve_unreachable_returns_502_and_audits_failure` — asserts `PVEAPIToken=` absent from error |
| T-02-03-08 | Mitigated | Both success+failure paths call audit_write; tests verify both |
| T-02-03-10 | Mitigated | extract_source_ip from Plan 02-02 honors XFF only from loopback |

## Test Results

```
249 total passing (221 pre-plan + 28 new)
ruff check app/inventory/ tests/test_inventory_*.py — All checks passed!
```

## Known Stubs

None. All endpoints return live data from PVEConnector (or stale cache with `is_stale=True`). No hardcoded empty values flow to responses.

## Self-Check: PASSED

- [x] `backend/app/inventory/routes.py` exists
- [x] `backend/app/inventory/service.py` exists
- [x] `backend/app/inventory/access.py` exists
- [x] `backend/app/inventory/schemas.py` exists
- [x] `backend/app/inventory/rrd.py` exists
- [x] Commits `27be3df`, `e76e070`, `bc0024f`, `bd97b55` all present in git log
- [x] 249 tests passing
- [x] ruff clean
