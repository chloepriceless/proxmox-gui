#!/usr/bin/env bash
# shellcheck shell=bash
#
# deploy/lxc/bootstrap.sh — runs INSIDE the freshly-created Debian 12 LXC
# (DEPLOY-02 idempotent install, DEPLOY-03 systemd + Caddy wiring)
#
# Invoked by install.sh via `pct exec`, but ALSO safe to run manually:
#   bash /opt/proxmox-gui/deploy/lxc/bootstrap.sh
#
# Idempotence (DEPLOY-02):
#   - First run: installs packages, creates user, lays out /opt + /etc dirs,
#     clones source, runs migrations, builds frontend, installs systemd units,
#     starts services, drops the .installed marker.
#   - Subsequent runs: detects the marker and short-circuits to
#     `alembic upgrade head` only. This is the upgrade path until Phase 5
#     ships proper self-update (DEPLOY-04).
#
# Required env (set by install.sh; sensible defaults if run manually):
#   REPO_URL  git remote URL          (default: https://github.com/chloepriceless/proxmox-gui)
#   RELEASE   branch / tag / commit   (default: master)

set -euo pipefail

trap 'echo "ERROR: bootstrap.sh failed at line $LINENO (exit $?)" >&2; exit 1' ERR

# Inputs (env-driven; install.sh exports both).
REPO_URL="${REPO_URL:-https://github.com/chloepriceless/proxmox-gui}"
RELEASE="${RELEASE:-master}"

# Layout (Pitfall A6: 0400/0700 perms on /etc/proxmox-gui).
APP_USER="proxmox-gui"
APP_GROUP="proxmox-gui"
APP_HOME="/opt/proxmox-gui"
APP_SRC="/opt/proxmox-gui-src"
ETC_DIR="/etc/proxmox-gui"
DATA_DIR="/var/lib/proxmox-gui"
LOG_DIR="/var/log/proxmox-gui"
INSTALLED_MARKER="${ETC_DIR}/.installed"
# DEPLOY-04: releases/current layout — each install/update unpacks into
# /opt/proxmox-gui/releases/<tag>/ and atomically symlinks `current` to it,
# so deploy/lxc/update.sh can swap codepaths without a window where
# `current` is missing.
RELEASES_DIR="${APP_HOME}/releases"
CURRENT_LINK="${APP_HOME}/current"
# Phase 1 layouts wrote backend/, frontend/, deploy/ directly into APP_HOME.
# Bootstrap now stamps an initial release tag so the very first install also
# uses the releases/current layout (D-12 idempotent re-run = update).
INITIAL_TAG="${RELEASE:-master}"

# ----------------------------------------------------------------------------
# Idempotent short-circuit: if marker exists, just run migrations and exit.
# This is the operator's "re-run bootstrap to migrate" entry point until
# Phase 5 self-update lands (DEPLOY-04).
# ----------------------------------------------------------------------------
# Drop-privilege helper: use runuser (always present, part of util-linux)
# instead of sudo (not installed in minimal Debian LXCs by default).
RUNAS=(runuser -u "$APP_USER" --)

if [[ -f "$INSTALLED_MARKER" ]]; then
    echo "==> $INSTALLED_MARKER present — running the idempotent upgrade path."

    # Phase 3 fix (Pitfall 10 / RESEARCH §Runtime State Inventory): the
    # idempotent-exit branch historically ran ONLY `alembic upgrade head`,
    # so a Phase-3 deploy onto an existing install never got arq/redis into
    # the venv and the worker crashed on import. The branch now re-runs
    # `pip install -e .` AND provisions redis-server, so re-running bootstrap
    # always leaves a fully-working Phase-3 install (DEPLOY-02).

    # 1. New apt deps that a pre-Phase-3 install lacks (redis-server).
    echo "==> [idempotent] apt: ensuring redis-server is installed..."
    apt-get update -qq
    apt-get install -y -qq redis-server
    # Redis must bind loopback only (T-03-01-01) — same guard as a fresh install.
    grep -qE '^bind 127\.0\.0\.1' /etc/redis/redis.conf \
        || echo 'bind 127.0.0.1 -::1' >> /etc/redis/redis.conf

    # 2. Re-install the backend so new dependencies (arq, redis) land in the
    #    venv — same invocation as the first-install path in Step 6.
    #
    # The idempotent-exit path predates the DEPLOY-04 releases/current layout:
    # on a Phase-1..4 install the venv + code live at $APP_HOME/{.venv,backend}.
    # If `current` already exists (a Phase-5+ install), prefer it.
    if [[ -L "$CURRENT_LINK" && -d "$CURRENT_LINK/.venv" ]]; then
        IDEMPOTENT_VENV="${CURRENT_LINK}/.venv"
        IDEMPOTENT_BACKEND="${CURRENT_LINK}/backend"
    else
        IDEMPOTENT_VENV="${APP_HOME}/.venv"
        IDEMPOTENT_BACKEND="${APP_HOME}/backend"
    fi
    echo "==> [idempotent] pip install -e backend (picks up arq/redis)..."
    "${RUNAS[@]}" "${IDEMPOTENT_VENV}/bin/pip" install \
        --quiet -e "${IDEMPOTENT_BACKEND}"

    # 3. Migrations. cd into backend/: alembic 1.18+ probes cwd for
    #    pyproject.toml, and /root (default cwd for root) is mode 0700 →
    #    APP_USER cannot stat it → crash. PROXMOX_GUI_DATABASE_URL keeps
    #    alembic + app on the same DB file.
    echo "==> [idempotent] alembic upgrade head..."
    "${RUNAS[@]}" bash -c "
        export PROXMOX_GUI_DATABASE_URL='sqlite+aiosqlite:////var/lib/proxmox-gui/app.db'
        cd '${IDEMPOTENT_BACKEND}' && \
        exec '${IDEMPOTENT_VENV}/bin/alembic' -c '${IDEMPOTENT_BACKEND}/alembic.ini' upgrade head
    "

    # 4. Re-install the systemd units (the worker unit's ExecStart changed in
    #    Phase 3, and the WorkingDirectory/ExecStart paths moved to
    #    /opt/proxmox-gui/current/* in Phase 5 / DEPLOY-04) and (re-)enable
    #    redis + worker. Source the unit files from whichever layout the
    #    on-disk install uses (pre-Phase-5: $APP_HOME; Phase-5+: $CURRENT_LINK).
    echo "==> [idempotent] refreshing systemd units + enabling redis/worker..."
    if [[ -L "$CURRENT_LINK" ]]; then
        UNIT_SRC="${CURRENT_LINK}/deploy/systemd"
    else
        UNIT_SRC="${APP_HOME}/deploy/systemd"
    fi
    install -m 0644 "${UNIT_SRC}/proxmox-gui-api.service" \
        /etc/systemd/system/proxmox-gui-api.service
    install -m 0644 "${UNIT_SRC}/proxmox-gui-frontend.service" \
        /etc/systemd/system/proxmox-gui-frontend.service
    install -m 0644 "${UNIT_SRC}/proxmox-gui-worker.service" \
        /etc/systemd/system/proxmox-gui-worker.service
    systemctl daemon-reload
    systemctl enable --now redis-server proxmox-gui-worker.service

    echo "==> Migrations applied + Phase-3 services wired. Idempotent-exit OK."
    exit 0
fi

# ----------------------------------------------------------------------------
# Step 1: apt deps
# Debian 12 (Bookworm) ships Python 3.11. We need 3.12 (D-16).
# Strategy (per 01-RESEARCH.md Q1 resolution):
#   1. Try bookworm-backports first (clean Debian path).
#   2. If still no 3.12, fall back to pyenv (TODO: out of scope for Phase 1
#      skeleton — Phase 5 polish will harden).
# ----------------------------------------------------------------------------
echo "==> apt-get update + base packages..."
apt-get update -qq
apt-get install -y -qq \
    ca-certificates curl git \
    sqlite3 \
    nodejs npm \
    caddy \
    redis-server \
    build-essential libssl-dev libffi-dev \
    openssl gnupg

# ----------------------------------------------------------------------------
# Step 1b: Redis hardening — bind loopback ONLY (RESEARCH §Security Domain,
# T-03-01-01). The Debian-stock /etc/redis/redis.conf already ships
# `bind 127.0.0.1 -::1` + `protected-mode yes`; this guard enforces it
# idempotently in case a prior edit removed the bind line. Redis must NEVER
# be reachable outside the LXC.
# ----------------------------------------------------------------------------
echo "==> Ensuring Redis is loopback-bound..."
grep -qE '^bind 127\.0\.0\.1' /etc/redis/redis.conf \
    || echo 'bind 127.0.0.1 -::1' >> /etc/redis/redis.conf
systemctl enable --now redis-server

echo "==> Locating Python 3.12..."
# Debian reality check (verified against deb.debian.org/debian/pool/main/p/):
#   - bookworm  ships python3.11 only
#   - trixie    ships python3.13 only
#   - bookworm-backports does NOT carry python3.12 (skipped release)
# Strategy: prefer system python3.12 if some flavor of Debian/Ubuntu happens to
# carry it, else download a python-build-standalone via uv (Astral). The latter
# is a statically-linked ~30 MB tarball that works on any glibc Linux, has
# zero apt deps, and is what pyenv-without-the-build-time would look like.
PYTHON_BIN=""
if python3.12 --version 2>/dev/null | grep -qE '^Python 3\.12\.'; then
    PYTHON_BIN="$(command -v python3.12)"
    echo "    found system python3.12: $($PYTHON_BIN --version)"
elif python3 --version 2>/dev/null | grep -qE '^Python 3\.12\.'; then
    PYTHON_BIN="$(command -v python3)"
    echo "    found system python3 == 3.12: $($PYTHON_BIN --version)"
else
    UV_BIN="/usr/local/bin/uv"
    if [[ ! -x "$UV_BIN" ]]; then
        echo "    installing uv (Astral python-build-standalone manager)..."
        curl -LsSf https://astral.sh/uv/install.sh \
            | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
        # Sanity: pct exec runs with a minimal PATH that may not include
        # /usr/local/bin, so always invoke uv by absolute path below.
        if [[ ! -x "$UV_BIN" ]]; then
            echo "ERROR: uv install reported success but $UV_BIN is missing." >&2
            exit 1
        fi
    fi
    export UV_PYTHON_INSTALL_DIR=/opt/python
    mkdir -p "$UV_PYTHON_INSTALL_DIR"
    chmod 0755 "$UV_PYTHON_INSTALL_DIR"
    echo "    downloading Python 3.12 via uv (python-build-standalone, ~30 MB)..."
    "$UV_BIN" python install 3.12
    PYTHON_BIN="$("$UV_BIN" python find 3.12)"
    # $APP_USER must be able to read+execute the managed interpreter
    chmod -R o+rX "$UV_PYTHON_INSTALL_DIR"
    echo "    installed: $PYTHON_BIN"
fi

echo "    using: $PYTHON_BIN ($($PYTHON_BIN --version))"

# ----------------------------------------------------------------------------
# Step 2: Service user (Pitfall A6)
# Unprivileged, no shell, no home-dir surprise: -d $APP_HOME but we don't
# auto-create — bootstrap creates the dir tree below.
# ----------------------------------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
    echo "==> Creating service user $APP_USER..."
    useradd -r -s /usr/sbin/nologin -d "$APP_HOME" "$APP_USER"
else
    echo "==> Service user $APP_USER already exists."
fi

# ----------------------------------------------------------------------------
# Step 3: Directory layout
# /etc/proxmox-gui is mode 0700 (Pitfall A6 — only the service user reads).
# /opt, /var/lib, /var/log are 0750 (drwxr-x---) so a debugging operator
# can `sudo -u proxmox-gui ls` without becoming root.
#
# DEPLOY-04: also create the releases/ subdir; the symlink `current` is
# created at the end of Step 4 once the initial release is in place.
# ----------------------------------------------------------------------------
echo "==> Creating /etc, /opt, /var/lib, /var/log layout..."
mkdir -p "$ETC_DIR" "$APP_HOME" "$RELEASES_DIR" "$DATA_DIR" "$LOG_DIR"
chown "$APP_USER:$APP_GROUP" "$ETC_DIR" "$APP_HOME" "$RELEASES_DIR" "$DATA_DIR" "$LOG_DIR"
chmod 0700 "$ETC_DIR"
chmod 0750 "$APP_HOME" "$RELEASES_DIR" "$DATA_DIR" "$LOG_DIR"

# ----------------------------------------------------------------------------
# Step 4: Pull source. We clone to a side directory then copy backend/,
# frontend/, deploy/ into the first releases/<initial-tag>/ slot. The
# `current` symlink is established once the initial release is in place
# so subsequent steps can address /opt/proxmox-gui/current/* uniformly with
# the runtime systemd units.
# ----------------------------------------------------------------------------
echo "==> Fetching source from $REPO_URL @ $RELEASE..."
rm -rf "$APP_SRC"
git clone --depth 1 --branch "$RELEASE" "$REPO_URL" "$APP_SRC"

INITIAL_RELEASE_DIR="${RELEASES_DIR}/${INITIAL_TAG}"
echo "==> Staging initial release into ${INITIAL_RELEASE_DIR}..."
rm -rf "$INITIAL_RELEASE_DIR"
mkdir -p "$INITIAL_RELEASE_DIR"
for sub in backend frontend deploy; do
    cp -r "${APP_SRC}/${sub}" "${INITIAL_RELEASE_DIR}/"
done
chown -R "$APP_USER:$APP_GROUP" "$INITIAL_RELEASE_DIR"

# DEPLOY-04: establish the `current` symlink. `ln -sfn` is atomic on Linux.
echo "==> Pointing ${CURRENT_LINK} → releases/${INITIAL_TAG}..."
ln -sfn "$INITIAL_RELEASE_DIR" "$CURRENT_LINK"
chown -h "$APP_USER:$APP_GROUP" "$CURRENT_LINK"

# APP_HOME is also chown'd so /opt/proxmox-gui/{releases,current} are owned
# correctly even when symlinks are followed by tools that stat their target.
chown -R "$APP_USER:$APP_GROUP" "$APP_HOME"

# ----------------------------------------------------------------------------
# Step 5: Secret material (D-14)
# gen-master-key.sh + gen-jwt-secret.sh are idempotent: they preserve any
# pre-existing files. Run as root because they chown to proxmox-gui. Scripts
# now resolve through /opt/proxmox-gui/current → releases/<tag> (DEPLOY-04).
# ----------------------------------------------------------------------------
echo "==> Generating master.key, jwt.secret, pat.pepper (idempotent)..."
bash "${CURRENT_LINK}/deploy/scripts/gen-master-key.sh"
bash "${CURRENT_LINK}/deploy/scripts/gen-jwt-secret.sh"

# ----------------------------------------------------------------------------
# Step 5b: GUI SSH key (D-21, UAT-1c)
# A dedicated Ed25519 keypair the GUI uses to `ssh root@<node>` for the
# `pct exec` transport that runs community-scripts. Lives alongside the master
# key in /etc/proxmox-gui — same persistent-state class (Pitfall 22).
# install.sh appends the public key to the hosting node's authorized_keys.
# Idempotent: only generated if absent (Pitfall 6 — never overwrite the key).
# ----------------------------------------------------------------------------
GUI_SSH_KEY="${ETC_DIR}/gui_ed25519"
if [[ ! -f "$GUI_SSH_KEY" ]]; then
    echo "==> Generating GUI Ed25519 SSH key at ${GUI_SSH_KEY}..."
    ssh-keygen -t ed25519 -f "$GUI_SSH_KEY" -N "" -C "proxmox-gui@$(hostname)" \
        -q < /dev/null
    chown "$APP_USER:$APP_GROUP" "$GUI_SSH_KEY" "${GUI_SSH_KEY}.pub"
    # 0400 mirrors gen-master-key.sh — strictly tighter than 0600.
    chmod 0400 "$GUI_SSH_KEY"
    chmod 0444 "${GUI_SSH_KEY}.pub"
else
    echo "==> GUI SSH key already present at ${GUI_SSH_KEY} (preserving)."
fi

# ----------------------------------------------------------------------------
# Step 5c: Scoped sudoers for `systemctl restart` (DEPLOY-04, Open Q2 / A5)
#
# The `run_self_update` worker job runs as the unprivileged `proxmox-gui`
# user, but step 5 + 7 of the update sequence (RESEARCH §Pattern 5) need
# `systemctl restart` of the three units. A spike confirmed the unprivileged
# user CANNOT `systemctl restart` system units without explicit polkit/sudo —
# the manager rejects with "access denied" (verified by the systemctl PolicyKit
# rules in /usr/share/polkit-1/actions/org.freedesktop.systemd1.policy, which
# require auth-self-keep for manage-units).
#
# Mitigation (Threat T-05-04-05): a SCOPED sudoers entry permits exactly
# `systemctl restart` of the three named units — nothing more. Not a wildcard,
# not NOPASSWD on /usr/bin/systemctl, not on any other action verb. Narrowly
# scoped: a compromise of the proxmox-gui user can restart the GUI, which it
# could already do via the API anyway.
# ----------------------------------------------------------------------------
echo "==> Installing scoped sudoers entry for systemctl restart..."
SUDOERS_FILE="/etc/sudoers.d/proxmox-gui-systemctl"
cat > "${SUDOERS_FILE}.new" <<SUDOERS
# Generated by deploy/lxc/bootstrap.sh — DEPLOY-04 (DO NOT EDIT BY HAND).
# Scoped sudoers entry: permits the GUI's worker job (DEPLOY-04 self-update,
# RESEARCH Open Question Q2) to restart EXACTLY the three GUI units.
# No wildcards, no NOPASSWD on the systemctl binary as a whole — explicit
# verb + explicit unit name only (Threat T-05-04-05 mitigation).
${APP_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart proxmox-gui-api.service, /usr/bin/systemctl restart proxmox-gui-worker.service, /usr/bin/systemctl restart proxmox-gui-frontend.service
SUDOERS
# visudo -cf validates before install — refuse to atomically swap a broken
# sudoers fragment that would lock the system out.
if visudo -cf "${SUDOERS_FILE}.new" >/dev/null; then
    install -m 0440 -o root -g root "${SUDOERS_FILE}.new" "$SUDOERS_FILE"
    rm -f "${SUDOERS_FILE}.new"
else
    echo "ERROR: generated sudoers fragment failed visudo -cf validation." >&2
    rm -f "${SUDOERS_FILE}.new"
    exit 1
fi

# ----------------------------------------------------------------------------
# Step 6: Python venv + backend install + Alembic migrations
# Each release owns its own .venv so a failed update never half-mutates the
# prior release's site-packages (DEPLOY-04 rollback = symlink repoint).
# ----------------------------------------------------------------------------
RELEASE_VENV="${INITIAL_RELEASE_DIR}/.venv"
echo "==> Creating Python venv at ${RELEASE_VENV} and installing backend..."
"${RUNAS[@]}" "$PYTHON_BIN" -m venv "$RELEASE_VENV"
"${RUNAS[@]}" "${RELEASE_VENV}/bin/pip" install \
    --quiet --upgrade pip setuptools wheel
"${RUNAS[@]}" "${RELEASE_VENV}/bin/pip" install \
    --quiet -e "${INITIAL_RELEASE_DIR}/backend"

echo "==> Running alembic upgrade head..."
# Same cwd-readability requirement as the idempotent-exit branch above.
# PROXMOX_GUI_DATABASE_URL: keep alembic + app on the same DB file.
"${RUNAS[@]}" bash -c "
    export PROXMOX_GUI_DATABASE_URL='sqlite+aiosqlite:////var/lib/proxmox-gui/app.db'
    cd '${INITIAL_RELEASE_DIR}/backend' && \
    exec '${RELEASE_VENV}/bin/alembic' -c '${INITIAL_RELEASE_DIR}/backend/alembic.ini' upgrade head
"

# ----------------------------------------------------------------------------
# Step 7: Frontend — pre-built adapter-node artefact lives in the repo.
#
# History (8 install iterations) showed that running pnpm + vite + tailwind v4
# inside a fresh Debian-12 LXC is fragile (no corepack, IPv6 ETIMEDOUTs to
# registry.npmjs.org, pnpm/oxide native-binding resolution bug). The
# pragmatic answer is to commit frontend/build/ to the repo, so the LXC
# only has to run Node.js — the same Node it needs at runtime anyway.
#
# build/ is generated by `pnpm run build` on a development machine and
# committed via `git add -f frontend/build/`. The bootstrap copies it
# verbatim (already done in Step 4).
# ----------------------------------------------------------------------------
if [[ ! -f "${INITIAL_RELEASE_DIR}/frontend/build/index.js" ]]; then
    echo "ERROR: frontend/build/index.js missing. The pre-built frontend artefact" >&2
    echo "       must be committed to the repo (see CONTRIBUTING.md)." >&2
    exit 1
fi
chown -R "$APP_USER:$APP_GROUP" "${INITIAL_RELEASE_DIR}/frontend/build"
echo "==> Frontend pre-built artefact in place: ${INITIAL_RELEASE_DIR}/frontend/build/"

# ----------------------------------------------------------------------------
# Step 8: systemd units + Caddyfile
# Enables api + caddy + worker (Phase 3 wired arq; the worker depends on the
# redis-server enabled in Step 1b). The Caddyfile uses `tls internal`
# (self-signed) so first-run works on a fresh LXC with no DNS (Pitfall A9).
# ----------------------------------------------------------------------------
echo "==> Installing systemd units..."
install -m 0644 "${INITIAL_RELEASE_DIR}/deploy/systemd/proxmox-gui-api.service" \
    /etc/systemd/system/proxmox-gui-api.service
install -m 0644 "${INITIAL_RELEASE_DIR}/deploy/systemd/proxmox-gui-frontend.service" \
    /etc/systemd/system/proxmox-gui-frontend.service
install -m 0644 "${INITIAL_RELEASE_DIR}/deploy/systemd/proxmox-gui-worker.service" \
    /etc/systemd/system/proxmox-gui-worker.service

echo "==> Installing Caddyfile..."
# Detect the LXC's primary IPv4 address and substitute it into the
# Caddyfile so `tls internal` has a concrete SAN anchor. A bare `:443`
# site block creates a TLS server with no issuable cert — clients then
# get TLS alert internal_error (80) and the wizard is unreachable.
LXC_IP="$(hostname -I | awk '{print $1}')"
if [ -z "$LXC_IP" ]; then
    echo "ERROR: could not detect LXC primary IPv4 from \`hostname -I\`." >&2
    exit 1
fi
echo "    primary IP detected: ${LXC_IP}"
sed "s|__SITE_ADDR__|https://${LXC_IP}:443|" \
    "${INITIAL_RELEASE_DIR}/deploy/caddy/Caddyfile.template" \
    > /etc/caddy/Caddyfile
chmod 0644 /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now proxmox-gui-api.service
systemctl enable --now proxmox-gui-frontend.service
# Caddy was auto-started by apt with the Debian default Caddyfile (HTTP-only,
# :80). `enable --now` would no-op because the unit is already active, leaving
# Caddy on the stale config. Force-restart so our :443 + tls internal config
# is the one actually loaded.
systemctl enable caddy.service
systemctl restart caddy.service
# Phase 3: the arq worker is now wired (depends on redis-server, enabled above).
systemctl enable --now proxmox-gui-worker.service

# ----------------------------------------------------------------------------
# Step 9: Drop the install marker.
# ----------------------------------------------------------------------------
touch "$INSTALLED_MARKER"
chown "$APP_USER:$APP_GROUP" "$INSTALLED_MARKER"
chmod 0644 "$INSTALLED_MARKER"

# ----------------------------------------------------------------------------
# Done.
# ----------------------------------------------------------------------------
echo
echo "============================================================"
echo "  Bootstrap complete."
echo "  Visit: https://<LXC-IP>/setup  (accept self-signed cert)"
echo "  Logs:  journalctl -u proxmox-gui-api -u proxmox-gui-frontend -u caddy -f"
echo "============================================================"
