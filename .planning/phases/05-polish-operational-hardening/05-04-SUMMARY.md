---
phase: 05-polish-operational-hardening
plan: 04
subsystem: deploy
tags: [self-update, deploy, arq, sqlite-backup, sha256, symlink-swap, rollback, sudoers, ssh-trust]

# Dependency graph
requires:
  - phase: 05-polish-operational-hardening
    plan: 01
    provides: selfupdate_functions placeholder + worker.py admin.self-update registration (max_tries=1, timeout=1800)
  - phase: 03-job-queue-lifecycle
    provides: arq WorkerSettings, jobs row state machine, jobs_retry 202-enqueue pattern, get_job/update_job/finish_job
  - phase: 01-foundation
    provides: require_admin + csrf_protect dependencies, /api/v1/health, releases/current-capable bootstrap.sh + systemd units
provides:
  - "POST /api/v1/admin/self-update — admin-gated, CSRF-protected, 202-enqueue of an admin.self-update arq job"
  - "run_self_update worker job — manifest fetch+verify, WAL-safe DB snapshot, update.sh invoke, health poll, auto-rollback"
  - "app.selfupdate.service pure helpers: fetch_release_manifest, download_tarball, verify_sha256, snapshot_db"
  - "deploy/lxc/update.sh — factored in-LXC update routine shared by install.sh --update and the worker job"
  - "releases/<tag> + current symlink deploy layout; scoped sudoers; idempotent host SSH trust"
affects: [05-06-frontend-self-update, 05-07-operator-uat]

# Tech tracking
tech-stack:
  added:
    - "sqlite3 online-backup API (.backup) — WAL-safe pre-update snapshot"
    - "hashlib.sha256 streaming manifest verification"
  patterns:
    - "Worker-owned orchestration so the API restart cannot kill the rollback (Pitfall 2 / T-05-04-08)"
    - "Atomic symlink swap via sibling-tempfile + os.replace (rename(2))"
    - "_assert_inside_releases swap-target guard — never repoint current outside /opt/proxmox-gui/releases (Pitfall 7 / T-05-04-03)"
    - "Scoped NOPASSWD sudoers for exactly three systemctl-restart verb+unit combos (T-05-04-05)"
    - "Idempotent authorized_keys append: grep -qF || echo >> (Pitfall 6 / T-05-04-06)"
    - "SHA-256 manifest gate aborts BEFORE unpack/snapshot/swap (T-05-04-01)"

key-files:
  created:
    - backend/app/selfupdate/__init__.py
    - backend/app/selfupdate/service.py
    - backend/app/selfupdate/schemas.py
    - backend/app/selfupdate/routes.py
    - deploy/lxc/update.sh
  modified:
    - backend/app/jobs/selfupdate_functions.py
    - backend/app/main.py
    - backend/tests/test_selfupdate.py
    - deploy/install.sh
    - deploy/lxc/bootstrap.sh
    - deploy/systemd/proxmox-gui-api.service
    - deploy/systemd/proxmox-gui-frontend.service
    - deploy/systemd/proxmox-gui-worker.service

key-decisions:
  - "The self-update route creates a jobs row (cluster_id=None, team_id=None, actor_user_id=<admin>) and then enqueues, rather than a bare arq enqueue — so the Tasks drawer renders one consistent row across pending→running→terminal and the rollback writes failed/needs_review against the same id."
  - "run_self_update locates update.sh by extracting deploy/lxc/update.sh from the just-verified tarball (the NEW routine), falling back to the on-disk current/ copy — a mid-swap on-disk tree still yields a valid update.sh."
  - "The manifest-mismatch abort raises BEFORE the DB snapshot or any unpack; the rollback only restores the DB if a snapshot was actually taken (pre_update_snapshot_taken flag) and only repoints the symlink if a previous target was captured."
  - "snapshot_db uses sqlite3.connect(src).backup(dst); _restore_db_snapshot is a plain shutil.copy of the already-self-contained snapshot back over app.db plus removal of stale -wal/-shm sidecars."
  - "systemctl is invoked as sudo -n (no password prompt) so a sudoers misconfiguration fails fast instead of hanging on stdin."
  - "Task 1 systemctl-privilege spike resolved (RESEARCH Open Question Q2): the unprivileged proxmox-gui user CANNOT restart system units without grant, so bootstrap.sh lays down a scoped NOPASSWD sudoers entry for exactly the three restart commands."

patterns-established:
  - "Module-attribute call-time lookup of selfupdate_service.fetch_release_manifest/download_tarball so tests monkeypatch the service module once and both the job and route see it"
  - "Best-effort rollback: every step try/except-wrapped, log accumulated into friendly_error, original cause preserved on Job.error"

requirements-completed: [DEPLOY-04]

# Metrics
duration: ~40min (across two sessions — Task 1 prior, Task 2 finalized 2026-06-02)
completed: 2026-06-02
---

# Phase 5 Plan 04: Self-Update (DEPLOY-04) Summary

**An admin can trigger a self-update from the API (202 + job id) or an operator can re-run install.sh --update; the update pulls a tagged release, SHA-256-verifies it against a manifest (abort on mismatch), takes a WAL-safe pre-update DB snapshot, atomically symlink-swaps releases/<tag>, polls /api/v1/health, and auto-rolls-back DB + code on failure — all orchestrated in the worker process so the API restart cannot kill the rollback.**

## Performance

- **Duration:** ~40 min (Task 1 in a prior session; Task 2 finalized 2026-06-02)
- **Completed:** 2026-06-02
- **Tasks:** 2
- **Files:** 13 (5 created, 8 modified)

## Accomplishments

- **DEPLOY-04 self-update route (Task 2):** `POST /api/v1/admin/self-update/`
  is admin-gated (`require_admin`) and CSRF-protected (`csrf_protect`),
  returns **202** with a `job_id`, and mirrors `jobs_retry`'s arq-pool
  lookup with a **503** fallback when Redis is down. It creates a `jobs`
  row first (so the Tasks drawer can render the update) then enqueues the
  `admin.self-update` arq job. `target_version` is semver-tag-validated at
  the schema layer (V5 input validation) — a metacharacter-laced version
  string is rejected **422** before it can reach the URL the worker fetches.
- **`run_self_update` worker orchestration (Task 2):** replaces the 05-01
  `NotImplementedError` stub with the verbatim RESEARCH §Pattern 5 sequence:
  1. fetch the release manifest + tarball over HTTPS,
  2. `verify_sha256` — **abort BEFORE any unpack/snapshot/swap** on mismatch
     (T-05-04-01 / closes carryover ME-03),
  3. WAL-safe DB snapshot → `app.db.pre-update` (Pitfall 1 / T-05-04-04),
  4. stage + invoke `deploy/lxc/update.sh` (unpack → pip → committed
     `frontend/build/` → `alembic upgrade head` → atomic `ln -sfn` swap),
  5. restart api + frontend via sudoers-scoped systemctl (**the API dies
     here; the worker survives**),
  6. poll `GET /api/v1/health` up to ~60s,
  7. healthy → mark the job done, restart the worker **LAST**,
  8. unhealthy/any-failure → **auto-rollback** (D-11): restore `app.db`,
     repoint `current` to the previous release, restart api, mark the job
     failed with the captured rollback log.
- **Worker-owned (Pitfall 2 / T-05-04-08):** the orchestration runs in the
  worker (a separate systemd unit) so step 5's API restart cannot kill the
  process that performs the health check + rollback.
- **Swap-target guard (Pitfall 7 / T-05-04-03):** `_assert_inside_releases`
  refuses to repoint `current` anywhere outside `/opt/proxmox-gui/releases/`
  — a traversal-laced manifest cannot point it at `/etc/proxmox-gui` (the
  master key). Persistent state under `/etc` + `/var/lib` is never touched
  by the swap (only the deliberate `alembic upgrade` + snapshot/restore).
- **Deploy layout + triggers (Task 1, prior commit `daaf13f`):**
  `releases/<tag>` + `current` symlink; the three systemd units repointed at
  `/opt/proxmox-gui/current/...`; `deploy/lxc/update.sh` as the shared
  in-LXC routine; `install.sh --update` + existing-CTID detection routing
  into it (D-09/D-12); idempotent host SSH trust (`ssh-keygen -t ed25519`
  + `grep -qF || echo >>` append — Pitfall 6); the scoped NOPASSWD sudoers
  entry resolving the systemctl-privilege spike (Open Question Q2).

## Task Commits

1. **Task 1: releases/current layout + update.sh + install.sh --update + sudoers + SSH trust**
   - `daaf13f` feat(05-04): releases/current deploy layout + install.sh --update + sudoers
   - _(No RED commit — Task 1 verify is `shellcheck` + grep, no unit tests; mirrors Plan 01-04's no-test deploy phase.)_
2. **Task 2: run_self_update worker job + 202-enqueue route**
   - `8e88425` test(05-04): add failing tests for run_self_update + 202-enqueue route (RED)
   - `782d4e7` test(05-04): refine self-update tests for real run_self_update shape (RED)
   - `fa51a5b` feat(05-04): run_self_update worker job + 202-enqueue self-update route (GREEN)

_TDD gate: Task 2's failing-test commits precede its `feat` commit. The
`782d4e7` refine commit sandboxes the worker's filesystem effects, stubs the
rollback systemctl path, tightens the manifest-mismatch assertion to
`Job.error`, and adds the traversal-guard test — all still RED without the
implementation._

## Files Created/Modified

**Created:**
- `backend/app/selfupdate/__init__.py` — package docstring.
- `backend/app/selfupdate/service.py` — `fetch_release_manifest`,
  `download_tarball`, `verify_sha256` (case-insensitive, streaming),
  `snapshot_db` (WAL-safe `.backup`, never `shutil.copy`).
- `backend/app/selfupdate/schemas.py` — `SelfUpdateRequest`
  (semver-tag-validated `target_version`) + `SelfUpdateResponse(job_id)`.
- `backend/app/selfupdate/routes.py` — the 202-enqueue route.
- `deploy/lxc/update.sh` — shared in-LXC update routine (Task 1).

**Modified:**
- `backend/app/jobs/selfupdate_functions.py` — real `run_self_update` body
  + helpers (`_systemctl_restart`, `_wait_for_health`, `_repoint_current`,
  `_assert_inside_releases`, `_restore_db_snapshot`, `_locate_update_sh`,
  `_rollback`).
- `backend/app/main.py` — mount the self-update router at
  `/api/v1/admin/self-update`.
- `backend/tests/test_selfupdate.py` — refined (Task 2 RED).
- `deploy/install.sh`, `deploy/lxc/bootstrap.sh`,
  `deploy/systemd/proxmox-gui-{api,frontend,worker}.service` — Task 1.

## Decisions Made

- **jobs-row-then-enqueue, not bare enqueue.** RESEARCH §Pattern 5 favours
  Tasks-drawer visibility; the rollback writes `failed`/`needs_review` to the
  same id the drawer already polls. Two consecutive admin clicks DO produce
  two rows (intentional — `max_tries=1` means arq never re-runs the same row).
- **update.sh sourced from the verified tarball.** `_locate_update_sh`
  extracts `deploy/lxc/update.sh` from the just-downloaded, SHA-verified
  tarball so the NEW update routine runs, falling back to the on-disk
  `current/` copy — robust against a mid-swap on-disk tree.
- **Rollback is conditional + best-effort.** DB restore only if a snapshot
  was taken; symlink revert only if a previous target was captured; every
  step try/except-wrapped; the original cause stays on `Job.error` while the
  rollback log goes to `friendly_error`.
- **`sudo -n`.** No-password-prompt so a sudoers misconfiguration fails fast
  rather than hanging the worker on stdin.

## Deviations from Plan

None material. The plan's `target_version` validation was placed in
`schemas.py` (the route's request model) rather than `service.py` — the
schema layer is the correct, earliest rejection point and is what the
`test_self_update_route_rejects_bad_version` 422 test exercises.

## Known Stubs

None. The 05-01 `NotImplementedError` placeholder is fully replaced.

## Issues Encountered

- `shellcheck` is not installed in this dev environment, so the Task 1
  `<verify>` shellcheck pass could not be re-run locally this session; the
  deploy-script changes were committed in `daaf13f` (prior session) and the
  acceptance greps (`--update`, `ssh-keygen -t ed25519`, `ln -sfn`,
  scoped-sudoers, `current` in the unit files) all pass.
- Bare `python`/`pytest` are not on PATH; used `backend/.venv/bin/python -m`.

## Verification Results

- `cd backend && .venv/bin/python -m pytest tests/test_selfupdate.py -q` —
  **14 passed** (WAL-safe snapshot round-trip + no-shutil-copy guard,
  SHA-256 match/mismatch/case-insensitive, route 202/403/CSRF/503/422,
  manifest-mismatch abort + rollback, traversal guard, worker registration).
- `cd backend && .venv/bin/python -c "from app.jobs.worker import WorkerSettings"`
  — worker imports with the real `run_self_update` body.
- Full backend suite: **594 passed**, 0 failed (146s).
- Task 1 acceptance greps: `--update` (8×), `ssh-keygen -t ed25519` (1×),
  `ln -sfn` in update.sh (3×), scoped sudoers in bootstrap.sh (1×) — all present.

## Acceptance Criteria

- [x] `grep -q "async def run_self_update"` + no `NotImplementedError("implemented in 05-04")` — PASS
- [x] `def snapshot_db` + `.backup(` present, `shutil.copy` absent in service.py — PASS
- [x] `def verify_sha256` / `hashlib.sha256` in service.py — PASS
- [x] `self_update_start` + `require_admin` + `csrf_protect` + `202` in routes.py — PASS
- [x] `/api/v1/admin/self-update` in main.py — PASS
- [x] `pre-update` snapshot + `health` poll referenced in selfupdate_functions.py — PASS
- [x] `--update`, `ssh-keygen -t ed25519`, `grep -qF`, `ln -sfn`, scoped sudoers, `current` in unit files — PASS
- [x] `pytest tests/test_selfupdate.py` exits 0 — PASS (14 passed)

## Next Phase Readiness

- DEPLOY-04 is complete. The frontend (Plan **05-06**) can wire the admin
  "Update" button to `POST /api/v1/admin/self-update` and subscribe to the
  returned `job_id` on the existing Tasks drawer.
- Operator UAT (Plan **05-07**) can exercise the live update + the
  `install.sh --update` out-of-band recovery path on the LXC.

## Self-Check: PASSED

All 5 created files exist; all Task 2 commits (`8e88425`, `782d4e7`,
`fa51a5b`) + Task 1 commit (`daaf13f`) are in `git log`. Full backend suite
green (594 passed).

---

_Phase: 05-polish-operational-hardening_
_Completed: 2026-06-02_
