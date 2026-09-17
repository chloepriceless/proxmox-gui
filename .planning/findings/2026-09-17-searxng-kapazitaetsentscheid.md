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
