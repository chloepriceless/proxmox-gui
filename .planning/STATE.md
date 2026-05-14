# STATE: Proxmox Self-Service GUI

**Last updated:** 2026-05-14
**Mode:** yolo
**Granularity:** coarse

## Project Reference

**Core value:** Users can self-provision and manage VMs/LXCs on Proxmox through a polished, opinionated UI — without ever needing to open the Proxmox web interface.

**Current focus:** Roadmap defined; ready to plan Phase 1 (Foundation).

## Current Position

- **Milestone:** v1
- **Phase:** Not started (next: Phase 1 — Foundation)
- **Plan:** None
- **Status:** Roadmap complete, awaiting `/gsd-plan-phase 1`
- **Progress:** `[░░░░░░░░░░] 0/5 phases`

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
- **Plans complete:** 0/?
- **Requirements shipped:** 0/89
- **Out-of-scope items deferred:** see REQUIREMENTS.md v2 section

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

### Open Questions (resolve before/during named phase)

- **Phase 1 ADR:** Single super-token vs. per-tenant privilege-separated Proxmox tokens — research strongly favors per-tenant; complexity tradeoff must be weighed.
- **Phase 1 ADR:** `asyncio.to_thread()` vs. async proxmoxer backend — confirm thread-pool sizing for concurrent calls.
- **Phase 4 spike:** SDN reload/applied semantics through proxmoxer (MEDIUM-LOW confidence).
- **Phase 4 spike:** noVNC vncticket single-encoding verification.
- **Phase 4 spike:** Community-scripts non-interactive execution mechanics.

### Todos

- [ ] Plan Phase 1 via `/gsd-plan-phase 1`
- [ ] Schedule SDN/noVNC/community-scripts spikes in Phase 4 planning

### Blockers

None.

## Session Continuity

**To resume:** Run `/gsd-plan-phase 1` to begin planning Phase 1 (Foundation).

**Next milestone:** First end-to-end "click → running VM/LXC" lands at the end of Phase 4.

**Recently completed:**
- 2026-05-14 — Project research (STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md)
- 2026-05-14 — Requirements definition (89 v1 requirements across 13 categories)
- 2026-05-14 — Roadmap (5-phase structure, 100% coverage)

---
*State managed by GSD; do not edit phase counts manually — use `/gsd-transition` and `/gsd-progress`.*
