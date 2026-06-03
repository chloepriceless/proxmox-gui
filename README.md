# Proxmox Self-Service GUI

A self-hosted, Hetzner-Cloud-style web portal for **Proxmox VE**. Users can
self-provision and manage VMs/LXCs through a polished, opinionated UI —
without ever needing to open the Proxmox web interface. Multi-tenant
(teams + quotas), multi-cluster (PVE 8.x+), full lifecycle (create,
power, snapshot, backup, resize, clone, migrate), REST API + UI, embedded
noVNC, SDN networking, community-scripts templates. Ships as a single
LXC installed via a one-line helper-script.

## Status

**Phases 1–4 complete; Phase 5 code-complete (6/7) — operator UAT pending** —
see [`.planning/STATE.md`](./.planning/STATE.md).

| Phase | Name                                          | Status                         |
|-------|-----------------------------------------------|--------------------------------|
| 1     | Foundation                                    | ✅ Complete                    |
| 2     | Multi-Cluster Inventory, Quotas & Audit       | ✅ Complete                    |
| 3     | Job Queue & Lifecycle                         | ✅ Complete                    |
| 4     | Provisioning, Networking & Console            | ✅ Complete (noVNC live-tested)|
| 5     | Polish & Operational Hardening                | ◆ Code-complete (6/7; UAT pending) |

Test status: **598 backend tests + 382 frontend tests green**, `svelte-check`
clean. The remaining Phase-5 items are two human gates — an operator
end-to-end UAT on the live LXC and a manual accessibility audit (the automated
axe-core half passes).

### What works today

- One-line installer creates an unprivileged LXC on a Proxmox VE 8.x host
- First-run setup wizard: admin account + first cluster registration
- Account: profile, password change, SSH keys, Personal Access Tokens
- Admin: user CRUD, cluster CRUD with PVE-side pool/user/token bootstrap, **Settings page**
- Inventory: cross-cluster list, VM/LXC detail with RRD sparklines, tags + notes, filters
- **Full lifecycle** (durable arq job queue + UPID polling): power, snapshot,
  backup (+ scheduled retention), resize, clone, migrate — surfaced live in a
  Tasks drawer over WebSocket
- **Provisioning wizards**: LXC + VM (multiple source paths), Cloud-Init editor,
  SDN network picker, node-fit hint, quota admission
- **Community-scripts** templates run via `pct exec` inside the new container
  (commit-pinned, attribution surfaced), gated by an SSH-trust preflight
- **Embedded noVNC console** (GUI-origin relay, vncticket-authenticated)
- Per-team quotas with admin-side editor + admission preview
- Audit log with CSV export (RFC 4180 + BOM + formula-injection safe) +
  nightly retention rotation into downloadable `.csv.gz` archives
- **Idle session timeout**: 2-min countdown toast + in-place re-auth modal
  (preserves route/state); server-authoritative
- **In-app self-update** (DEPLOY-04): admin-triggered, SHA-256-verified release,
  WAL-safe DB snapshot, atomic symlink swap, auto-rollback on a failed health
  check — also re-runnable via `install.sh --update`
- **Mobile reflow**: hamburger nav drawer, inventory card stack, console scaling
- TLS fingerprint pinning for self-signed PVE; Caddy CSP; Redis-backed rate limiter
- Multi-tenant via Proxmox pools + privilege-separated per-tenant tokens

### Remaining before v1.0 ships

- Operator end-to-end UAT against the live LXC (Phase 5, plan 05-07)
- Manual accessibility audit — keyboard / screen-reader / contrast (the
  automated axe-core audit already passes)

## Install (one-liner)

### Prerequisites

- **Proxmox VE 8.x host** with `pct` + `pvesh` available
- **Debian 12 LXC template** (installer downloads it if missing)
- **Outbound internet** from the host to:
  `github.com`, `deb.debian.org`, `astral.sh`, `registry.npmjs.org`, `pypi.org`
- **IPv4 connectivity** — IPv6 is not required
- **Min. 8 GB disk + 2 GB RAM** for the LXC (defaults; tunable)
- **~5 min** typical install time

Run **on the Proxmox VE 8.x host** (NOT inside an existing LXC):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/chloepriceless/proxmox-gui/master/deploy/install.sh)"
```

The installer creates a fresh unprivileged LXC, drops in a service user,
materialises secrets, applies migrations, and starts Caddy + the API.
Then open `https://<lxc-ip>/setup` to run the first-run wizard.

Tune resources via env or flags (full list in [`deploy/README.md`](./deploy/README.md)):

```bash
CPU=4 RAM_MB=4096 DISK_GB=20 STORAGE=local-zfs \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/chloepriceless/proxmox-gui/master/deploy/install.sh)"
```

## Local dev

**Backend** (Python 3.12 + FastAPI):

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

**Frontend** (SvelteKit 2 + Svelte 5 + Tailwind v4, **pnpm**):

```bash
cd frontend
pnpm install
pnpm dev           # dev server (proxies /api → backend on :8000)
pnpm test -- --run # vitest suite
pnpm exec svelte-check --threshold error
pnpm run build     # production build (adapter-node) — commit the build/ artifact
```

> Note: `frontend/build/` is a committed artifact. `pnpm run build` wipes the
> git-tracked `frontend/build/node_modules`; restore it with
> `git checkout -- frontend/build/node_modules` before `git add -fA frontend/build`.

Per-subsystem READMEs (backend, frontend, deploy) drill into specifics.

## Project layout

```
proxmox-gui/
├── README.md                 # you are here
├── CLAUDE.md                 # AI-assistant project guardrails
├── .planning/                # GSD planning artifacts (PROJECT, ROADMAP, STATE, ...)
│
├── backend/                  # FastAPI + SQLAlchemy 2.0 async + Alembic
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── core/             # cipher, jwt, passwords, csrf, db
│   │   ├── auth/             # /api/v1/auth/* (login, refresh, keepalive)
│   │   ├── users/, teams/, clusters/, ssh_keys/, pats/, setup/
│   │   ├── clusters/         # connector (circuit breaker), registry, probe
│   │   ├── jobs/             # arq worker, UPID poller, lifecycle + self-update jobs
│   │   ├── lifecycle/, provisioning/, networks/, iso/, catalog/, console/
│   │   ├── quotas/, audit/, notifications/, selfupdate/
│   │   ├── models/           # SQLAlchemy ORM
│   │   └── proxmox/          # proxmoxer wrapper
│   └── tests/
│
├── frontend/                 # SvelteKit (adapter-node)
│   ├── package.json
│   ├── svelte.config.js
│   └── src/
│       ├── routes/
│       └── lib/
│
└── deploy/                   # helper-script + systemd + Caddy
    ├── install.sh            # one-line entry (runs on PVE host); --update re-runs in place
    ├── lxc/bootstrap.sh      # idempotent inner install (releases/<tag> + current symlink)
    ├── lxc/update.sh         # shared in-LXC update routine (self-update + install.sh --update)
    ├── systemd/              # proxmox-gui-api + -worker + -frontend units
    ├── caddy/Caddyfile.template
    └── scripts/              # gen-master-key, gen-jwt-secret
```

## License

License: TBD — choice between AGPL-3.0 and MIT is open until first
public release. Until a `LICENSE` file lands, treat this code as "all
rights reserved" by the project authors.

## Contributing / Roadmap

The project uses the GSD (Get Shit Done) workflow. Phases are planned,
checked, executed, and verified sequentially. See:

- [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) — phase structure
- [`.planning/REQUIREMENTS.md`](./.planning/REQUIREMENTS.md) — v1 requirements + traceability
- [`.planning/STATE.md`](./.planning/STATE.md) — current execution state

## Documentation

- [`.planning/PROJECT.md`](./.planning/PROJECT.md) — vision, locked decisions, out-of-scope
- [`.planning/research/STACK.md`](./.planning/research/STACK.md) — stack rationale
- [`.planning/research/ARCHITECTURE.md`](./.planning/research/ARCHITECTURE.md) — modular monolith, per-cluster connector, URL-shape decisions
- [`.planning/research/PITFALLS.md`](./.planning/research/PITFALLS.md) — the 25 Proxmox traps that bit prior art
- [`CLAUDE.md`](./CLAUDE.md) — AI-assistant guardrails (also useful as project orientation)
