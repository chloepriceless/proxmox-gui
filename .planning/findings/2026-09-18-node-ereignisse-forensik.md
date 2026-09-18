# Die zwei ungeklärten Node-Ereignisse — aufgeklärt

**Datum:** 2026-09-18 · **Autor:** Infra-HEAD (vm-deployment-gui)
**Anlass:** Offener Punkt 4 aus `.planning/handover/HANDOVER.md` — „proxmox/.240 12 Tage weg
(02.–14.09.), pz1+pz3 Reboot vor ~9 Tagen". Beides stand unkommentiert im Handover.

**Ergebnis vorweg:** Es sind zwei *verschiedene* Ereignisse mit zwei verschiedenen Ursachen,
und das zweite ist kein Einzelfall, sondern das dritte Auftreten desselben Musters.

---

## Ereignis A — pz1 + pz3, 09.09. 03:25: HA-Selbst-Fencing, kein Absturz

**Das war kein Reboot und kein Crash. Beide Knoten haben sich selbst per Watchdog
hart zurückgesetzt**, weil sie das Quorum verloren hatten. Proxmox-HA arbeitet so: der
`pve-ha-lrm` füttert einen Watchdog nur, solange er quorat ist und nach `/etc/pve`
schreiben kann. Fällt das Quorum weg, läuft der Watchdog nach ~60 s ab und setzt den
Knoten hart zurück — genau das ist passiert.

### Zeitleiste (alle Zeiten CEST, unabhängig aus drei Journalen belegt)

| Zeit | Knoten | Ereignis |
|---|---|---|
| 03:24:17 | pz2 (Zeuge, lief durch) | `link: host: 5 link: 0 is down` · `host: 3 ... down` · `host: 2 ... down` — **alle drei in derselben Sekunde** |
| 03:24:19 | pz2 | `Token has not been received in 3712 ms` |
| 03:24:26 | pz2 | `Sync members[1]: 4` · `Sync left[3]: 2 3 5` · `This node is within the non-primary component` · `node lost quorum` |
| 03:24:26 | pz1 | `pve-ha-crm[2487]: watchdog closed (disabled)` (CRM gibt ab, LRM behält ihn) |
| 03:24:59 | pz3 | `watchdog-mux[943]: client (PID 3438) watchdog is about to expire` |
| 03:25:01 | pz1 | `watchdog-mux[970]: client (PID 3512) watchdog is about to expire` |
| 03:25:09 | pz3 | `watchdog expired — disable watchdog updates` → `watchdog0: watchdog did not stop!` |
| 03:25:11 | pz1 | `watchdog expired — disable watchdog updates` → `watchdog0: watchdog did not stop!` |
| 03:25:39 / 03:25:42 | pz3 / pz1 | Boot (`uptime -s`) |
| 03:27:24 | pz2 | Quorum wieder da (`node has quorum`), pz3 zurück im Verbund |

`watchdog0: watchdog did not stop!` als **letzte Zeile** des jeweiligen Boots ist der Beleg:
es gibt keine systemd-Shutdown-Sequenz, kein `Unmounting`, kein Signal. Das Gerät hat
mitten im Betrieb reingehauen.

### Warum pz2 überlebt hat

pz2 hat zur selben Sekunde ebenfalls das Quorum verloren (`Members[1]: 4`), aber sein
LRM hatte keinen scharfen Watchdog — er ging in `wait_for_quorum` und wartete es aus.
Gefencet wurden **exakt die beiden Knoten mit scharfem HA-Watchdog**. Wer HA-Ressourcen
hält, zahlt beim LAN-Aussetzer mit einem Hard-Reset; wer keine hält, wartet ihn ab.

### Der Auslöser war das Netz, nicht ein Knoten

pz2 verliert die Links zu Node 2, 3 und 5 **in derselben Sekunde**. Ein Knotenfehler
sieht anders aus (ein Link fällt). Das ist ein LAN-Ereignis. Unterstützend: in allen
drei Fence-Ereignissen loggt `pvestatd` zeitgleich
`Can't connect to 192.168.20.117:8007 (No route to host)` für das PBS-Backup-Ziel —
also fiel im selben Moment auch eine Adresse aus, die gar nichts mit Corosync zu tun hat.
(PBS .117 ist **heute erreichbar**: Ping 0 % Verlust, Port 8007 offen, seit 6 h kein
einziger Fehler auf pz1/pz2/pz3. Es war also kein PBS-Defekt, sondern ein Symptom.)

Vorgeschichte derselben Nacht: Node 2 (`pve`, .241) flappte schon vorher —
join 03:15:30, down 03:18:28, up 03:20:13, down 03:24:17.

### Das ist das dritte Mal, nicht das erste

Dieselbe Signatur (`watchdog expired` → `watchdog did not stop!` als letzte Zeile) steht
auf pz1 auch am Ende der beiden davorliegenden Boots:

| Datum | Uhrzeit | Knoten |
|---|---|---|
| 18.08.2026 | 04:03:19 | pz1 (+ pz3, gleicher Boot-Zeitstempel) |
| 20.08.2026 | 16:50:32 | pz1 (+ pz3; pz2 kam 17:01 hoch) |
| 09.09.2026 | 03:25:11 | pz1 (+ pz3) |

**Dreimal in drei Wochen.** Das Handover hat es als „ein Reboot vor ~9 Tagen" geführt —
es ist ein wiederkehrendes Muster.

### Strukturelle Ursache

`/etc/pve/corosync.conf` hat **einen einzigen Ring**, und der liegt auf dem flachen
Produktiv-LAN:

```
nodeid 1 proxmox ring0_addr 192.168.20.240
nodeid 2 pve     ring0_addr 192.168.20.241
nodeid 3 pz1     ring0_addr 192.168.20.68
nodeid 4 pz2     ring0_addr 192.168.20.42
nodeid 5 pz3     ring0_addr 192.168.20.106
```

Kein `ring1_addr`, kein dediziertes Corosync-Netz. Jede LAN-Störung von mehr als dem
Token-Timeout (~5 s) ist damit ein clusterweites Quorum-Ereignis — und für jeden Knoten
mit scharfem HA-Watchdog ein Hard-Reset. Das ist kein Bug, das ist die dokumentierte
Proxmox-Mechanik auf einer Topologie ohne Redundanz.

---

## Ereignis B — .240, 02.09. 01:53 bis 14.09. 12:21: Stromausfall, kein Fencing

Anderer Mechanismus, trotz ähnlicher Optik.

- **Letzter Journal-Eintrag:** `2026-09-02T01:53:14 proxmox pvestatd[4950]: …` — mitten im
  laufenden Betrieb. **Keine** Shutdown-Sequenz, **kein** `Unmounting`, **kein**
  Watchdog-Ablauf. Der .240-Watchdog war seit **20.08. 16:50** geschlossen
  (`pve-ha-crm: watchdog closed (disabled)`) — Fencing scheidet als Ursache aus.
- **BMC:** `ipmitool chassis status` → `Last Power Event : ac-failed`.
  ⚠️ **Einschränkung:** das Feld ist gelatcht und trägt keinen Zeitstempel — es belegt
  *ein* AC-Ereignis, nicht zwingend das vom 02.09. Als Einzelbeleg zu schwach, im
  Zusammenspiel mit dem Rest aber stimmig.
- **SEL:** zwischen `08/08/2026 23:55` und `09/14/2026 13:20` steht **kein einziger
  Eintrag**. Ein BMC auf Standby-Strom würde in 12 Tagen etwas loggen. Die Lücke deckt den
  Ausfall exakt ab → **auch die Standby-Schiene war stromlos**, nicht nur das Netzteil.
  Das zeigt auf Steckdose / PDU / Sicherung, nicht auf ein Netzteil im Gerät.
- **`Power Restore Policy : always-on`** — die Kiste kommt von selbst hoch, sobald Strom
  anliegt. Dass sie 12 Tage unten blieb, heißt: **es lag 12 Tage kein Strom an.**
  Der Boot am 14.09. 12:21 ist die Wiederkehr der Versorgung, keine Handlung am Gerät.

**Offen und nur von Christin beantwortbar:** Was hing am 02.09. ~01:53 an demselben
Stromkreis, und was ist am 14.09. mittags dort passiert? Eine gefallene Sicherung, eine
gezogene Leiste oder ein abgeschalteter Zwischenstecker erklären den Befund vollständig;
welche davon, sagt kein Log.

---

## Empfehlungen

1. **Zweiten Corosync-Ring ziehen** (`ring1_addr`) — für Netzi + Christin. Solange
   Corosync einzügig auf dem Produktiv-LAN liegt, ist jeder Switch-Hüpfer ein
   potenzieller Doppel-Hard-Reset. Das ist der eigentliche Fix.
2. **Prüfen, ob pz1/pz3 überhaupt HA brauchen.** Fencing ist der *Preis* von HA. Wenn die
   Gäste auf pz1/pz3 kein automatisches Failover brauchen, beseitigt das Entfernen der
   HA-Ressourcen die Hard-Resets sofort und ohne Netzumbau — die günstigste Sofortmaßnahme.
   Braucht man HA, ist Empfehlung 1 Pflicht, keine Kür.
3. **Ereignis B ist keine Cluster-Baustelle.** Nichts an Proxmox reparieren; die Frage
   gehört an die Elektrik. Bis das geklärt ist, bleibt .240 ein Knoten, der jederzeit
   ohne Vorwarnung 12 Tage weg sein kann — beim Platzieren neuer LXCs entsprechend werten
   (deckt sich mit dem bestehenden Vermerk „.240 instabil, keine Prod-VMs").

## Belege zum Nachprüfen

```bash
ssh -i ~/.ssh/id_ed25519 root@192.168.20.42  'journalctl --since "2026-09-09 03:20" --until "2026-09-09 03:32" | grep -E "QUORUM|TOTEM|link: 0 is"'
ssh -i ~/.ssh/id_ed25519 root@192.168.20.68  'journalctl -b -1 -n 20; journalctl -b -2 -n 6; journalctl -b -3 -n 6'
ssh -i ~/.ssh/id_ed25519 root@192.168.20.106 'journalctl -b -1 -n 20'
ssh -i ~/.ssh/id_ed25519 root@192.168.20.240 'journalctl -b -1 -n 25; ipmitool chassis status; ipmitool sel list | tail -20'
```

Verwandt: [[gruene-unit-ueber-echtem-defekt]] — auch hier meldete `systemctl` nichts
Auffälliges, während der Knoten schon am Fallen war.
