#!/usr/bin/env bash
# shellcheck shell=bash
#
# deploy/scripts/gen-master-key.sh — idempotent master.key generator (D-14).
#
# Writes 32 cryptographically-random bytes to /etc/proxmox-gui/master.key.
# The FastAPI service user (proxmox-gui) reads this on boot to instantiate
# the Fernet cipher used to encrypt PVE API tokens, refresh tokens, and the
# PAT pepper at rest (D-15).
#
# Mode 0400 (read-only owner) is intentionally more restrictive than CONTEXT D-14's stated 0600 minimum — principle of least privilege; FastAPI service user only reads, never writes.
# The startup check in app.core.cipher verifies `st_mode & 0o077 == 0` (Pitfall A6), which both 0400 and 0600 satisfy — but 0400 is strictly tighter.
#
# Idempotent: if /etc/proxmox-gui/master.key already exists, this script
# preserves it. Rotation is a Phase 5 concern (DEPLOY-04).
#
# Pitfall A6 enforced here:
#   - Owner: proxmox-gui:proxmox-gui (the service user)
#   - Mode:  0400
#   - Parent dir /etc/proxmox-gui MUST be 0700 (set by bootstrap.sh).
#
# Pitfall T-01-04-10 (information disclosure via stdout): we use
# `dd ... status=none` so the random bytes never appear in the journal.

set -euo pipefail

KEY_PATH="/etc/proxmox-gui/master.key"
APP_USER="proxmox-gui"
APP_GROUP="proxmox-gui"

if [[ -f "$KEY_PATH" ]]; then
    echo "master.key already exists at $KEY_PATH (preserving)"
    exit 0
fi

# Ensure parent dir exists with the right mode. bootstrap.sh creates it
# already, but this script must be safe to run standalone too.
mkdir -p "$(dirname "$KEY_PATH")"
chown "$APP_USER:$APP_GROUP" "$(dirname "$KEY_PATH")"
chmod 0700 "$(dirname "$KEY_PATH")"

# 32 random bytes — never echoed, `status=none` suppresses dd's summary.
dd if=/dev/urandom of="$KEY_PATH" bs=32 count=1 status=none

chown "$APP_USER:$APP_GROUP" "$KEY_PATH"
chmod 0400 "$KEY_PATH"  # more restrictive than D-14 minimum (0600)

echo "Wrote $KEY_PATH (32 random bytes, mode 0400, owner $APP_USER)"
