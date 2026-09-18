# Kapazitaetsentscheid: SearXNG-LXC (Anfrage Hub, 2026-09-17)

**Rolle:** Es gibt keinen `proxmox-master` in der Registry — vm-deployment-gui (Infra-HEAD) ist
Kapazitaets-Entscheider. **Entscheid: GO.**

## Gemessener Headroom (live, nicht geschaetzt)
| Node | cores | load | RAM total | RAM frei | zugesagt | Overcommit |
|---|---|---|---|---|---|---|
| proxmox (.240) | 32 | 1.44 | 128.7G | 92.9G | 134.1G | 1.04x |
| pve (.241) | 16 | 4.12 | 63.7G | 7.4G | 160.8G | 2.53x |
| pz1 (.68) | 4 | 1.69 | 15.7G | 2.6G | 24.6G | 1.56x |
| pz2 (.42) | 4 | 3.57 | 15.7G | 10.7G | 38.9G | 2.47x |
| **pz3 (.106)** | 4 | **0.67** | 15.7G | **10.9G** | 16.9G | **1.07x** |

Methode: `free -m` + `nproc` + `/proc/loadavg` je Node, plus Summe aller `memory:`-Zeilen in
`/etc/pve/nodes/<node>/{lxc,qemu-server}/*.conf` als **zugesagte** (nicht genutzte) Allokation —
also inkl. gestoppter Gaeste, die beim Start wieder Anspruch haben.

## Entscheidung: **Node pz3**, VMID 165
Niedrigste Last im Cluster (0.67), niedrigste Ueberbuchung der kleinen Nodes (1.07x), 10.9G RAM frei,
442G auf `Samsung_1TB` (pz3 ist in der nodes-Liste dieses Pools), 8 leichte Gaeste,
Uptime 1w1d bei 3 Boots/90d. Debian-13-Template in `local:vztmpl` vorhanden.

**Nicht proxmox/.240** trotz 92.9G/32c: der Node war 02.09.–14.09. **12 Tage** weg, Ursache ungeklaert.
Fuer eine Abhaengigkeit des lokalen Modells die falsche Wahl.
*Eigene Fehlmessung korrigiert:* "61 Boots/90d" zunaechst als Dauerinstabilitaet gelesen — falsch,
die Boots ballen sich im Juni, danach Wochen-Uptimes. Der 12-Tage-Ausfall bleibt das offene Problem.
**Nicht pve/.241:** 7.4G frei bei 2.5x Overcommit, Last 4.12/16c. **Nicht pz1:** 2.6G frei.

## Entscheidung: **nativ, KEIN nesting**
Der Hub hatte docker-compose fertig und ausdruecklich gefragt. Abgelehnt, in dieser Gewichtung:
1. **RAM:** Docker-Daemon kostet 150–250 MB in einem 1G-Container — Unterschied zwischen 4 uwsgi-Workern und Swap.
2. **`nesting=1` ist eine Privilegien-Lockerung** und waere beim naechsten Antrag Praezedenzfall.
3. **Fleet-Standard ist nativ** (`webapp-scaffold`: systemd + nginx); SearXNG ist Python/uwsgi, der einfachste Fall.
4. Weniger Schichten, Updates per apt/pip + systemd statt Image-Pull.
Die `settings.yml` des Hubs bleibt 1:1 gueltig (`search.formats: [html, json]`, `limiter: false`) —
die sind deployment-unabhaengig, nur das compose-File entfaellt.

## Specs (final)
```
Debian 13 · unprivileged 1 · KEIN nesting
2 cores · 1024 MB RAM + 512 MB swap · 8 GB rootfs auf Samsung_1TB
VMID 165 · Node pz3
```

## IP: statisch + Reservierung (blockiert auf Netzi)
Statisch, weil der Konsument (lokales Modell) die JSON-API per IP anspricht und CT141/op-connect am
14.09. gezeigt hat, dass ein Container bei leergefegtem Pool **ganz ohne Adresse** dastehen kann.
**Zusaetzlich** Reservierung auf derselben MAC, damit eine statische Adresse innerhalb des Pools nie
doppelt vergeben wird. Pool-Bereich ist mir unbekannt (beobachtete Leases quer ueber .30–.199) —
**nicht geraten**, sondern bei Netzi angefragt.

**Bewusst in Kauf genommen:** statisch = kein Lease = **kein dnsmasq-Name**. `searxng` wird nicht
auflösen, solange `static_dns` leer ist (siehe 2026-09-14, Nachtrag 10). Unkritisch, da IP-Konsument.

## Naechster Schritt
Container-Bau (meine Seite) sobald die Adresse da ist; der Hub installiert SearXNG nativ hinein und
liefert den Funktionsnachweis (JSON-Antwort mit echten Treffern, nicht "Container laeuft").

## MAC vorab festgelegt (spart eine Abstimmungsrunde)
```
CT165  searxng  eth0  BC:24:11:5E:A7:C3   Node pz3   bridge vmbr0, untagged
```
Bewusst vorab vergeben statt von Proxmox beim Anlegen generieren zu lassen — so kann Netzi die
Reservierung schreiben, **bevor** der Container existiert, und Adresse + Reservierung in einem Zug
erledigen. Kollisionsgeprueft: kein Treffer per `grep -ril` ueber alle
`/etc/pve/nodes/*/{lxc,qemu-server}/*.conf`, nicht im ARP-Cache. VMID 165 weiterhin frei.

## Provisioning: macht vm-deployment-gui, nicht der Hub
Der Hub hat Root ueber .240 und koennte es technisch. Bewusst bei mir behalten, damit
Entscheidung und Umsetzung nicht auseinanderlaufen koennen — ich habe VMID, Node und Specs
festgelegt, also lege ich auch an. Uebergabe an den Hub: fertiger Container mit statischer IP,
Gateway, SSH-Key, `onboot=1`. Der Hub installiert SearXNG nativ und liefert den Funktionsnachweis.

## Offener Punkt, aufgefallen beim Node-Vergleich
Der Hub hatte unabhaengig gemessen und war bei pz2 gelandet (Uptime 28.4 Tage gegen 8.9 bei pz1/pz3).
Seine Beobachtung ist richtig und mir entgangen: **pz1 und pz3 wurden vor ~9 Tagen neu gestartet**,
Ursache unbekannt. Zusammen mit dem ungeklaerten 12-Tage-Ausfall von proxmox/.240 (02.09.-14.09.)
sind das **zwei unerklaerte Node-Ereignisse in zwei Wochen**.
Kein Blocker fuer SearXNG (die Ueberbuchung von pz2 mit 2.47x wiegt schwerer als der Uptime-Vorteil),
aber fuer Christin notiert — das gehoert angesehen, bevor es ein drittes Mal passiert.

## Umentscheidung: DHCP + Reservierung statt statisch (2026-09-17, spaet)
Netzi hat den Pool gemessen: `dhcpd_start=192.168.20.30` / `dhcpd_stop=192.168.20.199`
(UniFi `networkconf`, identisch in der gerenderten dnsmasq-Config, ein DHCP-Server, kein Relay).
**.210 zugewiesen**, 11 Adressen oberhalb der Pool-Obergrenze; er deklariert `.200-.229` als Block
fuer statisch konfigurierte Infra-Dienste.

**Entscheidender Befund von ihm:** eine `dhcp-host`-Reservierung greift auf dieser Box auch
**ausserhalb** der `dhcp-range` — belegt an `.240`/`.241`, die beide draussen liegen und live
zugeteilt werden. Damit gibt es keinen Grund mehr fuer eine statische Container-Config:
`ip=dhcp` + Reservierung liefert dieselbe feste Adresse **plus** den dnsmasq-Namen.

**Ich habe meine eigene Festlegung revidiert.** Mein "kein DHCP im Boot-Weg" kam aus dem CT141-Fall —
aber CT141 lief ins Timeout, **weil der Pool leergefegt war**, und das ist ausserhalb von `.30-.199`
strukturell unmoeglich. Ich hatte eine Lehre auf einen Fall uebertragen, auf den sie nicht passt.
Dazu Netzis eigenes Argument vom 14.09., das hier eins zu eins gilt: der DHCP-Server **ist** die UDM;
faellt sie aus, fehlen Routing, DNS und Gateway ohnehin. Eine statisch gebundene Meta-Suchmaschine
waere dann zuverlaessig erreichbar und koennte nichts liefern.

**Final:** `net0: ...,hwaddr=BC:24:11:5E:A7:C3,ip=dhcp` + Reservierung auf `.210`.
`static_dns` wird dafuer **nicht** gebraucht — der Name kommt ueber den Lease.

## CT165 angelegt und verifiziert (Node pz3)
```
pct create 165 local:vztmpl/debian-13-standard_13.1-2_amd64.tar.zst \
  --hostname searxng --cores 2 --memory 1024 --swap 512 \
  --rootfs Samsung_1TB:8 \
  --net0 name=eth0,bridge=vmbr0,hwaddr=BC:24:11:5E:A7:C3,ip=dhcp,type=veth \
  --unprivileged 1 --onboot 1 --ostype debian --timezone Europe/Berlin \
  --ssh-public-keys <christin + id_ed25519>
```
`authorized_keys`: Christins Fleet-Key (Standard in allen Containern) + `id_ed25519`
(damit auch der Hub reinkommt — er nutzt denselben Key fuer den Cluster-Zugang).

### systemd 257 unter unprivileged — nesting war NICHT noetig
Proxmox warnt beim Anlegen und bei jedem Start: *"Systemd 257 detected. You may need to enable nesting."*
Erster Boot: `degraded`, drei fehlgeschlagene Mount-Units — `dev-mqueue.mount`, `run-lock.mount`, `tmp.mount`.

**Nicht mit `nesting=1` geloest**, sondern geprueft, ob die Pfade trotzdem nutzbar sind: alle drei
existieren und sind beschreibbar. systemd wollte lediglich tmpfs darueberlegen und durfte es nicht.
-> Units maskiert (`systemctl mask dev-mqueue.mount run-lock.mount tmp.mount`), Reboot.

**Verifiziert nach Reboot:** `systemctl is-system-running` -> **`running`**, 0 failed units,
`/tmp` + `/run/lock` beschreibbar, RAM 16M/1024M, Disk 601M/8.0G (8%).
Nebeneffekt positiv: ohne tmpfs-`/tmp` konkurriert nichts mit den 1 GB RAM.

**Merksatz:** Die Proxmox-Warnung betrifft systemd-Komfortmounts, nicht die Funktion.
Fuer eine Python/uwsgi-App reicht Maskieren — `nesting=1` waere hier Overkill gewesen.

### Gluecklicher Nebeneffekt: Netzis Blocker aufgeloest
Der Test-Boot hat regulaer per DHCP bezogen (`.109` aus dem Pool). Damit **kennt der Controller die
MAC** — Netzi war bei "0 von 67 Praezedenzfaellen" fuer einen handgelegten Doc einer nie gesehenen MAC
(Worst Case: synthetischer Doc zerschiesst den Config-Generator -> hausweiter DHCP-Ausfall).
Jetzt ist es der Standardfall: `use_fixedip` + `fixed_ip=.210` auf einem echten, gelernten Doc flippen.
Danach Reboot von CT165, Gegentest beim zweiten Bezug.

### .200 aufgeklaert
`CT200 caddy-proxy @ pz1`, MAC `BC:24:11:48:21:F5`, statisch (`ip=192.168.20.200/24`), `onboot=1`,
1 core/256 MB, Ports 22/80/443. Kein Verwaister — **VMID 200 und IP .200 bewusst aufeinandergelegt**,
Adresse ausserhalb des Pools. Bleibt wo sie ist, Netzi bucht sie als Kollisionsschutz.
Netzis Nebenbefund erklaert die Unsichtbarkeit: der Controller **kennt** die .200 (lernt verkabelte
Clients aus Switch-Traffic, nicht nur aus DHCP), nur `use_fixedip=false` haelt sie aus jeder
Reservierungsliste raus. Die Falle ist also nicht "unbekanntes Geraet", sondern "bekanntes Geraet
ohne Flag" — wer nach Luecken in der Reservierungsliste sucht, sieht sie nie.

## Abschluss: CT165 auf .210, verifiziert (2026-09-18)
Netzi hat die Reservierung geschrieben (Schnueffi-GO, gegen vorab festgelegtes Orakel gemessen:
genau +1 Zeile in der br0-Conf, 64 -> 65, `dnsmasq --test` OK, 9 uebrige Confs md5 unveraendert).
Reboot von CT165 **nach** dem Install des Hubs (ein Reboot mitten im pip-Lauf waere destruktiv gewesen).

**Gegentest bestanden:** vorher `.109`, 8 Sekunden nach dem Reboot `192.168.20.210/24` —
kein NAK-Umweg noetig.

| Pruefung | Ergebnis |
|---|---|
| Lease | `192.168.20.210/24` auf MAC `BC:24:11:5E:A7:C3` |
| **`searxng`** | -> **192.168.20.210** |
| **`searxng.bikini.bottom.zone`** | -> **192.168.20.210** |
| systemd | `running`, 0 failed (Maskierungen persistent ueber Reboot) |
| searxng / nginx | beide `active` **und** `enabled` (stop-mode-Backup-resilient) |
| RAM | 261 M / 1024 M |
| `/healthz` | HTTP 200 |
| `/search?...&format=json` | **42 Treffer**, Engines brave + duckduckgo + google cse, Schema vollstaendig |

Eigene Anfrage gestellt statt den Test des Hubs nachzusprechen.

**Die Namensaufloesung ist der Beleg, dass die Umentscheidung richtig war** — genau das haette die
statische Config gekostet. `static_dns` blieb unberuehrt.

**Die 261 M bestaetigen die nativ-statt-Docker-Entscheidung nachtraeglich:** mit Daemon waere man bei
~450-500 M gelandet, unter Last mit vier uwsgi-Workern waere 1 GB dann knapp geworden.

### ACL-Erweiterung des Hubs (akzeptiert)
Der Hub hat `allow 192.168.42.0/24` ergaenzt, weil er als **192.168.42.42** ankommt — das ist die
VLAN42-Adresse der Coder-VM (VM142), in der sein Docker-Container sitzt und die ihn dorthin NATet.
Dieselbe Adresse ist der einzige VLAN42-Scrape-Target von VictoriaMetrics (`scrape.yml:169`).
Cluster-weit haengen in VLAN42 genau zwei Gaeste (CT126, VM142) — kleiner, bekannter Kreis,
`deny all` bleibt, nichts oeffentlich. Bitte an den Hub: Zeile spaeter entfernen, falls sie nur fuer
seine Tests war und Christins Modell aus VLAN20 anfragt.

### Wiederkehrendes Muster dieser Woche: gruene Unit ueber echtem Defekt
Der Hub fand in seinem Skript, dass **Debians modulares uwsgi ohne `plugins = python3`** den Socket
bindet, `active (running)` meldet und die App **nie laedt** (`no request plugin is loaded`).
Das ist dasselbe Muster wie zweimal zuvor diese Woche:
- **CT143/Caddy** lauschte auf `*:443` und servierte nichts (Site-Block matchte nur die alte IP)
- **netdata** lief auf allen vier Nodes und wies den Scraper ab (ACL auf `.163`)
- **uwsgi** laeuft, bindet, laedt die App nicht

Drei verschiedene Dienste, dieselbe Falle. **Konsequenz, die der Hub gezogen hat und die richtig ist:
Abnahme gegen den Nutz-Output pruefen (echte JSON-Treffer), nie gegen `systemctl status`.**
Deckt sich mit R31 (Done heisst verifiziert gegen ein unabhaengiges Signal).
