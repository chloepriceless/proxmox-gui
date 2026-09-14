# Finding: ZFS-Pool `Samsung_1TB` (pz1) bei AVAIL=0 durch 406G verwaiste vm-142-Reservierungen

**Datum:** 2026-09-14 · **Anlass:** Anfrage monitoring/Kuma zu T-0326 (pve-240-Recovery-Alarm)
**Status:** diagnostiziert, NICHT behoben — Go/No-Go fuer destruktiven Fix ausstehend

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

## Vorgeschlagener Fix (NICHT ausgefuehrt — destruktiv, geteilte Ressource)
1. Gegenbestaetigung einholen, dass VM142/Coder nur die nvme-Disk braucht (Christin nutzt Coder aktiv).
2. `zfs destroy Samsung_1TB/vm-142-disk-0` + `...-disk-1` -> +406G sofort.
3. CT126: `systemctl reset-failed victoriametrics && systemctl start victoriametrics`.
4. CT126/CT100: `ifdown eth0 && ifup eth0` gegen die akkumulierten Leases; danach Lease-Datei pruefen.
5. Monitoring-Targets auf CTID/Hostname statt DHCP-IP umstellen (sonst wiederholt sich der Mess-Nebel).

## Offen
- Die 12d Downtime aus T-0326 decken sich NICHT mit dem VM-Crash (14.09.) — Scrape-Ausfall ist
  aelter als der Service-Crash. Wahrscheinlich separater Strang; exakter Scrape-Abriss bei monitoring erfragt.
- Warum wurden die vm-142-Zvols am 02.06. auf pz1 angelegt und nie aufgeraeumt? (Migration Coder pz1 -> pve?)

## Belege
Alle Werte live erhoben 2026-09-14 via `ssh root@192.168.20.68` (pz1) / `192.168.20.241` (pve):
`zpool list`, `zfs list -o name,used,avail,refer -d1 Samsung_1TB`, `zfs get refreservation,volsize,written`,
`pct exec 126 -- df -h /`, `journalctl -u victoriametrics`, `pct exec 126 -- ip -4 addr`, `ip neigh`.
