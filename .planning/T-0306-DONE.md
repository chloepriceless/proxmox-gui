# T-0306 — DONE (2026-07-18 ~12:05Z, Schraubi/vm-deployment-gui)

Alle 3 Fixes umgesetzt, additiv/idempotent, **kein Restart von VM 142 oder dem
Workspace-Container** (Leitplanken eingehalten). Verifikation jeweils live gemessen.

## Fix 1 — Stack-Autostart nach VM-Boot ✅
**Befund:** Im Workspace-Container läuft KEIN cron-Daemon (`command -v cron crond crontab` leer,
PID1 = coder agent, kein systemd). → Alternativ-Mechanismus lt. Auftrag: **cron auf dem
coder-host** (dort läuft `/usr/sbin/cron -f`, systemd `running`).
**Gebaut:**
- `/etc/cron.d/coder-workspace-bootstrap` (coder-host): `@reboot root /usr/local/bin/coder-workspace-bootstrap.sh`
- `/usr/local/bin/coder-workspace-bootstrap.sh` (coder-host, 755): wartet bis 15 min auf
  Docker + Container `coder-chloepriceless-Coding` (RestartPolicy=unless-stopped → kommt
  selbst hoch), dann `docker exec` → `bootstrap-hub.sh`, danach `respawn-warm-peers.sh`.
  Log: `/var/log/coder-workspace-bootstrap.log`. `--dry-run` wird durchgereicht.
- `/home/dev/respawn-warm-peers.sh` (Container, 755): wartet bis 120 s auf spawnerd :7901,
  spawnt sequenziell die warm-Peers `dvhub-docs, hetzner-website, fleet-meta,
  merkel-curator, bizzi` (Liste als Variable, Ausnahmen kommentiert: dvhub/Völtchen,
  DVhub-Subs, knowledge-base remote, bi retired). Token aus `~/.config/spawner/.token`.
  Bewusst NICHT in .bashrc eingehängt (sonst Spawn bei jeder Shell).
**Verifiziert:** Voller Testlauf `coder-workspace-bootstrap.sh --dry-run` → rc=0,
bootstrap-hub.sh alle 15 Dienste „bereits aktiv/überspringe", respawn listet exakt die
5 warm-Peers (Log 2026-07-18 11:59). Realer Spawn-Pfad: No-op-Spawn auf laufenden Peer
→ `{"ok": true, "already_running": true, "session": "peer-vm-deployment-gui"}` (Auth +
Registry + Idempotenz bestätigt; alle 5 warm-Keys + alle Ausnahme-Keys im Registry vorhanden).

## Fix 2 — RAM-Governance ✅
**a) Heap-Limit 8192 → 6144** an DREI Stellen (statt zwei — Grund s. Finding):
- `~/.bashrc:147`: `--max-old-space-size=6144`
- `~/.claude-agentapi/scripts/agentapi-start.sh`: `export NODE_OPTIONS=…6144` NEU gesetzt
  (Skript hatte vorher gar kein NODE_OPTIONS)
- `~/bootstrap-hub.sh` (Kopf): `export NODE_OPTIONS=…6144` NEU gesetzt
**🔍 FINDING (live via /proc/*/environ gemessen):** Die laufenden claude-Prozesse
(agentapi-claude pid 225, Peer-claude pid 50114, spawnerd 48970) hatten ALLE **kein**
NODE_OPTIONS in der Env — das alte 8192 aus .bashrc griff auf den Daemon-/Spawn-Pfaden
nie, weil (a) der bootstrap-Aufruf in `.bashrc:139` VOR dem Export in `:147` steht und
(b) tmux-/spawnerd-Spawns .bashrc nicht sourcen. Der Export in bootstrap-hub.sh schließt
genau diese Lücke: spawnerd→tmux→claudepeers→claude erben ihn ab dem nächsten
Stack-(Re-)Start. **Laufende Prozesse behalten die alte Env** (kein Restart erlaubt) →
voll wirksam ab nächstem natürlichen Boot/Respawn der Peers.
**b) Container-Memory-Limit (live, kein Restart):** `docker update --memory=13g
--memory-swap=15g coder-chloepriceless-Coding` → verifiziert `docker inspect`:
Memory=13958643712 (13 GiB), MemorySwap=16106127360 (15 GiB), Running=true. Vorher: 0/0
(unlimitiert). cgroup-OOM killt jetzt gezielt im Container, bevor die VM erstickt.
**c) earlyoom (coder-host):** installiert 1.8.2-1, `systemctl enable --now` →
active + enabled. Schwellen (Default): SIGTERM ≤10 % mem avail & ≤10 % swap free,
SIGKILL ≤5 %/≤5 %. Journal-Beleg: „mem avail: 11255 of 15281 MiB (73.66%)".

## Fix 3 — Watchdog ✅ (Config-only, aktiv ab nächstem Power-Cycle)
**a) pve (Hop .240 → pve):** `qm set 142 --watchdog model=i6300esb,action=reset` →
verifiziert `qm config 142`: `watchdog: model=i6300esb,action=reset`; `qm status 142` =
running (KEIN Reboot ausgelöst). Vorher-Check: name=Coder, memory=16384, balloon=0 ✓.
**b) Gast (coder-host):** `/etc/systemd/system.conf.d/watchdog.conf` mit
`[Manager] RuntimeWatchdogSec=30s` + `systemctl daemon-reexec` → verifiziert
`systemctl show`: `RuntimeWatchdogUSec=30s`. `/dev/watchdog` fehlt noch (erwartet —
i6300esb-Device erscheint erst beim nächsten Power-Cycle; Drop-in bis dahin harmlos).

## Erst nach dem nächsten natürlichen Reboot aktiv
1. Watchdog-Hardware (i6300esb) + systemd-Fütterung → Freeze löst nach ~30 s Auto-Reset aus.
2. Heap-Cap 6144 für die dann neu gestarteten Daemons/Peers (laufende behalten alte Env).
3. Erster echter `@reboot`-Lauf des Boot-Bootstraps (Mechanik heute per Testlauf +
   No-op-Spawn verifiziert, soweit ohne Reboot möglich).

## Empfehlung an Hub (kein Blocker)
Der Peer-Spawn-Pfad (spawnerd→tmux→claudepeers) setzte bislang NIE ein Heap-Limit —
falls die 12–13-GB-RSS-Sessions Peers waren, lief deren Node-Heap unlimitiert/Default.
Mit dem bootstrap-hub.sh-Export ist das ab dem nächsten Stack-Start gedeckelt; falls
zusätzlich ein Limit UNABHÄNGIG vom Bootstrap-Pfad gewünscht ist, müsste der
Spawner-Owner (Tüftli) es direkt in spawnerd/start-spawner.sh verankern.
