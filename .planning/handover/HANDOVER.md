# HANDOVER — Proxmox-GUI Head (autonomous Phase 05 run)

**Updated:** 2026-06-02 · **Branch:** `master` (pushed to origin through 9c02fe6)

## Aufgabe & Ziel
Operator (via Hub 7bk8gf37) green light: finish Phase 05 + Phase-1 carryover
autonomously. discuss→plan→execute per plan, TDD + atomic commits, backend AND
frontend tests green, edit STATE.md/ROADMAP.md directly.
**Guardrail:** prod-deploy to live LXC 192.168.20.171 ONLY after Hub check-in.

## Stand (was erledigt / was läuft)
- **05-04 self-update (DEPLOY-04): DONE + pushed.** run_self_update worker job +
  202 admin route; 594 backend tests green; SUMMARY written; STATE/ROADMAP updated.
- **05-05 mobile reflow + a11y (UI-03): CODE DONE + pushed.** hamburger drawer,
  inventory card stack (accessible stretched-link), wizard gate, axe-core audit
  (caught+fixed a real nested-interactive bug). svelte-check 0 err, 382 frontend
  tests, prod build staged. **Task 3 = manual a11y checkpoint PENDING operator**
  (bundle with 05-07).
- **05-06 frontend (AUTH-06/AUDIT-06/DEPLOY-04): IN PROGRESS** — next up.

## Exakte nächste Schritte (05-06, 4 auto tasks)
Plan: `.planning/phases/05-polish-operational-hardening/05-06-PLAN.md`
1. **Task 1** idle store + SessionExpiredModal + IdleCountdownToast + settings api
   + root +layout wiring. Analogs: `lib/stores/theme.svelte.ts` (rune store+init),
   `routes/+layout.svelte` (onMount theme.init), `lib/api/clusters.ts` (apiJson
   shape from `$lib/utils/api`), `components/forms/ConfirmByNameDialog.svelte`
   (Dialog overlay), `lib/components/ui/sonner`. Backend contracts: GET/PATCH
   `/api/v1/admin/settings`, POST `/api/v1/auth/keepalive`, refresh 401
   detail="session_idle_expired".
2. **Task 2** admin/settings +page(.server).svelte + selfupdate api (startSelfUpdate
   + health reconnect-poll) + audit archives list on audit page + add Settings to
   `lib/nav.ts` adminItems. Analogs: `routes/admin/clusters/+page(.server).ts`.
   Backend: POST `/api/v1/admin/self-update`→202{job_id}; GET `/api/v1/audit/archives`.
3. **Task 3** backend `app/networks/preflight.py` ssh_pct_exec_preflight + clusters
   route `POST /clusters/{id}/verify-ssh` + expose GUI pubkey (`/etc/proxmox-gui/
   gui_ed25519.pub`); frontend clusters/new pubkey+Verify-SSH UI; create/lxc
   preflight gate (community-script path only). NEEDS a `tests/test_ssh_preflight.py`
   (TDD RED first). Analog: `clusters/connector.py::_ssh_pct_exec`, snippets preflight.
4. **Task 4** prod build + restore dance (`pnpm run build` →
   `git checkout -- frontend/build/node_modules` → `git add -fA frontend/build`).
Then write `05-06-SUMMARY.md`, update STATE/ROADMAP, push.

## Danach
- **05-07** operator UAT (HUMAN — live LXC). Bundle with 05-05 Task 3.
- **Carryover triage:** ME-01..05/LO-01..04/IN-01..03/ssh-rsa/COOKIE_SECURE/TLS-pin/
  CSP were consolidated into **05-02 (DONE)**; scheduled probe into **05-03 (DONE)**.
  → Verify 05-02-SUMMARY actually covers all of them; it's NOT a separate block.

## Resume-Anleitung
- venv: `cd backend && .venv/bin/python -m pytest -q` (594 tests, ~146s).
- frontend: `cd frontend && pnpm test -- --run` (382) + `pnpm exec svelte-check --threshold error`.
- **Frontend build trap:** `pnpm run build` wipes git-tracked `frontend/build/node_modules`
  → ALWAYS `git checkout -- frontend/build/node_modules` then `git add -fA frontend/build`.
- shellcheck NOT installed. STATE/ROADMAP write-handlers don't parse this repo → edit directly.
- Ledger: `POST localhost:7890/api/agent-open-tasks`. Report phase-done to Hub 7bk8gf37.
- Durable task list: memory `project-open-tasks.md`.
