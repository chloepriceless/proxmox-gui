# HANDOVER — vm-deployment-gui (Infra-HEAD Proxmox)
**Stand:** 2026-09-18 ~03:10 · Branch `fix/release-review-blockers` · alles gepusht (`39d1479`, Tag `v0.6.4`)

## Aufgabe & Ziel
Ich bin Infra-HEAD fuer den Proxmox-Cluster (es gibt keinen `proxmox-master` in der Registry —
ich fuelle die Rolle, inkl. **Kapazitaets-Entscheider** fuer neue LXCs).

## Stand
**Alle autonom machbaren Punkte sind abgearbeitet.** Was offen ist, braucht eine
Entscheidung von Christin oder einen Zug von Netzi — nichts davon kann ich selbst ziehen.
`autonomous_open = 0`.

## ✅ Erledigt und verifiziert

**T-0326 (14.09.):** ZFS-Pool `Samsung_1TB` auf pz1 stand bei `AVAIL=0B` durch 406G verwaiste
`refreservation` (`vm-142-disk-0/1`, Migrations-Leichen). Reversibel geloest via
`refreservation=none` (Rollback: `zfs set refreservation=203G <vol>`). Folgeschaeden behoben:
VictoriaMetrics, DHCP-Lease-Storm (CT100/115/126), CT141 op-connect, scrape.yml, 44/44 Targets up.
Detail: `.planning/findings/2026-09-14-pz1-zfs-pool-exhaustion.md`

**SearXNG (18.09.):** GO erteilt, **CT165 @ pz3** gebaut (Debian 13, unprivileged, **kein nesting**,
2c/1024M/8G, MAC `BC:24:11:5E:A7:C3`, **192.168.20.210** per DHCP-Reservierung). Verifiziert:
42 JSON-Treffer, systemd `running`/0 failed, RAM 261M/1024M.
Detail: `.planning/findings/2026-09-17-searxng-kapazitaetsentscheid.md`

**`.176`-Konflikt: gemessen, gemeldet (18.09.).** Beide Container direkt per `pct exec` befragt,
nicht aus dem Handover uebernommen:
```
CT150 semaphore @ pz3  MAC BC:24:11:8F:6F:49  PRODUKTIV: v2.18.12, Up 8 days (healthy),
                                              LISTEN 192.168.20.176:3000
CT157 semaphore @ pz2  MAC BC:24:11:CB:30:27  LEICHE:    derselbe Container,
                                              Exited (143) vor 3 Monaten, nichts auf :3000
```
Netzi hat den Kausalmechanismus unabhaengig nachgemessen (14 Versuche, ARP-Cache jeweils geleert):
**13x refused / 1x OK.** Semaphore ist ueber `.176` also nicht „degradiert", sondern zu ~93 %
**ausgefallen** — und das seit Monaten, mit einem Fehlerbild, das man in der Anwendung sucht.
An Netzi und Hub gemeldet.

**bootstrap.sh Caddyfile-Drift: gefixt (v0.6.4, `77642ce`).** Die im alten Handover notierte
Loesung („Site-Adresse `:443` statt IP") ist **falsch** — nachgemessen auf caddy 2.6.2:
`caddy validate` nimmt den Block an, zur Laufzeit faellt der Handshake (`curl` exit 35).
Stattdessen: `deploy/scripts/render-caddyfile.sh` leitet die Adresse aus der Live-Default-Route
ab (content-vergleichend), `proxmox-gui-caddyfile.service` (Before=caddy.service) deckt den Boot ab,
`.timer` (2 min) den Lease-Wechsel unter laufender Box. Restart statt Reload, weil `admin off`
gesetzt ist. End-to-end auf CT143 gegen vorab festgelegte Orakel:
O1 Drift provoziert → `curl` exit 35 / http 000 bei `active` Unit · O2 Renderer → http 303,
MainPID 129814→129840 · O3 zweiter Lauf → idempotent, kein Restart.

**Die zwei ungeklaerten Node-Ereignisse: aufgeklaert (`39d1479`).**
Zwei verschiedene Ursachen, und die eine ist ein Muster, kein Einzelfall.
- **pz1+pz3, 09.09. 03:25 — HA-Selbst-Fencing**, kein Absturz. pz2 lief durch und ist der Zeuge:
  03:24:17 fallen die Links zu Node 2, 3 und 5 **in derselben Sekunde** → Quorum weg → die beiden
  Knoten mit scharfem `pve-ha-lrm`-Watchdog setzen sich ~60 s spaeter selbst hart zurueck
  (`watchdog0: watchdog did not stop!` als letzte Journal-Zeile, keine Shutdown-Sequenz).
  **Dieselbe Signatur auch am 18.08. 04:03 und 20.08. 16:50 — dreimal in drei Wochen.**
  **Ausloeser identifiziert (Nachtrag, `ecef376`): ein Switch.** Der Kernel meldet den
  Link-Verlust **2 s vor corosync** — pz1, pz2 und pz3 verlieren um 03:24:15 gleichzeitig
  **beide LACP-Slaves** (`bond0: now running without any active interface!`). Alle drei
  bonden gegen Partner **`f4:e2:c6:ad:a8:c7`**; `pve`/.241 haengt an `28:70:4e:cf:56:13`
  und hat im ganzen Fenster keine NIC-Zeile. Down-Zeit ~70 s = Reboot-Groesse.
  Seit 01.08.: **drei bond0-Totalausfaelle, drei Fences, 1:1 in beide Richtungen** —
  RMA-Argument, keine Vermutung.
  **Topologie (Nachtrag 2, `f2251e2`, mit Netzi):** Der Switch ist **USPM24P @ .145**
  (`f4:e2:c6:ad:a8:c7`), und **alle drei Hypervisor haengen daran**. Quorum-Rechnung:
  5 Knoten, Quorum 3, drei Stimmen an dem Geraet → faellt es, bleiben `.240`+`.241` = 2 < 3.
  **Ein Ausfall dieses Switches ist ein TOTALausfall des Clusters**, kein Teilausfall; dass
  bisher nur zwei Knoten resetteten, lag allein an pz2s nicht scharfem Watchdog.
  Ein blosser Tausch behebt das nicht — auch ein fehlerfreier Nachfolger nimmt bei jedem
  Firmware-Reboot alles mit.
  **Machbarkeit gemessen:** pz1/pz2/pz3 haben je **genau zwei NICs, beide in bond0, beide am
  USPM24P** — keine freie Schnittstelle, ein dedizierter Corosync-Ring ist ohne neue
  Hardware physisch unmoeglich. **Aber der zweite Pfad existiert, er ist falsch gesteckt:**
  ein Kabel pro Knoten auf einen zweiten Switch + `bond-mode active-backup` (LACP kann kein
  Aggregat ueber zwei UniFi-USW spannen, active-backup braucht das nicht). `bond-miimon 100`
  ist schon gesetzt → ~100–200 ms Umschaltzeit gegen 4950 ms Token-Timeout.
  Preis gemessen: bond0 traegt 10.6 / 1.2 / 4.2 Mbit/s bei 5000 Mbit/s Kapazitaet
  (0,02–0,2 %) — die Aggregation kauft messbar nichts.
- **.240, 02.–14.09. — Strom.** Journal bricht mitten im Betrieb ab, Watchdog seit 20.08.
  geschlossen (Fencing ausgeschlossen), BMC-SEL hat zwischen 08.08. und 14.09. **keinen Eintrag**
  → auch Standby stromlos. Bei `Power Restore Policy: always-on` heisst das woertlich: 12 Tage
  kein Strom. Steckdose/Sicherung, nicht Proxmox.
  Detail: `.planning/findings/2026-09-18-node-ereignisse-forensik.md`

## 🔴 Offene Punkte — ALLE blockiert, keiner autonom machbar
1. **CT157 abraeumen** (Entscheidung Christin, MC liegt beim Hub): (A) nur `.176` aus der Config —
   meine Empfehlung, reversibel, eine Zeile · (B) Container stoppen · (C) erst Daten pruefen.
   **Danach** reserviert Netzi `.176` auf `BC:24:11:8F:6F:49` — Zwei-Minuten-Zug bei ihm.
   Schritt 2 allein brachte nichts: eine DHCP-Reservierung bringt einen statisch konfigurierten
   ARP-Zweitsprecher nicht zum Schweigen.
2. **HA-Fencing / Topologie** (Entscheidung Christin, MC liegt beim Hub) — finale
   Reihenfolge, mit Netzi abgestimmt:
   (0) **USPM24P @ .145 pruefen/tauschen** — akut, drei Totalausfaelle in drei Wochen ·
   (1) **Ein Kabel pro Knoten auf einen zweiten Switch + `bond-mode active-backup`** —
   struktureller Fix, keine neue Hardware, nur Umstecken + drei Zeilen Config; Netzis Zug,
   angekuendigtes Wartungsfenster (einzeln unkritisch, Quorum 3 von 5 bleibt) ·
   (2) zweiter Corosync-Ring — nach (1) erst moeglich und dann weitgehend ueberfluessig,
   also optional · (A) **HA auf pz1/pz3 abschalten** — nicht mehr nur Alternative, sondern
   **Vorbedingung fuer (1)**: solange der Watchdog scharf ist, fenct sich der Knoten, an dem
   gearbeitet wird, nach ~60 s selbst.
   **Fuers Fenster vorbereitet** (Nachtrag 3, `b4f4179`): Netzi hat netzseitig freigegeben
   (`portconf: 0`, Ziel **US24PRO2 .63** oder **US24PRO .44**, nicht USL8A). Aber:
   die **Aggregation muss von den Ports runter** — LACP liegt bei UniFi in den
   Port-Overrides, nicht in den Port-Profilen, und der Switch spricht nachweislich LACP
   (lebender Partner in der LACPDU). Echte Portbelegung aus der LACPDU ausgelesen:
   **pz1 19+20, pz2 17+18, pz3 21+22** — Netzis Client-Tabelle zeigte nur 19/17/21, weil der
   Controller den Aggregat-MAC nur an einem Port fuehrt; seine Freiliste unterzaehlt deshalb.
   Zielport braucht untagged + **tagged VLAN 3/4/6/42**. Host-Aenderung: `bond-mode
   active-backup` + `bond-primary nic0`, `bond-xmit-hash-policy` faellt weg.
3. **Stromereignis .240** (nur Christin beantwortbar): was ist am 02.09. ~01:53 an dem Stromkreis
   passiert, und was am 14.09. mittags? Kein Log kann das sagen.
4. **`zfs destroy`** `Samsung_1TB/vm-142-disk-0/1` — Christin, unkritisch (406G ohne Loeschung frei).
5. **DNS-Wildcard** `*.bikini.bottom.zone` → WAN-IP, 5 Proxy-vhosts zeigen aktiv nach draussen.
   Netzi macht `static_dns` (11 Records), braucht Christins Muster-Record ueber die UniFi-UI.
   Detail: `.planning/findings/2026-09-18-interne-namen-inventar.md`
6. **Vier ungesicherte Pool-Statiken** (.172, .173, .174, .175) — Netzi reserviert sie.
   Detail: `.planning/findings/2026-09-18-statische-pool-adressen-sweep.md`

## Peers & Zustaendigkeiten
- **Netzi** (`network`, Peer-ID wechselt — `list_peers`): UDM/DHCP/DNS. Arbeitet gegen vorab
  festgelegte Orakel, misst unabhaengig nach. Hat die drei Fencing-Zeitstempel fuer die
  UDM-Korrelation bekommen (18.08. 04:03 · 20.08. 16:50 · 09.09. 03:25).
- **Hub** (`orchestrator`): erreichbar ueber `POST localhost:7890/api/peer/notify`
  (`repo:"orchestrator"`) — die Channel-Adresse `agent-master-hub` ist **kein** gueltiges
  `send_message`-Ziel. `context` deckelt bei 4000 Zeichen, die Response sagt `truncated`.
- **Kuma** (`monitoring`), **Schnueffi** (`security`).
- Netzis Gegenstueck zur Switch-Forensik: `orchestrator-network/.planning/reports/node-reset-forensik-udm-seite-2026-09-18.md` (`fd5ce96`).

## Merksaetze
- **Bei allem, was ein Rennen sein koennte, misst man Verteilungen, nicht Werte** (Netzi).
  Ein Read genuegt bei stabilen Werten — ARP bei Adresskonflikt ist per Definition keins.
- **Ein geerbter Loesungsvorschlag ist eine Hypothese, kein Auftrag.** Der `:443`-Fix stand
  als Tatsache im Handover und war falsch. Nachmessen vor Umsetzen.
- **`caddy validate` / `systemctl is-active` sind keine Orakel fuer „liefert aus".**
  Abnahme gegen den Nutz-Output. Standard-Fehlerklasse dieser Flotte.
- **Bei einem Cluster-Ereignis ist der beste Zeuge der Knoten, der NICHT rebootet hat.**
  Nur er kann die *Rueckkehr* noch loggen — und damit die Down-Zeit liefern, die Flap von
  Reboot trennt.
- **Der Kernel ist der Sensor, corosync der Alarm.** `grep corosync` zeigt das Symptom
  2 s zu spaet; `NIC Link is Down` / `now running without any active interface` zeigt die
  Ursache. Zuordnung zum Geraet ohne Switch-Zugriff: `Partner Mac Address` aus
  `/proc/net/bonding/bond0` — gleiche Partner-MAC = gleicher Switch.
- **Korrelation in BEIDE Richtungen pruefen.** Drei Ausfaelle → drei Fences ist erst dann
  ein Argument, wenn es auch keinen Ausfall ohne Fence gibt. Nur die Hinrichtung zu
  pruefen ist der uebliche Fehler.
- **`journalctl -b -1/-2/-3` auf die letzten Zeilen** verwandelt ein Einzelereignis in ein Muster.
- **`ipmitool`-Felder wie `Last Power Event` sind gelatcht und ohne Zeitstempel** — die
  SEL-**Luecke** ist der belastbare Beleg, nicht das Feld.

## Resume
```bash
git log --oneline -6
ssh -i ~/.ssh/id_ed25519 root@192.168.20.68   # pz1   (.42 pz2, .106 pz3, .240 proxmox, .241 pve)
ssh -i ~/.ssh/id_ed25519 root@192.168.20.240 'pct exec 143 -- systemctl status caddy'  # GUI-LXC
```
Memories: `~/.claude/projects/-home-dev-vm-deployment-gui/memory/` — neu:
`pve-cluster-ha-fencing`, `messe-verteilungen-nicht-werte`.
Merkel: zwei Eintraege ingestet (HA-Fencing-Signatur, Caddy `tls internal`).
