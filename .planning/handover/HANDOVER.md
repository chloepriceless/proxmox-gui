# HANDOVER — Proxmox-GUI Head

**Updated:** 2026-06-04 pm · **Branch:** `master` @ `420f63e` (**v0.6.0**, pushed, clean tree).
**Operator:** Christin (von Perbandt) / company **Bikini Bottom Capital GmbH**. Hub peer = `agent-master-hub`.

## State: Phase 05 DEPLOYED LIVE + MCP server shipped. All assigned work delivered; 3 decisions await the Hub.
`autonomous_open=0, blocked_open=3`. Durable detail in repo-memory **`project-open-tasks.md`**.

**This session delivered (all pushed):**
1. **Screenshots** — authenticated README shots via safe demo harness (`scripts/demo-screenshots/`, commit `0836ab7`).
2. **Phase 05 DEPLOYED to live .171** (`https://192.168.20.171/`) — flat→releases/current migration via `update.sh`, alembic 0006→0007, verified. Rollback: `/root/phase05-rollback-20260604-125005/` + `app.db.bak-phase05-*` on .171.
3. **MCP server T-0032** — `backend/app/mcp/` (v0.6.0, commit `420f63e`), stdio↔REST bridge w/ PAT, 614 tests green, adversarial-reviewed, `docs/MCP.md`.

### 3 decisions awaiting the Hub (the only open items)
1. **T-0044 Phase A** spawner rollout — scope plan at `/home/dev/Report/2026-06-04_peer-spawner-phaseA-scope.md`; needs: pilot host (rec. LXC147), host-assignment policy, registry-decoupling (repo in /spawn payload). On go → build A0+A1.
2. **Self-update-button fix direction** — FOUND a real DEPLOY-04 bug: the unprivileged `proxmox-gui` worker runs `update.sh` without sudo, but `update.sh` writes `/etc/systemd/system` + `daemon-reload` (needs root); `sudo` isn't even installed on the LXC → the self-update button would abort. GUI/code features all work; only the self-update button is affected. Rec: split update.sh (worker does /opt part, root part via scoped sudoers/helper). Security-sensitive → flagged, not self-fixed on live.
3. **MCP scope detail** — add read-only infra-discovery tools (nodes/storages/templates) so `create_*` is usable unaided? (read-only, additive; would add on go.)

### Done (committed + pushed)
- **Phase 05 code-complete** (Phases 1–4 already done). 05-04 self-update (DEPLOY-04), 05-05 mobile/a11y code (UI-03), 05-06 idle-UX+admin-settings+self-update-UI+audit-archives+SSH-trust (AUTH-06/AUDIT-06/DEPLOY-04). Carryover verified closed in 05-02/03/04. **598 backend + 382 frontend tests green, svelte-check 0/0.** SUMMARYs: `.planning/phases/05-polish-operational-hardening/05-0{4,5,6}-SUMMARY.md`.
- **README** brought current + GUI sign-in screenshot (`docs/screenshot.png`, Playwright headless of live /login). 
- **Relicensed AGPL→MIT** — holder `Bikini Bottom Capital GmbH` (verified Handelsregister/LEI). LICENSE + pyproject + package.json + README.
- Registry self-update + activity-report backfill (4 units) done at the Hub.

_(The screenshots / MCP / deploy-go items that were blocked earlier this day are now all DONE — see the State section above. The 3 remaining decisions are listed there.)_

## Resume instructions
- After respawn: read `project-open-tasks.md` + the State section above. **No unblocked autonomous work** — all 3 remaining items need a Hub/operator decision. If an answer arrived, act on it (Phase A → build A0+A1 per the scope plan; self-update → the chosen fix direction; MCP discovery → add the read-only tools).
- MCP tests: `cd backend && .venv/bin/python -m pytest tests/test_mcp.py -q` (23). Full suite 614. MCP run: `docs/MCP.md`.
- Screenshot regen: `scripts/demo-screenshots/README.md`.
- venv: `cd backend && .venv/bin/python -m pytest -q` (598). frontend: `pnpm test -- --run` (382) + `pnpm exec svelte-check --threshold error` (0/0).
- **Frontend build trap:** `pnpm run build` wipes git-tracked `frontend/build/node_modules` → `git checkout -- frontend/build/node_modules` then `git add -fA frontend/build`.
- Screenshot tooling: `/tmp/pwshot` (playwright 1.49 + chromium, apt deps installed). Script `/tmp/pwshot/shot.mjs <url> <out>` (NOTE: /tmp is wiped on respawn — reinstall if needed: `cd /tmp/pwshot && npm i playwright@1.49.0` + `npx playwright install chromium`).
- Guardrail: prod-deploy to .171 ONLY after Hub check-in. Deploy procedure: memory `prod-deployment`. STATE/ROADMAP write-handlers don't parse this repo → edit directly.
- Ledger: `POST localhost:7890/api/agent-open-tasks`. Activity reports: `POST /api/activity-reports`.
