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
# Drop-privilege helper: use runuser (always present, part of util-linux)
# instead of sudo (not installed in minimal Debian LXCs by default).
RUNAS=(runuser -u "$APP_USER" --)

if [[ -f "$INSTALLED_MARKER" ]]; then
    echo "==> $INSTALLED_MARKER present — running alembic upgrade head and exiting."
    # cd into backend/: alembic 1.18+ probes cwd for pyproject.toml, and /root
    # (default cwd for root) is mode 0700 → APP_USER cannot stat it → crash.
    "${RUNAS[@]}" bash -c "cd '${APP_HOME}/backend' && exec '${APP_HOME}/.venv/bin/alembic' -c '${APP_HOME}/backend/alembic.ini' upgrade head"
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
"${RUNAS[@]}" "$PYTHON_BIN" -m venv "${APP_HOME}/.venv"
"${RUNAS[@]}" "${APP_HOME}/.venv/bin/pip" install \
    --quiet --upgrade pip setuptools wheel
"${RUNAS[@]}" "${APP_HOME}/.venv/bin/pip" install \
    --quiet -e "${APP_HOME}/backend"

echo "==> Running alembic upgrade head..."
# Same cwd-readability requirement as the idempotent-exit branch above.
"${RUNAS[@]}" bash -c "cd '${APP_HOME}/backend' && exec '${APP_HOME}/.venv/bin/alembic' -c '${APP_HOME}/backend/alembic.ini' upgrade head"

# ----------------------------------------------------------------------------
# Step 7: Frontend build (SvelteKit adapter-node -> frontend/build/)
# The frontend uses pnpm (lockfile is pnpm-lock.yaml, no package-lock.json).
# `package.json` declares packageManager: pnpm@11.1.1.
#
# Why we install pnpm as a standalone binary instead of via corepack or
# npm install -g:
#   - corepack: Debian's nodejs package strips it (policy decision).
#   - npm install -g: registry.npmjs.org resolves to a Cloudflare IPv6
#     address. Many LXCs have functional IPv4 but no IPv6 routing,
#     leading to an ETIMEDOUT on every fresh install. Forcing Node to
#     prefer IPv4 (NODE_OPTIONS=--dns-result-order=ipv4first) helps for
#     the subsequent `pnpm install`, but the bootstrap problem remains.
#   - Standalone pnpm binary: a single statically-linked file hosted on
#     github.com (well-routed over IPv4), so no DNS surprises during
#     bootstrap.
# ----------------------------------------------------------------------------
PNPM_VERSION="11.1.1"
PNPM_HOME="/opt/pnpm"
echo "==> Downloading pnpm ${PNPM_VERSION} (~50 MB tarball from GitHub)..."
# pnpm v11+ ships as a tarball (binary + dist/ side-car), not a single
# self-contained file. We extract to /opt/pnpm and symlink the launcher
# binary into /usr/local/bin/pnpm — the binary resolves dist/ relative
# to its own resolved path, so the symlink works correctly.
mkdir -p "$PNPM_HOME"
TMP_TARBALL="$(mktemp -t pnpm.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_TARBALL"' EXIT
curl -fsSL --retry 3 -o "$TMP_TARBALL" \
    "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linux-x64.tar.gz"
tar -xzf "$TMP_TARBALL" -C "$PNPM_HOME"
chmod -R o+rX "$PNPM_HOME"
ln -sf "${PNPM_HOME}/pnpm" /usr/local/bin/pnpm
if ! /usr/local/bin/pnpm --version >/dev/null 2>&1; then
    echo "ERROR: pnpm extracted but cannot execute (architecture mismatch?)." >&2
    exit 1
fi
echo "    using: /usr/local/bin/pnpm -> ${PNPM_HOME}/pnpm ($(/usr/local/bin/pnpm --version))"

# pnpm stores its content-addressable store under \$HOME/.local/share/pnpm/store
# by default. APP_USER has \$APP_HOME as home (per useradd -d above) and owns
# it, so the store + node_modules can be written there without issue.
#
# NODE_OPTIONS=--dns-result-order=ipv4first prevents IPv6 ETIMEDOUTs against
# registry.npmjs.org (same class as the npm install -g failure above).
#
# Why NOT --frozen-lockfile here:
#   @tailwindcss/oxide (Tailwind v4 Rust backend) uses optionalDependencies
#   for per-platform native bindings (@tailwindcss/oxide-linux-x64-gnu, ...).
#   With --frozen-lockfile, pnpm 11.1.1 sometimes fails to install the
#   platform-matching native binding even though it's in the lockfile —
#   "Cannot find native binding" at build time.
#   --prefer-frozen-lockfile: use the lockfile if it matches the manifest,
#   re-resolve otherwise. Safe because we own the lockfile + manifest.
#
# We also drop --reporter=silent so any install warnings (especially around
# optional deps and platform-skip) surface in the bootstrap output.
echo "==> Running pnpm install (verbose, --prefer-frozen-lockfile)..."
"${RUNAS[@]}" bash -c "
    set -e
    export NODE_OPTIONS='--dns-result-order=ipv4first'
    export PATH=/usr/local/bin:/usr/bin:/bin
    cd '${APP_HOME}/frontend' && \
    pnpm install --prefer-frozen-lockfile
"

echo "==> Building frontend (pnpm run build)..."
"${RUNAS[@]}" bash -c "
    set -e
    export NODE_OPTIONS='--dns-result-order=ipv4first'
    export PATH=/usr/local/bin:/usr/bin:/bin
    cd '${APP_HOME}/frontend' && \
    pnpm run build
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
