---
phase: 01-foundation
plan: 04
subsystem: infra
tags:
  - deployment
  - helper-script
  - systemd
  - caddy
  - lxc
  - shellcheck

# Dependency graph
requires:
  - phase: 01-foundation
    provides: backend FastAPI app (Plan 01-01), Alembic migrations (Plan 01-02), SvelteKit adapter-node build (Plan 01-03)
provides:
  - One-line helper-script installer (DEPLOY-01)
  - Idempotent inner bootstrap.sh (DEPLOY-02)
  - Three systemd units (api enabled, worker placeholder, caddy via package default) (DEPLOY-03, D-17)
  - Master key + JWT secret + PAT pepper generators (D-14, D-15)
  - Caddy reverse-proxy template (Pattern 11, Pitfall A9)
  - Repo .gitignore + top-level README
affects:
  - 01-05-auth-subsystem  # consumes jwt.secret, pat.pepper paths from systemd Environment
  - 01-07-users-admin-setup  # first-run wizard reached via the installer
  - 01-08-frontend-auth-shell  # SvelteKit static build served by Caddy
  - phase-3-job-queue-lifecycle  # arq wires into proxmox-gui-worker.service
  - phase-5-polish  # DEPLOY-04 self-update, GPG-signed releases, CSP polish

# Tech tracking
tech-stack:
  added:
    - shellcheck (lint; dev/CI only; v0.9.0 used here)
    - systemd unit hardening profile (NoNewPrivileges, PrivateTmp, ProtectSystem=full, ProtectHome, ReadWritePaths)
    - Caddy 2.6 Caddyfile (LAN: tls internal; public: $PUBLIC_HOSTNAME swap)
    - Debian 12 bookworm-backports python3.12 path
  patterns:
    - Idempotent .installed marker short-circuits to alembic upgrade head
    - Atomic temp-file + rename for secret-file creation (jwt.secret, pat.pepper)
    - Mode-0400 owner-only secrets (stricter than CONTEXT D-14 0600 minimum)
    - Two-tier installer: outer install.sh on PVE host; inner bootstrap.sh inside the LXC
    - Single-origin reverse proxy: /api/* -> 8000 (FastAPI), /* -> 3000 (SvelteKit adapter-node)

key-files:
  created:
    - deploy/install.sh
    - deploy/lxc/bootstrap.sh
    - deploy/scripts/gen-master-key.sh
    - deploy/scripts/gen-jwt-secret.sh
    - deploy/systemd/proxmox-gui-api.service
    - deploy/systemd/proxmox-gui-worker.service
    - deploy/caddy/Caddyfile.template
    - deploy/README.md
    - README.md
  modified:
    - .gitignore

key-decisions:
  - "master.key, jwt.secret, pat.pepper ship at mode 0400 owned by proxmox-gui (more restrictive than CONTEXT D-14's stated 0600 minimum) — principle of least privilege, FastAPI never writes after generation"
  - "Debian 12 python3.12 sourced from bookworm-backports; pyenv fallback explicitly deferred to Phase 5 (TODO marker in bootstrap.sh)"
  - "Worker unit ships installed-but-disabled in Phase 1 with ExecStart=sleep infinity placeholder; Phase 3 swaps to arq invocation"
  - "Caddy auto-sets X-Forwarded-For + X-Forwarded-Proto; only Host + X-Real-IP set explicitly (silences caddy validate warnings, no behavior change)"
  - "CSP intentionally omitted in Phase 1 (acceptable v1 gap, documented in Caddyfile + deploy/README.md); Phase 5 polish hardens"
  - "Caddy file is auto-formatted (tabs) by `caddy fmt --overwrite` — committed in canonical form so future edits stay lint-clean"

patterns-established:
  - "Pattern: .installed marker — bootstrap.sh first-line check short-circuits to alembic upgrade head and exit 0 if marker present"
  - "Pattern: atomic-secret-write — generate to mktemp -p $(dirname target) with chmod 0400 BEFORE rename; eliminates world-readable window"
  - "Pattern: systemd hardening profile — every unit gets NoNewPrivileges + PrivateTmp + ProtectSystem=full + ProtectHome + scoped ReadWritePaths"
  - "Pattern: Caddyfile two-form template — :443 { tls internal } for LAN default; swap header to $PUBLIC_HOSTNAME for public auto-HTTPS"
  - "Pattern: -Server header strip — never expose Caddy version to clients (T-01-04-04)"

requirements-completed:
  - DEPLOY-01
  - DEPLOY-02
  - DEPLOY-03
  - DEPLOY-05

# Metrics
duration: 7min
completed: 2026-05-14
---

# Phase 1 Plan 04: Deployment Skeleton Summary

**One-line `curl|bash` installer that provisions an unprivileged Debian 12 LXC with nesting+keyctl, lays out /etc/proxmox-gui with mode-0400 secrets, builds the FastAPI + SvelteKit stack, and starts three systemd units behind a single-origin Caddy reverse proxy with HSTS + tls-internal — shellcheck-clean across four scripts, `caddy validate` returns Valid configuration.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-14T03:41:12Z
- **Completed:** 2026-05-14T03:48:07Z
- **Tasks:** 2 / 2
- **Files created:** 9
- **Files modified:** 1 (.gitignore)
- **Commits:** 2 task commits + 1 metadata (this) commit

## Accomplishments

1. **One-line installer (DEPLOY-01).** `bash -c "$(curl -fsSL …/install.sh)"` on a Proxmox VE 8.x host:
   - Verifies host has `pct` + `pvesh`
   - Allocates VMID via `pvesh get /cluster/nextid`
   - Downloads Debian 12 LXC template (with fallback to known `12.7-1`)
   - Creates **unprivileged** LXC with `nesting=1,keyctl=1` (D-17, Pitfall 19 — never `--privileged 1`)
   - Waits up to 60s for DHCP, then `pct exec`s the inner bootstrap
   - Flag + env override parser (CTID, hostname, CPU, RAM, disk, storage, bridge, repo-url, release)
2. **Idempotent inner bootstrap (DEPLOY-02).** `.installed` marker short-circuits to `alembic upgrade head` and exits — re-runs are safe and minimal. First-run path installs deps, creates `proxmox-gui` service user, lays out `/etc/proxmox-gui` (mode 0700), generates secrets, clones source, builds Python venv + frontend, installs and enables systemd units.
3. **Three systemd units shipped (D-17, DEPLOY-03).** `proxmox-gui-api.service` (uvicorn, enabled), `proxmox-gui-worker.service` (placeholder, installed but disabled — Phase 3 wires arq), `caddy.service` (distribution-default unit, enabled by `bootstrap.sh`). All units use the hardening profile (NoNewPrivileges, PrivateTmp, ProtectSystem=full, ProtectHome, scoped ReadWritePaths).
4. **Secret material at mode 0400 (D-14, Pitfall A6, DEPLOY-05).** `gen-master-key.sh` writes 32 random bytes via `dd status=none` (T-01-04-10 — never echoes to journal). `gen-jwt-secret.sh` writes 48-char url-safe base64 to `jwt.secret` + `pat.pepper`. Both are idempotent: existing files preserved.
5. **Caddy single-origin reverse proxy (Pattern 11, Pitfall A9).** `:443 { tls internal }` LAN default; `/api/*` → 127.0.0.1:8000, `/*` → 127.0.0.1:3000. Security headers (HSTS, X-Content-Type-Options, X-Frame-Options=SAMEORIGIN, Referrer-Policy, `-Server`). `caddy validate` reports `Valid configuration`.
6. **Defense-in-depth `.gitignore` + top-level README.** `.gitignore` blocks `*.key`, `*.secret`, `*.pepper`, `*.tar.zst` even though they live outside the repo by design. README.md introduces the project, install one-liner, local-dev commands, and links to the planning artifacts.

## Task Commits

1. **Task 1: install.sh + bootstrap.sh + key generators** — `33a1925` (feat)
   - `deploy/install.sh`, `deploy/lxc/bootstrap.sh`, `deploy/scripts/gen-master-key.sh`, `deploy/scripts/gen-jwt-secret.sh`, `deploy/README.md`
2. **Task 2: systemd units + Caddyfile + .gitignore + README** — `7810c6f` (feat)
   - `deploy/systemd/proxmox-gui-api.service`, `deploy/systemd/proxmox-gui-worker.service`, `deploy/caddy/Caddyfile.template`, `.gitignore`, `README.md`

## Files Created / Modified

| File | Purpose |
| --- | --- |
| `deploy/install.sh` | Outer one-line entry (runs on PVE host); creates LXC; `pct exec`s bootstrap |
| `deploy/lxc/bootstrap.sh` | Inner idempotent install (runs inside LXC); deps, user, secrets, venv, migrate, build, systemd |
| `deploy/scripts/gen-master-key.sh` | 32-byte master key at `/etc/proxmox-gui/master.key` mode 0400 (D-14) |
| `deploy/scripts/gen-jwt-secret.sh` | 48-char url-safe `jwt.secret` + `pat.pepper`, mode 0400 each |
| `deploy/systemd/proxmox-gui-api.service` | FastAPI uvicorn unit (User=proxmox-gui, hardened) |
| `deploy/systemd/proxmox-gui-worker.service` | arq placeholder (installed, disabled, Phase 3 wires) |
| `deploy/caddy/Caddyfile.template` | Single-origin reverse proxy with HSTS + tls-internal |
| `deploy/README.md` | Install + persistent-state backup notes (Pitfall 22) |
| `.gitignore` | Add `.env.local`, `*.key`, `*.secret`, `*.pepper`, `*.tar.zst`, IDE/OS noise |
| `README.md` | Top-level project README (product summary, install, dev, layout) |

## Shellcheck results

`shellcheck -x deploy/install.sh deploy/lxc/bootstrap.sh deploy/scripts/*.sh` exits 0 with no findings. shellcheck 0.9.0 (Debian/Ubuntu repository) was used. No suppressions or `# shellcheck disable=` lines were needed.

## Caddy validation

`caddy validate --config deploy/caddy/Caddyfile.template --adapter caddyfile` (caddy 2.6.2) returns `Valid configuration`. The two `Unnecessary header_up X-Forwarded-*` warnings from the initial draft were fixed by removing those redundant directives (Caddy auto-sets X-Forwarded-For + X-Forwarded-Proto on the upstream request). The `Caddyfile input is not formatted` warning was fixed by `caddy fmt --overwrite`. Only the informational `automatic HTTP->HTTPS redirects are disabled` notice remains — that is intentional (`auto_https disable_redirects` global option, LAN-install default).

## systemd-analyze

`systemd-analyze verify deploy/systemd/proxmox-gui-api.service` reports only a `Command /opt/proxmox-gui/.venv/bin/uvicorn is not executable: No such file or directory` warning, which is expected on the dev host — that path lives inside the LXC and is created by `bootstrap.sh`. No syntax errors on either unit file. The worker unit verifies with no warnings.

## Caddy security-header decisions

| Header | Value | Threat mitigated |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | T-01-04-05 (downgrade) — 1-year HSTS pin |
| `X-Content-Type-Options` | `nosniff` | MIME-sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | T-01-04-06 (clickjacking); compatible with Phase 4 same-origin noVNC iframe |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Information disclosure |
| `Server` | stripped (`-Server`) | T-01-04-04 (Caddy version disclosure) |
| **CSP** | **omitted (Phase 5 polish)** | Documented v1 gap |

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **0400 mode override.** CONTEXT D-14 specifies 0600 minimum; we ship 0400 (read-only owner). 0400 is strictly more restrictive than 0600 and aligns with Pitfall A6's `st_mode & 0o077 == 0` invariant that `app.core.cipher` enforces. Documented inline in `gen-master-key.sh` AND in `deploy/README.md`.
- **python3.12 via bookworm-backports (D-16 / Assumption A1).** Bootstrap writes `/etc/apt/sources.list.d/bookworm-backports.list` and installs `python3.12 python3.12-venv python3.12-dev -t bookworm-backports`. Pyenv fallback (build-from-source) is explicitly deferred to Phase 5 (DEPLOY-04) with a TODO marker.
- **Worker placeholder.** D-17 mandates the worker unit ship in Phase 1. `ExecStart=/bin/sh -c '… sleep infinity'` is a no-op; `systemctl enable` line is commented in bootstrap.sh with the Phase 3 note. The unit file itself reads `Description=… — Phase 3 wires this`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Lint hygiene] Removed redundant `X-Forwarded-*` header_up directives**
- **Found during:** Task 2 (Caddy validate)
- **Issue:** `caddy validate` warned twice that `header_up X-Forwarded-For` and `header_up X-Forwarded-Proto` are unnecessary — Caddy's `reverse_proxy` sets both automatically on the upstream request.
- **Fix:** Dropped the two redundant lines from both `handle` blocks; kept `Host` and `X-Real-IP` explicit (X-Real-IP is NOT automatic).
- **Files modified:** `deploy/caddy/Caddyfile.template`
- **Verification:** `caddy validate --config deploy/caddy/Caddyfile.template --adapter caddyfile` now returns `Valid configuration` with no `header_up` warnings.
- **Committed in:** `7810c6f` (Task 2 commit)

**2. [Rule 1 — Lint hygiene] Ran `caddy fmt --overwrite` on the Caddyfile**
- **Found during:** Task 2 (Caddy validate emitted "Caddyfile input is not formatted" warning)
- **Issue:** Caddyfile used 4-space indent; Caddy's canonical format is tab-indented (verified via `caddy fmt`).
- **Fix:** Ran `caddy fmt --overwrite deploy/caddy/Caddyfile.template`. Behavior unchanged; cosmetic only.
- **Files modified:** `deploy/caddy/Caddyfile.template`
- **Verification:** `caddy validate` no longer emits the formatting warning.
- **Committed in:** `7810c6f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — lint hygiene; both pre-commit polish).
**Impact on plan:** None — both fixes are cosmetic/redundancy-removal with zero behavior change. The Caddyfile still ships the same security headers, same reverse-proxy targets, and same `tls internal` default.

## Issues Encountered

- **shellcheck not installed on the dev box.** Installed via `apt-get install shellcheck` (v0.9.0). All four scripts pass with no findings.
- **systemd-analyze + caddy not installed.** Installed both (`apt-get install systemd caddy`) to run the verification commands the plan recommends. Both validators report clean.
- **No real Proxmox host available for end-to-end smoke test.** Per the plan's explicit success criteria ("we do not RUN it in CI — we ship the artifacts"), the install.sh path is exercised only by `shellcheck` + visual review. Manual smoke instructions are documented below.

## Manual smoke-test instructions (for a Proxmox VE 8.x host)

1. On the PVE host as root: `bash -c "$(curl -fsSL https://raw.githubusercontent.com/chrissi/proxmox-gui/main/deploy/install.sh)"`
   (replace owner once the repo is published).
2. Watch the script log: it should report `==> Plan:`, `==> Ensuring template present`, `==> Creating LXC <ctid>`, `==> Starting LXC`, `==> Waiting for network`, then the bootstrap output streaming through `pct exec`.
3. When the install completes, the banner prints `https://<lxc-ip>/setup`. Visit that URL in a browser, accept the Caddy self-signed cert.
4. Verify systemd: `pct exec <ctid> -- systemctl status proxmox-gui-api caddy` — both should be `active (running)`. Worker should be `inactive (dead)` (Phase 1 expected).
5. Verify file perms: `pct exec <ctid> -- stat -c '%a %U:%G %n' /etc/proxmox-gui/master.key /etc/proxmox-gui/jwt.secret /etc/proxmox-gui/pat.pepper` — all should print `400 proxmox-gui:proxmox-gui …`.
6. Idempotence check: `pct exec <ctid> -- bash /opt/proxmox-gui/deploy/lxc/bootstrap.sh` — must print `.installed present — running alembic upgrade head and exiting.` and exit 0 quickly.
7. Logs: `pct exec <ctid> -- journalctl -u proxmox-gui-api --since "5min ago"` — no ERROR / Traceback lines.

## User Setup Required

None — the helper-script handles all setup. The operator's only manual step is visiting `https://<lxc-ip>/setup` after the install completes (Plan 01-07 + Plan 01-08 implement the wizard backend + UI).

## Known gaps left for Phase 5 (DEPLOY-04 polish)

These are documented in `deploy/README.md` "Known limitations" and threat model:

- **No GPG-signed releases.** `curl | bash` over HTTPS is the only integrity check (T-01-04-01, T-01-04-08).
- **No self-update CLI.** Re-running `bootstrap.sh` only migrates the DB; it does not pull a new release tarball.
- **No backup CLI.** Operators must manually back up `/etc/proxmox-gui/{master.key,jwt.secret,pat.pepper}` + `/var/lib/proxmox-gui/app.db` (Pitfall 22).
- **CSP not in Caddyfile.** Phase 5 polish ships `Content-Security-Policy: default-src 'self'; frame-ancestors 'self'; …` (ASVS V14.5).
- **pyenv fallback for python3.12.** Bootstrap currently aborts if `bookworm-backports` does not ship python3.12; Phase 5 will build from source as a fallback (TODO marker in bootstrap.sh).
- **Worker unit is a no-op.** Phase 3 swaps `ExecStart=sleep infinity` for `ExecStart=/opt/proxmox-gui/.venv/bin/arq app.worker.WorkerSettings` and enables the unit.

## Threat Flags

No new threat surface introduced beyond the plan's threat model. T-01-04-01..T-01-04-11 are all addressed inline (see Caddy security-header decisions and "Known gaps" sections).

## Next Phase Readiness

Plans 01-05 (auth-subsystem), 01-06 (clusters-tenant-bootstrap), and 01-07 (users-admin-setup) can now assume:

- `PROXMOX_GUI_MASTER_KEY_PATH`, `PROXMOX_GUI_JWT_SECRET_FILE`, `PROXMOX_GUI_PAT_PEPPER_FILE` env vars resolve to mode-0400 files at install time (their existence is the deployment contract; Plan 01-01 already reads them via `app.config.Settings`).
- The api unit's `WorkingDirectory=/opt/proxmox-gui/backend` is the working dir; alembic + uvicorn invocations match this convention.
- Caddy serves the SvelteKit build at `/` and proxies `/api/*` to FastAPI — Plan 01-08 (frontend-auth-shell) can assume same-origin cookies + CSRF.
- The first-run wizard is reachable at `https://<lxc-ip>/setup` after the installer completes — Plan 01-07 implements the backend `/api/v1/setup/*` routes and Plan 01-08 the matching UI.

## Self-Check: PASSED

Verified post-summary:

| Check | Result |
| --- | --- |
| `deploy/install.sh` exists, executable, `#!/usr/bin/env bash` | FOUND |
| `deploy/lxc/bootstrap.sh` exists, executable | FOUND |
| `deploy/scripts/gen-master-key.sh` exists, executable | FOUND |
| `deploy/scripts/gen-jwt-secret.sh` exists, executable | FOUND |
| `deploy/systemd/proxmox-gui-api.service` exists | FOUND |
| `deploy/systemd/proxmox-gui-worker.service` exists | FOUND |
| `deploy/caddy/Caddyfile.template` exists | FOUND |
| `deploy/README.md` exists | FOUND |
| `README.md` (repo root) exists | FOUND |
| `.gitignore` updated | FOUND |
| `grep '^chmod 0400' deploy/scripts/gen-master-key.sh` ≥ 1 match | FOUND (line 46) |
| `grep 'more restrictive than D-14' deploy/scripts/gen-master-key.sh` ≥ 1 match | FOUND (lines 11 + 46) |
| Exact line "master.key: mode 0400 owned by proxmox-gui (more restrictive than D-14's 0600 minimum)" in `deploy/README.md` | FOUND (line 82) |
| `shellcheck -x deploy/install.sh deploy/lxc/bootstrap.sh deploy/scripts/*.sh` exits 0 | PASS |
| `caddy validate --config deploy/caddy/Caddyfile.template --adapter caddyfile` reports Valid configuration | PASS |
| Commit `33a1925` exists in git log | FOUND |
| Commit `7810c6f` exists in git log | FOUND |

---
*Phase: 01-foundation*
*Plan: 04 — deployment-skeleton*
*Completed: 2026-05-14*
