---
phase: 04-provisioning-networking-console
plan: 04
subsystem: provisioning-backend
tags: [provisioning, lxc-create, vm-create, migration, job-queue, multi-tenancy]
dependency_graph:
  requires:
    - "app.lifecycle.clone.reserve_vmid + enqueue_clone (Phase 3)"
    - "app.jobs.clone_migrate_functions._run_polled_job (Phase 3)"
    - "app.quotas.admission.check_and_preview (Phase 2)"
    - "app.clusters.registry.get_for_team + TeamClusterToken (Phase 1)"
  provides:
    - "POST /api/v1/clusters/{id}/provisioning/lxc — 202 + reserved vmid"
    - "POST /api/v1/clusters/{id}/provisioning/qemu — 202 + reserved vmid"
    - "connector.create_qemu / create_lxc / download_url / node_resources"
    - "run_create_qemu / run_create_lxc / run_download arq job functions"
    - "0006_phase4 migration — network_scope / catalog_pin / notification_seen"
    - "NetworkScope / CatalogPin / NotificationSeen ORM models"
    - "ProvisioningJobAcceptedResponse (vmid in the 202 body — D-04)"
  affects:
    - "backend/app/clusters/connector.py (shared — new methods)"
    - "backend/app/jobs/worker.py (shared — new job kinds registered)"
    - "backend/app/main.py (shared — provisioning router mounted)"
    - "backend/app/models/__init__.py (shared — 3 new model imports)"
tech_stack:
  added: []
  patterns:
    - "enqueue_create_* mirrors enqueue_clone: membership guard → connector → quota admission → reserve_vmid → resolve pool → enqueue → audit → commit"
    - "job functions supply only a _build dispatch closure to the shared _run_polled_job"
    - "clone source kinds (template-clone / vm-clone) delegate to clone.enqueue_clone, never duplicate it"
key_files:
  created:
    - backend/app/provisioning/__init__.py
    - backend/app/provisioning/schemas.py
    - backend/app/provisioning/service.py
    - backend/app/provisioning/routes.py
    - backend/app/jobs/provisioning_functions.py
    - backend/app/models/network_scope.py
    - backend/app/models/catalog_pin.py
    - backend/app/models/notification_seen.py
    - backend/alembic/versions/0006_phase4.py
    - backend/tests/test_provisioning.py
  modified:
    - backend/app/clusters/connector.py
    - backend/app/jobs/worker.py
    - backend/app/main.py
    - backend/app/models/__init__.py
    - backend/tests/conftest.py
    - backend/tests/test_schema_invariants.py
    - backend/tests/test_migrations.py
    - backend/tests/test_models_metadata.py
decisions:
  - "Provisioning routes name the owning team in the request body (team_id field); the service runs a cross-tenant membership guard because a create has no existing resource to resolve via require_resource_access"
  - "The qemu route resolves the clone source resource inline via inventory.access.resolve_resource (the provisioning URL has no {vmid} path param, so Depends(require_resource_access) is not usable)"
  - "enqueue_create_* returns (job, vmid) tuples — the route needs the reserved VMID for the 202 body (D-04); the clone path's newid is read back off the clone job payload"
  - "_resolve_team_pool reads TeamClusterToken.poolid directly (never reconstructs str(team_id)) — CLAUDE.md #7 / Pitfall 5+7 tenant-isolation invariant"
metrics:
  duration: ~9 min
  completed: 2026-05-16
  tasks: 2
  files: 18
  tests: 387 pass (17 new)
---

# Phase 4 Plan 04: Provisioning Backend Foundation Summary

Backend-only provisioning foundation: a 202-Accepted LXC/VM create API that
reserves the VMID, runs quota admission, joins each resource to the team's PVE
pool, and enqueues a UPID-polled arq job — plus the Phase-4 migration with
three new tables and the worker/router wiring that lets every later Phase-4
backend plan extend its own module without conflict.

## What Shipped

**Task 1 — connector + migration + models.** Four new `PVEConnector` methods
(`create_qemu`, `create_lxc`, `download_url`, `node_resources`), each routed
through `_call_with_breaker`; the three mutating creates clear the resource
cache, the `node_resources` read does not. Three ORM models —
`NetworkScope` (team-scoped, NET-02), `CatalogPin` (global config, D-06),
`NotificationSeen` (per-user cursor, D-23) — each carrying its
schema-invariant ALLOWLIST rationale. The `0006_phase4` migration creates all
three tables with explicitly-named constraints and round-trips cleanly
(`upgrade head` → `downgrade -1` → `upgrade head`).

**Task 2 — the provisioning module.** `provisioning/schemas.py` defines
`CreateLxcRequest` and the discriminated `CreateQemuRequest` (cloud-image /
blank-iso / template-clone / vm-clone), each with a `to_pve_config(pool=...)`
translation, plus `ProvisioningJobAcceptedResponse` (subclasses
`JobAcceptedResponse`, adds `vmid`). `provisioning/service.py` ships
`enqueue_create_lxc` / `enqueue_create_qemu` following the exact `enqueue_clone`
ordering — quota admission BEFORE the VMID reservation, the team pool read from
`TeamClusterToken.poolid`. The two clone source kinds delegate to the Phase-3
`clone.enqueue_clone`. `provisioning/routes.py` exposes both 202 endpoints with
`Depends(csrf_protect)`. Three arq job functions (`run_create_qemu`,
`run_create_lxc`, `run_download`) dispatch through the shared `_run_polled_job`;
the worker registers `vm.create.qemu` / `lxc.create` / `storage.download` with
`max_tries=1`; `main.py` mounts the router.

## Must-Haves Verification

- A user can POST a plain-LXC create and receive 202 + a job id + the reserved
  VMID — `test_create_lxc_returns_202_with_vmid` (vmid 150 in the body).
- A user can POST a VM create (cloud-init image) and receive 202 + job id +
  reserved VMID — `test_create_qemu_cloud_image_returns_202_with_vmid`.
- Every create runs quota admission before reserving the VMID, and the new
  resource joins the team's PVE pool — `test_create_rejected_when_quota_exceeded`
  (409) + `test_create_payload_carries_team_pool` (config carries `pool=`).
- The arq worker creates the VM/LXC via a UPID-polled job and audits the
  outcome — `run_create_*` route through `_run_polled_job`
  (`test_run_create_qemu_dispatches_through_polled_job`).
- The 0006_phase4 migration creates the three new tables —
  `test_0006_phase4_creates_new_tables` + `test_0006_phase4_round_trips`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exact-table-set assertions broke on the new tables**
- **Found during:** Task 1
- **Issue:** `test_migrations.py::test_upgrade_head_creates_all_business_tables`
  and `test_models_metadata.py::test_metadata_has_exactly_all_business_tables`
  assert the business-table set *exactly* — adding three Phase-4 tables fails
  both.
- **Fix:** Added `network_scope` / `catalog_pin` / `notification_seen` to both
  expected sets and bumped the metadata count assertion 12 → 15.
- **Files modified:** `backend/tests/test_migrations.py`,
  `backend/tests/test_models_metadata.py`
- **Commit:** d58965c

**2. [Rule 3 - Blocking] VMID reservation state leaked across tests**
- **Found during:** Task 2
- **Issue:** `clone._reserved` is a module-level per-cluster reserved set
  (single-process design, Pitfall 1). The in-memory test DB resets per test so
  `cluster.id` autoincrement restarts at 1 — a VMID reserved by one test still
  appeared live to the next test on `cluster_id=1`, shifting the allocated id
  (150 → 151) and producing a false-positive assertion failure.
- **Fix:** Added an autouse `_reset_vmid_reservations` conftest fixture that
  clears `clone._reserved` + `clone._cluster_locks` between tests — same
  rationale as the existing `_reset_rate_limit_buckets` fixture (the harness
  owns isolation, not the production module).
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** 41825ed

No deviations affected production behaviour — both fixes are test-harness
isolation corrections.

## Threat Model Compliance

- T-04-04-01 (cross-tenant provisioning) — `_require_team_membership` raises
  403 for a team the principal is not a member of; verified by
  `test_create_cross_tenant_team_returns_403`. Clone source kinds additionally
  go through `resolve_resource` (403 on cross-tenant source).
- T-04-04-02 (quota TOCTOU) — `run_quota_admission_for_request` runs the
  row-locked `check_and_preview` (BEGIN IMMEDIATE) BEFORE the VMID is reserved.
- T-04-04-03 (VMID race) — `reserve_vmid` reused verbatim (per-cluster lock +
  60s reserved set).
- T-04-04-05 (pool scoping) — `to_pve_config()` always carries
  `pool=<TeamClusterToken.poolid>`; verified by
  `test_create_payload_carries_team_pool`.

No new threat surface beyond the plan's `<threat_model>` was introduced.

## Notes for Later Phase-4 Plans

- `run_download` (`storage.download`) ships now but is enqueued by Plan 04-05
  (ISO / cloud-image downloads).
- `node_resources` provides the VM-09/VM-10 node-fit backend half — the wizard
  frontend plans consume it.
- The three new tables exist for later backend plans: `network_scope`
  (Plan 04-networks), `catalog_pin` (Plan 04-catalog), `notification_seen`
  (Plan 04-notifications).
- `provisioning/cloudinit.py` (VM-05/06/07 — effective-config render +
  validator) is NOT in this plan — it is a later Phase-4 plan.

## Self-Check: PASSED

All created files exist; all three task commits are in `git log`.
