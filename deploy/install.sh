#!/usr/bin/env bash
# shellcheck shell=bash
#
# deploy/install.sh — Proxmox GUI one-line helper-script installer (DEPLOY-01)
#
# Usage (on a Proxmox VE 8.x host):
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/chloepriceless/proxmox-gui/master/deploy/install.sh)"
#
# This script:
#   1. Verifies it is running on a Proxmox VE host (pct must be present).
#   2. Allocates a VMID via `pvesh get /cluster/nextid` (Pitfall 6: app-level
#      lock at runtime — install-time race is acceptable per CONTEXT D-17).
#   3. Downloads the Debian 12 LXC template if missing (D-16).
#   4. Creates an UNPRIVILEGED LXC with nesting=1,keyctl=1 features
#      (D-17, Pitfall 19: never use --privileged 1; nesting required for
#      systemd-in-LXC, keyctl required for Caddy CA + Python crypto keyring).
#   5. Boots the LXC, waits for network, then `pct exec`s the inner
#      bootstrap.sh fetched from the same release.
#
# This file is intentionally small. All heavy lifting (deps, user, code,
# migrations, systemd, Caddy) happens inside the LXC via bootstrap.sh.
#
# Idempotence: re-running this script with an existing CTID will fail at
# `pct create`. Use a new CTID, or `pct destroy <id>` first. The inner
# bootstrap.sh IS idempotent (see deploy/lxc/bootstrap.sh).

set -euo pipefail

# ----------------------------------------------------------------------------
# Banner
# ----------------------------------------------------------------------------
cat <<'BANNER'
============================================================
  Proxmox Self-Service GUI — installer
  https://github.com/chloepriceless/proxmox-gui
============================================================
BANNER

# ----------------------------------------------------------------------------
# Sanity: must run on a Proxmox VE host
# ----------------------------------------------------------------------------
if ! command -v pct >/dev/null 2>&1; then
    echo "ERROR: this script must run on a Proxmox VE host (pct not found)." >&2
    exit 1
fi

if ! command -v pvesh >/dev/null 2>&1; then
    echo "ERROR: pvesh not found — is this a Proxmox VE 8.x host?" >&2
    exit 1
fi

# ----------------------------------------------------------------------------
# Error trap (surfaces the failing line so operator can read journal/journal-host)
# ----------------------------------------------------------------------------
trap 'echo "ERROR: install.sh failed at line $LINENO (exit $?)" >&2; exit 1' ERR

# ----------------------------------------------------------------------------
# Defaults (overridable via env or flags)
# ----------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/chloepriceless/proxmox-gui}"
RELEASE="${RELEASE:-master}"

CTID_DEFAULT="$(pvesh get /cluster/nextid)"
CTID="${CTID:-$CTID_DEFAULT}"
HOSTNAME_VAL="${HOSTNAME:-proxmox-gui}"
CPU="${CPU:-2}"
RAM_MB="${RAM_MB:-2048}"
DISK_GB="${DISK_GB:-8}"
STORAGE="${STORAGE:-local-lvm}"
BRIDGE="${BRIDGE:-vmbr0}"

# ----------------------------------------------------------------------------
# Argument parser — flags win over env vars
# ----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --ctid)     CTID="$2";         shift 2 ;;
        --hostname) HOSTNAME_VAL="$2"; shift 2 ;;
        --cpu)      CPU="$2";          shift 2 ;;
        --ram)      RAM_MB="$2";       shift 2 ;;
        --disk)     DISK_GB="$2";      shift 2 ;;
        --storage)  STORAGE="$2";      shift 2 ;;
        --bridge)   BRIDGE="$2";       shift 2 ;;
        --repo-url) REPO_URL="$2";     shift 2 ;;
        --release)  RELEASE="$2";      shift 2 ;;
        -h|--help)
            cat <<'HELP'
Usage: install.sh [flags]

Flags (all optional; defaults shown):
  --ctid     N     LXC ID (default: pvesh get /cluster/nextid)
  --hostname X     LXC hostname (default: proxmox-gui)
  --cpu      N     vCPU cores (default: 2)
  --ram      MB    RAM in MB (default: 2048)
  --disk     GB    rootfs size in GB (default: 8)
  --storage  S     PVE storage ID (default: local-lvm)
  --bridge   B     network bridge (default: vmbr0)
  --repo-url URL   git repo URL  (default: https://github.com/chloepriceless/proxmox-gui)
  --release  REF   git branch/tag (default: main)

Environment variables (CTID, HOSTNAME, CPU, RAM_MB, DISK_GB, STORAGE,
BRIDGE, REPO_URL, RELEASE) are read as fallback when a flag is not given.

Example:
  CPU=4 RAM_MB=4096 bash install.sh --hostname pmx-gui --storage local-zfs
HELP
            exit 0 ;;
        *)
            echo "ERROR: unknown flag: $1 (try --help)" >&2
            exit 1 ;;
    esac
done

echo "==> Plan:"
echo "      CTID=$CTID  hostname=$HOSTNAME_VAL"
echo "      cpu=$CPU  ram=${RAM_MB}MB  disk=${DISK_GB}GB"
echo "      storage=$STORAGE  bridge=$BRIDGE"
echo "      repo=$REPO_URL  release=$RELEASE"

# ----------------------------------------------------------------------------
# Step 1: Debian 12 template (D-16)
# `pveam available` lists every offered template; we pick the latest
# debian-12-standard amd64 entry. `pveam download` is idempotent — if the
# template already exists it returns 0 with a "(already downloaded)" message.
# ----------------------------------------------------------------------------
echo "==> Locating Debian 12 LXC template..."
TEMPLATE="$(pveam available 2>/dev/null \
              | grep -E 'debian-12-standard.*amd64' \
              | awk '{print $2}' \
              | sort -r \
              | head -1 || true)"

if [[ -z "$TEMPLATE" ]]; then
    # Fall back to the well-known 12.7-1 release (also documented in 01-RESEARCH.md).
    TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
    echo "    WARN: pveam available returned nothing; falling back to $TEMPLATE"
fi

echo "==> Ensuring template present: $TEMPLATE"
pveam download local "$TEMPLATE" >/dev/null 2>&1 || true

# ----------------------------------------------------------------------------
# Step 2: Create UNPRIVILEGED LXC (D-17, Pitfall 19)
#   - unprivileged 1     : root inside is unmapped; host-root NOT exposed
#   - features nesting=1 : systemd-in-LXC requires this
#   - features keyctl=1  : Caddy local CA + Python cryptography keyring need keyctl
#   - onboot 1           : start on host boot
# DO NOT add `--privileged 1` here — it defeats the entire security model.
# ----------------------------------------------------------------------------
echo "==> Creating LXC $CTID..."
pct create "$CTID" "local:vztmpl/$TEMPLATE" \
    --hostname "$HOSTNAME_VAL" \
    --cores "$CPU" \
    --memory "$RAM_MB" \
    --rootfs "$STORAGE:$DISK_GB" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=dhcp" \
    --unprivileged 1 \
    --features "nesting=1,keyctl=1" \
    --onboot 1

# ----------------------------------------------------------------------------
# Step 3: Boot + wait for network
# Some hosts take 30-40s for DHCP. Poll for an IPv4 on eth0.
# ----------------------------------------------------------------------------
echo "==> Starting LXC $CTID..."
pct start "$CTID"

echo "==> Waiting for network in LXC (up to 60s)..."
LXC_IP=""
for i in $(seq 1 30); do
    set +e
    LXC_IP="$(pct exec "$CTID" -- ip -4 -o addr show dev eth0 2>/dev/null \
                | awk '{print $4}' | cut -d/ -f1 | head -1)"
    set -e
    if [[ -n "$LXC_IP" ]]; then
        echo "    got IP: $LXC_IP (after ${i} polls)"
        break
    fi
    sleep 2
done

if [[ -z "$LXC_IP" ]]; then
    echo "ERROR: LXC did not acquire an IPv4 address within 60s." >&2
    echo "       Check: pct exec $CTID -- ip a ; pct exec $CTID -- journalctl -b" >&2
    exit 1
fi

# ----------------------------------------------------------------------------
# Step 4: Inner bootstrap
# Inject REPO_URL + RELEASE into the LXC's env so bootstrap.sh can reuse them
# when it git-clones the source tree.
#
# SECURITY (BL-01 fix): pass REPO_URL / RELEASE as env-prefix args to `pct
# exec` rather than interpolating them into a quoted shell string. The
# previous form (`bash -c "...export REPO_URL='$REPO_URL'..."`) was
# vulnerable to single-quote injection: a value like `'; id > /tmp/pwned;
# echo '` would break out of the quotes and execute arbitrary commands
# with the privileges of the calling process (typically root on a PVE
# host). With `pct exec -- env KEY=VAL bash -c '...'` the operator-supplied
# values land in the inner shell's environment as opaque strings and the
# heredoc itself is single-quoted (no host-side interpolation at all);
# the inner shell expands ${REPO_URL} / ${RELEASE} from its own env.
#
# Pitfall T-01-04-01: we still use HTTPS curl + the operator must visually
# verify the install URL. Phase 5 will add GPG-signed releases (DEPLOY-04).
# ----------------------------------------------------------------------------
echo "==> Running inner bootstrap.sh inside the LXC..."
# shellcheck disable=SC2016
# SC2016 disabled intentionally: the inner shell string is single-quoted on
# purpose so the host shell does NOT interpolate REPO_URL/RELEASE. The inner
# shell expands them from its own env (passed via `pct exec -- env ...`).
pct exec "$CTID" -- env \
    REPO_URL="$REPO_URL" \
    RELEASE="$RELEASE" \
    bash -c '
    set -euo pipefail
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates
    curl -fsSL "${REPO_URL}/raw/${RELEASE}/deploy/lxc/bootstrap.sh" | bash
'

# ----------------------------------------------------------------------------
# Step 5: Final banner
# ----------------------------------------------------------------------------
cat <<EOF

============================================================
  Proxmox GUI installed
  LXC:    $CTID  ($HOSTNAME_VAL)
  Visit:  https://$LXC_IP/setup
          (accept the self-signed cert; first-run wizard guides you)
  Logs:   pct exec $CTID -- journalctl -u proxmox-gui-api -f
============================================================
EOF
