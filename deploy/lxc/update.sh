#!/usr/bin/env bash
# shellcheck shell=bash
#
# deploy/lxc/update.sh — factored in-LXC update routine (DEPLOY-04).
#
# Invoked by BOTH:
#   - `install.sh --update` (re-running the helper-script — D-09 / D-12), and
#   - the `run_self_update` worker arq job (the admin-button path — D-09).
#
# Both call sites stage a release tarball under /var/lib/proxmox-gui/staging/
# and a manifest line that names the target tag. This script:
#
#   1. Unpacks the tarball into /opt/proxmox-gui/releases/<tag>/
#   2. Re-creates the Python venv inside the new release dir, pip-installs the
#      backend, and copies in the COMMITTED frontend/build/ (no pnpm — see
#      MEMORY "Frontend build node_modules trap").
#   3. Runs `alembic upgrade head` against the persistent app.db.
#   4. Atomic symlink swap: /opt/proxmox-gui/current → releases/<tag>
#      (`ln -sfn` is atomic on Linux).
#   5. systemd unit refresh + restart of api + frontend via the scoped sudoers
#      entry written by bootstrap.sh (Open Question Q2 resolution).
#
# This script DOES NOT touch /etc/proxmox-gui (master key, jwt secret,
# pat.pepper, GUI SSH private key) or /var/lib/proxmox-gui (the app.db, the
# self-update's pre-update DB snapshot). Pitfall 7 / Threat T-05-04-03:
# persistent state must survive every update.
#
# Idempotent: re-invoking with the same tag re-unpacks into the same
# releases/<tag>/ dir (rm -rf then mkdir), so a partial prior run leaves no
# half-installed leftover.
#
# Required env (set by the caller):
#   RELEASE_TAG       semver tag of the staged release (e.g. v0.5.0)
#   RELEASE_TARBALL   absolute path to the unpacked-into-place tarball
#                     (typically /var/lib/proxmox-gui/staging/<tag>.tar.gz)

set -euo pipefail

trap 'echo "ERROR: update.sh failed at line $LINENO (exit $?)" >&2; exit 1' ERR

# --- Inputs ------------------------------------------------------------------
RELEASE_TAG="${RELEASE_TAG:-}"
RELEASE_TARBALL="${RELEASE_TARBALL:-}"
if [[ -z "$RELEASE_TAG" ]] || [[ -z "$RELEASE_TARBALL" ]]; then
    echo "ERROR: RELEASE_TAG and RELEASE_TARBALL env vars are required." >&2
    exit 1
fi
if [[ ! -f "$RELEASE_TARBALL" ]]; then
    echo "ERROR: tarball not found: $RELEASE_TARBALL" >&2
    exit 1
fi

APP_USER="proxmox-gui"
APP_GROUP="proxmox-gui"
APP_HOME="/opt/proxmox-gui"
RELEASES_DIR="${APP_HOME}/releases"
CURRENT_LINK="${APP_HOME}/current"
TARGET_DIR="${RELEASES_DIR}/${RELEASE_TAG}"

RUNAS=(runuser -u "$APP_USER" --)

# --- 1. Unpack into releases/<tag>/ -----------------------------------------
echo "==> Preparing ${TARGET_DIR}..."
mkdir -p "$RELEASES_DIR"
# Idempotent re-run: wipe any half-installed prior attempt for the same tag.
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
chown "$APP_USER:$APP_GROUP" "$RELEASES_DIR" "$TARGET_DIR"

echo "==> Unpacking ${RELEASE_TARBALL} into ${TARGET_DIR}..."
# --strip-components=1 if the tarball has a top-level dir (GitHub Release
# tarballs do); accept either layout.
tar -xzf "$RELEASE_TARBALL" -C "$TARGET_DIR" --strip-components=1 \
    || tar -xzf "$RELEASE_TARBALL" -C "$TARGET_DIR"
chown -R "$APP_USER:$APP_GROUP" "$TARGET_DIR"

# Sanity: the tarball must carry backend + frontend + deploy.
for sub in backend frontend deploy; do
    if [[ ! -d "${TARGET_DIR}/${sub}" ]]; then
        echo "ERROR: tarball missing ${sub}/ — refusing to swap." >&2
        exit 1
    fi
done

# Sanity: the COMMITTED frontend build artefact must be present.
if [[ ! -f "${TARGET_DIR}/frontend/build/index.js" ]]; then
    echo "ERROR: ${TARGET_DIR}/frontend/build/index.js missing — refusing to swap." >&2
    exit 1
fi

# --- 2. Per-release venv + backend install ---------------------------------
# Each release gets its own .venv so a failed update never half-mutates the
# previous release's site-packages (rollback = repoint the symlink, no pip undo).
PYTHON_BIN="${APP_HOME}/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
    # Fall back to system python3 if a pre-release install never had a venv.
    PYTHON_BIN="$(command -v python3)"
fi

echo "==> Creating per-release venv at ${TARGET_DIR}/.venv..."
"${RUNAS[@]}" "$PYTHON_BIN" -m venv "${TARGET_DIR}/.venv"
"${RUNAS[@]}" "${TARGET_DIR}/.venv/bin/pip" install \
    --quiet --upgrade pip setuptools wheel
"${RUNAS[@]}" "${TARGET_DIR}/.venv/bin/pip" install \
    --quiet -e "${TARGET_DIR}/backend"

# --- 3. Migrations ---------------------------------------------------------
echo "==> Running alembic upgrade head against the persistent app.db..."
"${RUNAS[@]}" bash -c "
    export PROXMOX_GUI_DATABASE_URL='sqlite+aiosqlite:////var/lib/proxmox-gui/app.db'
    cd '${TARGET_DIR}/backend' && \
    exec '${TARGET_DIR}/.venv/bin/alembic' -c '${TARGET_DIR}/backend/alembic.ini' upgrade head
"

# --- 4. Atomic symlink swap -------------------------------------------------
# `ln -sfn TARGET LINK` is atomic on Linux: rename() the new symlink onto the
# old one in a single syscall. No window where `current` is missing.
echo "==> Swapping ${CURRENT_LINK} → releases/${RELEASE_TAG}..."
ln -sfn "$TARGET_DIR" "$CURRENT_LINK"
chown -h "$APP_USER:$APP_GROUP" "$CURRENT_LINK"

# --- 5. systemd unit refresh + restart -------------------------------------
# The unit files may have changed between releases (new env, new ExecStart
# flag). Re-install them from the just-unpacked release, daemon-reload, then
# restart the three services via the scoped sudoers entry.
echo "==> Refreshing systemd units from ${TARGET_DIR}/deploy/systemd/..."
install -m 0644 "${TARGET_DIR}/deploy/systemd/proxmox-gui-api.service" \
    /etc/systemd/system/proxmox-gui-api.service
install -m 0644 "${TARGET_DIR}/deploy/systemd/proxmox-gui-worker.service" \
    /etc/systemd/system/proxmox-gui-worker.service
install -m 0644 "${TARGET_DIR}/deploy/systemd/proxmox-gui-frontend.service" \
    /etc/systemd/system/proxmox-gui-frontend.service
systemctl daemon-reload

# API + frontend restart now (the worker is restarted LAST by the orchestrator
# — install.sh restarts it here, run_self_update from the worker restarts itself
# at the very end after the health check).
echo "==> Restarting proxmox-gui-api + proxmox-gui-frontend..."
systemctl restart proxmox-gui-api.service
systemctl restart proxmox-gui-frontend.service

# install.sh invokes this script as root (via `pct exec`); the worker invokes
# it as the proxmox-gui user via sudo with the scoped entry. Both paths can
# reach `systemctl restart` for the three named units.

echo "==> update.sh: release ${RELEASE_TAG} installed and swapped in."
