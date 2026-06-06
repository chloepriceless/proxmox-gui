# HANDOVER — Proxmox-GUI Head ("Schraubi")

**Updated:** 2026-06-06 ~02:15 · **Branch:** `master` @ `4872119` (**v0.6.3**, pushed, clean tree, in sync with origin).
**Operator:** Christin (von Perbandt) / company **Bikini Bottom Capital GmbH**. Hub peer = `agent-master-hub` (live key was `vdyofkr8`).

## State: GUI v0.6.2 LIVE on .171; v0.6.3 committed (NOT deployed). One open item, blocked on the Hub.
`autonomous_open=0, blocked_open=1`. Durable detail in repo-memory **`project-open-tasks.md`** (read it first).

### What is LIVE / shipped
- **v0.6.2 is LIVE on `.171`** (`https://192.168.20.171/`): `/opt/proxmox-gui/current → releases/v0.6.2`, 4 services active, D-13 backup-storage empty-state/load-error fix live-served (chunk contains "No backup-capable storage found"). Rollback target kept: `releases/phase05-3f5d711`.
- **v0.6.3 committed + tagged + pushed, but NOT yet deployed** (`4872119`). Fix: `/api/v1/health` + FastAPI/OpenAPI `version` now read `app.__version__` via `importlib.metadata` instead of hardcoded `0.1.0`. Rides along with the **next** prod-deploy (no standalone prod-touch for cosmetics). Until then live `.171` still reports `0.1.0` on `/api/v1/health` (old code). 623/623 backend tests green.
- Earlier delivered (all live/handed off): Phase 05, MCP server (T-0032, `docs/MCP.md`), README+MIT relicense, authenticated screenshots, fleet-infra tasks T-0053 (decap+B1) and T-0067 (persona-cwd separation) — both confirmed DONE by the Hub.

### THE ONE OPEN ITEM (blocked on Hub) → resume here
**T-0061 — agent-master dashboard Linux-fixes: WIRING/BUILD awaits Hub GO + 1 scope decision.**
- The **audit is DONE** (read-only, delivered): `/home/dev/Report/2026-06-05_T-0061-dashboard-audit.md`. Findings: UI↔endpoint 51/51 match (0 orphans); exactly **3 Linux breakages**:
  1. 🔴 `/api/focus` ("↗ Terminal" button) **CRASHES the Hub server on Linux** — `focusAgent` (server.mjs:3161) calls osascript ungated; `runOsa` (server.mjs:1671) has no `child.on("error")` handler → ENOENT = uncaught = `node server.mjs` dies. **NEVER provoke `/api/focus` against the live Hub.**
  2. `/api/update/apply` → `update-apply.mjs` `launchctl kickstart` ungated → self-update restart broken on Linux. Fix: Linux branch via `/home/dev/.local/bin/agent-master restart`.
  3. minor: `server.mjs:2743` `open -a Terminal` (try/catch) → IS_DARWIN-guard.
- **Blocked on:** (a) Hub GO to build (it's a process-critical mutation of the live Hub server — R22), and (b) 1 scope decision: `/api/focus` on Linux → **graceful no-op (my recommendation)** vs. real tmux select-window focus.
- **On GO:** deterministic patcher (focusAgent IS_DARWIN-guard + runOsa 'error'-handler + update-apply launchctl→agent-master-restart branch) → `node --check` → Codex-refute (R22) → hand to Hub for gate + controlled restart-deploy (backup → node --check → `agent-master restart` → verify /api/health 200 + orchestrator identity stable + focus returns graceful JSON not crash). Don't touch decapitation guards.
- **Hub restart mechanism (Linux):** `/home/dev/.local/bin/agent-master {start|stop|restart|status|logs}`.

### Parked decision items (not mine to drive / not acute)
- **Self-update-button direction** — real DEPLOY-04 privilege bug found; design doc `/home/dev/Report/2026-06-04_self-update-privilege-fix-DESIGN.md` (kept OUT of public repo). Operator decides direction (security-sensitive). Rec = Option A (descope in-GUI button, update from host helper which already works).
- **MCP scope / Christin backup-error-text** — Hub confirmed NOT mine / not open.

## Resume instructions
- After respawn / "weiter": read `project-open-tasks.md` + the State above. **No unblocked autonomous work remains** — the only open item (T-0061 wiring) needs the Hub's GO + scope decision (already asked via send_message). If the GO/decision arrived → build per the "On GO" steps above. Peer messages auto-wake this session.
- Tests: `cd backend && .venv/bin/python -m pytest -q` (**623**). frontend: `pnpm test -- --run` (382) + `pnpm exec svelte-check --threshold error` (0/0). Health test: `tests/test_health.py`.
- **Version is now single-sourced** via `app.__version__` (`backend/app/__init__.py`, importlib.metadata). After a version bump, `pip install -e backend` to refresh the editable-install metadata (it freezes at install time; the live per-release venv reinstalls fresh so it's always correct).
- **Frontend build trap:** `pnpm run build` wipes git-tracked `frontend/build/node_modules` → `git checkout -- frontend/build/node_modules` then `git add -fA frontend/build`. (Backend-only changes don't touch the build.)
- **Before ANY GUI deploy:** check the last `frontend/build/` commit is AFTER the last source change (`git log -1 -- frontend/build/` vs source) — GSD frontend plans don't prod-build. Deploy verify must prove the fix in the LIVE-SERVED artifact, not just "deploy ran".
- Guardrail: prod-deploy to `.171` ONLY after a Hub check-in. Deploy procedure: memory `prod-deployment` (SSH `-i ~/.ssh/proxmox_deploy root@192.168.20.171`, prefix remote cmds with `export PATH=/usr/sbin:/usr/bin:/sbin:/bin;`). STATE/ROADMAP write-handlers don't parse this repo → edit directly.
- Ledger: `POST localhost:7890/api/agent-open-tasks`. Activity reports: `POST /api/activity-reports`. Hub's live receive may be flaky (T-0070) → confirm deliverables as ARTEFACTS (commit/file/tag), not just messages.
