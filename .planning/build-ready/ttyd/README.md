# Baustein 2 — ttyd Browser-Grid (read-only tmux Video-Wall)

**T-0204, Schraubi. INSTALL-READY DRAFT.** ttyd **fehlt im Ist** (verifiziert: `which ttyd` leer) →
im Ziel-LXC nachinstallieren (`apt-get install -y ttyd`, in Debian 12/13 paketiert; Fallback:
statisches Binary aus den `tsl0922/ttyd`-Releases).

## Was es macht
`fleet-grid.sh` baut eine tmux-Session `fleetgrid` mit EINEM Fenster, in dem **alle Peer-Sessions
gekachelt** als Panes laufen (read-only gespiegelt via `tmux attach -r`). `ttyd-grid.service`
serviert dieses Fenster **read-only** im Browser auf `:7681` — 1 Link, wie ein Kamera-Grid.

## Read-only — doppelt abgesichert
1. **Innen:** jedes Pane ist `tmux attach -t <peer> -r` → read-only-Client, kann die Session nicht steuern.
2. **Aussen:** `ttyd … tmux attach -t fleetgrid -r` **ohne `-W`/`--writable`** → ttyd gibt keine
   Tastatureingaben durch. (Moderne ttyd ist default read-only; das fehlende `-W` ist der Riegel.
   Falls eine sehr alte ttyd-Version im Repo landet, die default *writable* ist: zusaetzlich
   `-R`/`--readonly` setzen — beim Cutover die ttyd-Version pruefen.)

## 🔴 Distributed-Caveat (wichtig im 3-Node-Modell)
Eine tmux-Instanz kann nur **lokale** Sessions attachen — sie sieht KEINE Peers auf anderen Nodes.
Im verteilten Fleet (Peers auf pz1/pz2/pz3) gibt es daher **zwei saubere Optionen:**
- **(A) empfohlen — ein ttyd pro Node** (jeweils die lokalen Peer-Panes) + **eine zentrale
  Landing-Seite** (statisches HTML im agent-master-Dashboard `:7890`), die auf
  `http://<node>:7681` je Node verlinkt/iframed. Robust, keine Cross-Node-tmux-Magie.
- **(B) Aggregator** — ein zentraler Node baut das Grid aus `ssh <node> tmux attach -r` Panes.
  Funktioniert, aber kostet eine SSH-Session je Pane + ist fragiler. Nur falls Christin EINEN
  einzigen Link ohne Landing-Seite will.

`fleet-grid.sh` liefert das **lokale** Grid (Baustein für beide Optionen). Die Landing-Seite/
Aggregation ist ein kleiner Folge-Build nach der Topologie-Entscheidung.

## Install (GATED, im Ziel-LXC)
```bash
apt-get install -y ttyd
install -m644 ttyd-grid.service /etc/systemd/system/
# -i im Service auf die LXC-LAN-IP setzen + host-nftables-Allowlist (Netzi) davor (auth-los!)
systemctl daemon-reload && systemctl enable --now ttyd-grid
# Browser: http://<lxc-lan-ip>:7681
```
**Sicherheit:** ttyd ist auth-los. NICHT auf `0.0.0.0` ohne FW exponieren. Entweder host-nftables-
Allowlist (42/20/16, wandert beim Failover mit) ODER ttyd-Basic-Auth (`-c user:pass`). LAN/WG-only.
