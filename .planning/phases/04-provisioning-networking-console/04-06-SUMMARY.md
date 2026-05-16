---
phase: 04-provisioning-networking-console
plan: 06
subsystem: provisioning-backend
tags: [community-scripts, catalog, lxc-provisioning, pct-exec, ssh, two-stage-job, job-queue]

requires:
  - phase: 04-provisioning-networking-console (Plan 04-04)
    provides: "connector.create_lxc, run_create_lxc, CatalogPin ORM model, 0006_phase4 migration, provisioning module (schemas/service/routes), enqueue ordering, reserve_vmid, run_quota_admission_for_request"
  - phase: 04-provisioning-networking-console (Plan 04-01)
    provides: "04-SPIKE-community-scripts.md — the pinned floor commit SHA, the pct-exec-over-SSH exec mechanism, the stage-2 install contract, the metadata field set"
  - phase: 03 (Job Queue & Lifecycle)
    provides: "_run_polled_job, dispatch_and_poll (UPID poller), _claim, _fail_job, publish_event, enqueue_job"
provides:
  - "GET /api/v1/clusters/{id}/catalog — curated shortlist (LXC-01) + searchable full catalog (LXC-02)"
  - "GET /api/v1/clusters/{id}/catalog/{slug} — single script detail + LXC-04 attribution"
  - "POST /api/v1/catalog/sync — admin catalog re-pin (D-05)"
  - "POST /api/v1/clusters/{id}/provisioning/community-script — 202 two-stage deploy (LXC-03)"
  - "connector.lxc_exec — SSH pct exec transport (the spike-confirmed in-container exec mechanism)"
  - "run_community_script — two-stage create+install arq job function"
  - "backend/app/catalog/snapshot.json — vendored community-scripts catalog floor (D-05)"
affects:
  - "Plan 04-12/04-13 (provisioning wizard frontend) — the Community-Script path consumes GET /catalog + POST /provisioning/community-script"
  - "Future SSH-using plans (networking/console) — connector now ships an SSH pct-exec transport"

tech-stack:
  added: []
  patterns:
    - "Catalog served from a vendored snapshot floor + a commit-pin row; admin sync re-pins the SHA, never the moving default branch (Pitfall 10)"
    - "run_community_script is the one provisioning job that is NOT a plain _run_polled_job — two stages: dispatch_and_poll create, then a synchronous lxc_exec install"
    - "connector.lxc_exec shells out to the OS ssh binary via subprocess (no Python SSH dependency); pct exec is a CLI command with no PVE REST endpoint"

key-files:
  created:
    - backend/app/catalog/__init__.py
    - backend/app/catalog/snapshot.json
    - backend/app/catalog/service.py
    - backend/app/catalog/routes.py
    - backend/tests/test_catalog.py
  modified:
    - backend/app/clusters/connector.py
    - backend/app/jobs/provisioning_functions.py
    - backend/app/jobs/worker.py
    - backend/app/provisioning/schemas.py
    - backend/app/provisioning/service.py
    - backend/app/provisioning/routes.py
    - backend/app/main.py

key-decisions:
  - "lxc_exec is SSH pct exec, NOT a proxmoxer REST call — POST .../lxc/{vmid}/status/exec returns 501 on PVE 9.1.2 (spike §3); implemented as an OS ssh-binary subprocess shell-out so no new Python SSH dependency is added"
  - "The catalog content (entry list) always comes from the vendored snapshot.json floor; sync_catalog re-pins only the commit SHA — D-05 deliberately keeps the GUI on a reviewed, trusted copy rather than refetching unreviewed upstream JSON"
  - "run_community_script runs ct/<slug>.sh's install-stage script (install/<slug>-install.sh) at the PINNED commit SHA, never main; the build.func env block is reproduced host-side and affirmative stdin clears the whiptail/read confirms (spike §2)"
  - "A stage-2 install failure marks the job failed but issues NO LXC delete — the user keeps the created-but-install-failed container (Pitfall 8 / threat T-04-06-05)"

patterns-established:
  - "ScriptEntry/CatalogData service objects wrap the snapshot JSON and stamp the LXC-04 attribution triple from the active pin"
  - "Two-stage arq job: stage 1 via dispatch_and_poll, re-open the job row to 'running', stage 2 synchronous lxc_exec with chunked output capture"

requirements-completed: [LXC-01, LXC-02, LXC-03, LXC-04]

duration: ~13min
completed: 2026-05-16
---

# Phase 4 Plan 06: Community-Scripts Catalog & Two-Stage Deploy Summary

**A commit-pinned community-scripts catalog backend (curated shortlist + searchable full catalog with source/commit/last-reviewed attribution) plus the spike-gated `run_community_script` two-stage job — create the empty LXC, then run only the upstream install stage inside it via SSH `pct exec`.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-16T19:50:24Z
- **Completed:** 2026-05-16T20:00:40Z
- **Tasks:** 2
- **Files modified:** 12 (5 created, 7 modified)

## Accomplishments

- **Catalog backend (LXC-01/02/04):** a vendored `snapshot.json` floor pinned to the spike's floor commit `369f9013`, a service exposing the featured-plus-override curated shortlist, a case-insensitive substring + category search, and an admin `POST /catalog/sync` that re-pins the `catalog_pin` row. Every catalog entry surfaces its GitHub `source_url`, the active `commit_sha`, and the `last_reviewed` date.
- **`connector.lxc_exec`:** the spike-confirmed in-container exec mechanism. Because PVE 9.1.2 has no LXC `exec` REST endpoint (`POST .../lxc/{vmid}/status/exec` → 501), `lxc_exec` SSHes to the PVE node and runs the CLI `pct exec <vmid> -- <command>`, routed through `_call_with_breaker`, with chunked output delivery for the Tasks drawer.
- **`run_community_script` two-stage job (LXC-03):** stage 1 creates the empty LXC and UPID-polls it via `dispatch_and_poll`; stage 2 starts the container and runs only the install-stage script (fetched at the pinned commit SHA) inside it via `lxc_exec`, with the `build.func` env block reproduced and affirmative stdin. A stage-2 failure marks the job failed but never deletes the container (Pitfall 8). The install output is captured to the audit log.
- **`POST /clusters/{id}/provisioning/community-script`** — the 202 endpoint the wizard's Community-Script path enqueues; validates `script_slug` against the catalog set, runs quota admission before reserving the VMID, joins the team pool.

## Must-Haves Verification

- A user lists the curated shortlist and searches the full catalog with category filters — `test_get_catalog_curated_view`, `test_get_catalog_full_view_with_search`.
- Each entry exposes source GitHub link + commit hash + last-reviewed date derived from the active pin — `test_attribution_carries_source_commit_lastreviewed`, `test_get_catalog_entry_has_attribution`.
- An admin catalog sync pulls a fresher commit and re-pins the `catalog_pin` row — `test_catalog_sync_as_admin_repins`; a non-admin → 403 (`test_catalog_sync_as_non_admin_returns_403`).
- A community-script deploy runs as a two-stage job — `test_run_community_script_stage1_creates_then_stage2_execs` (stage 1 `create_lxc`, stage 2 `lxc_exec` the install stage).
- A failed install stage marks the job failed but does NOT delete the created LXC — `test_run_community_script_stage2_failure_keeps_lxc` asserts the FakeProxmox recorded zero `.delete` calls.
- The install output is captured to the audit log — `test_run_community_script_captures_output_to_audit`.

## Task Commits

1. **Task 1: Catalog module + `lxc_exec` connector method** — `516300f` (feat)
2. **Task 2: `run_community_script` two-stage job + community-script endpoint** — `003f02d` (feat)

_TDD: tests were authored alongside each task in the single `test_catalog.py` suite and run green at each commit._

## Files Created/Modified

- `backend/app/catalog/snapshot.json` — vendored catalog floor: 12 community-script entries (mix of featured/non-featured across 9 categories), pinned to floor SHA `369f9013`.
- `backend/app/catalog/service.py` — `load_catalog`, `curated_shortlist`, `search_catalog`, `attribution_for`, `get_entry`, `sync_catalog`; the `ScriptEntry`/`CatalogData` wrappers.
- `backend/app/catalog/routes.py` — `GET /clusters/{id}/catalog`, `GET /clusters/{id}/catalog/{slug}`, `POST /catalog/sync` (admin-gated).
- `backend/app/catalog/__init__.py` — package marker.
- `backend/app/clusters/connector.py` — added `lxc_exec` (async) + `_ssh_pct_exec` (sync subprocess shell-out).
- `backend/app/jobs/provisioning_functions.py` — added `run_community_script` + the `_build_install_command` / `_build_install_env` helpers.
- `backend/app/jobs/worker.py` — registers `lxc.community-script` (`max_tries=1`, 1h timeout).
- `backend/app/provisioning/schemas.py` — added `CommunityScriptRequest` + its `to_pve_config`.
- `backend/app/provisioning/service.py` — added `enqueue_community_script` + `_resolve_ostemplate`.
- `backend/app/provisioning/routes.py` — added the `POST .../provisioning/community-script` route.
- `backend/app/main.py` — mounts the catalog router.
- `backend/tests/test_catalog.py` — 22 tests (catalog floor/service/routes/connector + the two-stage job).

## Decisions Made

- **`lxc_exec` is SSH `pct exec`, not proxmoxer REST.** The 04-06 plan's `<interfaces>` sketch named a `POST .../lxc/{vmid}/status/exec` proxmoxer method. The approved spike (§3) confirmed that endpoint returns **501 Not Implemented** on the live PVE 9.1.2 cluster — it does not exist. Per spike authority, `lxc_exec` is implemented as a `pct exec` CLI invocation over SSH to the PVE node. The SSH transport shells out to the OS `ssh` binary via `subprocess` rather than adding a Python SSH library — this keeps the dependency set unchanged and gives a live byte stream for chunked output (D-08).
- **Catalog content is the vendored snapshot floor; `sync_catalog` re-pins only the SHA.** D-05 keeps the GUI on a deliberately-reviewed commit. `sync_catalog` resolves and records a fresher commit SHA on the `catalog_pin` row but does not refetch the entry list from unreviewed upstream JSON — the floor `snapshot.json` is the trusted copy that ships with each release. This is intentional (see Known Behavior below), not a stub.
- **Install stage runs only `install/<slug>-install.sh` at the pinned SHA.** Following the spike's go/no-go contract — never `ct/<slug>.sh` (which drives the interactive whiptail orchestrator, Pitfall 10), never `main`. The `build.func` env block is reproduced host-side and `yes y` affirmative stdin clears the few interactive `read` confirms.

## Deviations from Plan

The 04-06 plan's `<interfaces>` block sketched `lxc_exec` as a proxmoxer-REST call (`POST .../lxc/{vmid}/status/exec`). This was overridden by the **approved spike** — not a deviation against the plan's intent, but the explicit spike-authority instruction in the execution prompt. The spike-confirmed `pct exec` over SSH mechanism was implemented instead. The plan's `must_haves.artifacts` text ("create LXC then `lxc_exec` install") and the threat model (`pct exec` in the trust boundary table) are consistent with this; only the pre-spike connector sketch differed.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No Python SSH library available for the `pct exec` transport**
- **Found during:** Task 1 (the `lxc_exec` connector method)
- **Issue:** The spike requires `pct exec` over SSH, but no SSH library (`paramiko`/`asyncssh`) is in the backend dependency set, and adding a new package was not installable in this environment.
- **Fix:** Implemented the SSH transport as an OS `ssh`-binary subprocess shell-out (`subprocess.Popen` with an argv list — no `shell=True`, every argument `shlex.quote`-d exactly once). This needs zero new Python dependencies, streams output naturally off the subprocess stdout, and is fully testable via `patch.object(conn, "_ssh_pct_exec", ...)`.
- **Files modified:** `backend/app/clusters/connector.py`
- **Verification:** `test_connector_lxc_exec_runs_pct_exec_over_ssh` + `test_connector_lxc_exec_routes_through_breaker`; `ruff check` clean.
- **Committed in:** `516300f` (Task 1 commit)

**2. [Rule 1 - Bug] `ruff` ASYNC109 on the `lxc_exec` `timeout` parameter**
- **Found during:** Task 1 (ruff verification)
- **Issue:** `ruff` flags `ASYNC109` ("async function with a `timeout` parameter") on `lxc_exec`; the `timeout` here is a passthrough to the synchronous `subprocess.wait`, not an asyncio timeout.
- **Fix:** Added `# noqa: ASYNC109` with an inline rationale comment.
- **Files modified:** `backend/app/clusters/connector.py`
- **Verification:** `ruff check app/catalog app/clusters/connector.py` → "All checks passed!"
- **Committed in:** `516300f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). Plus 1 spike-authority override (`lxc_exec` mechanism) which the execution prompt explicitly instructed.
**Impact on plan:** No scope creep. The SSH-binary transport is the minimal correct way to honour the spike's `pct exec` verdict without adding an uninstallable dependency.

## Known Behavior (not a stub)

`sync_catalog` re-pins the `catalog_pin.commit_sha` but the catalog **entry list** is always served from the vendored `backend/app/catalog/snapshot.json`. This is the D-05 design — the GUI ships and trusts a reviewed floor; the admin sync records WHICH upstream commit the operator deliberately chose, never auto-importing unreviewed upstream JSON. A future catalog-refresh plan can extend `sync_catalog` to also re-vendor the entry JSON from `community-scripts/ProxmoxVE-Local` at the chosen SHA if a fresher entry set is wanted; the current behaviour is correct and complete for LXC-01/02/04.

## Threat Model Compliance

- **T-04-06-01 (command injection via slug/options)** — `script_slug` is validated against the catalog entry set (`enqueue_community_script` → 422 on an unknown slug); `lxc_exec`'s `command` is a list and every argument is `shlex.quote`-d once in `_ssh_pct_exec` — no shell interpolation; the install stage runs inside the fresh LXC, never on the host.
- **T-04-06-02 (commit-pin tampering / "always latest")** — the floor `snapshot.json` pins a 40-char reviewed SHA; `run_community_script` fetches `install/<slug>-install.sh` at the job's pinned `commit_sha`, never `main`.
- **T-04-06-03 (catalog sync open to non-admins)** — `POST /catalog/sync` carries `Depends(require_admin)` + `Depends(csrf_protect)`; verified by `test_catalog_sync_as_non_admin_returns_403`.
- **T-04-06-04 (cross-tenant community-script create)** — `enqueue_community_script` runs `_require_team_membership` → 403; verified by `test_community_script_cross_tenant_returns_403`. The LXC config carries `pool=<TeamClusterToken.poolid>`.
- **T-04-06-05 (orphan LXC on stage-2 failure — accepted)** — `run_community_script` deliberately keeps the created-but-install-failed container; `test_run_community_script_stage2_failure_keeps_lxc` asserts zero `.delete` calls.

## Issues Encountered

None beyond the two auto-fixed items above. The two-stage job test required queuing the create-task poll responses keyed by the full UPID dotted path; the `FakeProxmox.queue_response` helper handled this cleanly.

## Next Phase Readiness

- The community-scripts backend is complete — the provisioning wizard frontend plans (04-12/04-13) can consume `GET /catalog` and `POST /provisioning/community-script`.
- The connector now ships a reusable SSH `pct exec` transport — later networking/console plans that need in-container commands can build on `lxc_exec`.
- **Operational note:** `lxc_exec` requires SSH key trust from the GUI LXC to each PVE node (`root@<node>`, port 22). The spike confirmed port 22 is reachable; provisioning the SSH key onto the GUI LXC and the node `authorized_keys` is a deployment step for Phase 5 packaging / the install helper-script. Until that key trust exists, `run_community_script` stage 2 will fail at the SSH connect (the job is marked failed and the LXC is kept — the designed failure mode).

## Self-Check: PASSED

All created files exist (`catalog/__init__.py`, `catalog/snapshot.json`, `catalog/service.py`, `catalog/routes.py`, `tests/test_catalog.py`, `04-06-SUMMARY.md`); both task commits (`516300f`, `003f02d`) are in `git log`. Full backend suite: 437 tests pass (415 baseline + 22 new).

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
