# T-0183 — Externer Zugang VERWORFEN (Christin-Entscheid 2026-06-12)

**Status: Dolibarr bleibt INTERN / VPN-only. Externer Zugang wird NICHT geöffnet.**

Christin hat entschieden, den externen Zugang (Arbeitgeber-Netz → Dolibarr) nicht
einzurichten. Der Strang ist geschlossen. Nichts wurde extern deployt:
- **KEIN** UniFi-Port-Forward (17443 war geplant, nie eingefügt — Gateway unberührt).
- **KEIN** Caddy-Flip, **KEIN** tinyauth-2FA-Gate (nur Staging, nie hochgefahren).
- Live-Stand LXC 156 unverändert: Dolibarr `:80` nur auf `192.168.20.175` (LAN/WG via
  Firewall), MariaDB intern. Kein `:443`-Listener.

## Was BLEIBT (interne Härtung, bewusst behalten):
- LXC-Firewall fail-closed (`dolibarr-fw.sh` + `dolibarr-fw.service`, Reboot-Probe PASS).
- `/install/` gelockt (install.lock).
- Admin-Creds in NetBoard (`dolibarr-admin`).

## Diese Staging-Dateien bleiben als UPGRADE-PFAD liegen
Falls Christin den externen Zugang später doch will, ist alles vorbereitet:
- `deploy-tls.sh` / `Caddyfile` (DNS-01 auto-renew, braucht CF-Token)
- `Caddyfile.internal` / `docker-compose.internal.yml` (tls internal, tokenlos)
- `Caddyfile.2fa` / `docker-compose.2fa.yml` / `deploy-2fa.sh` (vorgelagertes TOTP-Gate)
- `dolibarr-fw.sh` (FW erlaubt bereits `212.211.160.228` auf `:443` — die AG-IP-Regel
  ist scharf, schadet aber nicht, da nichts auf `:443` lauscht und kein PF existiert).

UniFi-Port-Forward-Plan (Insert-Doc, `restart unifi` statt force-provision) steht im
Repo-Memory `project-open-tasks.md` (SESSION-8c), falls je gebraucht.
Netz-Hoheit liegt künftig bei Netzi (orchestrator-network).
