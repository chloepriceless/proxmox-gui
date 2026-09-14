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
