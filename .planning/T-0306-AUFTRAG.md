# T-0306 — Session-Kill-Fixes 1–3 (vom Hub, 2026-07-18, Christin-Go liegt vor)

## Kontext (Diagnose T-0305, Report: ~/Report/2026-07-18-session-kills-diagnose.md)
Die Coder-VM (VMID 142 „Coder" auf Node **pve**, Gast = coder-host 192.168.42.42,
16 GB RAM, balloon=0, kein Watchdog) leidet unter RAM-Not:
- OOM-Killer killt `claude.exe`-Sessions (12–13 GB RSS; NODE_OPTIONS-Heap=8 GB).
- Wiederholte harte VM-Freezes (alle Boots seit 12.06. enden „crash"), Freeze bleibt
  stehen bis manueller Reset.
- Nach Crash bleibt die Flotte tot: bootstrap-hub.sh läuft nur via .bashrc/.profile.

## ⚠️ HARTE LEITPLANKEN
- **VM 142 NICHT neustarten/stoppen** (killt die ganze Flotte inkl. Hub!). Watchdog
  wird nur konfiguriert und ab dem NÄCHSTEN natürlichen Reboot aktiv.
- **Den eigenen Workspace-Container NICHT restarten** — `docker update` geht live.
- Alles additiv/idempotent; jede Änderung in der DONE-Datei dokumentieren.
- SSH: root@192.168.42.42 (coder-host) und root@192.168.20.240 → `ssh pve` (Hop),
  Key `~/.ssh/orchestrator_ed25519`.

## Fix 1 — Stack-Autostart nach VM-Boot (im Coder-Container, also HIER lokal)
1. Prüfen, ob ein cron-Daemon im Container läuft (`pgrep cron`). Wenn ja:
   `@reboot /home/dev/bootstrap-hub.sh` per crontab (idempotent). Wenn nein:
   robusten Alternativ-Mechanismus wählen (z. B. cron auf dem coder-host, der per
   `docker exec` in den Workspace-Container bootstrapt — Container-Name via
   `docker ps` ermitteln) und begründen.
2. **Peer-Respawn integrieren:** Nach Stack-Start die warm-Peers via spawnerd
   wecken (`POST localhost:7901/spawn {"agent":"<key>"}`, Token
   `~/.config/spawner/.token`, ~22 s pro Spawn, sequenziell):
   `dvhub-docs`, `hetzner-website`, `fleet-meta`, `merkel-curator`, `bizzi`.
   **AUSNAHMEN — NICHT spawnen:** `dvhub` (Völtchen: Christin steuert selbst!),
   DVhub-Subs (`dvhub-control/forecast/history`), `knowledge-base` (remote),
   `bi` (retired). Liste als Variable im Skript, kommentiert.

## Fix 2 — RAM-Governance
a) **Heap-Limit senken (Container-lokal):** In `~/.bashrc` und im
   agentapi-Start-Skript (finden via `grep -rn "max-old-space-size" ~/ --include="*.sh" -l`
   + `~/.bashrc`) `--max-old-space-size` von 8192 auf **6144** setzen.
b) **Memory-Limit auf den Workspace-Container (coder-host):** Container ermitteln
   (`docker ps`, der mit dem Coder-Workspace), dann
   `docker update --memory=13g --memory-swap=15g <container>`.
   Ziel: Container-cgroup-OOM killt gezielt, bevor die VM global erstickt.
c) **earlyoom in der VM (coder-host):** `apt-get install -y earlyoom`,
   `systemctl enable --now earlyoom` (Default-Schwellen ok).

## Fix 3 — Watchdog (Freeze → Auto-Reset statt Stunden-Stillstand)
a) Auf pve (via Hop über 192.168.20.240): `qm set 142 --watchdog model=i6300esb,action=reset`
   — NUR Config, kein Reboot (Device erscheint beim nächsten Power-Cycle).
b) Im Gast (coder-host): Drop-in `/etc/systemd/system.conf.d/watchdog.conf` mit
   `[Manager]\nRuntimeWatchdogSec=30s` + `systemctl daemon-reexec`. Harmlos solange
   /dev/watchdog fehlt; greift automatisch nach dem nächsten Reboot.

## Abschluss
- Verifikation: cron/Mechanismus-Test (soweit ohne Reboot möglich), `docker inspect`
  Memory-Werte, `systemctl status earlyoom`, `qm config 142 | grep watchdog`.
- Findings/Config-Änderungen → Merkel (mit Belegen), Header X-Merkel-Fleet: bikini-bottom
  + Bearer aus /home/dev/orchestrator/.secrets/merkel-fleet.env.
- **DONE-Datei:** `.planning/T-0306-DONE.md` (was geändert, wie verifiziert, was erst
  nach nächstem Reboot aktiv wird). Fragen → `.planning/T-0306-FRAGEN.md`. Hub pollt.
