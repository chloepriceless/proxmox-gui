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
# Idempotence (DEPLOY-04 / D-12):
#   - First run: creates the LXC and runs bootstrap.sh inside it.
#   - Re-running with `--update` OR against an existing CTID: skips `pct create`
#     and runs `deploy/lxc/update.sh` inside the LXC instead (in-place update).
#   - SSH trust (UAT-1c / D-21): on the create path the script also generates
#     a GUI Ed25519 keypair INSIDE the LXC and IDEMPOTENTLY appends the public
#     key to THIS PVE node's /root/.ssh/authorized_keys so community-scripts
#     work out-of-the-box. Re-runs do NOT duplicate the authorized_keys line
#     (Pitfall 6: `grep -qF || echo >>`).

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
# DEPLOY-04: --update forces the update-in-place path even if the CTID is
# fresh; an existing CTID also routes into the update path. Either way the
# script invokes deploy/lxc/update.sh inside the LXC.
FORCE_UPDATE=0

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
        --update)   FORCE_UPDATE=1;    shift   ;;
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
  --update         Force the in-place update path (DEPLOY-04). Re-runs
                   deploy/lxc/update.sh inside an existing LXC. An existing
                   CTID also triggers this path automatically (D-12).

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
# DEPLOY-04 / D-09 / D-12: existing-CTID detector — if --update was passed
# OR the target CTID already exists, route into the update-in-place path
# (deploy/lxc/update.sh) instead of `pct create`. "One command for install
# and update" — re-running this script just works.
# ----------------------------------------------------------------------------
CTID_EXISTS=0
if pct status "$CTID" >/dev/null 2>&1; then
    CTID_EXISTS=1
fi

if [[ "$FORCE_UPDATE" -eq 1 ]] || [[ "$CTID_EXISTS" -eq 1 ]]; then
    if [[ "$CTID_EXISTS" -ne 1 ]]; then
        echo "ERROR: --update was passed but CTID $CTID does not exist." >&2
        echo "       Drop --update to create a fresh LXC, or re-run with an existing CTID." >&2
        exit 1
    fi
    echo "==> CTID $CTID already exists — routing into the update path (DEPLOY-04 / D-12)."
    # Ensure the LXC is running before `pct exec`.
    if ! pct status "$CTID" | grep -q running; then
        echo "==> Starting LXC $CTID..."
        pct start "$CTID"
        # Brief settling time — the prior code path had a 60s network wait,
        # but an update path only needs `pct exec` to work, not external
        # network, so a few seconds is enough.
        for _ in $(seq 1 10); do
            pct exec "$CTID" -- true 2>/dev/null && break
            sleep 1
        done
    fi

    # Stage the release tarball INSIDE the LXC by fetching from the repo at
    # the requested ref. The worker job (run_self_update) instead stages a
    # SHA-256-verified GitHub Release tarball; install.sh trusts the operator
    # (HTTPS + master-branch source) for the recovery / out-of-band path
    # (D-09 — install.sh --update is the recovery channel when the UI is broken).
    #
    # SECURITY (BL-01-class): pass env vars to `pct exec` so the inner shell
    # is single-quoted; the host shell never interpolates operator strings.
    echo "==> Staging release tarball + invoking deploy/lxc/update.sh inside CTID $CTID..."
    # shellcheck disable=SC2016
    pct exec "$CTID" -- env \
        REPO_URL="$REPO_URL" \
        RELEASE="$RELEASE" \
        bash -c '
        set -euo pipefail
        STAGING=/var/lib/proxmox-gui/staging
        mkdir -p "$STAGING"
        TARBALL="${STAGING}/${RELEASE}.tar.gz"
        echo "==> Downloading ${REPO_URL}/archive/${RELEASE}.tar.gz..."
        curl -fsSL "${REPO_URL}/archive/${RELEASE}.tar.gz" -o "$TARBALL"
        # update.sh expects to find itself inside the staged tarball — extract
        # it to a temp dir and invoke from there so install-time and self-update
        # both run the same code that just arrived.
        TMP="$(mktemp -d)"
        tar -xzf "$TARBALL" -C "$TMP" --strip-components=1
        env RELEASE_TAG="$RELEASE" RELEASE_TARBALL="$TARBALL" \
            bash "${TMP}/deploy/lxc/update.sh"
        rm -rf "$TMP"
    '

    cat <<EOF

============================================================
  Proxmox GUI updated in place
  LXC:    $CTID
  Tag:    $RELEASE
  Logs:   pct exec $CTID -- journalctl -u proxmox-gui-api -f
============================================================
EOF
    exit 0
fi

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
# Step 5: SSH trust (UAT-1c / D-21) — establish the hosting-node trust so
# community-scripts work zero-config on the local PVE node out of the box.
#
# bootstrap.sh created an Ed25519 keypair at /etc/proxmox-gui/gui_ed25519
# inside the LXC (Step 5b). Read its PUBLIC half via `pct exec` and IDEMPOTENTLY
# append it to THIS host's /root/.ssh/authorized_keys.
#
# Idempotence (Pitfall 6): use `grep -qF || echo >>` so a re-run does NOT
# duplicate the line. -F = fixed-string match (no regex). The pubkey ends with
# a stable comment ("proxmox-gui@<lxc-hostname>") so identical re-runs match.
#
# install.sh runs as root on the PVE host, so it can write authorized_keys.
# ----------------------------------------------------------------------------
echo "==> Establishing SSH trust to this PVE node (UAT-1c)..."
# Defense-in-depth: bootstrap.sh Step 5b already generates the GUI SSH key,
# but re-create it idempotently from install.sh as well — Pitfall 6 — so an
# operator running install.sh against an LXC that was bootstrapped before
# the SSH-key block existed still gets a key. ssh-keygen exits non-zero only
# if the file already exists; -N "" disables passphrase prompting.
# shellcheck disable=SC2016
# SC2016 disabled intentionally: the inner shell is single-quoted so $(hostname)
# is expanded INSIDE the LXC, not on the PVE host.
pct exec "$CTID" -- bash -c '
    set -e
    if [[ ! -f /etc/proxmox-gui/gui_ed25519 ]]; then
        mkdir -p /etc/proxmox-gui
        chmod 0700 /etc/proxmox-gui
        ssh-keygen -t ed25519 -f /etc/proxmox-gui/gui_ed25519 -N "" \
            -C "proxmox-gui@$(hostname)" -q < /dev/null
        chown proxmox-gui:proxmox-gui /etc/proxmox-gui/gui_ed25519 \
            /etc/proxmox-gui/gui_ed25519.pub
        chmod 0400 /etc/proxmox-gui/gui_ed25519
        chmod 0444 /etc/proxmox-gui/gui_ed25519.pub
    fi
' 2>/dev/null || true
PUBKEY="$(pct exec "$CTID" -- cat /etc/proxmox-gui/gui_ed25519.pub 2>/dev/null || true)"
if [[ -z "$PUBKEY" ]]; then
    echo "WARN: could not read /etc/proxmox-gui/gui_ed25519.pub from CTID $CTID." >&2
    echo "      Community-scripts will fail until SSH trust is set up manually." >&2
else
    AUTH="/root/.ssh/authorized_keys"
    mkdir -p /root/.ssh
    chmod 0700 /root/.ssh
    touch "$AUTH"
    chmod 0600 "$AUTH"
    # IDEMPOTENT append — Pitfall 6: never grow the file on re-runs.
    if grep -qF "$PUBKEY" "$AUTH"; then
        echo "    pubkey already present in $AUTH (no append)."
    else
        echo "$PUBKEY" >> "$AUTH"
        echo "    pubkey appended to $AUTH (1 new line)."
    fi
fi

# ----------------------------------------------------------------------------
# Step 6: Final banner
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
