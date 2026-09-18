# Inventar: interne Namen unter `bikini.bottom.zone` — wer nutzt sie, wer zeigt nach draussen

**Anlass:** Der Hub forderte als Vorbedingung fuer jeden Zonen-Eingriff eine Liste, **welche internen
Namen heute tatsaechlich benutzt werden** ("sonst ist der erste Effekt ein Schwung kaputter Dinge").
Dieses Inventar ist die Antwort — und es enthaelt einen Live-Befund, der die Prioritaet aendert.

## 🔴 Kernbefund: 5 von 9 Reverse-Proxy-vhosts zeigen JETZT nach draussen
`CT200 caddy-proxy @ pz1` serviert neun interne Namen. Fuenf davon loesen intern **nicht** auf und
fallen in die Wildcard:

| vhost | loest auf | Upstream laut Caddyfile |
|---|---|---|
| `grafana.bikini.bottom.zone` | 192.168.20.153 ✓ | .153:3000 |
| `librenms.bikini.bottom.zone` | 192.168.20.47 ✓ | .47 |
| `merkel.bikini.bottom.zone` | 192.168.20.81 ✓ | .81:8080 |
| **`merkel-api.bikini.bottom.zone`** | **87.139.158.187 ⚠ WAN** | .81:8000 |
| **`qdrant.bikini.bottom.zone`** | **87.139.158.187 ⚠ WAN** | .81:6333 |
| **`pbs.bikini.bottom.zone`** | **87.139.158.187 ⚠ WAN** | .117:8007 |
| **`agent-dashboard.bikini.bottom.zone`** | **87.139.158.187 ⚠ WAN** | .168 |
| **`bareos.bikini.bottom.zone`** | **87.139.158.187 ⚠ WAN** | — |
| **`victoriametrics.bikini.bottom.zone`** | **87.139.158.187 ⚠ WAN** | .163:8428 |

Die drei funktionierenden haben einen **DHCP-Lease mit passendem Hostnamen** (grafana, librenms, merkel).
Die fuenf kaputten haben keinen — sie waren nie als Lease-Name vorhanden und wurden nur im Proxy
konfiguriert. **Das ist kein Tippfehler-Risiko, das sind konfigurierte Dienstnamen, die falsch zeigen.**

### Der Proxy funktioniert — nur DNS leitet vorbei
```
curl -k --resolve qdrant.bikini.bottom.zone:443:192.168.20.200  ->  HTTP 200   (Proxy antwortet)
curl -k https://qdrant.bikini.bottom.zone/                      ->  HTTP 200   (WAN antwortet!)
curl -k https://192.168.20.200/                                 ->  HTTP 000   (nur namensbasierte vhosts)
```
Ein LAN-Client, der den Namen benutzt, erreicht den Proxy also **nicht** — er bekommt von aussen eine
echte 200er-Antwort.

### Was dort antwortet
```
HTTP/2 200 · server: nginx · x-frame-options: SAMEORIGIN
Zertifikat: CN = bikini.bottom.zone, Let's Encrypt R12
            notAfter = Aug 21 2026  -> seit ~4 Wochen ABGELAUFEN
```

## Korrektur an meiner eigenen Eskalation
Schnueffi hat recht: **"still" war ueberzogen.** Das Zertifikat ist abgelaufen UND der CN passt nicht
zur Subdomain — ein korrekt pruefender HTTPS-Client bricht mit zwei Fehlern ab. Die Fehlleitung ist
fuer solche Clients **laut**.

Zwei Einschraenkungen bleiben und halten das Szenario aufrecht:
1. **Die Anfrage verlaesst das Haus, bevor das Zertifikat eine Rolle spielt.** Bei einer
   Suchmaschine steht die Nutzlast im Query-String (`GET /search?q=...`) — sie ist raus, auch wenn
   der Client danach am Zertifikat scheitert. Das Zertifikat schuetzt die *Antwort*, nicht die *Anfrage*.
2. **Clients mit `-k` / `verify=False` bekommen eine echte 200** — nachgemessen. Skripte und
   Agenten-Code tun das oefter, als man moechte.

## Wer den search-Pfad hat (Expansion bloßer Hostnamen)
**Alle 5 Nodes** und **alle 39 laufenden Container** haben `search bikini.bottom.zone` in
`/etc/resolv.conf`. Ein blosses `ssh pz1` oder `curl http://qdrant/` wird also ueberall in die Zone
expandiert. Das ist die Reichweite des Problems.

## Wer den Zonennamen in Configs hat (nicht nur im search-Pfad)
Cluster-weiter Scan, `/etc` in allen laufenden Containern:

| Ort | Datei | Name |
|---|---|---|
| CT200 caddy-proxy | `/etc/caddy/Caddyfile` | die 9 vhosts oben |
| CT103 GameSrv01 | `/etc/nginx/sites-enabled/pufferpanel.conf` | `server_name game.bikini.bottom.zone` |
| CT103 | letsencrypt-Metadaten | `GameSrv01.bikini.bottom.zone` (nur Registrierungs-Info) |
| CT107 plex | 4x `resolv.conf`-Backups | nur `search`-Zeilen, funktional irrelevant |
| `/etc/pve` | `pz1/lxc/200.conf` | `searchdomain: bikini.bottom.zone` |

**Sonst nichts.** Kein Agenten-Code, kein Skript, keine Anwendungs-Config im Cluster nutzt einen
FQDN der Zone. Die Fleet-Policy fuer Merkel nutzt durchgehend **IPs**
(`192.168.20.81:8000` / `:8080` / `:6333`) — **kein Agent ist derzeit betroffen.**

## Was das fuer die Optionen bedeutet
- **Netzis Option C (static_dns befuellen) ist nicht nur Komfort, sondern behebt einen aktiven Fehlstand.**
  Konkrete Liste fuer C: die fuenf kaputten vhosts oben, jeweils auf **192.168.20.200** (den Proxy),
  plus die fuenf Hypervisor-Namen. Die drei funktionierenden brauchen nichts.
- **Mein `local=`-Vorschlag ist verworfen**, zu Recht, aus zwei unabhaengigen Gruenden:
  Netzi — die Wildcard ist ein echter oeffentlicher `*`-A-Record bei domainoffensive, kein
  Forwarder-Artefakt, und `local=` haette auf der UDM kein dauerhaftes Zuhause (`/run` ist tmpfs,
  `/etc/dnsmasq.d` wird nicht gelesen).
  Schnueffi — die Zone ist nicht aufzaehlbar, also darf man sie nicht auf local-only schalten;
  echte Records (`vpn`, `home`, `ha` -> Home-Assistant-Cloud) wuerden brechen.
  **Sein Kernargument trifft:** meine Reihenfolge deckte nur die Namen ab, an die wir denken — genau
  der Einwand, den ich selbst gegen `static_dns` allein erhoben hatte.
- **Option A (Wildcard verengen, Christin-Gate)** bleibt der Strukturfix. Mit diesem Inventar ist die
  Vorbedingung des Hubs erfuellt: im Proxmox-Cluster haengt **nichts** an einem FQDN der Zone ausser
  den Proxy-vhosts und `game.` auf CT103.

## 🔴 Vorgelagerter Befund (Netzi): drei Hypervisor-Adressen liegen ungesichert im DHCP-Pool
Beim Gegenpruefen der C-Zielliste fand Netzi, dass die Node-Adressen selbst nicht gesichert sind.
Von mir gemessen und **verschaerft**: es sind **drei** Nodes, nicht zwei.

```
.42  (pz2)   im Pool (.30-.199), statisch belegt, KEINE Reservierung   -> ungeschuetzt
.68  (pz1)   im Pool, statisch belegt, KEINE Reservierung              -> ungeschuetzt
.106 (pz3)   im Pool, Reservierung auf 00:e0:4c:56:36:92 — real ist :93 -> greift NIE, ungeschuetzt
.240 (proxmox) / .241 (pve)   ausserhalb des Pools                      -> strukturell sicher
```
Die Nodes sind statisch konfiguriert und halten **keinen Lease** — es schuetzt sie also nichts davor,
dass dnsmasq ihre Adresse an ein anderes Geraet vergibt. Dieselbe Zeitbombe wie am 14.09., nur an der
Wurzel der Hypervisoren statt an den Containern.

### Node-Identitaet, am IP-tragenden Interface gemessen
```
pz1   192.168.20.68    vmbr0 <- bond0   00:e0:4c:5b:96:b2
pz2   192.168.20.42    vmbr0 <- bond0   00:e0:4c:5b:96:98
pz3   192.168.20.106   vmbr0 <- bond0   00:e0:4c:56:36:93
```
Methode: auf jedem Node das Interface ermittelt, das die Adresse traegt, dann dessen MAC gelesen —
nicht aus einer Liste zugeordnet. Deckt sich mit `/etc/pve/.members` und `pvecm status`.

**MAC-Stabilitaet geprueft** (weil es Bonds sind): alle drei `802.3ad`, `fail_over_mac: none`, und
**beide Slaves tragen jeweils schon die Bond-MAC** (nic0 == nic1). Slave-Ausfall oder Umreihung
aendert die MAC nicht -> eine Reservierung darauf ist belastbar.

### Betriebsentscheidung: reservieren wo sie sind, NICHT umziehen
Netzi hatte den Umzug in den statischen Block mit "kostet je einen Node-Neustart" bewertet — das ist
deutlich zu guenstig:
```
/etc/pve/corosync.conf:   pz1 ring0_addr: 192.168.20.68
                          pz2 ring0_addr: 192.168.20.42
                          pz3 ring0_addr: 192.168.20.106
```
**Die Node-IPs sind die corosync-Ring-Adressen.** Eine Adressaenderung ist kein Netzwerk-Reboot,
sondern ein Eingriff in die **Cluster-Mitgliedschaft**: `corosync.conf` versioniert aendern, alle fuenf
Nodes muessen die neue Sicht uebernehmen, ein Fehler kostet **Quorum**. Bei laufenden Gaesten auf pz1
(grafana, victoriametrics, node-red, caddy-proxy, HomeAssistant) und pz2 (merkel, checkmk,
forgejo-runner, protectbridge) ist das geplante Wartung mit Rueckfallplan.

Eine Reservierung auf eine nachweislich stabile MAC ist dagegen reversibel, sofort wirksam, risikofrei.
Falls die Adressen langfristig aus dem Pool sollen, waere **die Pool-Untergrenze von `.30` auf `.45`
anheben** der billigere Weg als drei Node-Umzuege (nimmt .42 raus, laesst .68/.106 drin) — eigener
geplanter Vorgang, nicht jetzt.

### Stale Reservierungen freigeben
`.65` und `.105` antworten nicht auf ping. Es sind `ZimaBoard2`-Docs zu den MACs, die real auf `.68`
und `.106` sitzen — nie nachgezogen, als die Hosts auf statisch umgestellt wurden. Koennen zurueck in den Pool.

### Reihenfolge (Netzis, bestaetigt)
Adressen vor Namen — ein Record auf eine Adresse, die morgen jemand anderem gehoert, ist schlimmer
als kein Record.
1. `.42` / `.68` / `.106` auf die drei MACs reservieren, `.106`s Off-by-one korrigieren
2. `.65` / `.105` freigeben
3. Dann C: sechs vhosts + `caddy-proxy` auf `.200`, fuenf Node-Namen auf ihre Adressen

**CT200 hat kein `hostname`-Feld** (Netzi) — da kaeme auch mit DHCP kein Name heraus. Der Proxy
braucht seinen `static_dns`-Eintrag also zwingend, die Reservierung allein reicht nicht.
