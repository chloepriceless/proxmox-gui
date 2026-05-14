---
phase: 01-foundation
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - deploy/install.sh
  - deploy/lxc/bootstrap.sh
  - deploy/systemd/proxmox-gui-api.service
  - deploy/systemd/proxmox-gui-worker.service
  - deploy/caddy/Caddyfile.template
  - deploy/scripts/gen-master-key.sh
  - deploy/scripts/gen-jwt-secret.sh
  - deploy/README.md
  - .gitignore
  - README.md
autonomous: true
requirements:
  - DEPLOY-01
  - DEPLOY-02
  - DEPLOY-03
  - DEPLOY-05
user_setup: []
tags:
  - deployment
  - helper-script
  - systemd
  - caddy
  - lxc
must_haves:
  truths:
    - "One-line install command form is documented in deploy/README.md: `bash -c \"$(curl -fsSL …/install.sh)\"`"
    - "install.sh is shellcheck-clean and runs `set -euo pipefail`"
    - "install.sh creates an unprivileged Debian 12 LXC with `nesting=1,keyctl=1` features (D-17, Pitfall 19)"
    - "bootstrap.sh inside the LXC creates the proxmox-gui service user, /etc/proxmox-gui directory mode 0700, master.key mode 0400 (Pitfall A6)"
    - "bootstrap.sh is idempotent — re-running with `.installed` marker present only runs `alembic upgrade head` (DEPLOY-02)"
    - "Three systemd units installed: proxmox-gui-api.service, proxmox-gui-worker.service, caddy.service (D-17)"
    - "Caddyfile.template reverse-proxies /api/* → 127.0.0.1:8000, /* → 127.0.0.1:3000"
    - "gen-master-key.sh writes 32 random bytes to /etc/proxmox-gui/master.key (D-14)"
  artifacts:
    - path: "deploy/install.sh"
      provides: "One-line helper-script entry point (DEPLOY-01)"
      min_lines: 60
    - path: "deploy/lxc/bootstrap.sh"
      provides: "Inner LXC bootstrap (DEPLOY-02, DEPLOY-03)"
      min_lines: 80
    - path: "deploy/systemd/proxmox-gui-api.service"
      provides: "FastAPI uvicorn unit (D-17)"
      contains: "ExecStart=/opt/proxmox-gui/.venv/bin/uvicorn"
    - path: "deploy/systemd/proxmox-gui-worker.service"
      provides: "arq worker unit (D-17) — no-op in Phase 1"
      contains: "Description"
    - path: "deploy/caddy/Caddyfile.template"
      provides: "Caddy reverse proxy template"
      contains: "reverse_proxy 127.0.0.1:8000"
    - path: "deploy/scripts/gen-master-key.sh"
      provides: "Master key generator (D-14)"
      contains: "32"
  key_links:
    - from: "deploy/install.sh"
      to: "deploy/lxc/bootstrap.sh"
      via: "pct exec inside the LXC pulls and runs bootstrap.sh"
      pattern: "bootstrap.sh"
    - from: "deploy/lxc/bootstrap.sh"
      to: "deploy/systemd/proxmox-gui-api.service"
      via: "installs unit to /etc/systemd/system/ then systemctl enable --now"
      pattern: "systemctl enable"
    - from: "deploy/lxc/bootstrap.sh"
      to: "deploy/scripts/gen-master-key.sh"
      via: "first-run-only master key generation"
      pattern: "gen-master-key"
decisions:
  0400_override: "D-14 specifies 0600 minimum; we ship 0400 (read-only owner) — read-only owner is strictly more restrictive than 0600 and aligns with Plan 01's SecretCipher invariant (st_mode & 0o077 == 0)"
---

<objective>
Ship the helper-script skeleton: one-line `install.sh` invokable as `bash -c "$(curl -fsSL …/install.sh)"`, the inner `bootstrap.sh` that runs INSIDE the freshly-created LXC, three systemd units (`proxmox-gui-api.service`, `proxmox-gui-worker.service`, `caddy.service` — using the package default), a `Caddyfile.template` for single-origin reverse-proxying, and the master-key + jwt-secret generator scripts. Per CONTEXT.md D-16/D-17/D-18 the LXC is Debian 12 unprivileged with `nesting=1,keyctl=1`; the worker unit ships but is no-op until Phase 3 wires arq.

Purpose: An operator can run a single curl|bash and arrive at a freshly-provisioned LXC serving the first-run wizard (Plan 07 + Plan 08 implement the wizard backend + UI). Phase 5 polishes this; Phase 1 establishes the skeleton.

Output: Shellcheck-clean install.sh + bootstrap.sh; systemd units + Caddyfile templates committed; documented one-liner that an end-to-end test on a real Proxmox host CAN execute (we do not RUN it in CI — we ship the artifacts).
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
@/mnt/claude-config/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@.planning/research/PITFALLS.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: install.sh + bootstrap.sh + key generators</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Helper-script skeleton, §Pitfall A6, §Pitfall A9)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-14, D-16, D-17, D-18)
    - /home/dev/vm-deployment-gui/.planning/research/PITFALLS.md (Pitfall 19 unprivileged LXC, Pitfall 22 self-backup)
  </read_first>
  <files>
    deploy/install.sh,
    deploy/lxc/bootstrap.sh,
    deploy/scripts/gen-master-key.sh,
    deploy/scripts/gen-jwt-secret.sh,
    deploy/README.md
  </files>
  <action>
    **deploy/install.sh** (outer; runs on the Proxmox VE host) — copy the skeleton from 01-RESEARCH.md §Helper-script skeleton and refine:
    - `#!/usr/bin/env bash`, `set -euo pipefail`
    - Header banner echo identifying the project
    - `command -v pct >/dev/null 2>&1 || { echo "ERROR: must run on PVE host"; exit 1; }`
    - Defaults: `CTID=$(pvesh get /cluster/nextid)`, `HOSTNAME=proxmox-gui`, `CPU=2`, `RAM_MB=2048`, `DISK_GB=8`, `STORAGE=local-lvm`, `BRIDGE=vmbr0`. Override via env vars OR via flags `--ctid N --hostname X --storage Y --bridge Z`.
    - Argument parser using `while [[ $# -gt 0 ]]; do case ... esac done`.
    - `REPO_URL` and `RELEASE` configurable via env (defaults: `https://github.com/<owner>/proxmox-gui` and `main`). Document that the repo URL is a placeholder pre-publication.
    - Detect Debian 12 template — `pveam available | grep -E 'debian-12-standard.*amd64' | head -1 | awk '{print $2}'`. If not on the host, `pveam download local <template>` (Pitfall: `pveam download` is idempotent, so call it always; suppress errors only on already-present case).
    - `pct create $CTID local:vztmpl/<template> --hostname $HOSTNAME --cores $CPU --memory $RAM_MB --rootfs $STORAGE:$DISK_GB --net0 name=eth0,bridge=$BRIDGE,ip=dhcp --unprivileged 1 --features nesting=1,keyctl=1 --onboot 1` (D-17, Pitfall 19).
    - `pct start $CTID`. Wait for network: poll `pct exec $CTID -- ip -4 a show dev eth0` for up to 60s until an IP appears.
    - `pct exec $CTID -- bash -c "apt-get update && apt-get install -y curl ca-certificates && curl -fsSL '$REPO_URL/raw/$RELEASE/deploy/lxc/bootstrap.sh' | bash"`.
    - Print final banner with the container's IP and `https://<IP>/setup` URL.
    - Trap on error: `trap 'echo "Install failed at line $LINENO"; exit 1' ERR`.

    **deploy/lxc/bootstrap.sh** (inner; runs inside the freshly-created LXC) — refine from 01-RESEARCH.md §Helper-script skeleton:
    - `#!/usr/bin/env bash`, `set -euo pipefail`
    - Read-only marker file check: `INSTALLED_MARKER=/etc/proxmox-gui/.installed`. If present, run `sudo -u proxmox-gui /opt/proxmox-gui/.venv/bin/alembic -c /opt/proxmox-gui/backend/alembic.ini upgrade head` and exit 0 (DEPLOY-02 idempotence).
    - apt updates: `apt-get update && apt-get install -y python3 python3-venv python3-dev nodejs npm sqlite3 caddy git build-essential libssl-dev libffi-dev openssl`. **Python 3.12 note (D-16 / A1 assumption):** Debian 12 ships Python 3.11. If `python3 --version | grep -qE 'Python 3\.1[2-9]'` is false, install via Debian-backports: write `/etc/apt/sources.list.d/bookworm-backports.list` with `deb http://deb.debian.org/debian bookworm-backports main`, then `apt-get update && apt-get install -y -t bookworm-backports python3.12 python3.12-venv python3.12-dev`. Use `PYTHON_BIN=python3.12` if installed, else `python3`. Document the fallback to pyenv as a TODO if backports doesn't ship 3.12.
    - Create service user: `id -u proxmox-gui >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d /opt/proxmox-gui proxmox-gui` (Pitfall A6).
    - Layout: `mkdir -p /etc/proxmox-gui /opt/proxmox-gui /var/lib/proxmox-gui /var/log/proxmox-gui && chown proxmox-gui:proxmox-gui /etc/proxmox-gui /opt/proxmox-gui /var/lib/proxmox-gui /var/log/proxmox-gui && chmod 0700 /etc/proxmox-gui`.
    - Pull source: `git clone --depth 1 --branch "$RELEASE" "$REPO_URL" /opt/proxmox-gui-src && cp -r /opt/proxmox-gui-src/{backend,frontend,deploy} /opt/proxmox-gui/ && chown -R proxmox-gui:proxmox-gui /opt/proxmox-gui` (use env-injected `REPO_URL` and `RELEASE` — install.sh exports them into the pct exec environment).
    - Generate master key (D-14) by calling `/opt/proxmox-gui/deploy/scripts/gen-master-key.sh` (runs idempotently). Generate JWT secret + PAT pepper similarly via `gen-jwt-secret.sh`.
    - Python deps: `sudo -u proxmox-gui $PYTHON_BIN -m venv /opt/proxmox-gui/.venv && sudo -u proxmox-gui /opt/proxmox-gui/.venv/bin/pip install -e /opt/proxmox-gui/backend`.
    - Run migrations: `sudo -u proxmox-gui /opt/proxmox-gui/.venv/bin/alembic -c /opt/proxmox-gui/backend/alembic.ini upgrade head`.
    - Build frontend: `sudo -u proxmox-gui bash -c 'cd /opt/proxmox-gui/frontend && npm ci --no-audit --no-fund && npm run build'`. Document that adapter-node produces `frontend/build/`.
    - Install systemd units: `install -m 0644 /opt/proxmox-gui/deploy/systemd/proxmox-gui-api.service /etc/systemd/system/`, same for worker. Install Caddyfile: copy `/opt/proxmox-gui/deploy/caddy/Caddyfile.template` to `/etc/caddy/Caddyfile`, then `envsubst < tmpl > /etc/caddy/Caddyfile` if needed for `$PUBLIC_HOSTNAME` substitution (Phase 1 default: no substitution, use `:443 { tls internal ... }` form per Pitfall A9).
    - Enable + start: `systemctl daemon-reload && systemctl enable --now proxmox-gui-api caddy`. The worker unit is installed but NOT enabled in Phase 1 — `# systemctl enable proxmox-gui-worker # Phase 3 wires arq`.
    - Write marker: `touch "$INSTALLED_MARKER"` and `chown proxmox-gui:proxmox-gui "$INSTALLED_MARKER"`.
    - Final echo: "Install complete. Visit https://<LXC-IP>/setup (accept self-signed cert)."
    - Use the same `set -euo pipefail` + `trap 'echo "bootstrap failed at line $LINENO"; exit 1' ERR`.

    **deploy/scripts/gen-master-key.sh** — `#!/usr/bin/env bash`, `set -euo pipefail`. Idempotent:
    ```bash
    # Mode 0400 (read-only owner) is intentionally more restrictive than CONTEXT D-14's stated 0600 minimum — principle of least privilege; FastAPI service user only reads, never writes
    KEY_PATH=/etc/proxmox-gui/master.key
    if [[ -f "$KEY_PATH" ]]; then
        echo "master.key already exists at $KEY_PATH (preserving)"
        exit 0
    fi
    dd if=/dev/urandom of="$KEY_PATH" bs=32 count=1 status=none
    chown proxmox-gui:proxmox-gui "$KEY_PATH"
    chmod 0400 "$KEY_PATH"  # more restrictive than D-14 minimum (0600)
    echo "Wrote $KEY_PATH (32 random bytes, 0400)"
    ```

    **deploy/scripts/gen-jwt-secret.sh** — same pattern but writes 48 url-safe base64 chars to `/etc/proxmox-gui/jwt.secret` (mode 0400). Also generate `/etc/proxmox-gui/pat.pepper` the same way. Document that BOTH are idempotent (preserve existing).

    **deploy/README.md** — Document:
    1. The one-line install command form: `bash -c "$(curl -fsSL https://raw.githubusercontent.com/<owner>/proxmox-gui/main/deploy/install.sh)"` (note placeholder owner).
    2. Required env / flags (CTID, HOSTNAME, STORAGE, BRIDGE, CPU, RAM_MB, DISK_GB).
    3. Post-install: visit `https://<LXC-IP>/setup`.
    4. Persistent state under `/etc/proxmox-gui` (master.key, jwt.secret, pat.pepper) and `/var/lib/proxmox-gui` (SQLite DB). Pitfall 22: these MUST be in any self-backup. **File permissions:** `master.key: mode 0400 owned by proxmox-gui (more restrictive than D-14's 0600 minimum)`; jwt.secret and pat.pepper likewise 0400.
    5. systemd unit names + log inspection (`journalctl -u proxmox-gui-api`).
    6. Manual idempotence test: `bash /opt/proxmox-gui/deploy/lxc/bootstrap.sh` re-runs `alembic upgrade head` and exits.
    7. Known limitations in Phase 1: helper-script polish + self-update land in Phase 5.

    **Lint:** Every shell script gets a `# shellcheck shell=bash` directive at the top. Run `shellcheck -x deploy/install.sh deploy/lxc/bootstrap.sh deploy/scripts/*.sh` and resolve all warnings (or `# shellcheck disable=SCxxxx` with justification).
  </action>
  <verify>
    <automated>test -x deploy/install.sh && test -x deploy/lxc/bootstrap.sh && test -x deploy/scripts/gen-master-key.sh && command -v shellcheck >/dev/null 2>&1 && shellcheck -x deploy/install.sh deploy/lxc/bootstrap.sh deploy/scripts/gen-master-key.sh deploy/scripts/gen-jwt-secret.sh || echo "shellcheck not installed locally — install with apt-get install shellcheck"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f deploy/install.sh && head -1 deploy/install.sh | grep -q '#!/usr/bin/env bash'`
    - `grep -q 'set -euo pipefail' deploy/install.sh`
    - `grep -q 'unprivileged 1' deploy/install.sh`
    - `grep -q 'nesting=1,keyctl=1' deploy/install.sh`
    - `grep -q 'INSTALLED_MARKER' deploy/lxc/bootstrap.sh`
    - `grep -q 'alembic.*upgrade head' deploy/lxc/bootstrap.sh`
    - `grep -q 'useradd -r' deploy/lxc/bootstrap.sh`
    - `grep '^chmod 0400' deploy/scripts/gen-master-key.sh` AND `grep 'more restrictive than D-14' deploy/scripts/gen-master-key.sh`
    - `grep -q 'chmod 0700' deploy/lxc/bootstrap.sh` (Pitfall A6 directory perms)
    - `shellcheck -x deploy/install.sh deploy/lxc/bootstrap.sh deploy/scripts/*.sh` exits 0 (if shellcheck available — soft-fail if not)
    - `test -x deploy/install.sh && test -x deploy/lxc/bootstrap.sh && test -x deploy/scripts/gen-master-key.sh && test -x deploy/scripts/gen-jwt-secret.sh`
  </acceptance_criteria>
  <done>install.sh + bootstrap.sh + key generators committed and shellcheck-clean; deploy/README.md documents the one-line install and persistent state for backups (Pitfall 22).</done>
</task>

<task type="auto">
  <name>Task 2: systemd units, Caddyfile template, repo .gitignore + top-level README</name>
  <read_first>
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-RESEARCH.md (§Sample systemd unit, §Pattern 11 Caddy)
    - /home/dev/vm-deployment-gui/.planning/phases/01-foundation/01-CONTEXT.md (D-17)
  </read_first>
  <files>
    deploy/systemd/proxmox-gui-api.service,
    deploy/systemd/proxmox-gui-worker.service,
    deploy/caddy/Caddyfile.template,
    .gitignore,
    README.md
  </files>
  <action>
    **deploy/systemd/proxmox-gui-api.service** — copy exactly from 01-RESEARCH.md §Sample systemd unit. Final form:
    ```ini
    [Unit]
    Description=Proxmox GUI API (FastAPI)
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=proxmox-gui
    Group=proxmox-gui
    WorkingDirectory=/opt/proxmox-gui/backend
    Environment=PROXMOX_GUI_MASTER_KEY_PATH=/etc/proxmox-gui/master.key
    Environment=PROXMOX_GUI_DATABASE_URL=sqlite+aiosqlite:////var/lib/proxmox-gui/app.db
    Environment=PROXMOX_GUI_JWT_SECRET_FILE=/etc/proxmox-gui/jwt.secret
    Environment=PROXMOX_GUI_PAT_PEPPER_FILE=/etc/proxmox-gui/pat.pepper
    Environment=PROXMOX_GUI_COOKIE_SECURE=true
    Environment=PROXMOX_GUI_LOG_LEVEL=INFO
    ExecStart=/opt/proxmox-gui/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
    Restart=on-failure
    RestartSec=5
    StandardOutput=journal
    StandardError=journal

    # hardening
    NoNewPrivileges=true
    PrivateTmp=true
    ProtectSystem=full
    ProtectHome=true
    ReadWritePaths=/var/lib/proxmox-gui /var/log/proxmox-gui

    [Install]
    WantedBy=multi-user.target
    ```

    **deploy/systemd/proxmox-gui-worker.service** — D-17: ships in Phase 1 but disabled. Use:
    ```ini
    [Unit]
    Description=Proxmox GUI Worker (arq) — Phase 3 wires this
    After=network-online.target proxmox-gui-api.service
    Wants=network-online.target

    [Service]
    Type=simple
    User=proxmox-gui
    Group=proxmox-gui
    WorkingDirectory=/opt/proxmox-gui/backend
    Environment=PROXMOX_GUI_MASTER_KEY_PATH=/etc/proxmox-gui/master.key
    Environment=PROXMOX_GUI_DATABASE_URL=sqlite+aiosqlite:////var/lib/proxmox-gui/app.db
    # Phase 1 no-op: idle until Phase 3 wires arq.
    ExecStart=/bin/sh -c 'echo "worker placeholder — phase 3 wires arq"; sleep infinity'
    Restart=on-failure
    RestartSec=10
    StandardOutput=journal
    StandardError=journal
    NoNewPrivileges=true
    PrivateTmp=true
    ProtectSystem=full
    ProtectHome=true
    ReadWritePaths=/var/lib/proxmox-gui /var/log/proxmox-gui

    [Install]
    WantedBy=multi-user.target
    ```
    Add a top-of-file comment: `# Phase 1: this unit is installed but NOT enabled by bootstrap.sh. Phase 3 wires arq.`

    **deploy/caddy/Caddyfile.template** — per 01-RESEARCH.md §Pattern 11 and Pitfall A9 (LAN-only first-run via `tls internal`). Two-form template, default to LAN form (the helper-script can swap to public-hostname form post-install):
    ```caddy
    # /etc/caddy/Caddyfile — Proxmox GUI (Phase 1 default: LAN / self-signed)
    # For a public install with auto-HTTPS, replace the :443 block with:
    #   {$PUBLIC_HOSTNAME} {
    #     # ... same handle directives
    #   }

    {
        # Global options
        admin off
        auto_https disable_redirects
    }

    :443 {
        tls internal

        encode zstd gzip

        # Security headers (ASVS V14.4 — see threat_model)
        header {
            Strict-Transport-Security "max-age=31536000; includeSubDomains"
            X-Content-Type-Options "nosniff"
            X-Frame-Options "SAMEORIGIN"   # noVNC iframe in Phase 4 is same-origin
            Referrer-Policy "strict-origin-when-cross-origin"
            # CSP intentionally omitted in Phase 1; Phase 5 polish hardens.
            -Server
        }

        # FastAPI
        handle /api/* {
            reverse_proxy 127.0.0.1:8000 {
                header_up Host {host}
                header_up X-Real-IP {remote_host}
                header_up X-Forwarded-For {remote_host}
                header_up X-Forwarded-Proto {scheme}
            }
        }

        # SvelteKit adapter-node
        handle {
            reverse_proxy 127.0.0.1:3000 {
                header_up Host {host}
                header_up X-Real-IP {remote_host}
                header_up X-Forwarded-For {remote_host}
                header_up X-Forwarded-Proto {scheme}
            }
        }
    }

    # Optional :80 redirect → 443 (off by default for LAN/internal CA)
    # :80 { redir https://{host}{uri} }
    ```

    **.gitignore** (repo root) — Python: `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.venv/`, `.ruff_cache/`, `.mypy_cache/`. Node: `node_modules/`, `.svelte-kit/`, `build/`, `dist/`. SQLite: `*.db`, `*.db-shm`, `*.db-wal`. Env: `.env`, `.env.local`. Secrets: `*.key`, `*.secret`, `*.pepper`, `master.key`, `jwt.secret`, `pat.pepper` (defense-in-depth — these are also outside the repo by design but block accidental commits). LXC: `*.tar.zst`. IDE: `.vscode/settings.json`, `.idea/`. OS: `.DS_Store`, `Thumbs.db`.

    **README.md** (repo root) — concise top-level README. Sections:
    1. **What this is** — one-paragraph product summary lifted from `.planning/PROJECT.md` "Core Value".
    2. **Status** — `Phase 1 of 5 (Foundation) — see .planning/STATE.md`.
    3. **Install (one-liner)** — the curl|bash form from `deploy/README.md`.
    4. **Local dev** — link to `backend/README.md` (TBD; not in this plan) and `frontend/README.md` (TBD). For now document: `cd backend && uv pip install -e .[dev] && uvicorn app.main:app --reload` and `cd frontend && pnpm install && pnpm dev`.
    5. **Project layout** — copy the tree from 01-RESEARCH.md §Recommended Project Structure.
    6. **License** — placeholder (`LICENSE` file deferred — Claude's discretion to use AGPL-3.0 or MIT; default to a "License: TBD" line for now).
    7. **Contributing / Roadmap** — link to `.planning/ROADMAP.md`.
    8. **Documentation** — link to `.planning/PROJECT.md`, `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`.
  </action>
  <verify>
    <automated>test -f deploy/systemd/proxmox-gui-api.service && test -f deploy/systemd/proxmox-gui-worker.service && test -f deploy/caddy/Caddyfile.template && systemd-analyze verify deploy/systemd/proxmox-gui-api.service 2>&1 | grep -vE '^$|Unit file format|systemd-analyze' || true ; test -f .gitignore && test -f README.md</automated>
  </verify>
  <acceptance_criteria>
    - `test -f deploy/systemd/proxmox-gui-api.service && grep -q 'User=proxmox-gui' deploy/systemd/proxmox-gui-api.service`
    - `grep -q 'ExecStart=/opt/proxmox-gui/.venv/bin/uvicorn' deploy/systemd/proxmox-gui-api.service`
    - `grep -q 'NoNewPrivileges=true' deploy/systemd/proxmox-gui-api.service`
    - `grep -q 'ReadWritePaths=/var/lib/proxmox-gui' deploy/systemd/proxmox-gui-api.service`
    - `test -f deploy/systemd/proxmox-gui-worker.service && grep -q 'phase 3' deploy/systemd/proxmox-gui-worker.service` (case-insensitive)
    - `test -f deploy/caddy/Caddyfile.template && grep -q 'reverse_proxy 127.0.0.1:8000' deploy/caddy/Caddyfile.template`
    - `grep -q 'reverse_proxy 127.0.0.1:3000' deploy/caddy/Caddyfile.template`
    - `grep -q 'tls internal' deploy/caddy/Caddyfile.template`
    - `grep -q 'Strict-Transport-Security' deploy/caddy/Caddyfile.template`
    - `test -f .gitignore && grep -q 'master.key' .gitignore`
    - `test -f README.md && grep -q 'Proxmox' README.md`
    - Optional: `systemd-analyze verify deploy/systemd/proxmox-gui-api.service` shows no warnings (if `systemd-analyze` is available on the workstation; soft-fail otherwise).
  </acceptance_criteria>
  <done>systemd units, Caddyfile, .gitignore, README committed; security headers in Caddy; service users + paths + permissions consistent across files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| External HTTPS → Caddy | TLS termination; Caddy is the only network-exposed listener |
| Caddy → uvicorn (127.0.0.1) | Localhost trust boundary; uvicorn binds 127.0.0.1 only |
| Caddy → adapter-node (127.0.0.1) | Same |
| Installer script → filesystem | `install.sh` runs as root on the PVE host; `bootstrap.sh` runs as root inside the LXC |
| master.key permissions | Owned by proxmox-gui:proxmox-gui mode 0400 — only the service user reads it |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-04-01 | Tampering | Installer downloads bootstrap.sh from untrusted URL | mitigate | `install.sh` uses `curl -fsSL` over HTTPS; document that the operator must visually verify the install URL before running. Future hardening (Phase 5): GPG-signed release tarball with detached signature verified against a pinned public key. |
| T-01-04-02 | Information disclosure | master.key world-readable | mitigate | `gen-master-key.sh` writes mode 0400 owned by `proxmox-gui:proxmox-gui`; parent dir `/etc/proxmox-gui` mode 0700. Acceptance criteria enforce. App startup re-validates (Plan 01, Pitfall A6). |
| T-01-04-03 | Elevation of privilege | Privileged LXC | mitigate | `pct create --unprivileged 1 --features nesting=1,keyctl=1` (Pitfall 19). No `privileged 1`. |
| T-01-04-04 | Information disclosure | Caddy exposes server header / version | mitigate | `header -Server` removes the Server header. Documented in Caddyfile. |
| T-01-04-05 | Tampering | Connection downgrade to HTTP | mitigate | `Strict-Transport-Security` 1-year max-age. `auto_https disable_redirects` is `false` by default in `:443 { tls internal }` form — Caddy will still redirect HTTP→HTTPS. Note: for LAN installs the operator may explicitly visit HTTPS. |
| T-01-04-06 | Spoofing | Clickjacking via iframe | mitigate | `X-Frame-Options: SAMEORIGIN` (Phase 4 noVNC iframe is same-origin so this is compatible). Phase 5 polishes to `frame-ancestors 'self'` via CSP. |
| T-01-04-07 | Information disclosure | install.sh leaks Proxmox API token via process listing | accept | install.sh does NOT take a PVE token argument — the operator pastes it into the first-run wizard (Plan 07/08). install.sh runs on the PVE host as root and uses `pct` directly (no token needed). |
| T-01-04-08 | Denial of service | curl|bash with no integrity check pipes arbitrary bytes through bash | mitigate | Document HTTPS-only URL and Phase 5 detached-signature plan in `deploy/README.md`. Acceptable risk for v1; matches community-scripts pattern explicitly chosen in PROJECT.md. |
| T-01-04-09 | Repudiation | systemd unit logs to journald — operator can review installs and crashes | mitigate (design) | StandardOutput=journal, StandardError=journal in both units. `journalctl -u proxmox-gui-api --since "1h"` shows recent logs. |
| T-01-04-10 | Information disclosure | bootstrap.sh prints master key during generation | mitigate | `gen-master-key.sh` writes via `dd` with `status=none`; no echo of key contents. Output is just `"Wrote $KEY_PATH"`. |
| T-01-04-11 | Tampering | Idempotent re-run of bootstrap.sh corrupts an established install | mitigate | `.installed` marker short-circuits to `alembic upgrade head` only. App code refresh / rolling update is Phase 5's `DEPLOY-04` work — out of scope here. |

**ASVS L1 mappings:**
- V14.1 (build process) → systemd hardening directives (`NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths` scoped to data dirs only)
- V14.4 (HTTP security headers) → HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy in Caddyfile
- V14.5 (CSP) → DEFERRED to Phase 5 (acceptable gap for Phase 1; documented)
- V1.14 (separation of duties / privilege) → unprivileged LXC + dedicated service user `proxmox-gui` (not root)
- V6.4 (key management) → installer-generated 32-byte master key in /etc/proxmox-gui with 0400 perms; lifecycle is operator-managed (rotate by writing new file + re-encrypting at-rest data — Phase 5 hardens)
</threat_model>

<verification>
- `shellcheck -x deploy/install.sh deploy/lxc/bootstrap.sh deploy/scripts/*.sh` exits 0
- `systemd-analyze verify deploy/systemd/proxmox-gui-api.service` (if available) shows no errors
- `caddy validate --config deploy/caddy/Caddyfile.template` (if available) shows no errors
- All key acceptance-criteria greps pass
- `test -x deploy/install.sh` and shebang is `#!/usr/bin/env bash`
</verification>

<success_criteria>
A Proxmox VE 8.x operator can copy the one-line install command, run it on their host, and arrive at a freshly-provisioned LXC with the FastAPI + SvelteKit stack serving HTTPS on `:443` (self-signed via Caddy `tls internal`). The first-run wizard endpoint (Plan 07) returns "no admin yet" and the UI (Plan 08) renders the wizard. Idempotent re-run of `bootstrap.sh` runs `alembic upgrade head` and exits without disturbing existing data.

Phase 5 will: harden CSP, add GPG-signed releases, polish the wizard messaging, ship the self-update path. Phase 1 ships the skeleton.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-04-SUMMARY.md` documenting:
- Files committed
- Shellcheck results (lines fixed, suppressions added)
- Caddy security-header decisions
- Known gaps left for Phase 5 (CSP, self-update, GPG signing)
- Manual smoke test instructions for a Proxmox VE host
</output>
