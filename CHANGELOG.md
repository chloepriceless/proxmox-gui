# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project uses [Semantic Versioning](https://semver.org/) (pre-1.0).

## [0.6.3] — 2026-06-06

### Fixed
- **`/api/v1/health` now reports the real version.** The liveness probe (and
  the FastAPI `version` / OpenAPI `info.version`) were hardcoded to `0.1.0` and
  never tracked the version catch-up — a live `0.6.2` deploy advertised itself
  as `0.1.0`. The version is now resolved once from the installed package
  metadata (`app.__version__` via `importlib.metadata`), so a per-release
  deploy reports the version it actually shipped. Added a regression test that
  pins the probe to `app.__version__` rather than a literal.

## [0.6.2] — 2026-06-05

### Fixed
- **Production build now actually carries the D-13 fix.** `0.6.1` bumped the
  `+page.svelte` source for the backup-storage empty-state/load-error handling
  but committed a *stale* `frontend/build/` artifact (the frontend build was
  last regenerated in the 05-06 build, before D-13). A deploy from the `0.6.1`
  tree would have shipped the UI *without* the fix. `0.6.2` regenerates and
  commits the production build so the deployed artifact matches the source.
  (No source-behaviour change beyond `0.6.1`; build-integrity fix.)

## [0.6.1] — 2026-06-05

### Fixed
- **Cluster admin → Backup storage**: the picker no longer silently swallows a
  failed storage-list load (D-13). An empty Select now distinguishes "no
  backup-capable storage exists in this cluster" — with an actionable hint to
  enable the `VZDump backup file` content type (or add a PBS/NFS/Directory
  backup storage) in Proxmox — from "couldn't load the storage list", which is
  now surfaced verbatim instead of looking identical to an empty cluster.

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
