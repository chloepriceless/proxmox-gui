# Finding: ZFS-Pool `Samsung_1TB` (pz1) bei AVAIL=0 durch 406G verwaiste vm-142-Reservierungen

**Datum:** 2026-09-14 · **Anlass:** Anfrage monitoring/Kuma zu T-0326 (pve-240-Recovery-Alarm)
**Status:** BEHOBEN 2026-09-14 12:38 MESZ (reversibel, ohne destroy). Optionales Aufraeumen (`zfs destroy`) offen bei Christin.

## Ausgangslage (Meldung monitoring)
VictoriaMetrics (:8428) + Grafana (:3000) "down", Hosts .163/.153 pingbar, :22 + :9100 offen.
Verdacht: LXCs auf pve-240, onboot-Dienste nach 12d Downtime nicht hochgekommen.
Zweitens: geaenderter SSH-Host-Key auf .153 (SHA256:ezpGkS6BSo/lgG8SCCFpkWikp34Q/IvkDl7QNgzDlsA).

## Befund — Verdacht war falsch
- Grafana = **CT 100 @ pz1**, running, `grafana-server` active, :3000 lauscht.
- VictoriaMetrics = **CT 126 @ pz1**, Container running, `victoriametrics.service` **failed**.
- **pve-240 unbeteiligt.** .153/.163 sind nicht die Dienst-Hosts (Verwechslung IP==CTID:
  CT153=forgejo@pz3, CT163=ai-beacon-spike@proxmox/stopped).
- Host-Key-"Anomalie" = **CT126s eigener Key**, verifiziert out-of-band via
  `pct exec 126 -- ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` -> identischer Fingerprint.
  Kein Restore/Neubau/MITM. CT126 hatte .153 per DHCP belegt.

## Root Cause
`Samsung_1TB` (pz1): SIZE 888G, ALLOC 212G, aber `zfs list` AVAIL **0B**.
Ursache: zwei thick-provisionierte Zvols mit je `refreservation=203G`, `volsize=200G`, `written=56K`:
- `Samsung_1TB/vm-142-disk-0` (creation 2026-06-02 11:05)
- `Samsung_1TB/vm-142-disk-1` (creation 2026-06-02 11:06)

**Verwaist:** VM142 (Coder) laeuft auf Node `pve` mit `nvme:vm-142-disk-0`
(`/etc/pve/nodes/pve/qemu-server/142.conf:scsi0`). Cluster-weiter
`grep -rn Samsung_1TB /etc/pve/nodes/*/{qemu-server,lxc}/*.conf` referenziert beide nirgends.
406G tote Reservierung -> AVAIL=0 fuer alle Gaeste des Pools.

## Folgekette
1. Pool AVAIL=0 -> CT126 rootfs 100% (11G/11G, refquota 16G greift nicht, Pool ist leer)
2. VictoriaMetrics: `cannot create lock file "/opt/victoriametrics/data/flock.lock":
   no space left on device` -> panic -> restart counter 6 -> "Start request repeated too quickly"
   -> bleibt unten. Letzter guter Start 2026-09-09 03:27, Crash 2026-09-14 09:11.
3. dhclient kann Lease-Datei nicht persistieren (`/var/lib/dhcp/dhclient.eth0.leases`
   eingefroren seit 2026-09-11 03:46) -> Loop `DHCPACK -> DHCPDECLINE -> DHCPDISCOVER` alle 10s
   -> CT126 haelt ~50 IPv4 auf eth0, CT100 ~34, mit Ueberschneidungen (.162 .163 .123 .128 ...)
   -> Monitoring-Targets auf diesem Pool sind unzuverlaessig; Probes treffen den falschen Container.

**Mitbetroffen auf demselben Pool:** CT100 grafana (3.7G/3.7G = 100%), CT102 homepage,
CT115 node-red, CT127 mqtt. Pool ist nodes-shared: pz1, pz3, proxmox (`/etc/pve/storage.cfg`).

## Durchgefuehrter Fix (2026-09-14, reversibel — KEIN destroy)

1. `zfs set refreservation=none Samsung_1TB/vm-142-disk-0` + `...-disk-1`
   Vorher-Werte je `203G`. **Rollback:** `zfs set refreservation=203G <vol>`.
   -> Pool AVAIL **0B -> 406G**. CT126 rootfs 100% -> 65%, CT100 100% -> 53%.
2. CT126: `systemctl reset-failed victoriametrics && systemctl start victoriametrics`
   -> `ActiveState=active SubState=running NRestarts=0`, `:8428` lauscht, 46 Scrape-Targets geladen.
3. CT126 + CT100: dhclient gekillt, Lease-Dateien entfernt, `ip addr flush dev eth0/eth1`, dhclient neu gebunden.
   -> eth0-Adressen **CT126 50 -> 1**, **CT100 34 -> 1**. DHCPDECLINE seit Flush: **0**.

**`zfs destroy` wurde NICHT ausgefuehrt.** Irreversibel + geteilte Ressource -> Entscheidung liegt bei Christin.
Nicht mehr dringend: die 406G sind ohne Loeschung frei.

## Verifikation (R31 — Oracle vor dem Check)
Oracle: Pool-AVAIL > 400G, beide Dienste HTTP-erreichbar, eth0-Adressen == 1, DHCPDECLINE == 0.

| Pruefung | Methode | Ergebnis |
|---|---|---|
| Pool frei | `zfs list -H -o name,used,avail Samsung_1TB` | USED 454G / **AVAIL 406G** (vorher 0B) |
| VictoriaMetrics | `curl http://192.168.20.79:8428/health` | **HTTP 200, Body "OK"** |
| Grafana | `curl http://192.168.20.78:3000/api/health` | `{"database":"ok","version":"13.0.1+security-01"}` |
| Dienst host-seitig | `pct exec 126 -- systemctl show victoriametrics` | active/running, NRestarts=0, Start 12:38:02 CEST |
| Lease-Storm | `pct exec -- ip -4 -o addr show eth0 \| wc -l` | CT126 **1** (war 50), CT100 **1** (war 34) |
| DECLINE-Loop | `journalctl --since 12:38:40 \| grep -c DHCPDECLINE` | **0** auf beiden |

Echte VictoriaMetrics-Downtime: **09-14 09:11:56 -> 12:38:02 = 3h26min** (journal-Luecke der Unit,
host-seitig per `pct exec` belegt) — NICHT 12 Tage. Die 12 Tage gehoeren allein pve-240 (unabhaengiger Vorfall).

## Rohevidenz VM142-Verwaisung (Auflage Hub)
`qm config 142` @ Node pve: `scsi0: nvme:vm-142-disk-0,format=raw,iothread=1,size=200G` — kein Samsung_1TB-Eintrag.
`zfs get` beide Volumes: `used=referenced=written=56K`, `volsize=200G`, `usedbysnapshots=0B`, keine Snapshots.
`pvesm list Samsung_1TB` fuehrt beide weiter unter VMID 142 — daher nie aufgeraeumt: Proxmox ordnet sie
der VM namentlich zu, obwohl die Config sie nicht referenziert. Migrations-Leiche Coder pz1 -> pve (02.06.).

## IP-Aenderung durch den Flush (wichtig fuers Monitoring)
- VictoriaMetrics CT126: **192.168.20.79** (vorher u.a. .153)
- Grafana CT100: **192.168.20.78** (vorher u.a. .163)
- .153/.163/.126/.162 sind frei.

## Offen / Empfehlung
- **Statische IPs fuer CT100 + CT126** (Kern-Infra) — Dauerloesung gegen Target-Drift. Hinweis liegt bei `network`.
- **Monitor auf Pool-AVAIL**: `zfs list -H -o avail Samsung_1TB` auf pz1, Alarm < 50G. Die Ursache war
  stiller Speicherdruck, kein Dienst- oder CPU-Symptom — genau das hat bisher niemand gesehen.
- Monitoring-Targets auf Hostname/CTID statt IP (Kuma, T-0327).
- Kosmetisch: CT126 dhclient nutzt aktuell `/var/lib/dhcp/dhclient.leases` statt der ifupdown-Pfade
  (Folge des manuellen `dhclient eth0`). Beim naechsten Reboot uebernimmt ifupdown wieder — kein Funktionsrisiko.
- Optional: `zfs destroy` der beiden Volumes (Entscheidung Christin). Ohne Eile.

## Nachtrag DNS (korrigiert durch Netzi, 2026-09-14)
Erste Einschaetzung von mir war falsch: ich hielt `victoriametrics.bikini.bottom.zone -> 87.139.158.187`
fuer einen host-spezifischen Fehl-Record. Netzi hat mit einem Gegenbeispiel widerlegt — ein frei
erfundener Name unter der Zone loest auf dieselbe WAN-IP auf. Es ist eine **Zonen-Wildcard**,
kein VictoriaMetrics-Problem. Praktische Folge ist breiter: jeder Tippfehler interner Clients
landet auf 87.139.158.187 (dort u.a. UniFi-Console:443). Bewertung liegt bei `security` (Schnueffi).

Gemessen (nebeneinander):
```
victoriametrics.bikini.bottom.zone               -> 87.139.158.187   (Wildcard)
quatsch-existiert-nicht-12345.bikini.bottom.zone -> 87.139.158.187   (Wildcard, Gegenbeispiel)
grafana.bikini.bottom.zone                       -> 192.168.20.78    (echter A-Record)
```
Verfeinerung: `grafana` hat einen echten Record, `victoriametrics` **keinen** — nur deshalb faellt
letzterer in die Wildcard. Netzis geplanter `static_dns`-Eintrag schliesst genau diese Luecke.
Zusaetzlich: kurzer Name `victoriametrics` loest auf das VLAN42-Bein (.42.165) auf, nicht auf 20.x.

**Lehre fuer mich:** aus einer einzelnen Aufloesung auf einen host-spezifischen Record geschlossen,
ohne das Gegenbeispiel zu pruefen — derselbe Fehlertyp, den ich am selben Tag beim Hub kritisiert habe.
Bei DNS-Befunden immer einen garantiert nicht existierenden Namen gegenmessen.

## Netz-Folgearbeit (Netzi, laufend)
MACs geliefert: CT100 eth0 `BC:24:11:45:1B:DF` -> .153 · CT126 eth0 `BC:24:11:8A:35:FF` -> .163 ·
CT126 eth1 `BC:24:11:EF:7C:B6` -> .42.165 · CT115 eth0 `BC:24:11:73:76:9F` -> .157.
Reihenfolge (Netzi): Reservierung -> messen -> `static_dns`. Feste IPs in den LXC-Configs trage ich
erst nach Netzis Signal ein, sonst Kollision. Dual-Homing CT126 bleibt (belegt tragend, s.o.).

## Nachtrag 2: DHCP-Hostname — Ursache liegt UDM-seitig, nicht im Container
Netzis Hypothese (CT126 eth0 melde beim DHCP keinen Hostnamen, darum gewinne das VLAN42-Bein
den Namen) ist **am Draht widerlegt**. tcpdump auf `vmbr0` waehrend eines erzwungenen Renew:

```
DHCP-Message (53): Discover | Requested-IP (50): 192.168.20.79 | Hostname (12), len 15: "victoriametrics"
DHCP-Message (53): Request  |                                   Hostname (12), len 15: "victoriametrics"
DHCP-Message (53): ACK      |                                   Hostname (12), len 15: "victoriametrics"
```
Client-seitig alles korrekt: `/etc/dhcp/dhclient.conf:15 send host-name = gethostname();`,
`/etc/hostname = victoriametrics` — identisch zu CT100. Die UDM **echot** den Namen sogar im ACK.
Das `**` in der UDM-Lease-Tabelle ist also ein Controller-seitiger Aussetzer (vermutlich stale
Client-Eintrag nach ~50 Leases derselben MAC waehrend des Storms), kein fehlendes Option-12.
**Netzis Schluss bleibt richtig (expliziter Record noetig), der Grund ist ein anderer.**

### Fehlgeschlagener Versuch (dokumentiert, nicht verschwiegen)
Source-seitiger Rename des VLAN42-Beins via `hostname victoriametrics-dev` in
`/etc/network/interfaces` unter `iface eth1`: nach `ifdown/ifup eth1` war eth1 **ohne Adresse**.
Sofortiger Rollback aus `/etc/network/interfaces.bak-20260914`, eth1 wieder auf `.42.165`,
VictoriaMetrics durchgehend `active`, `192.168.42.42:9100` von CT126 aus HTTP 200.
Ausfall im Sekundenbereich. **Erneuter Versuch nur ausserhalb von Netzis Arbeitsfenster**,
dann ueber per-Interface `send host-name` statt der ifupdown-Stanza.

## Nachtrag 3: 13 von 46 Scrape-Targets DOWN
**Gruppe A — Lease-Storm-Leichen** (`job=lxc-hosts`, :9100): `.57 .99 .126 .127 .153 .163 .171 .179`.
Vier stichprobenartig gegengeprueft (.57/.99/.163/.179): kein ping, tot. Die `scrape.yml` ist gegen
DHCP-Adressen geschrieben — Beleg dafuer, dass die Umstellung auf feste IPs ueber CT100/CT126 hinausgeht.
Ein toter `lxc-hosts`-Target alarmiert nicht, er verschwindet still.

**Gruppe B — echte Dienst-Ausfaelle** (keine IP-Drift):
- `192.168.20.163:8428` `instance=victoriametrics-self` — Self-Scrape, bestaetigt unabhaengig, dass
  die laufende Config CT126 auf **.163** erwartet. Netzis Pin repariert ihn mit.
- `.241/.68/.42/.106:19999` `job=netdata` = die vier Proxmox-Nodes (feste IPs, nichts gewandert)
  -> **netdata laeuft auf keinem Node**. Aelterer, unabhaengiger Befund; Entscheidung ueber
  Weiterbetrieb vs. Targets entfernen liegt bei monitoring.

## Nachtrag 4: netdata (T-0332) — ACL auf .163, kein Ausfall
netdata ist auf **allen vier Nodes** installiert, `enabled`, `active`, Paket 2.11.0, lauscht auf
`<node-ip>:19999`, lokal `curl 127.0.0.1:19999` -> HTTP 200. Die Scrapes scheitern an einer ACL,
identisch in `/etc/netdata/netdata.conf` auf pve/pz1/pz2/pz3:

```
allow connections from = localhost 192.168.20.163
```

netdata akzeptiert also ausschliesslich die dokumentierte VictoriaMetrics-Adresse. Seit CT126 durch
den Lease-Storm auf .79 abgedriftet ist, wird der Scraper abgewiesen ("connection reset by peer").
Von CT126 aus gemessen: alle vier HTTP 000. **Self-Heal mit Netzis Pin auf .163** — Targets NICHT
deprecaten. Dritte unabhaengige Bestaetigung, dass .163 die richtige Zieladresse ist.

## Nachtrag 5: CT141 op-connect war ohne IP — Kollateralschaden des Lease-Storms
CT141 (op-connect, Node proxmox/.240) lief, hatte aber **keine eth0-Adresse**. Journal:
```
10:23:21  eth0: dhclient: timeout failed to detect new ip addresses
10:23:21  eth0: releasing expired dhcp lease...
10:23:22  DHCPRELEASE of 192.168.20.99 on eth0 to 192.168.20.1
```
Der DHCP-Pool war zu dem Zeitpunkt von den ~133 gehorteten Leases (CT100/115/126) leergefegt; die
Anfrage lief ins Timeout, der Container gab `.99` frei und stand ohne Netz. Disk unauffaellig (42%).
**Behoben:** eth0 neu gebunden -> jetzt `192.168.20.39`, node_exporter HTTP 200.
Zeigt, dass der Storm ueber verfaelschte Messungen hinaus realen Schaden auf einem *anderen* Node
angerichtet hat.

## Nachtrag 6: Zuordnung der 8 toten Scrape-Targets (T-0331)
CTIDs stehen als Kommentar in `scrape.yml`. Nach Netzis Pins heilen drei Eintraege von selbst:

| scrape.yml | Container | aktuell | Aktion |
|---|---|---|---|
| `.153:9100` | grafana CT100 | .78 | wird .153 gepinnt -> **unveraendert** |
| `.163:9100` | victoriametrics CT126 | .79 | wird .163 gepinnt -> **unveraendert** |
| `.163:8428` (Z.156, self) | CT126 | .79 | dito -> **unveraendert** |
| `.57:9100` | node-red CT115 | .157 | -> **.157** |
| `.99:9100` | op-connect CT141 | .39 | -> **.39** (wiederhergestellt) |
| `.171:9100` | proxmox CT143 | .92 | -> **.92** |
| `.126:9100` | sammelmappe CT144 | .55 | -> **.55** |
| `.179:9100` | agent-dashboard CT147 | **gestoppt** | Target raus |
| `.127:9100` | fileflows CT109 | **gestoppt** | Target raus; CT113 (pve, .76) hat **keinen** node_exporter |

Edits erst **nach** Netzis Pins, damit die Datei nur einmal angefasst wird.

## Nachtrag 7: scrape.yml korrigiert (T-0331 umgesetzt)
Kuma lieferte die Entscheidung fuer die zwei Luecken (beide Targets entfernen). Umgesetzt **ohne**
auf Netzis Pins zu warten — Begruendung: keine der sechs Aenderungen ist pin-abhaengig. Die zwei
pin-abhaengigen Eintraege (.153/.163) sind genau die, die *unveraendert* bleiben; sie heilen durch
den Pin, nicht durch eine Dateiaenderung. "Datei nur einmal anfassen" war damit bereits erfuellt.

Datei: `/opt/victoriametrics/config/scrape.yml` (CT126), Backup `scrape.yml.bak-20260914`.
```
.57  -> .157   node-red (LXC115)
.99  -> .39    op-connect (LXC141)
.171 -> .92    proxmox-lxc143 (LXC143)
.126 -> .55    sammelmappe (LXC144)
.179 entfernt  agent-dashboard (LXC147, gestoppt)
.127 entfernt  fileflows (LXC109, gestoppt)
```
Jede Ersetzung gegen eine Treffer-Assertion (genau 1 Vorkommen); Kommentare + Einrueckung erhalten.

**Verifikation:** `POST /-/reload` -> HTTP 200; Journal `SIGHUP received; reloading Prometheus configs`
+ `added targets: 4, removed targets: 6; total targets: 44`; Dienst durchgehend `active`.
Alle vier korrigierten Adressen vorab direkt gegengeprueft: `.157 / .92 / .55 / .39` je HTTP 200 auf `:9100`.
Danach ein voller Scrape-Zyklus abgewartet (12 Messungen ueber 60 s, stabil) — direkt nach dem Reload
stehen neue Targets auf `down`, weil noch nicht gescrapet; das ist ein Messfehler, kein Befund.

**Bilanz: 13 down von 46 -> 7 down von 44.**

Die verbleibenden 7 sind **ausschliesslich** pin-abhaengig und heilen ohne weitere Dateiaenderung:
`.153:9100` (grafana) · `.163:9100` (victoriametrics) · `victoriametrics-self` (.163:8428) ·
`netdata` auf pve/pz1/pz2/pz3 (ACL auf .163).
-> Nach Netzis Reservierungen muss die Bilanz **44/44 up** sein. Das ist zugleich der Gegentest,
ob die Pins gegriffen haben.

**Offene Einschraenkung:** `.39` (CT141), `.92` (CT143) und `.55` (CT144) sind **ungepinnte
DHCP-Leases** — heute korrekt, koennen wieder wandern. Die drei stehen nicht auf Netzis
Reservierungsliste. Fuer dauerhaft stabile Targets gehoeren sie ergaenzt (MACs auf Zuruf).

## Reservierungsliste an Netzi (final, Stand 2026-09-14)
Kuma hat CT141/143/144 nachgefordert, weil `.39/.92/.55` in der korrigierten `scrape.yml` als
**ungepinnte Leases** stehen — ohne Reservierung waere die Drift nur vertagt.

| CTID | Name | Interface | MAC | Ziel-IP |
|---|---|---|---|---|
| 100 | grafana | eth0 | `BC:24:11:45:1B:DF` | .153 |
| 126 | victoriametrics | eth0 | `BC:24:11:8A:35:FF` | .163 |
| 115 | node-red | eth0 | `BC:24:11:73:76:9F` | .157 |
| 141 | op-connect | eth0 | `BC:24:11:16:F2:16` | .39 |
| 143 | proxmox | eth0 | `BC:24:11:B0:DC:8C` | .92 |
| 144 | sammelmappe | eth0 | `BC:24:11:94:23:C5` | .55 |
| 126 | victoriametrics | eth1 (VLAN42) | `BC:24:11:EF:7C:B6` | .42.165 (zweiter Zug) |

**Gegentest nach den Pins:** Scrape-Bilanz muss **44/44 up** erreichen, ohne weitere Dateiaenderung.
Bleibt danach etwas down, liegt es an den Reservierungen — nicht an der `scrape.yml`.

## Zusammenfassung des Gesamtvorfalls
Eine Wurzel (406G verwaiste `refreservation` auf `Samsung_1TB`), fuenf Symptome auf drei Ebenen:
1. **VictoriaMetrics 3h26 tot** (ENOSPC -> flock.lock -> panic -> Start-Limit) — behoben
2. **DHCP-Lease-Storm** auf CT100/CT115/CT126 (34/49/50 Adressen) — behoben
3. **CT141 op-connect ohne Netz** auf einem anderen Node (Pool-Erschoepfung) — behoben
4. **Falscher SSH-Hostkey-Alarm** (CT126s Key auf geliehener IP) — entkraeftet
5. **13 tote Scrape-Targets** (IP-Drift + netdata-ACL auf .163) — 6 behoben, 7 pin-abhaengig

Keiner dieser fuenf Punkte war als Speicherproblem erkennbar. `zpool list` zeigte CAP 23%.

## Nachtrag 8: Pins gesetzt, Renewals durchgefuehrt — Gegentest 44/44 up
Netzi hat die DHCP-Reservierungen geschrieben (CT100 -> .153, CT126 -> .163, live in der
dnsmasq-Config der UDM). Eine Reservierung wirkt erst beim naechsten Renewal, daher per `pct exec`
**strikt `dhclient -r eth0 && dhclient eth0`** (nie ohne Interface — sonst kann die Default-Route
auf VLAN42 kippen und den `.42.42`-Scrape abschiessen):

| CT | vorher | nachher | Default-Route |
|---|---|---|---|
| 115 node-red | .157 | **.57** | `via 192.168.20.1 dev eth0` unveraendert |
| 100 grafana | .78 | **.153** | unveraendert |
| 126 victoriametrics | .79 | **.163** | unveraendert, eth1 `.42.165` unberuehrt |

`192.168.42.42:9100` von CT126 aus weiterhin HTTP 200 — das VLAN42-Bein hat der Eingriff nicht beruehrt.

### Korrektur an meiner Zuordnung: node-red gehoert auf .57, nicht .157
Netzi fand beim Pre-Image, dass CT115 **bereits** eine Reservierung auf `.57` hatte. Mein
scrape.yml-Edit `.57 -> .157` war damit falsch und haette beim naechsten Renewal gebrochen.
Zurueckgezogen: Zeile 86 steht wieder auf `192.168.20.57:9100`.

**Beleg, dass .57 die richtige Adresse ist** (gegen Schnueffis Tippfehler-Verdacht `.57` vs `.157`):
`scrape.yml.bak-20260914` Zeile 88 — das Backup von *vor* allen Edits — zeigte bereits auf `.57`.
Zwei unabhaengige Altquellen fuer `.57` (UDM-Reservierung + Scrape-Config), **null** fuer `.157`.
`.157` war reiner Storm-Zufall.

**Wichtige Abgrenzung:** node-red ist NICHT derselbe Fall wie `.39/.92/.55`. Dort sind die Adressen
Storm-Hinterlassenschaften ohne dokumentierte Wunschadresse (Configs wurden angepasst). Bei node-red
ist `.57` die dokumentierte Wahrheit und `.157` der Unfall — Richtung umgekehrt.

### 🎯 Gegentest: **44/44 up**
`cadvisor 5/5 · homeassistant 1/1 · lxc-hosts 19/19 · netdata 5/5 · node_exporter 5/5 ·
services 2/2 · smartctl_exporter 5/5 · vm-hosts 2/2`

Die vier netdata-Targets sind gruen — **bestaetigt die ACL-These nachtraeglich** (nur `.163` durfte
verbinden). Self-Scrape `.163:8428` ebenfalls up.

### Eigener Messfehler, dokumentiert
Direkt nach den Renewals stand die Bilanz bei **16/44** und sah nach einer Katastrophe aus.
Fehlschluss: ich vermutete veraltete Sockets (die Fehlermeldungen nannten noch die alte Quell-IP
`.79`) und startete VictoriaMetrics neu — unnoetig. **Tatsaechliche Ursache: VictoriaMetrics staffelt
Scrapes nach einem (Neu-)Start ueber die Intervalle**; manche Jobs brauchen Minuten bis zur ersten
Runde. Ein `down` ohne `lastError` heisst "noch nie gescrapet", nicht "kaputt" — das ist das
Unterscheidungsmerkmal. Erst nach vollem Zyklus bewerten.

### Netz-Topologie-Gegenprobe (fuer Netzis Pins)
CT141/CT143/CT144 sind alle **single-homed** (nur `net0`). Cluster-weit tragen genau zwei Gaeste
`tag=42`: CT126 und VM142 (Coder). Sonst niemand.

## Nachtrag 9: eth1-Hostname geloest (zweiter Anlauf) — Namens-Ambiguitaet dauerhaft weg
Erster Versuch ueber die ifupdown-Stanza `hostname ...` in `/etc/network/interfaces` hatte eth1
abgeschossen (s. Nachtrag 2). Zweiter Anlauf ueber die **per-Interface-Syntax von dhclient**
in `/etc/dhcp/dhclient.conf` (Backup: `dhclient.conf.bak-20260914`):

```
interface "eth1" {
  send host-name "victoriametrics-dev";
}
```

**Am Draht verifiziert** (tcpdump auf vmbr0 waehrend `dhclient -r eth1 && dhclient eth1`):
`Hostname (12), length 19: "victoriametrics-dev"`.

Aufloesung danach:
```
victoriametrics      -> 192.168.20.163   (VLAN20-Bein)
victoriametrics-dev  -> 192.168.42.165   (VLAN42-Bein)
grafana              -> 192.168.20.153
node-red             -> 192.168.20.57
```
Damit ist Netzis Einschraenkung ("nicht dauerhaft geloest, nur gerade guenstig — beide Beine melden
denselben Namen, bei der naechsten eth1-Erneuerung kann es auf .42.165 zurueckkippen") **strukturell
erledigt**: eth1 beansprucht den Namen `victoriametrics` nicht mehr.
eth0 unangetastet, Default-Route auf eth0, `.42.42:9100` HTTP 200, Targets 44/44.

## Nachtrag 10: Statische IPs in den LXC-Configs — bewusst NICHT eingetragen
Netzi gab gruenes Licht, ich habe **widersprochen**. Begruendung folgt aus seinem eigenen Befund,
dass `static_dns` auf der UDM **leer** ist (0 Records): saemtliche Namensaufloesung ist
**lease-abgeleitet** (dnsmasq expand-hosts).

Wuerde man `ip=dhcp` durch `ip=<addr>/24,gw=...` ersetzen, zieht der Container keinen Lease mehr:
- `grafana`, `victoriametrics`, `node-red` wuerden **aufhoeren aufzuloesen**
- `victoriametrics.bikini.bottom.zone` fiele zurueck in die **Zonen-Wildcard** -> 87.139.158.187 (extern)
- Netzis Gate 2b ("genau eine Adresse pro Name") waere gegenstandslos

Der einzige Zugewinn waere Unabhaengigkeit von einem DHCP-Server-Ausfall — zu teuer erkauft, da die
Reservierungen die feste Adresse bereits garantieren.

**Empfehlung (a), Ist-Zustand:** `ip=dhcp` in der LXC-Config + Reservierung auf der UDM.
Eine Autoritaet fuer Adressen, Namen funktionieren, feste IPs gewaehrleistet.
**Alternative (b)**, nur bei gewuenschter DHCP-Ausfallsicherheit: zuerst `static_dns`-Records
anlegen, **danach** statische IPs eintragen — in dieser Reihenfolge.

Status: **nichts an den LXC-Configs geaendert**, Entscheidung liegt bei Netzi.
