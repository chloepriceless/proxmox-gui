---
phase: 05-polish-operational-hardening
plan: 06
subsystem: frontend
tags: [idle-timeout, re-auth, settings, self-update, audit-archives, ssh-trust, preflight]

# Dependency graph
requires:
  - phase: 05-polish-operational-hardening
    plan: 01
    provides: GET/PATCH /admin/settings, POST /auth/keepalive, refresh 401 session_idle_expired
  - phase: 05-polish-operational-hardening
    plan: 03
    provides: GET /audit/archives + /audit/archives/{name}
  - phase: 05-polish-operational-hardening
    plan: 04
    provides: POST /admin/self-update (202), GET /health, the GUI gui_ed25519 key
  - phase: 05-polish-operational-hardening
    plan: 05
    provides: $lib/nav.ts shared nav arrays
provides:
  - "Idle-session UX: idle store + IdleCountdownToast + SessionExpiredModal (in-place re-auth, AUTH-06)"
  - "Admin Settings page (idle timeout + audit retention + self-update trigger)"
  - "Self-update UI with reconnect-poll across the API restart"
  - "Audit-archive listing + per-file download on the Audit page"
  - "Community-script SSH-trust: GET /clusters/ssh-pubkey + POST /clusters/{id}/verify-ssh + ssh_pct_exec_preflight + the cluster-registration pubkey/Verify-SSH UI + the ScriptDetailPanel preflight gate"
affects: [05-07-operator-uat]

# Tech tracking
tech-stack:
  patterns:
    - "Rune singleton idle store (lastActivity + derived countdown/expired); client UX-only, server refresh refusal authoritative"
    - "In-place re-auth overlay (Dialog) that preserves route + invalidateAll on success"
    - "Self-update reconnect-poll: wait-for-health-down-then-up before reload"
    - "Stretched/sibling interactive separation reused; untrack() to seed editable form $state from SSR load without the state_referenced_locally warning"
    - "SSH preflight via ssh -o BatchMode=yes pct list; sync pubkey-reader helper to keep the async route off blocking pathlib (ASYNC240)"

key-files:
  created:
    - frontend/src/lib/api/settings.ts
    - frontend/src/lib/api/selfupdate.ts
    - frontend/src/lib/stores/idle.svelte.ts
    - frontend/src/lib/components/auth/SessionExpiredModal.svelte
    - frontend/src/lib/components/auth/IdleCountdownToast.svelte
    - frontend/src/routes/admin/settings/+page.svelte
    - frontend/src/routes/admin/settings/+page.server.ts
    - backend/app/networks/preflight.py
    - backend/tests/test_ssh_preflight.py
  modified:
    - frontend/src/routes/+layout.svelte
    - frontend/src/lib/utils/api.ts
    - frontend/src/lib/api/audit.ts
    - frontend/src/lib/api/clusters.ts
    - frontend/src/lib/nav.ts
    - frontend/src/routes/audit/+page.svelte
    - frontend/src/routes/admin/clusters/new/+page.svelte
    - frontend/src/lib/components/wizard/ScriptDetailPanel.svelte
    - backend/app/clusters/routes.py
    - frontend/build

key-decisions:
  - "The idle timer is UX-only; the server refresh refusal is authoritative. utils/api.ts also dispatches a `session_idle_expired` window event on a 401 with that detail so the modal fires when the server reports expiry first."
  - "Self-update progress = reconnect-poll /health: wait for it to go DOWN (restart) then UP, then reload onto the new code; a timeout points the admin at the Tasks drawer (covers the SHA-mismatch-rollback path where the API never restarts)."
  - "DEVIATION: the plan's frontend gate target frontend/src/routes/create/lxc/+page.svelte does not exist — the Phase-4 wizard is a unified create/+page.svelte and the community-script path lives in wizard/ScriptDetailPanel.svelte. The D-23 preflight gate is placed there (opening a community script verifies SSH trust; failure blocks the 'Use this script' CTA with a guided fix). Plain OS-template LXCs + VMs never open that panel, so they stay open."
  - "DEVIATION: vite.config test.include extended to src/** in 05-05 already covers the co-located test convention; no new config change here."
  - "GET /clusters/ssh-pubkey exposes only the PUBLIC key (T-05-06-04) and is declared before /{cluster_id} to avoid int-coercion (422). A sync _read_gui_pubkey helper keeps the async route off blocking pathlib."

requirements-completed: [AUTH-06, AUDIT-06 (frontend), DEPLOY-04 (frontend)]

# Metrics
duration: ~90min
completed: 2026-06-02
---

# Phase 5 Plan 06: AUTH-06 / AUDIT-06 / DEPLOY-04 Frontend + SSH-Trust UX Summary

**The idle session now shows a 2-minute countdown toast then an in-place re-auth modal that preserves the route; an admin Settings page edits the idle timeout + audit retention and triggers a reconnect-polling self-update; the Audit page lists downloadable retention archives; and registering a cluster surfaces the GUI public key + a Verify-SSH button while the community-script wizard path is SSH-preflight-gated — plain VM/LXC paths untouched.**

## Performance
- **Duration:** ~90 min · **Tasks:** 4 · **Files:** 19 (9 created, 10 modified)
- **Completed:** 2026-06-02

## Accomplishments
- **AUTH-06 idle UX (Task 1):** `idle.svelte.ts` rune store (activity listeners,
  configurable window via `getSettings`, derived countdown/expired);
  `IdleCountdownToast` (live countdown + keepalive "Stay signed in");
  `SessionExpiredModal` (overlay re-auth that calls `invalidateAll` on success so
  route + state survive — D-03). `+layout.svelte` inits the store and renders
  both above the shell; `utils/api.ts` dispatches `session_idle_expired` on the
  server's 401 so the modal also fires server-first.
- **Admin Settings + self-update + archives (Task 2):** `/admin/settings`
  (admin-gated server load) edits idle timeout + retention; a Self-update card
  enqueues the job and reconnect-polls `/health` across the restart;
  `lib/api/selfupdate.ts` + `lib/api/settings.ts` wrappers; Settings added to the
  admin nav; the Audit page gained an admin-only Archives section (name/size/date
  + download + total size).
- **SSH-trust (Task 3):** backend `ssh_pct_exec_preflight` + `GET
  /clusters/ssh-pubkey` + `POST /clusters/{id}/verify-ssh`; the cluster-
  registration page shows the GUI pubkey + copy one-liner + Verify-SSH after
  register; `ScriptDetailPanel` preflight-gates the community-script path.
- **Production build (Task 4):** rebuilt + restaged `frontend/build` (node_modules
  restored).

## Task Commits
1. `8c3190d` feat(05-06): idle-session UX — countdown toast + in-place re-auth modal (AUTH-06)
2. `7824142` feat(05-06): admin Settings page + self-update UI + audit-archive listing (D-01, DEPLOY-04, D-08)
3. `62149d2` test(05-06) RED + `3ceebf6` feat(05-06): community-script SSH-trust preflight + cluster pubkey/Verify-SSH UI (D-22/D-23)
4. `2247e9c` build(05-06): frontend production build

## Deviations from Plan
- **`create/lxc/+page.svelte` does not exist.** The Phase-4 wizard is a unified
  `create/+page.svelte`; the community-script path lives in
  `wizard/ScriptDetailPanel.svelte`. The D-23 preflight gate is placed there
  (the plan's intent + must-have truth are satisfied; the literal acceptance
  grep on the non-existent file is N/A).
- **`untrack()` to seed the Settings form** from the SSR load (avoids the
  Svelte 5 `state_referenced_locally` warning while expressing read-once intent).

## Verification Results
- `pnpm exec svelte-check --threshold error` — **0 errors / 0 warnings** (2919 files).
- `pnpm test -- --run` — **382 passed** (25 files).
- `cd backend && pytest tests/test_ssh_preflight.py tests/test_clusters.py` — **30 passed**.
- Full backend suite — **598 passed**, 0 failed.
- `ruff check app/networks/preflight.py app/clusters/routes.py` — clean.
- `pnpm run build` — ✓; `frontend/build/node_modules` restored; `frontend/build` staged.

## Acceptance Criteria
- [x] idle store (lastActivity) + keepalive (settings.ts + idle store)
- [x] SessionExpiredModal + IdleCountdownToast exist; layout wires both + session_idle_expired
- [x] admin/settings page+server with idle_timeout_minutes + audit_retention_days + self-update
- [x] selfupdate.ts health() reconnect-poll; Settings in nav; audit page archives section
- [x] preflight.py (pct exec / _ssh_pct_exec) + verify-ssh route + clusters/new pubkey UI
- [~] community-script gate — placed in ScriptDetailPanel.svelte (create/lxc/+page.svelte N/A — deviation)
- [x] svelte-check 0; ssh_preflight tests pass; prod build staged with node_modules restored

## Next Phase Readiness
- **05-07** operator UAT is the only remaining plan (human-gated, live LXC).
  Bundle with the 05-05 Task 3 manual a11y checkpoint as one operator ask.

---
_Phase: 05-polish-operational-hardening_
_Completed: 2026-06-02_
