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

# ----------------------------------------------------------------------------
# Idempotent short-circuit: if marker exists, just run migrations and exit.
# This is the operator's "re-run bootstrap to migrate" entry point until
# Phase 5 self-update lands (DEPLOY-04).
# ----------------------------------------------------------------------------
if [[ -f "$INSTALLED_MARKER" ]]; then
    echo "==> $INSTALLED_MARKER present — running alembic upgrade head and exiting."
    sudo -u "$APP_USER" "${APP_HOME}/.venv/bin/alembic" \
        -c "${APP_HOME}/backend/alembic.ini" upgrade head
    echo "==> Migrations applied. Bootstrap idempotent-exit OK."
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
    build-essential libssl-dev libffi-dev \
    openssl gnupg

echo "==> Locating Python 3.12..."
PYTHON_BIN="python3"
if ! python3 --version 2>/dev/null | grep -qE 'Python 3\.1[2-9]'; then
    echo "    Debian default python3 is < 3.12; enabling bookworm-backports."
    cat >/etc/apt/sources.list.d/bookworm-backports.list <<'BACKPORTS'
deb http://deb.debian.org/debian bookworm-backports main
BACKPORTS
    apt-get update -qq
    if apt-get install -y -qq -t bookworm-backports \
            python3.12 python3.12-venv python3.12-dev; then
        PYTHON_BIN="python3.12"
        echo "    installed python3.12 from bookworm-backports."
    else
        # TODO(phase-5): pyenv fallback (build from source). Track in DEPLOY-04.
        echo "ERROR: bookworm-backports does not ship python3.12 yet." >&2
        echo "       Phase 5 will add pyenv fallback (DEPLOY-04). For now, abort." >&2
        exit 1
    fi
else
    # System python3 is already >= 3.12 — ensure venv module is present.
    apt-get install -y -qq python3-venv python3-dev
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
# ----------------------------------------------------------------------------
echo "==> Creating /etc, /opt, /var/lib, /var/log layout..."
mkdir -p "$ETC_DIR" "$APP_HOME" "$DATA_DIR" "$LOG_DIR"
chown "$APP_USER:$APP_GROUP" "$ETC_DIR" "$APP_HOME" "$DATA_DIR" "$LOG_DIR"
chmod 0700 "$ETC_DIR"
chmod 0750 "$APP_HOME" "$DATA_DIR" "$LOG_DIR"

# ----------------------------------------------------------------------------
# Step 4: Pull source. We clone to a side directory then copy backend/,
# frontend/, deploy/ into $APP_HOME so the install path doesn't include
# .git/ or .planning/. The scripts directory (deploy/scripts) is also
# needed before we can generate keys — so we copy it now.
# ----------------------------------------------------------------------------
echo "==> Fetching source from $REPO_URL @ $RELEASE..."
rm -rf "$APP_SRC"
git clone --depth 1 --branch "$RELEASE" "$REPO_URL" "$APP_SRC"

for sub in backend frontend deploy; do
    rm -rf "${APP_HOME:?}/${sub}"
    cp -r "${APP_SRC}/${sub}" "${APP_HOME}/"
done
chown -R "$APP_USER:$APP_GROUP" "$APP_HOME"

# ----------------------------------------------------------------------------
# Step 5: Secret material (D-14)
# gen-master-key.sh + gen-jwt-secret.sh are idempotent: they preserve any
# pre-existing files. Run as root because they chown to proxmox-gui.
# ----------------------------------------------------------------------------
echo "==> Generating master.key, jwt.secret, pat.pepper (idempotent)..."
bash "${APP_HOME}/deploy/scripts/gen-master-key.sh"
bash "${APP_HOME}/deploy/scripts/gen-jwt-secret.sh"

# ----------------------------------------------------------------------------
# Step 6: Python venv + backend install + Alembic migrations
# ----------------------------------------------------------------------------
echo "==> Creating Python venv and installing backend..."
sudo -u "$APP_USER" "$PYTHON_BIN" -m venv "${APP_HOME}/.venv"
sudo -u "$APP_USER" "${APP_HOME}/.venv/bin/pip" install \
    --quiet --upgrade pip setuptools wheel
sudo -u "$APP_USER" "${APP_HOME}/.venv/bin/pip" install \
    --quiet -e "${APP_HOME}/backend"

echo "==> Running alembic upgrade head..."
sudo -u "$APP_USER" "${APP_HOME}/.venv/bin/alembic" \
    -c "${APP_HOME}/backend/alembic.ini" upgrade head

# ----------------------------------------------------------------------------
# Step 7: Frontend build (SvelteKit adapter-node -> frontend/build/)
# ----------------------------------------------------------------------------
echo "==> Building frontend (npm ci && npm run build)..."
sudo -u "$APP_USER" bash -c "
    cd '${APP_HOME}/frontend' && \
    npm ci --no-audit --no-fund --silent && \
    npm run build
"

# ----------------------------------------------------------------------------
# Step 8: systemd units + Caddyfile
# Phase 1 enables api + caddy; worker is INSTALLED but NOT enabled
# (Phase 3 wires arq). The Caddyfile uses `tls internal` (self-signed)
# so first-run works on a fresh LXC with no DNS (Pitfall A9).
# ----------------------------------------------------------------------------
echo "==> Installing systemd units..."
install -m 0644 "${APP_HOME}/deploy/systemd/proxmox-gui-api.service" \
    /etc/systemd/system/proxmox-gui-api.service
install -m 0644 "${APP_HOME}/deploy/systemd/proxmox-gui-worker.service" \
    /etc/systemd/system/proxmox-gui-worker.service

echo "==> Installing Caddyfile..."
install -m 0644 "${APP_HOME}/deploy/caddy/Caddyfile.template" \
    /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now proxmox-gui-api.service
systemctl enable --now caddy.service
# systemctl enable --now proxmox-gui-worker.service  # Phase 3 wires arq

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
echo "  Logs:  journalctl -u proxmox-gui-api -f"
echo "============================================================"
