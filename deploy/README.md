# deploy/ — Proxmox GUI helper-script install

This directory ships the **one-line installer** for the Proxmox Self-Service GUI.
An operator runs a single curl|bash on their Proxmox VE 8.x host and arrives at
a freshly-provisioned LXC running the FastAPI backend + SvelteKit UI behind
Caddy with auto-HTTPS (self-signed for LAN; Let's Encrypt-ready for public).

> **Status:** Phase 2 of 5 (Multi-Cluster Inventory). Read-only inventory, audit,
> and quotas surfaces are live; provisioning (Phase 4), power/snapshots (Phase 3),
> and self-update polish (Phase 5) are still to come.

## Prerequisites

- Proxmox VE 8.x host with `pct` and `pvesh` (run as root or with `sudo`)
- Debian 12 LXC template (installer fetches it if missing)
- Outbound HTTPS from the host to:
  - `github.com` + `raw.githubusercontent.com` (source + standalone pnpm)
  - `deb.debian.org` (apt packages)
  - `astral.sh` (uv installer)
  - `pypi.org` (Python wheels)
  - `registry.npmjs.org` (frontend deps)
- **IPv4** is sufficient — the bootstrap forces IPv4-first DNS for npm-registry
  traffic to avoid IPv6 timeouts on hosts without routed IPv6
- Free LXC ID via `pvesh get /cluster/nextid` (or pass `--ctid` / `CTID=`)
- Recommended host resources: 2 vCPU, 2 GB RAM, 8 GB disk (defaults below)

## One-line install

Run **on the Proxmox VE 8.x host** (NOT inside an LXC):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/chloepriceless/proxmox-gui/master/deploy/install.sh)"
```

> If the repo is private, replace the raw-content URL with a
> token-authenticated curl or override `REPO_URL` to point at a
> reachable mirror.

This will:

1. Verify the host is Proxmox VE (`pct` + `pvesh` present).
2. Download the Debian 12 LXC template if missing (D-16).
3. Create an **unprivileged** LXC with `nesting=1,keyctl=1` features
   (D-17, Pitfall 19 — never `--privileged 1`).
4. Boot the LXC, wait for DHCP, then `pct exec` the inner
   `lxc/bootstrap.sh` to install deps, lay out `/etc/proxmox-gui`,
   generate secrets, build the app, install systemd units, and start
   `proxmox-gui-api` + `caddy`.
5. Print the URL of the first-run wizard.

## Configuration

All settings have sensible defaults. Override via env vars **or** flags
(flags win when both are set).

| Setting     | Env var      | Flag           | Default                              |
|-------------|--------------|----------------|--------------------------------------|
| LXC id      | `CTID`       | `--ctid`       | `pvesh get /cluster/nextid`          |
| Hostname    | `HOSTNAME`   | `--hostname`   | `proxmox-gui`                        |
| vCPU        | `CPU`        | `--cpu`        | `2`                                  |
| RAM (MB)    | `RAM_MB`     | `--ram`        | `2048`                               |
| Disk (GB)   | `DISK_GB`    | `--disk`       | `8`                                  |
| Storage     | `STORAGE`    | `--storage`    | `local-lvm`                          |
| Bridge      | `BRIDGE`     | `--bridge`     | `vmbr0`                              |
| Repo URL    | `REPO_URL`   | `--repo-url`   | `https://github.com/chloepriceless/proxmox-gui` |
| Git ref     | `RELEASE`    | `--release`    | `master`                             |

Example with a few overrides:

```bash
CPU=4 RAM_MB=4096 STORAGE=local-zfs \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/chloepriceless/proxmox-gui/master/deploy/install.sh)"
```

## Post-install

1. Visit `https://<LXC-IP>/setup` in your browser. Accept the self-signed
   certificate (Caddy `tls internal` issues a local-CA cert per D-18 +
   Pitfall A9 — public-hostname auto-HTTPS lands when you configure
   `$PUBLIC_HOSTNAME` in `/etc/caddy/Caddyfile`).
2. The first-run wizard creates the initial admin user (D-19); cluster
   registration and SSH-key import are optional and can be done from
   Settings afterwards (D-18 "lenient").

## Persistent state — back this up

> **Pitfall 22 — back up the GUI's own state, not just the VMs it manages.**

| Path                              | What it is                              | Restore behavior                |
|-----------------------------------|-----------------------------------------|---------------------------------|
| `/etc/proxmox-gui/master.key`     | 32 random bytes; Fernet root key (D-14) | Required to decrypt PVE tokens. |
| `/etc/proxmox-gui/jwt.secret`     | JWT signing secret (D-15)               | Lose it → all sessions logged out. |
| `/etc/proxmox-gui/pat.pepper`     | PAT secret pepper                       | Lose it → all PATs invalid (revoke + reissue). |
| `/var/lib/proxmox-gui/app.db`     | SQLite WAL DB (users, teams, clusters)  | Restore alongside master.key.   |

### File permissions (enforced by `bootstrap.sh` + `gen-*.sh`)

- `/etc/proxmox-gui/` directory: mode `0700` owned by `proxmox-gui` (Pitfall A6).
- master.key: mode 0400 owned by proxmox-gui (more restrictive than D-14's 0600 minimum) — read-only owner; FastAPI never writes after generation.
- `jwt.secret` and `pat.pepper`: likewise mode `0400` owned by `proxmox-gui`.
- App startup re-validates these (Pitfall A6: `st_mode & 0o077 == 0` or refuse to start).

> Phase 5 will ship a `proxmox-gui backup` CLI that bundles the four paths
> above into a single timestamped tarball and pushes it to S3 / NFS /
> Proxmox `backup` storage (DEPLOY-04).

## systemd units

Three units ship in `deploy/systemd/` and `bootstrap.sh` installs them to
`/etc/systemd/system/`:

| Unit                            | State              | Notes                                                              |
|---------------------------------|--------------------|--------------------------------------------------------------------|
| `proxmox-gui-api.service`       | enabled + running  | uvicorn on 127.0.0.1:8000.                                         |
| `proxmox-gui-worker.service`    | enabled + running  | arq job worker — runs `arq app.jobs.worker.WorkerSettings`; depends on `redis-server`. |
| `caddy.service`                 | enabled + running  | Distribution-default unit; we provide only the Caddyfile.          |

### Embedded Redis (Phase 3)

Phase 3 adds a **4th runtime service**: `redis-server` (the Debian stock
package). `bootstrap.sh` installs it and enforces that it binds **loopback
only** — `/etc/redis/redis.conf` ships `bind 127.0.0.1 -::1` and
`protected-mode yes`, and the bootstrap guards that the `bind` line is
present. Redis is auth-less on loopback and **never** reachable outside the
LXC. The `proxmox-gui-worker.service` unit `Requires=redis-server.service`;
the arq job queue and the Tasks-drawer pub/sub channel both run over it.

Inspect logs:

```bash
journalctl -u proxmox-gui-api -f
journalctl -u caddy -f
```

The api unit hardens with `NoNewPrivileges=true`, `PrivateTmp=true`,
`ProtectSystem=full`, `ProtectHome=true`, and a tight `ReadWritePaths=`
that allows only `/var/lib/proxmox-gui` and `/var/log/proxmox-gui`
(ASVS V14.1).

## Manual idempotence test (DEPLOY-02)

After the first install completes, re-running `bootstrap.sh` MUST be safe.
SSH into the LXC (`pct enter <ctid>`) and run:

```bash
bash /opt/proxmox-gui/deploy/lxc/bootstrap.sh
```

Expected output:

```
==> /etc/proxmox-gui/.installed present — running alembic upgrade head and exiting.
==> Migrations applied. Bootstrap idempotent-exit OK.
```

The script detects the `.installed` marker and short-circuits to just
`alembic upgrade head`. No package reinstall, no user re-create, no
secret regeneration.

## Caddyfile

`deploy/caddy/Caddyfile.template` is installed as `/etc/caddy/Caddyfile`
verbatim by `bootstrap.sh`. Phase 1 defaults to the `:443 { tls internal }`
form (LAN / self-signed, no DNS required). To switch to auto-HTTPS via
Let's Encrypt:

1. Edit `/etc/caddy/Caddyfile`, replace `:443 {` with `your.domain.example {`.
2. Ensure ports 80 + 443 are reachable from the public internet, and that
   your domain's A/AAAA records point at the LXC.
3. `systemctl reload caddy`.

Security headers shipped by default (ASVS V14.4):
`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`. The `Server` header is stripped. **CSP is intentionally
omitted in Phase 1** — Phase 5 polish hardens (acceptable v1 gap; documented).

## Known limitations (Phase 1)

- **No GPG-signed releases.** `curl | bash` over HTTPS is the only integrity
  check. Phase 5 ships a detached-signature flow (DEPLOY-04, T-01-04-01).
- **No self-update.** Re-running `bootstrap.sh` only migrates the DB; it
  does not pull a new release. Phase 5 adds `proxmox-gui upgrade` (DEPLOY-04).
- **No backup CLI.** Operator must back up the four paths above manually
  for now (Pitfall 22 — Phase 5 ships `proxmox-gui backup`).
- **No 2FA / OIDC.** v2 per `.planning/PROJECT.md`.
- **CSP not in Caddyfile.** Phase 5 polish.

## Files in this directory

```
deploy/
├── install.sh                    # one-line entry (runs on PVE host)
├── README.md                     # you are here
├── lxc/
│   └── bootstrap.sh              # idempotent inner install (runs in the LXC)
├── scripts/
│   ├── gen-master-key.sh         # writes /etc/proxmox-gui/master.key (D-14)
│   └── gen-jwt-secret.sh         # writes jwt.secret + pat.pepper
├── systemd/
│   ├── proxmox-gui-api.service   # uvicorn FastAPI on :8000
│   └── proxmox-gui-worker.service # arq job worker (Phase 3)
└── caddy/
    └── Caddyfile.template        # reverse proxy :443 -> :8000 + :3000
```
