---
phase: 04-provisioning-networking-console
plan: 16
subsystem: api
tags: [proxmox, node-fit, fastapi, sveltekit, vm-provisioning]

# Dependency graph
requires:
  - phase: 04-provisioning-networking-console
    provides: "node-fit.ts / NodeSelect.svelte / computeNodeFit (04-12) — the node-fit UI + logic this plan supplies live data to"
  - phase: 04-provisioning-networking-console
    provides: "connector.node_resources() — the /cluster/resources?type=node connector read this route exposes"
provides:
  - "GET /api/v1/clusters/{id}/nodes/resources — per-node free CPU cores + free RAM MB"
  - "NodeResourceItem backend schema with byte→MB / load-fraction→free-cores unit math"
  - "service.list_node_resources — registry-driven cluster-admin node-capacity read"
  - "api.clusters.getNodeResources frontend API call"
  - "create wizard clusterNodes populated with live free figures (VM-10 node-fit hint now fires)"
affects: [provisioning, create-wizard, node-fit, phase-05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cluster-scoped READ route behind get_current_principal (non-admin) — distinct from the admin-gated cluster CRUD"
    - "Frontend $effect graceful degradation: a secondary fetch wrapped in its own .catch so its failure never empties primary state"

key-files:
  created: []
  modified:
    - backend/app/clusters/schemas.py
    - backend/app/clusters/service.py
    - backend/app/clusters/routes.py
    - backend/tests/test_clusters.py
    - frontend/src/lib/api/types.ts
    - frontend/src/lib/api/clusters.ts
    - frontend/src/routes/create/+page.svelte
    - frontend/tests/node-fit.test.ts

key-decisions:
  - "Route uses registry.get cluster-admin connector (not _build_transient_connector) — per plan interface note; the cluster-admin connector can always enumerate cluster-wide node capacity"
  - "node-resources fetch is wrapped in its own .catch inside the wizard $effect — a failure degrades node-fit to fit-unknown rather than blocking the wizard"

patterns-established:
  - "Non-admin cluster-scoped read route: GET behind get_current_principal, no csrf, no 202 — mirrors list_backup_storages posture but readable by regular users"
  - "Secondary-fetch graceful degradation in a Svelte $effect: inner .catch(() => null) keeps the primary state populated"

requirements-completed: [VM-10]

# Metrics
duration: 9min
completed: 2026-05-16
---

# Phase 4 Plan 16: Node-Fit Data Route (VM-10) Summary

**GET /clusters/{id}/nodes/resources exposes live per-node free CPU/RAM and the create wizard now feeds it into computeNodeFit so the "won't fit on node-X" hint fires against real cluster capacity.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-16T23:12:54Z
- **Completed:** 2026-05-16T23:21:33Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `GET /api/v1/clusters/{cluster_id}/nodes/resources` — a cluster-scoped read, behind the standard authenticated principal (non-admin), exposing each node's free CPU cores and free RAM MB derived from `connector.node_resources()`.
- `NodeResourceItem` schema performs the unit math the route needs: PVE's 0-1 `cpu` load fraction → free cores (`maxcpu * (1 - cpu)`), and `maxmem`/`mem` bytes → free RAM MB (floored).
- `service.list_node_resources` obtains the cluster-admin connector via `registry.get(cluster_id, db=db)` and returns the raw `/cluster/resources?type=node` rows for the route to map.
- Frontend `api.clusters.getNodeResources` call + `NodeResourceApi` type mirroring the backend JSON.
- Rewired the create wizard's `clusterNodes` `$effect` to merge live `free_cpu`/`free_ram_mb` figures into `clusterNodes` — `computeNodeFit` now fires the VM-10 "won't fit on node-X" hint with real data instead of always returning fit-unknown.
- Preserved graceful degradation: a node-resources fetch failure (breaker open / PVE unreachable) leaves `clusterNodes` populated with `null` free figures — node-fit stays advisory, the wizard still works.

## Task Commits

Each task was committed atomically (TDD — test commit then implementation commit for Task 1):

1. **Task 1 (RED): failing tests for node-resources route** - `f514b4e` (test)
2. **Task 1 (GREEN): GET /clusters/{id}/nodes/resources route** - `00bff62` (feat)
3. **Task 2: wire create wizard node-fit to live node-resources** - `9705f8a` (feat)

_Task 2 followed TDD test-first but its new tests exercise the already-shipped `computeNodeFit`/`allBlocked` pure functions, so they passed immediately; they were committed together with the implementation as a single feat commit (the genuinely new code — the API call + type + `$effect` rewire — is verified by `svelte-check`). Plan metadata commit follows this SUMMARY._

## Files Created/Modified

- `backend/app/clusters/schemas.py` - Added `NodeResourceItem` (free_cpu / free_ram_mb / status + `from_pve` unit-math classmethod).
- `backend/app/clusters/service.py` - Added `list_node_resources` (registry-driven cluster-admin node-capacity read).
- `backend/app/clusters/routes.py` - Added `GET /{cluster_id}/nodes/resources` behind `get_current_principal`; imported `get_current_principal` and `NodeResourceItem`.
- `backend/tests/test_clusters.py` - Added 5 route tests (shape, unit math, offline node, 401 unauthenticated, non-admin allowed).
- `frontend/src/lib/api/types.ts` - Added `NodeResourceApi` type.
- `frontend/src/lib/api/clusters.ts` - Added `getNodeResources()` API call.
- `frontend/src/routes/create/+page.svelte` - Rewired the `clusterNodes` `$effect` to fetch + merge live free figures; replaced the now-false "no node-free-resource API in Phase 4" comment.
- `frontend/tests/node-fit.test.ts` - Added 4 tests proving the live-data path (won't-fit verdict, all-blocked, degraded fit-unknown, partial-merge).

## Decisions Made

- **Cluster-admin connector via `registry.get`:** the route uses `registry.get(cluster_id, db=db)` rather than `service.list_backup_storages`'s `_build_transient_connector` — the plan's interface note specified this; `/cluster/resources` is always enumerable by the cluster-admin connector and `registry.get` is the documented per-cluster connector accessor.
- **Inner `.catch` for graceful degradation:** the `getNodeResources` call inside the wizard `$effect` is wrapped in `.catch(() => null)` so a resources-fetch failure does not reject the outer inventory promise — `clusterNodes` stays populated (with `null` free figures) and node-fit degrades to fit-unknown.

## Deviations from Plan

None - plan executed exactly as written. The plan's verify commands reference `backend/venv`; per the execution context this repo's venv is at `backend/.venv` and that substitution was applied (an environment note, not a plan deviation).

## Issues Encountered

- **Connector caching in route tests:** `register_cluster` starts a health probe that calls `registry.get`, caching a connector wired to the registration-time `FakeProxmox`. The node-resources GET runs under a different `FakeProxmox` patch, so the cached connector returned an empty result. Resolved by invalidating the registry cache for the cluster id after registration in the test helper (`registry.invalidate(cid)`), forcing `registry.get` to rebuild against the resources fake.
- **httpx cookie-jar persistence:** the test `AsyncClient` persists login cookies in its jar, so the "unauthenticated → 401" test still carried the admin session. Resolved by calling `client.cookies.clear()` before the anonymous request.

## Deferred Issues

- **`test_jwt.py::test_decode_tampered_signature_raises` is flaky** (passes ~2/3 runs). The test flips the last base64 char of a JWT signature segment expecting decode to fail; the last char encodes only a few significant bits, so flipping it can yield an equivalent decoded signature and the token still validates. This is a **pre-existing** test bug in a file untouched by this plan (`test_jwt.py` / `app/auth/jwt.py`) — out of scope per the scope boundary. Logged to `deferred-items.md`. Suggested fix: tamper a byte that materially changes the signature.

## Verification Results

- **Backend full suite:** `python -m pytest -q` → **489 passed, 1 failed** (`test_decode_tampered_signature_raises` — flaky, pre-existing, unrelated; see Deferred Issues). 489 passed exceeds the ≥485 floor.
- **`test_clusters.py`:** 26 passed (21 pre-existing + 5 new node-resources tests).
- **Unit-math assertion:** confirmed — for `maxcpu=8, cpu=0.25` → `free_cpu == 6.0`; for `maxmem=16 GiB, mem=4 GiB` → `free_ram_mb == 12288`.
- **Frontend tests:** `pnpm test` → **364 passed** (full suite; node-fit suite includes the 4 new live-data-path tests).
- **`pnpm exec svelte-check --threshold error`:** **0 errors, 0 warnings** across 2901 files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VM-10 node-fit hint is now end-to-end functional with live cluster data — ROADMAP success criterion 3 ("node-fit hints, e.g. won't fit on node-1") is satisfied.
- Phase-5 / human-verify item remains: in the Create wizard, request RAM exceeding a node's free RAM and confirm that node is disabled in `NodeSelect` with a "won't fit" reason.
- The flaky `test_jwt.py` test should be repaired in a future polish/hardening pass (Phase 5) — tracked in `deferred-items.md`.

## Self-Check: PASSED

- FOUND: `backend/app/clusters/routes.py` contains `nodes/resources`
- FOUND: `backend/app/clusters/schemas.py` contains `class NodeResourceItem`
- FOUND: `backend/app/clusters/service.py` contains `def list_node_resources`
- FOUND: `frontend/src/lib/api/clusters.ts` contains `getNodeResources`
- FOUND: `frontend/src/routes/create/+page.svelte` calls `getNodeResources`
- FOUND: commit `f514b4e` (RED — failing tests)
- FOUND: commit `00bff62` (GREEN — node-resources route)
- FOUND: commit `9705f8a` (Task 2 — wizard node-fit wiring)

## TDD Gate Compliance

Task 1 followed the RED → GREEN gate: `test(04-16)` commit `f514b4e` (5 failing
route tests, confirmed 404) precedes the `feat(04-16)` commit `00bff62`. No
REFACTOR commit was needed. Task 2's new tests exercise already-shipped pure
functions (`computeNodeFit`/`allBlocked`) so a separate RED commit would have
been a no-op; the genuinely new Task 2 code is type-checked by `svelte-check`.

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
