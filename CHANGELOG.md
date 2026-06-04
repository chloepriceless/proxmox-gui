# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project uses [Semantic Versioning](https://semver.org/) (pre-1.0).

## [0.6.0] — 2026-06-04

First tagged release. The version is a deliberate, honest catch-up: the project
sat at `0.1.0` through five built phases, so this baselines it at `0.6.0`
(Phases 1–5 ≈ `0.5.x`, plus the MCP server feature below).

### Added
- **MCP server** (T-0032) — a stdio Model-Context-Protocol bridge
  (`python -m app.mcp`, optional `[mcp]` extra) exposing tools to create / list
  / start / stop / delete VMs and LXCs. Implemented as a thin client of the
  GUI's own REST API authenticated with a PAT, so it inherits the full RBAC,
  quota, audit and job-queue model. See `docs/MCP.md`.
- Authenticated README screenshots (cross-cluster inventory + VM detail)
  rendered from a safe, fictional demo harness (`scripts/demo-screenshots/`).

### Baselined in this release (built across Phases 1–5)
- **Phase 1** — auth (argon2 + JWT + DB refresh tokens, PATs), multi-tenant
  schema, encrypted token storage, OpenAPI shell, UI skeleton, first-run installer.
- **Phase 2** — multi-cluster read-only inventory, per-team quotas with
  admission control, audit log.
- **Phase 3** — durable arq job queue + UPID polling, power actions, snapshots,
  backups (+ scheduled retention), resize, clone, migrate.
- **Phase 4** — LXC + VM provisioning wizards, Cloud-Init editor, SDN picker,
  community-scripts catalog, embedded noVNC console.
- **Phase 5** — mobile reflow, idle session timeout, audit retention archives,
  admin settings, in-app self-update (DEPLOY-04 release/`current` layout),
  SSH-trust preflight, Caddy CSP.

### Deployed
- Phase 5 deployed to the live instance and migrated to the
  `releases/<tag>` + atomic `current` symlink layout (alembic `0007_phase5`).

[0.6.0]: https://github.com/chloepriceless/proxmox-gui/releases/tag/v0.6.0
