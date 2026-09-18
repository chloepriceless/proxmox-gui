# HANDOVER — vm-deployment-gui (Infra-HEAD Proxmox)
**Stand:** 2026-09-18 ~02:50 · Branch `fix/release-review-blockers` · alles gepusht

## Aufgabe & Ziel
Ich bin Infra-HEAD fuer den Proxmox-Cluster (es gibt keinen `proxmox-master` in der Registry —
ich fuelle die Rolle, inkl. **Kapazitaets-Entscheider** fuer neue LXCs).
Zwei Straenge liefen: (1) Incident T-0326 vom 14.09., (2) SearXNG-LXC in der Nacht 17./18.09.

## ✅ Erledigt und verifiziert
**T-0326 (14.09.):** ZFS-Pool `Samsung_1TB` auf pz1 stand bei `AVAIL=0B` durch 406G verwaiste
`refreservation` (`vm-142-disk-0/1`, Migrations-Leichen). Reversibel geloest via
`refreservation=none` (Rollback: `zfs set refreservation=203G <vol>`). Folgeschaeden behoben:
VictoriaMetrics, DHCP-Lease-Storm (CT100/115/126), CT141 op-connect, scrape.yml, 44/44 Targets up.
Detail: `.planning/findings/2026-09-14-pz1-zfs-pool-exhaustion.md`

**SearXNG (18.09.):** GO erteilt, **CT165 @ pz3** gebaut (Debian 13, unprivileged, **kein nesting**,
2c/1024M/8G, MAC `BC:24:11:5E:A7:C3`, **192.168.20.210** per DHCP-Reservierung). Verifiziert:
42 JSON-Treffer, `searxng` + FQDN loesen auf, systemd `running`/0 failed, RAM 261M/1024M.
Detail: `.planning/findings/2026-09-17-searxng-kapazitaetsentscheid.md`

## 🔴 Exakter naechster Schritt: .176-Konflikt ist GELOEST — nur noch melden
Zwei Container statisch auf `192.168.20.176`. **Gerade fertig gemessen, noch NICHT an die Peers
gemeldet — das ist das Erste, was die frische Session tun soll:**

```
CT150 semaphore @ pz3  ->  PRODUKTIV: docker "semaphoreui/semaphore:v2.18.12", Up 8 days (healthy),
                           lauscht auf 192.168.20.176:3000, /opt/semaphore 648K
CT157 semaphore @ pz2  ->  LEICHE:    docker-Container "Exited (143) 3 months ago",
                           nichts lauscht auf :3000, /opt/semaphore 608K, docker-Dienst active
```
**Damit ist Netzis Sorge ausgeraeumt**, beide koennten Teilzustand halten: CT157 laeuft seit
**3 Monaten** nicht, kann also keine Anfragen verarbeitet haben. Das Flappen entsteht, weil CT157s
Kernel die konfigurierte Adresse per ARP beantwortet, obwohl kein Dienst dahinter ist -> ~die Haelfte
aller neuen Verbindungen laeuft in ein `connection refused`.

**Empfehlung an Hub/Christin (NICHT eigenmaechtig ausfuehren, Anwendungsentscheidung):**
CT157 ist die Leiche. Saubere Reihenfolge: `.176` aus CT157s Config entfernen (oder CT157 stoppen),
**dann** kann Netzi `.176` auf CT150s MAC `BC:24:11:8F:6F:49` reservieren.
Netzi hat ausdruecklich gesagt: **keine Reservierung auf `.176`, solange der Konflikt besteht** —
das wuerde den Gewinner stillschweigend festlegen.

## Offene Punkte (alle blockiert, keiner autonom machbar)
1. **`.176`-Konflikt** — Befund oben melden, dann Entscheidung Hub/Christin.
2. **`zfs destroy`** `Samsung_1TB/vm-142-disk-0/1` — Christin, unkritisch (406G ohne Loeschung frei).
3. **`bootstrap.sh`** backt die Installations-IP ins Caddyfile -> Adressdrift macht die GUI
   unerreichbar (CT143 war live betroffen). Fix: Site-Adresse `:443` statt IP. **Projektentscheidung.**
4. **Zwei ungeklaerte Node-Ereignisse:** proxmox/.240 12 Tage weg (02.–14.09.), pz1+pz3 Reboot vor ~9 Tagen.
5. **DNS-Wildcard** `*.bikini.bottom.zone` -> WAN-IP. 5 Proxy-vhosts (merkel-api, qdrant, pbs,
   agent-dashboard, bareos, victoriametrics) zeigen aktiv nach draussen. Netzi macht `static_dns`
   morgen (11 Records), braucht dafuer Christins Muster-Record ueber die UniFi-UI.
   Detail: `.planning/findings/2026-09-18-interne-namen-inventar.md`
6. **Vier ungesicherte Pool-Statiken** (.172 forgejo, .173 forgejo-runner, .174 ansible-control,
   .175 dolibarr) — Netzi reserviert sie morgen. Detail:
   `.planning/findings/2026-09-18-statische-pool-adressen-sweep.md`

## Peers & Zustaendigkeiten
- **Netzi** (`network`): UDM/DHCP/DNS. Arbeitet nach R22-Refute via Schnueffi, schreibt gegen
  vorab festgelegte Orakel. Heute Nacht 3 Gateway-Zuege gemacht, verschiebt den 4. bewusst auf morgen.
- **Hub** (`orchestrator`): hat SearXNG nativ installiert. `peer/notify` **schneidet bei 4000 Zeichen
  ab** — Laengeres ins Repo legen und nur den Pfad schicken.
- **Kuma** (`monitoring`): T-0326/0331/0332 geschlossen. **Schnueffi** (`security`): Wildcard-Bewertung.

## Meine eigenen Fehler dieser Session (damit sie sich nicht wiederholen)
- Configs gelesen ohne gegen die Realitaet zu pruefen -> zwei Fehltreffer im Sweep
  (`CT133 paperless` liegt in `192.168.10.x`; `.148` ist korrekt fuer eine **andere** MAC reserviert).
- `local=/bikini.bottom.zone/` vorgeschlagen, ohne zu prüfen, ob die Zone aufzaehlbar ist — mein
  eigenes Argument gegen `static_dns` allein, auf meinen eigenen Vorschlag nicht angewandt.
- "Datenabfluss ist still" ueberzogen — das Zertifikat ist abgelaufen, ein pruefender Client bricht laut ab.
- `.176`: aus **einem** ARP-Read geschlossen, CT150 "gewinne". Netzi hat 6x mit geleertem Cache
  gemessen: es flappt. **Ein Single-Read ist keine Messung.**

## Merksaetze fuer die Nachwelt
- **Ein Oracle, das nur zaehlt, ist blind fuer Austausch-Operationen** (Netzi: +1/-1 Eintrag ->
  Zeilenzahl unveraendert; nur md5 + Ansprueche-pro-Adresse zeigen den Zug).
- **Gruene Unit ueber echtem Defekt** ist die Standard-Fehlerklasse dieser Flotte (Caddy, netdata,
  uwsgi). Abnahme gegen den **Nutz-Output**, nie gegen `systemctl status`.
- **Adresse: dokumentierte Wahrheit vs. Zufallswert** — Test: gibt es fuer die alte Adresse eine
  Quelle, die aelter ist als der Vorfall UND nicht aus einem Automatismus stammt?

## Resume
```bash
git log --oneline -8
ssh -i ~/.ssh/id_ed25519 root@192.168.20.68   # pz1
ssh -i ~/.ssh/id_ed25519 root@192.168.20.106  # pz3 (CT165 searxng)
```
Memories: `~/.claude/projects/-home-dev-vm-deployment-gui/memory/` — `pve-node-ssh-access`,
`pz1-zfs-pool-refreservation-trap`, `lxc-dhcp-lease-storm-signature`,
`adresse-dokumentierte-wahrheit-vs-zufallswert`, `debian13-unprivileged-lxc-nesting`,
`gruene-unit-ueber-echtem-defekt`.
