# HANDOVER — Proxmox-GUI Head

**Updated:** 2026-06-04 · **Branch:** `master` @ `0836ab7` (pushed, clean tree, 0 ahead).
**Operator:** Christin (von Perbandt) / company **Bikini Bottom Capital GmbH**. Hub peer = `agent-master-hub`.

## State: Phase 05 CODE-COMPLETE + README/MIT/screenshots done. All autonomous work finished.
`autonomous_open=0, blocked_open=2`. The durable task queue lives in repo-memory **`project-open-tasks.md`** (read it — it has full detail).
**This session (respawn):** resolved the logged-in-screenshots task autonomously via the safe demo-data path (no operator input needed — correct for a public repo). See `scripts/demo-screenshots/` + commit `0836ab7`.

### Done (committed + pushed)
- **Phase 05 code-complete** (Phases 1–4 already done). 05-04 self-update (DEPLOY-04), 05-05 mobile/a11y code (UI-03), 05-06 idle-UX+admin-settings+self-update-UI+audit-archives+SSH-trust (AUTH-06/AUDIT-06/DEPLOY-04). Carryover verified closed in 05-02/03/04. **598 backend + 382 frontend tests green, svelte-check 0/0.** SUMMARYs: `.planning/phases/05-polish-operational-hardening/05-0{4,5,6}-SUMMARY.md`.
- **README** brought current + GUI sign-in screenshot (`docs/screenshot.png`, Playwright headless of live /login). 
- **Relicensed AGPL→MIT** — holder `Bikini Bottom Capital GmbH` (verified Handelsregister/LEI). LICENSE + pyproject + package.json + README.
- Registry self-update + activity-report backfill (4 units) done at the Hub.

### ✅ Resolved this session
- **Logged-in README screenshots** — done via the safe demo-data path (Option B). `docs/screenshot-inventory.png` + `docs/screenshot-vm-detail.png`, reproducible harness in `scripts/demo-screenshots/`. No real data committed.

### Blocked on Christin/Hub — 2 decisions (parked, reported to Hub; each is an MC when re-raised)
1. **MCP server (new feature)** — scope-first proposal sent; awaiting decisions: tool surface (core vs full lifecycle), auth model (**recommend stdio↔REST bridge with a PAT** — inherits RBAC/audit/job-queue), destructive-ops gating, target instance + PAT identity, packaging (`python -m app.mcp`). On answers → build, **Codex-spar design+diff before merge** (security-critical: create/delete). Operator wants scope decided first → no speculative build.
2. **Deploy Go/No-Go** — deploy Phase-05 code to live LXC **192.168.20.171** for the 05-07 operator UAT (guardrail = prod-deploy needs Hub check-in). Downstream human gates: 05-07 UAT + 05-05 manual a11y audit.

## Resume instructions
- After respawn: read `project-open-tasks.md`. No unblocked autonomous work exists — both items need Christin/Hub. If an answer arrived, act on it (for MCP/deploy, see the file).
- Screenshot regen: `scripts/demo-screenshots/README.md`.
- venv: `cd backend && .venv/bin/python -m pytest -q` (598). frontend: `pnpm test -- --run` (382) + `pnpm exec svelte-check --threshold error` (0/0).
- **Frontend build trap:** `pnpm run build` wipes git-tracked `frontend/build/node_modules` → `git checkout -- frontend/build/node_modules` then `git add -fA frontend/build`.
- Screenshot tooling: `/tmp/pwshot` (playwright 1.49 + chromium, apt deps installed). Script `/tmp/pwshot/shot.mjs <url> <out>` (NOTE: /tmp is wiped on respawn — reinstall if needed: `cd /tmp/pwshot && npm i playwright@1.49.0` + `npx playwright install chromium`).
- Guardrail: prod-deploy to .171 ONLY after Hub check-in. Deploy procedure: memory `prod-deployment`. STATE/ROADMAP write-handlers don't parse this repo → edit directly.
- Ledger: `POST localhost:7890/api/agent-open-tasks`. Activity reports: `POST /api/activity-reports`.
