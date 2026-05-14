# CLAUDE.md — Proxmox Self-Service GUI

This file gives Claude Code (or any AI assistant) the orientation it needs to do useful work in this repo.

## Project

**Proxmox Self-Service GUI** — a self-hosted, Hetzner-Cloud-style web portal for Proxmox VE. Multi-tenant, multi-cluster, full VM/LXC lifecycle, REST API + UI, embedded noVNC, SDN networking, community-scripts templates. Ships as a single LXC installed via a one-line helper-script.

**Core Value:** Users can self-provision and manage VMs/LXCs on Proxmox through a polished UI — without ever opening Proxmox directly.

See `.planning/PROJECT.md` for the authoritative project context.

## Technology Stack

- **Backend:** Python 3.12 + FastAPI (REST + WebSocket)
- **Proxmox client:** `proxmoxer` 2.3.x (the only mature Proxmox API client)
- **Database:** SQLite (SQLAlchemy 2.0 async + `aiosqlite`) in WAL mode, Alembic migrations
- **Job queue:** `arq` + embedded Redis (durable UPID polling, orphan reaper)
- **Auth:** `pwdlib[argon2]` + PyJWT (short-lived access + DB-stored refresh tokens)
- **Frontend:** SvelteKit 2 + Svelte 5 + Tailwind v4 + `shadcn-svelte`
- **Reverse proxy:** Caddy 2 (in the LXC, auto-HTTPS)
- **Deployment:** Single LXC, one-line helper-script install

Full rationale + alternatives: `.planning/research/STACK.md`.

## Architecture

Modular monolith, single binary, single LXC. Components:
- HTTP/REST + WebSocket layer (FastAPI)
- Embedded SvelteKit SPA
- Per-cluster Proxmox connector with circuit breaker + health probe
- arq job worker (UPID polling, orphan reaper on boot)
- SQLite for users, teams, quotas, clusters, audit log, job state
- Caddy reverse proxy in the LXC

Multi-cluster identity: cluster ID lives in URL path (`/api/v1/clusters/{id}/vms/{vmid}`), never in JWT/header.

Full architecture: `.planning/research/ARCHITECTURE.md`.

## Proxmox-Specific Constraints (Critical)

These come from `.planning/research/PITFALLS.md` and must not be violated:

1. **Every mutating Proxmox call returns a UPID** — every HTTP write must enqueue a job, return `202`, and let the worker poll. No sync waiting on Proxmox.
2. **Persist UPIDs before polling** — Proxmox tasks can finish before the first poll; race condition mitigation is foundational.
3. **Use API tokens for backend→PVE auth** (no CSRF, revocable). Tickets only for noVNC iframe minting. Never expose the API token to the browser.
4. **vncticket lifetime is ~30–40s** — mint on user click, not on page load. URL-encode exactly once (double-encoding silently fails).
5. **`cicustom` snippets require snippets-enabled storage** — preflight check is mandatory.
6. **VMID race condition** — `/cluster/nextid` is not atomic on older PVE; app-level locking required.
7. **Multi-tenancy must use Proxmox pools + privilege-separated tokens per tenant** — never a single super-token with app-level filtering.
8. **Community-scripts must run via `pct exec` inside the freshly-created LXC**, never on the host. Pin to commit hashes. Surface attribution.

## Project Layout

```
.planning/             — GSD planning artifacts (don't edit manually)
  PROJECT.md           — Project context (evolves at milestones)
  REQUIREMENTS.md      — v1 requirements + traceability
  ROADMAP.md           — Phase structure
  STATE.md             — Current state (Claude reads this first)
  config.json          — Workflow config (yolo, coarse, opus+sonnet)
  research/            — STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY
  phase-N/             — Per-phase plans, verifications, etc.
```

The application code lives at the repo root (to be scaffolded in Phase 1).

## GSD Workflow

This project uses **GSD (Get Shit Done)** workflow. Phases are planned and executed sequentially, with research, plan-check, and verifier agents enabled.

**Current config** (`.planning/config.json`):
- Mode: `yolo` (auto-approve at gates)
- Granularity: `coarse` (5 phases)
- Parallelization: enabled
- Model profile: `quality` (Opus for research/roadmap, Sonnet for execution)
- Research before each phase: **on**
- Plan check: **on**
- Verifier: **on**

**Phases:**
1. Foundation — auth, multi-tenant schema, encrypted token storage, OpenAPI shell, UI skeleton, first-run installer
2. Multi-Cluster Inventory, Quotas & Audit — read-only dashboard, quotas (admission control), audit log
3. Job Queue & Lifecycle — arq + UPID polling, power actions, snapshots, backups, resize, clone, migrate
4. Provisioning, Networking & Console — LXC + VM wizards, Cloud-Init editor, SDN picker, noVNC (3 research spikes)
5. Polish & Operational Hardening — mobile, idle timeout, audit retention, self-update, packaging

## Workflow Rules for Claude

1. **Always read `.planning/STATE.md` first** to know where the project is.
2. **Never edit `.planning/*` manually** — use GSD commands (`/gsd-plan-phase`, `/gsd-execute-phase`, etc.).
3. **Atomic commits per task** — small, focused commits with conventional commit messages.
4. **Don't bypass the Proxmox constraints above** — they aren't suggestions.
5. **Multi-tenancy invariants are foundational** — the data model carries `tenant_id` on every relevant row from Phase 1. Don't shortcut.
6. **For long-running Proxmox operations, always go through the job queue** — never block an HTTP request on a UPID poll.
7. When in doubt, consult `.planning/research/PITFALLS.md`.

## Common Commands

- `/gsd-progress` — Show current phase, plans, status, suggest next step
- `/gsd-plan-phase N` — Plan phase N (creates PLAN.md)
- `/gsd-execute-phase N` — Execute all plans in phase N
- `/gsd-discuss-phase N` — Gather phase context before planning
- `/gsd-help` — Full command list

## What's Out of Scope

Don't implement these — they're explicitly excluded (see `.planning/PROJECT.md` and `REQUIREMENTS.md`):

- Storage pool / ZFS / LVM management (Proxmox UI's job)
- Cluster formation / node join
- Firewall rule management (v2+)
- Multi-hypervisor support (Proxmox only by design)
- Bulk Delete (catastrophic surface area)
- OIDC/SSO (v2)
- Built-in monitoring/alerting (separate product)
- Plugin system (v2+)

---

*Generated 2026-05-14 during project initialization. Update via `/gsd-progress` or after phase transitions.*
