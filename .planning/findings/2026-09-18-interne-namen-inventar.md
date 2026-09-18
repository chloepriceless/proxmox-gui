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
