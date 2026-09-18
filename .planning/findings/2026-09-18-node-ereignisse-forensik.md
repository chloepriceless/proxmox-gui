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

### NACHTRAG (03:30) — der Auslöser ist identifiziert: ein Switch

Die erste Fassung dieses Dokuments sagte „ein LAN-Ereignis, Ursache von hier nicht
bestimmbar". Das war zu vorsichtig — ich hatte nur `grep corosync` gemacht und die
**Kernel-Zeilen** nicht angesehen. Die stehen da, und sie sind eindeutig:

```
2026-09-09T03:24:15  pz1  igc nic1: NIC Link is Down · igc nic0: NIC Link is Down
2026-09-09T03:24:15  pz1  bond0: now running without any active interface!
2026-09-09T03:24:15  pz2  … identisch, dieselbe Sekunde
2026-09-09T03:24:15  pz3  … identisch, dieselbe Sekunde
```

**Drei Knoten, beide LACP-Slaves, dieselbe Sekunde — zwei Sekunden bevor corosync
(03:24:17) etwas merkt.** Corosync war das Symptom, nicht der Sensor.

Zuordnung über den LACP-Partner:

| Knoten | Partner MAC | Link | NIC-Event 03:24:15 |
|---|---|---|---|
| pz1, pz2, pz3 | `f4:e2:c6:ad:a8:c7` | 2× 2500 Mbps | **ja, alle drei** |
| pve (.241) | `28:70:4e:cf:56:13` | 2× 10000 Mbps | **nein, keine Zeile** |

`.241` hängt an einem anderen Switch und verlor das Quorum nur, weil die anderen weg
waren. Damit ist der Verursacher **der Switch `f4:e2:c6:ad:a8:c7`** (Ubiquiti-OUI), der
um 03:24:15 alle seine Ports fallen ließ. Ein Kabel- oder Einzelport-Defekt scheidet aus —
sonst wäre nicht jeder Slave jedes Knotens gleichzeitig weg.

**Dauer**, gemessen an pz2 (der einzige, der überlebte und die Rückkehr noch loggen konnte):
`03:24:15 now running without any active interface!` → `03:25:25 NIC Link is Up 2500 Mbps`
= **~70 s**. Das ist keine Reconvergence-, das ist eine Reboot-Zeit.

#### Und es sind exakt dieselben drei Ereignisse

```
$ journalctl --since 2026-08-01 | grep "now running without any active interface"
  2026-08-18T04:02:44   →  Fence 04:03:19  (35 s später)
  2026-08-20T16:49:38   →  Fence 16:50:32  (54 s später)
  2026-09-09T03:24:15   →  Fence 03:25:11  (56 s später)
```

**Drei Totalausfälle des Bonds seit 01.08., drei Fence-Ereignisse — 1:1, ohne Ausreißer
in beide Richtungen.** Kein Bond-Ausfall ohne Fence, kein Fence ohne Bond-Ausfall.
(Der Journal-Bestand auf pz1 reicht bis 03.08. zurück, der Zeitraum ist also gedeckt.)

Damit ist es kein diffuses „das LAN zuckt gelegentlich", sondern **ein Gerät mit drei
dokumentierten Totalausfällen in drei Wochen**, von denen jeder zwei Hypervisor hart
zurückgesetzt hat. Das ist ein RMA-Argument, keine Vermutung.

**Abgrenzung zum UDM-Befund (Netzi, `orchestrator-network`, commit `4a77f71`):** Die UDM
hat an allen drei Zeitpunkten *nichts* geloggt, und das ist korrekt — der Vorfall fand
nicht auf ihr statt. Ihr separates `eth10`/SFP+-Problem (10G↔1G-Oszillation, Flap
03:14:27–03:15:12) erklärt das Flappen von `pve`/.241 im **Vorlauf** derselben Nacht,
nicht den Trigger 9 Minuten später. Zwei unabhängige Defekte, beide echt.

**Nebenprodukt für die Netzwerk-Forensik:** Es gibt in dieser Installation keine
Switch-Port-Historie (UniFi-`event`/`alarm` leer, `/var/log/messages` rotiert nach ~20 h).
Die **andere Seite des Kabels** protokolliert aber mit — jeder Port-Ausfall an einem
Proxmox-Knoten ist in dessen Kernel-Log datiert, inklusive Down-Zeit und Speed:
`journalctl | grep -E "NIC Link is (Down|Up)|now running without any active interface"`.
Als Interims-Sensor brauchbar, bis die Switch-Logs off-box laufen.

### NACHTRAG 2 (03:45) — Topologie: SPOF, Quorum-Rechnung und der machbare Fix

Netzi (`orchestrator-network`, commit `fd5ce96`) hat die MACs zugeordnet:

| Partner MAC | Gerät | Adresse |
|---|---|---|
| `f4:e2:c6:ad:a8:c7` | **USPM24P** (USW Pro Max 24 PoE) | 192.168.20.145 |
| `28:70:4e:cf:56:13` | USL8A | 192.168.20.146 |

Firmware auf allen Switches identisch (`7.5.15.17146`) — ein Versionsunterschied als
Erklärung fällt aus. Und sein eigentlicher Befund wiegt schwerer als der Defekt:
**alle drei Hypervisor hängen am USPM24P** (zusammen mit 37 weiteren Clients).

#### Die Quorum-Rechnung macht daraus einen Totalausfall

5 Knoten, Quorum 3. Am USPM24P hängen pz1, pz2 **und** pz3 = drei Stimmen. Fällt das
Gerät, bleiben `.240` + `.241` = **2 Stimmen < 3** — der überlebende Teil ist ebenfalls
nicht quorat. Ein USPM24P-Ausfall ist also kein Teil-, sondern ein **Totalausfall des
Clusters**. Dass bisher nur zwei Knoten hart resetteten, lag allein daran, dass pz2
keinen scharfen Watchdog hielt.

Damit ist ein Tausch des Geräts nur die halbe Antwort: auch ein fehlerfreier Nachfolger
nimmt bei jedem Firmware-Reboot und jeder Wartung wieder den ganzen Cluster mit.

#### Hardware-Bestand: keine freie NIC

```
pz1 / pz2 / pz3   nic0 (igc, 2500) + nic1 (igc, 2500)  →  beide in bond0, beide am USPM24P
```

**Zwei Ports pro Knoten, beide belegt.** Ein dedizierter Corosync-Ring auf eigener
Schnittstelle ist ohne neue Hardware physisch unmöglich. Die Ringfrage ist der
Verteilung damit *nachgelagert*, nicht nebengeordnet.

#### Der zweite Pfad existiert — er ist falsch gesteckt

Nicht ein drittes Kabel, sondern **ein Kabel pro Knoten umstecken** und LACP aufgeben:

```
statt   bond-mode 802.3ad        nic0+nic1 → USPM24P (aggregiert)
dann    bond-mode active-backup  nic0 → USPM24P, nic1 → zweiter Switch
```

LACP kann kein Aggregat über zwei UniFi-USW spannen (kein MLAG) — active-backup braucht
das nicht, beide Switches sind dieselbe Broadcast-Domäne. `bond-miimon 100` ist auf allen
drei Knoten bereits gesetzt: Umschaltzeit ~100–200 ms gegen ein Corosync-Token-Timeout von
**4950 ms**, zwei Größenordnungen Luft. Ein USPM24P-Ausfall löst dann *kein*
Quorum-Ereignis mehr aus.

**Preis, gemessen statt behauptet** (Durchsatz über `bond0/statistics`, Schnitt seit Boot,
Kapazität 2×2500 = 5000 Mbit/s):

| Knoten | Schnitt | Anteil der Kapazität |
|---|---|---|
| pz1 | 10.6 Mbit/s | 0,2 % |
| pz2 | 1.2 Mbit/s | 0,02 % |
| pz3 | 4.2 Mbit/s | 0,08 % |

⚠️ Der Schnitt über 9 Tage verdeckt Spitzen (Backup-Fenster). Er müsste allerdings um
Faktor >250 überschritten werden, um einen einzelnen 2,5G-Link zu sättigen. Die
Aggregation kauft hier messbar nichts und kostet aktuell genau die Redundanz, die fehlt.

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

0. **Den Switch USPM24P (`f4:e2:c6:ad:a8:c7`, 192.168.20.145) prüfen/tauschen** — *neu nach dem Nachtrag, und
   jetzt die wichtigste Maßnahme.* Drei Totalausfälle in drei Wochen, ~70 s Down-Zeit
   (Reboot-Größenordnung). Ein Gerät mit dieser Bilanz gehört auf den Prüfstand, bevor
   man die Topologie drumherum umbaut. Netzi ordnet die MAC einem konkreten USW zu.
1. **Ein Kabel pro Knoten auf einen zweiten Switch, `bond-mode` auf `active-backup`** —
   *der strukturelle Fix.* Keine neue Hardware, kein Kapazitätsproblem (USL8A und US24PRO
   haben Platz), nur Umstecken plus drei Zeilen in `/etc/network/interfaces`. Löst den SPOF
   und das Fencing in einem Zug; der Umbau ist ein kurzer, angekündigter Aussetzer pro
   Knoten (einzeln unkritisch, Quorum 3 von 5 bleibt gewahrt).
2. **Zweiter Corosync-Ring** (`ring1_addr`) — nach Punkt 1 erst *möglich* (vorher fehlt die
   freie NIC), danach aber weitgehend **überflüssig**: ist der Pfad selbst redundant,
   braucht der Ring keine eigene Redundanz. Als optional führen, nicht als Pflicht.
3. **Prüfen, ob pz1/pz3 überhaupt HA brauchen.** Fencing ist der *Preis* von HA. Wenn die
   Gäste auf pz1/pz3 kein automatisches Failover brauchen, beseitigt das Entfernen der
   HA-Ressourcen die Hard-Resets sofort und ohne Netzumbau — die günstigste Sofortmaßnahme.
   Braucht man HA, ist Empfehlung 1 Pflicht, keine Kür.
4. **Ereignis B ist keine Cluster-Baustelle.** Nichts an Proxmox reparieren; die Frage
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
