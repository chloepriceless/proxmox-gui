#!/usr/bin/env bash
#
# render-caddyfile.sh — re-derive /etc/caddy/Caddyfile from the release
# template using the LXC's *current* primary IPv4.
#
# Why this exists
# ---------------
# The Caddyfile site block needs a concrete subject so Caddy's internal CA can
# put something in the leaf certificate's SAN. A bare `:443 { tls internal }`
# block is accepted by `caddy validate` but serves no usable certificate —
# measured on CT143 (caddy 2.6.2): the bare block answers the TCP connect and
# then fails the handshake (`curl` exit 35), while the same config with an
# `https://<ip>:443` site address serves fine. So we cannot simply drop the IP.
#
# bootstrap.sh baked the install-time IP in once and never revisited it. The
# GUI LXC runs on DHCP (`net0: ip=dhcp`), so a lease change silently leaves
# Caddy holding a certificate for an address the box no longer has, and the
# GUI becomes unreachable. Re-rendering is the fix: keep the concrete SAN,
# but derive it from the live address instead of from install-time history.
#
# Idempotent by construction — it only touches /etc/caddy/Caddyfile and
# restarts Caddy when the rendered content actually differs. Safe to run from
# a boot-ordered oneshot and from a timer.
#
# `systemctl reload caddy` is NOT an option here: the Caddyfile sets
# `admin off`, and Debian's ExecReload shells out to `caddy reload`, which
# needs the admin API. Verified on CT143 — reload fails, restart works.

set -euo pipefail

TEMPLATE="${CADDYFILE_TEMPLATE:-/opt/proxmox-gui/current/deploy/caddy/Caddyfile.template}"
TARGET="${CADDYFILE_TARGET:-/etc/caddy/Caddyfile}"
# Set to 0 to render without touching the running service — lets the render be
# exercised against a scratch target without bouncing a live Caddy.
RENDER_RESTART="${RENDER_RESTART:-1}"

if [ ! -r "$TEMPLATE" ]; then
    echo "ERROR: Caddyfile template not readable at ${TEMPLATE}" >&2
    exit 1
fi

# Primary IPv4 = the source address the kernel would use for off-link traffic,
# i.e. the address on the default-route interface. `hostname -I` is the weaker
# signal: it lists every address in unspecified order, so on a box that later
# grows a second bridge or a container network it can hand back the wrong one.
# It stays as the fallback for the case where no default route exists.
LXC_IP="$(ip -4 -o route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
if [ -z "$LXC_IP" ]; then
    LXC_IP="$(hostname -I | awk '{print $1}')"
fi
if [ -z "$LXC_IP" ]; then
    echo "ERROR: could not detect a primary IPv4 address." >&2
    exit 1
fi

RENDERED="$(mktemp)"
trap 'rm -f "$RENDERED"' EXIT

sed "s|__SITE_ADDR__|https://${LXC_IP}:443|" "$TEMPLATE" > "$RENDERED"

if [ -f "$TARGET" ] && cmp -s "$RENDERED" "$TARGET"; then
    echo "Caddyfile already matches ${LXC_IP} — nothing to do."
    exit 0
fi

echo "==> Rendering ${TARGET} for ${LXC_IP}..."
install -m 0644 "$RENDERED" "$TARGET"

# Only restart a Caddy that is already up. At boot this script runs *before*
# caddy.service (see proxmox-gui-caddyfile.service), where Caddy is not yet
# active and starting it here would fight the ordering.
if [ "$RENDER_RESTART" = "1" ] && systemctl is-active --quiet caddy.service; then
    echo "==> Site address changed — restarting caddy..."
    systemctl restart caddy.service
fi
