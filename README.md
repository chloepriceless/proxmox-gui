# Proxmox Self-Service GUI

A self-hosted, Hetzner-Cloud-style web portal for **Proxmox VE**. Users can
self-provision and manage VMs/LXCs through a polished, opinionated UI —
without ever needing to open the Proxmox web interface. Multi-tenant
(teams + quotas), multi-cluster (PVE 8.x+), full lifecycle (create,
power, snapshot, backup, resize, clone, migrate), REST API + UI, embedded
noVNC, SDN networking, community-scripts templates. Ships as a single
LXC installed via a one-line helper-script.

## Status

**Phase 2 of 5 complete (smoke-test pending)** — see [`.planning/STATE.md`](./.planning/STATE.md).

| Phase | Name                                          | Status        |
|-------|-----------------------------------------------|---------------|
| 1     | Foundation                                    | Complete      |
| 2     | Multi-Cluster Inventory, Quotas & Audit       | Smoke pending |
| 3     | Job Queue & Lifecycle                         | Planned       |
| 4     | Provisioning, Networking & Console            | Planned       |
| 5     | Polish & Operational Hardening                | Planned       |

### What works today

- One-line installer creates an unprivileged LXC on a Proxmox VE 8.x host
- First-run setup wizard: admin account + first cluster registration
- Account: profile, password change, SSH keys, Personal Access Tokens
- Admin: user CRUD, cluster CRUD with PVE-side pool/user/token bootstrap
- Inventory **read-only**: cross-cluster list, VM/LXC detail with RRD sparklines, tags + notes
- Per-team quotas with admin admin-side editor + admission preview
- Audit log with CSV export (RFC 4180 + BOM + formula-injection safe)
- Multi-tenant via Proxmox pools + privilege-separated per-tenant tokens

### Not yet built (next phases)

- VM/LXC **provisioning** (Phase 4)
- Power actions, snapshots, backups, resize, clone, migrate (Phase 3)
- Embedded noVNC console (Phase 4)
- Cloud-Init editor, SDN picker, community-scripts templates (Phase 4)
- Mobile polish, self-update, idle timeout (Phase 5)

## Install (one-liner)

Run **on your Proxmox VE 8.x host** (NOT inside an LXC):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/chloepriceless/proxmox-gui/master/deploy/install.sh)"
```

Then open `https://<lxc-ip>/setup` in your browser. Full installer
documentation, configuration flags, and persistent-state backup notes
live in [`deploy/README.md`](./deploy/README.md).

## Local dev

**Backend** (Python 3.12 + FastAPI):

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

**Frontend** (SvelteKit 2 + Svelte 5 + Tailwind v4):

```bash
cd frontend
npm install
npm run dev
```

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
│   │   ├── auth/             # /api/v1/auth/*
│   │   ├── users/, teams/, clusters/, ssh_keys/, pats/, setup/
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
    ├── install.sh            # one-line entry (runs on PVE host)
    ├── lxc/bootstrap.sh      # idempotent inner install
    ├── systemd/              # proxmox-gui-api + proxmox-gui-worker units
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
