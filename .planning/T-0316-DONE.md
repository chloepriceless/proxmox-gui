# T-0316 — DONE (2026-07-23, Schraubi/vm-deployment-gui)

Wegwerf-LXC für den **ai-beacon**-Spike angelegt, Docker installiert, Dashboard
live + verifiziert, an Hub via Ledger T-0316 (`set --status done --result`)
zurückgemeldet. **Additiv, kein bestehender Guest angefasst.**

## Ergebnis (Rückmeldedaten)
| Feld | Wert |
|---|---|
| VMID | **163** |
| Node | **proxmox** (192.168.20.240) |
| IP | **192.168.20.189** (DHCP, hwaddr BC:24:11:36:AB:F2) |
| Dashboard-URL | http://192.168.20.189:8080 |
| Login-PW / URL-Token | `QxL1OOhQMh22P20ISBJ` → http://192.168.20.189:8080/?token=QxL1OOhQMh22P20ISBJ |
| Agent-Token (`docker exec ai-beacon cat /data/token`) | `2bed06291dcb7d46765f0b7a8c428292e3c525eed5c78f257f7400afebd2a236` |
| LXC-Root-PW | `a0QHhCNM94o3DTYSRuE3` (zusätzlich SSH-Key `id_ed25519` autorisiert) |

Passwörter/Token stehen durabel im **Ledger T-0316 result**. Session-Kopie:
`scratchpad/T-0316-creds.env` (ephemer).

## Node-Wahl: proxmox/.240 statt pz3
`.240` ist der explizit **instabile** Node (chronische HW/Thermik-Crashes) **ohne
prod-VMs** → ideal für einen disposable Spike. 70 GiB RAM frei / 32 Cores /
239 GB auf local-lvm. pz3 wäre die Alternative gewesen; .240 war im Auftrag der
Erstvorschlag und bietet den meisten Headroom bei null Blast-Radius für Prod.

## LXC-Specs
- Debian 13 (`local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst`)
- 2 Cores / 3072 MB RAM / 512 MB swap / rootfs `local-lvm:12G`
- **unprivileged=1**, `features nesting=1,keyctl=1` (Docker), `onboot=0` (Wegwerf)
- net0 eth0@vmbr0, ip=dhcp
- Beschreibung: „ai-beacon-spike (disposable, T-0316) …" (in `pct config 163`)

## Docker + ai-beacon
- Docker CE **29.6.2**, Storage-Driver **overlayfs** (DinD via nesting bestätigt),
  `systemctl enable --now docker`.
- `docker volume create ai-beacon`; Container `ai-beacon` aus
  `ghcr.io/manusa/ai-beacon:latest` (Digest `sha256:dcc5c286…11b1d7`),
  `--restart unless-stopped`, `-p 8080:8080`, `-v ai-beacon:/data`,
  `-e AI_BEACON_AUTH_PASSWORD=…`.

## Verifikation (live gemessen)
- `docker ps`: ai-beacon Up, `0.0.0.0:8080->8080/tcp`.
- HTTP im LXC: `/` → 302 (Redirect auf Login).
- HTTP aus LAN (von VM-142 aus): `/` → **302**, `/?token=…` → **303** (Auth ok).
- Token-Datei `/data/token` vorhanden (0600), Log: „auth token source resolved:
  generated".

## Leitplanken eingehalten
- Kein bestehender Guest angefasst/neugestartet (nur neuer LXC 163 erzeugt+gestartet).
- Kein Produktions-Host bespielt; alles im isolierten Wegwerf-LXC.
- VMID/IP/PW-Ort dokumentiert → sauber löschbar.

## Löschen nach Spike
```bash
ssh -i ~/.ssh/id_ed25519 root@192.168.20.240 'pct stop 163 && pct destroy 163'
```

## Danach (macht der Hub)
Wegwerf-Claude-Session via `ai-beacon`-CLI + Agent-Token an das Dashboard binden,
Browser-Attach/Spawn testen. Reine Spike-Bewertung.
