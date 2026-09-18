# Sweep: statisch konfigurierte Gaeste im DHCP-Pool — plus ein aktiver IP-Konflikt

**Anlass:** Netzi sicherte die drei Hypervisor-Adressen (.42/.68/.106) und benannte die Restgrenze:
eine Reservierung schuetzt gegen DHCP-Vergabe, und ohne Reservierung schuetzt nur dnsmasqs
ICMP-Probe — **die versagt genau dann, wenn der Host nicht antwortet** (Reboot, NIC down, Wartung).
Das ist eine Klasse, nicht drei Faelle. Also cluster-weit gesweept.

**Methode:** alle `net<N>:`-Zeilen in `/etc/pve/nodes/*/{lxc,qemu-server}/*.conf` mit `ip=<adresse>`
statt `ip=dhcp`, dann Subnetz **und** letztes Oktett gegen den Pool `.30-.199` geprueft.

## 🔴 Aktiver IP-Konflikt: zwei laufende Container auf `192.168.20.176`
```
CT150 semaphore @ pz3   running   ip=192.168.20.176/24   MAC BC:24:11:8F:6F:49
CT157 semaphore @ pz2   running   ip=192.168.20.176/24   MAC BC:24:11:CB:30:27
```
Beide **statisch** auf dieselbe Adresse, beide `vmbr0` untagged, beide live bestaetigt per
`pct exec <ct> -- ip -4 -br addr show eth0`. ARP entscheidet fuer CT150:
```
192.168.20.176 dev vmbr0 lladdr bc:24:11:8f:6f:49 REACHABLE
```
-> **CT157 ist ueber .176 nicht erreichbar**; wer gewinnt, haengt am ARP-Cache des Anfragers.
Dasselbe Muster wie am 14.09. (mehrere Hosts auf einer Adresse), nur von Hand konfiguriert statt
durch einen Lease-Storm entstanden. Zwei echte `semaphore`-Instanzen — riecht nach einem Umzug
pz2 <-> pz3, bei dem die Quelle nie abgeraeumt wurde (dieselbe Sorte Leiche wie die vm-142-Volumes).

**Nicht angefasst.** Welche Instanz die echten Daten haelt, ist eine Anwendungs- und keine
Infrastrukturfrage; ein Stoppen der falschen waere teurer als der Konflikt, der offenbar seit Wochen
so laeuft. Frage an Hub/Christin gestellt.

## Fuenf weitere ungesicherte Pool-Statiken (gleiche Klasse wie die Hypervisoren)
```
CT153 forgejo          .172   BC:24:11:E0:B9:74   running
CT154 forgejo-runner   .173   BC:24:11:3F:86:10   running
CT155 ansible-control  .174   BC:24:11:A3:0A:3D   running
CT156 dolibarr         .175   BC:24:11:1D:FF:D6   running
CT157 semaphore        .176   BC:24:11:CB:30:27   running  (Konflikt, s.o.)
CT150 semaphore        .176   BC:24:11:8F:6F:49   running  (Konflikt, s.o.)
CT148 unpoller         .148   BC:24:11:62:2F:CA   gestoppt
```
`.172-.176` ist ein **zusammenhaengender, offensichtlich bewusst vergebener Block** — dasselbe, was
Netzi jetzt mit `.200-.229` formalisiert, nur mitten im dynamischen Bereich. Alle ohne Reservierung.

**Vorschlag an Netzi:** die fuenf laufenden in denselben Zug wie die Hypervisoren (reservieren wo sie
sind). Bei `CT148/unpoller` (gestoppt) eher die Adresse in den Pool zurueckgeben.
`CT200 caddy-proxy` (.200) liegt ausserhalb des Pools und ist inzwischen reserviert — nicht betroffen.

## Korrektur an meinem eigenen Sweep
`CT133 paperless` zunaechst als Pool-Treffer gelistet — **falsch**. Er haengt auf `vmbr1` in
`192.168.10.31/24`, also einem anderen Subnetz, und ist gestoppt. Mein erster Check prueft nur das
letzte Oktett; korrekt ist Subnetz **und** Oktett. Nicht betroffen.

## Uebernommener Lehrsatz aus Netzis Zug (fuer eigene Verifikationen)
Bei seinem Statement kam ein `dhcp-host`-Eintrag dazu und einer fiel weg -> die **Zeilenzahl blieb
bei 66 unveraendert**. Eine reine Zaehlpruefung haette den Zug nicht nachgewiesen; erst **md5 plus
Ansprueche-pro-Adresse** zeigen ihn. Merksatz: **ein Oracle, das nur zaehlt, ist blind fuer
Austausch-Operationen.**

---

## NACHTRAG 2026-09-18 — Controller-Hostnamen fuer .172–.175 sind Geister des Lease-Storms

Netzi hat vor dem Reservieren gemeldet, dass der UniFi-Controller andere Namen fuehrt als
diese Liste, und richtigerweise **nicht** geschrieben, bevor das geklaert war:

| Adresse | dieser Sweep | Controller-`hostname` |
|---|---|---|
| .172 | CT153 forgejo | `node-red` |
| .173 | CT154 forgejo-runner | `node-red` |
| .174 | CT155 ansible-control | `victoriametrics` |
| .175 | CT156 dolibarr | *(nicht gesetzt)* |

**Dieser Sweep stimmt, dreifach gegengeprueft** (Cluster-Config, Messung *im* Container,
Status) — die vier MAC→CT-Zuordnungen sind bestaetigt:

```
CT153  BC:24:11:E0:B9:74  .172  hostname -I → 192.168.20.172  running @ pz3
CT154  BC:24:11:3F:86:10  .173  hostname -I → 192.168.20.173  running @ pz2
CT155  BC:24:11:A3:0A:3D  .174  hostname -I → 192.168.20.174  running @ pz3
CT156  BC:24:11:1D:FF:D6  .175  hostname -I → 192.168.20.175  running @ pz2
```

**Woher die Geister kommen:** `node-red` ist **CT115 @ pz1**, MAC `BC:24:11:73:76:9F`,
und — entscheidend — **`ip=dhcp`**. Am **14.09.** lief auf demselben Pool der
DHCP-Lease-Storm (Ausloeser: `Samsung_1TB` auf `AVAIL=0`, siehe
`2026-09-14-pz1-zfs-pool-exhaustion.md`): **CT115 hielt 49 Adressen gleichzeitig**,
CT126 (`victoriametrics`) 50, CT100 (`grafana`) 34. Jede durchlaufene Adresse bekam den
Hostnamen der MAC angeheftet. Das erklaert `node-red` auf .172/.173 und
`victoriametrics` auf .174 vollstaendig — und deckt sich mit dem damaligen Nebenbefund,
dass das `**` in der UDM-Lease-Tabelle ein stale Client-Eintrag nach ~50 Leases derselben
MAC war.

⚠️ **Ehrliche Einschraenkung:** Der Mechanismus ist belegt und datiert, die Zuordnung
*dieser konkreten* Adressen nicht mehr direkt — die Adresslisten wurden am 14.09. beim Fix
geflusht (CT126 50→1, CT100 34→1, DHCPDECLINE seither 0). Dokumentierte Storm-Leichen im
selben Bereich: `.57 .99 .126 .127 .153 .163 .171 .179` — `.171` liegt direkt neben dem Block.

**Konsequenz ueber die vier hinaus:** Drei Container mit zusammen ~130 Leases in kurzer
Zeit heisst, die Verschmutzung ist breiter als diese vier Eintraege.
**Controller-Hostnamen in `192.168.20.x` sind aus diesem Zeitfenster kein Identitaetsbeleg.**
Wer die Identitaet braucht, fragt die Quelle: `pct config <id>` plus
`pct exec <id> -- hostname`.

Verwandt: [[lxc-dhcp-lease-storm-signature]], [[pz1-zfs-pool-refreservation-trap]]
