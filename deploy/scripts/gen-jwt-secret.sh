#!/usr/bin/env bash
# shellcheck shell=bash
#
# deploy/scripts/gen-jwt-secret.sh — idempotent JWT secret + PAT pepper generator.
#
# Writes TWO files under /etc/proxmox-gui/, both mode 0400 owned by
# proxmox-gui:proxmox-gui (same principle as gen-master-key.sh):
#
#   - jwt.secret  : 48 url-safe base64 chars (~36 bytes of entropy).
#                   Signs the access JWT (D-10: 15-min TTL).
#   - pat.pepper  : 48 url-safe base64 chars (~36 bytes of entropy).
#                   Per-deployment pepper mixed into PAT secret hashing
#                   (D-15: PAT secret = SHA-256(pat_pepper || raw_pat_secret)).
#
# Both files are idempotent: existing files are preserved (rotation lands
# in Phase 5 alongside master.key rotation — DEPLOY-04).
#
# Mode 0400 is intentionally more restrictive than D-14's 0600 minimum
# (same justification as gen-master-key.sh: service user only reads).

set -euo pipefail

ETC_DIR="/etc/proxmox-gui"
APP_USER="proxmox-gui"
APP_GROUP="proxmox-gui"

# Generate 48 url-safe base64 chars (~36 bytes of entropy).
# `openssl rand -base64 N` emits N bytes -> 4*ceil(N/3) chars (with =).
# We want 48 url-safe chars; pull 36 raw bytes and tr the '+/=' out.
gen_secret() {
    openssl rand 36 \
        | base64 \
        | tr -d '\n=' \
        | tr '+/' '-_' \
        | cut -c1-48
}

write_secret_file() {
    local path="$1"
    local label="$2"

    if [[ -f "$path" ]]; then
        echo "$label already exists at $path (preserving)"
        return 0
    fi

    # Generate to a temp file inside the same dir then atomic-rename so the
    # final file is never world-readable for any window.
    local tmp
    tmp="$(mktemp -p "$(dirname "$path")" ".${label}.XXXXXX")"
    chmod 0400 "$tmp"
    gen_secret > "$tmp"
    chown "$APP_USER:$APP_GROUP" "$tmp"
    mv "$tmp" "$path"

    echo "Wrote $path (48 url-safe base64 chars, mode 0400, owner $APP_USER)"
}

mkdir -p "$ETC_DIR"
chown "$APP_USER:$APP_GROUP" "$ETC_DIR"
chmod 0700 "$ETC_DIR"

write_secret_file "${ETC_DIR}/jwt.secret" "jwt.secret"
write_secret_file "${ETC_DIR}/pat.pepper" "pat.pepper"
