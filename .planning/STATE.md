---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-14T03:25:00Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 10
  completed_plans: 1
  percent: 10
---

# STATE: Proxmox Self-Service GUI

**Last updated:** 2026-05-14
**Mode:** yolo
**Granularity:** coarse

## Project Reference

**Core value:** Users can self-provision and manage VMs/LXCs on Proxmox through a polished, opinionated UI — without ever needing to open the Proxmox web interface.

**Current focus:** Phase 01 — Foundation

## Current Position

Phase: 01 (Foundation) — EXECUTING
Current Plan: 2 of 10 (01-02 db-schema is next)

- **Milestone:** v1
- **Phase:** 01 — Foundation (executing)
- **Plan:** 01-01 backend-scaffold ✅ complete
- **Status:** Executing Phase 01
- **Progress:** `[█░░░░░░░░░] 1/10 plans, 0/5 phases`

## Phases at a Glance

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Foundation | Not started | 19 |
| 2 | Multi-Cluster Inventory, Quotas & Audit | Not started | 23 |
| 3 | Job Queue & Lifecycle | Not started | 16 |
| 4 | Provisioning, Networking & Console | Not started | 27 |
| 5 | Polish & Operational Hardening | Not started | 4 |

**Coverage:** 89/89 v1 requirements mapped.

## Performance Metrics

- **Phases complete:** 0/5
- **Plans complete:** 1/10
- **Requirements shipped:** 2/89 (API-01, API-03 via Plan 01-01)
- **Out-of-scope items deferred:** see REQUIREMENTS.md v2 section

### Plan Metrics

| Phase | Plan | Duration | Tasks | Files | Tests   |
|-------|------|----------|-------|-------|---------|
| 01    | 01   | ~25 min  | 2     | 25    | 33 pass |

## Accumulated Context

### Decisions (locked in during initialization)

| Decision | Rationale | Locked at |
|----------|-----------|-----------|
| Multi-tenant + quotas in v1 | Hetzner-style self-service from day one; cannot retrofit | PROJECT.md |
| Multi-cluster from v1 | User has the need now; URL-shape decision can't be deferred | PROJECT.md |
| Local auth in v1; OIDC v2 | Faster ship; minimize external dependencies | PROJECT.md |
| Embedded noVNC via iframe | Fastest path; custom console deferred to v2 | PROJECT.md |
| REST API as primary contract; UI consumes it | Forces parity; enables Terraform/Ansible from day one | PROJECT.md |
| Helper-script install | Dogfoods the community-scripts pattern | PROJECT.md |
| Tech stack: Python 3.12 + FastAPI + SvelteKit + SQLite (WAL) + arq | Single mature Proxmox client (proxmoxer); single-LXC fit | research/STACK.md |
| Per-cluster API token (not user-ticket forwarding) | Tokens are stateless, no 2h expiry, no CSRF dance | research/PITFALLS.md (Pitfall 9) |
| Cluster ID in URL path (`/clusters/{id}/...`) from day one | Cannot retrofit; prevents ambient-context bugs | research/ARCHITECTURE.md |
| Plan 01 owns app/main.py + app/core/*; Plan 02 owns app/models/__init__.py | Ownership split keeps the foundation isolated from concrete model imports | Plan 01-01 |
| Settings.__repr__ redacts jwt_secret/pat_pepper as defense-in-depth | T-01-01-07 mitigation beyond the docstring prohibition; attribute stays plain str so jwt.encode/sha256 contracts hold | Plan 01-01 SUMMARY |
| run_migrations tolerates missing alembic.ini until Plan 02 lands the migrations directory | Lets Plan 01 ship the lifespan call without coupling to Plan 02's timing | Plan 01-01 SUMMARY |
| EncryptedSecret reads its cipher via module-level install_cipher / _get_cipher singleton | SQLAlchemy TypeDecorator runs outside FastAPI request context — request.app.state is unreachable | Plan 01-01 (RESEARCH §Pattern 3) |

### Open Questions (resolve before/during named phase)

- **Phase 1 ADR:** Single super-token vs. per-tenant privilege-separated Proxmox tokens — research strongly favors per-tenant; complexity tradeoff must be weighed.
- **Phase 1 ADR:** `asyncio.to_thread()` vs. async proxmoxer backend — confirm thread-pool sizing for concurrent calls.
- **Phase 4 spike:** SDN reload/applied semantics through proxmoxer (MEDIUM-LOW confidence).
- **Phase 4 spike:** noVNC vncticket single-encoding verification.
- **Phase 4 spike:** Community-scripts non-interactive execution mechanics.

### Todos

- [x] Plan Phase 1 via `/gsd-plan-phase 1`
- [x] Execute Plan 01-01 backend-scaffold
- [ ] Execute Plan 01-02 db-schema (next — adds app/models/__init__.py + alembic + initial migration)
- [ ] Schedule SDN/noVNC/community-scripts spikes in Phase 4 planning

### Blockers

None.

## Session Continuity

**To resume:** Run `/gsd-execute-phase 1` to continue with Plan 01-02 (db-schema).

**Next milestone:** First end-to-end "click → running VM/LXC" lands at the end of Phase 4.

**Recently completed:**

- 2026-05-14 — Plan 01-01 backend-scaffold (FastAPI app factory + 7 core primitives, 33 tests green)
- 2026-05-14 — Project research (STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md)
- 2026-05-14 — Requirements definition (89 v1 requirements across 13 categories)
- 2026-05-14 — Roadmap (5-phase structure, 100% coverage)

**Last session:** 2026-05-14T03:25:00Z
**Stopped at:** Completed Plan 01-01; ready for Plan 01-02
**Resume file:** `.planning/phases/01-foundation/01-02-db-schema-PLAN.md`

---
*State managed by GSD; do not edit phase counts manually — use `/gsd-transition` and `/gsd-progress`.*

**Planned Phase:** 01 (Foundation) — 10 plans — 2026-05-14T02:54:17.732Z
