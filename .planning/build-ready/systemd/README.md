# systemd-Units — INSTALL-READY (T-0204, Schraubi)

**Stand:** Christin 2026-06-13 — systemd-Ansatz = **GO/entschieden**. Diese Units sind
**install-ready** (User=dev, Restart=always, EnvironmentFile=minimax-m3.env). **Deploy/enable
bleibt Teil des Cutovers (GATED).** Nichts davon auf dem laufenden Coder-Workspace installieren —
Ziel ist die neue Fleet-LXC (echtes systemd). Im Coder-Container ist PID1 `./coder agent`,
systemd dort wirkungslos — das ist der Grund zu migrieren.

## Units
| Unit | Dienst | Port | ExecStart (verifiziert am Live-Ist) |
|---|---|---|---|
| `agent-master.service` | Hub: Dashboard, LLM-Gateway, Registry/Ledger, Lifecycle | 7890 | `/usr/bin/node server.mjs` @ `codex/agent-master` |
| `claude-peers-broker.service` | Message-Bus aller Peers | 7899 | `bun broker.ts` @ `~` |
| `wa-bridge.service` | WhatsApp-Gateway (Baileys) | — | `/usr/bin/node index.js` @ `codex/wa-bridge` |
| `telegram-bridge.service` | Telegram-Gateway | — | `/usr/bin/node index.js` @ `codex/telegram-bridge` |
| `spawner.service` | Peer-Spawn/Lifecycle-Controller | — | `python3 spawner/spawnerd.py` @ `orchestrator` |

Christin-Auftrag waren explizit **agent-master(:7890) + wa-bridge + telegram-bridge**; Broker +
Spawner sind zwingend mitgeliefert, weil ohne sie kein Peer-Netz/keine Peers laufen.

## Design-Entscheidungen (begruendet)
- **System-Units mit `User=dev` (NICHT `systemctl --user`).** Robuster: greifen ohne
  User-Login/lingering schon im `multi-user.target` -> ueberleben Reboot UND den Proxmox-Backup-
  Stop-Mode (Backup = LXC kurz herunterfahren+rebooten). Wer echte `--user`-Units will, muss
  `loginctl enable-linger dev` setzen — unnoetiger zweiter Failure-Mode. Gewaehlt: System-Units.
- **`StartLimitIntervalSec=0`** = Restart-Ratelimiter aus -> `Restart=always` greift unbegrenzt
  (Hub/Bridges sollen IMMER zurueckkommen, nicht nach 5 Fails „failed" bleiben).
- **Geschachtelte `EnvironmentFile`:** stabile Secrets (`minimax-m3.env`) hart; INFLUX
  (`influx.env`, Brettli) + Workspace-Runtime (`fleet-runtime.env`, Cutover) mit `-` optional, damit
  die Unit auch vor deren Befuellung sauber startet. GH_TOKEN ist im Coder-Workspace ephemer ->
  bewusst in die optionale Runtime-Datei (nach Reboot ggf. stale = recoverable Degradation, kein
  Start-Blocker).
- **journald-Logging** (`journalctl -u <unit>`) statt selbstgebauter Logfiles.

## Cutover-Install (GATED — erst nach Christins Build-GO + R22-Refute + Schnueffi)
```bash
# IM ZIEL-LXC, als root:
install -m644 *.service /etc/systemd/system/
# Secrets bereitstellen (separat, NICHT aus Git):
#   /home/dev/orchestrator/.secrets/minimax-m3.env   (vorhanden, mit-rsyncen)
#   /home/dev/orchestrator/.secrets/influx.env       (Brettli liefert)
#   /home/dev/orchestrator/.secrets/fleet-runtime.env (Cutover-Skript: GH_TOKEN, CLAUDE_CONFIG_DIR, LAN-Binds)
#   /home/dev/orchestrator/.secrets/wa-bridge.env / telegram-bot.env (mit-rsyncen)
systemctl daemon-reload
systemctl enable --now claude-peers-broker agent-master wa-bridge telegram-bridge spawner
systemctl is-enabled claude-peers-broker agent-master wa-bridge telegram-bridge spawner  # alle 'enabled'
```
**Vor enable verifizieren:** kein Coder-Workspace-Fleet mehr aktiv (Quiesce), sonst Doppel-Login
(wa-bridge) bzw. 409-Conflict (telegram getUpdates) bzw. zwei Broker.

## VERIFY-am-Cutover (nicht raten)
- `bun`-Pfad (`which bun`), `node`-Version (Ist: v22.22.3), CLAUDE_CONFIG_DIR-Pfad im LXC.
- Existenz von `wa-bridge.env`/`telegram-bot.env` (Pfade hier sind die wahrscheinlichen; im
  Cutover gegenpruefen — Memory nennt `.secrets/telegram-bot.env`).
