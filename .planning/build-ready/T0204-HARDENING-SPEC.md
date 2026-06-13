# T-0204 — Hardening-Spec (Szenario R) für die 4 R22-Cutover-Blocker

**Schraubi (T-0204-Design-Owner) · 2026-06-13 · Deliberate-Mode Design-vor-Build-Artefakt.**
Topologie ist entschieden (**Szenario R**, Design-Doc §7). Dieses Dokument schließt die **4 R22-Cutover-
Blocker** (Design-Doc §8) — sie sind topologie-unabhängig und **teils cross-component**. Es liefert pro
Blocker eine **Design-Position + verworfene Alternativen + Tradeoffs**, einen **Owner** und **messbare
Akzeptanzkriterien (R31)**. Es ist ein **Vorschlag an die jeweiligen Owner zur Review**, KEINE einseitige
Implementierungs-Entscheidung über fremde Komponenten — ich besitze die T-0204-Architektur, die Owner
implementieren ihre Teile. **Nächste Schritte (unten): echter cross-lab Codex-Refute auf diese Spec +
Owner-Koordination.** Nichts hier ist live ausgeführt.

**Primärquellen-Belege** (in Merkel ingested, 2026-06-13):
- *Proxmox VE HA — Fencing/Watchdog/Quorum/LRM/CRM*: Watchdog **self-fence nach 60s** bei Quorum-Verlust;
  **softdog = Default** (geringere Zuverlässigkeit als HW-Watchdog); **failover ~2 min** typisch; **LRM-Lock
  nötig** zum HA-Resource-Start.
- *Proxmox VE Storage Replication (pvesr/ZFS)*: **KEINE App-Konsistenz-Garantie**, kein Quiescing/Flush;
  min 1 min / default 15 min; failed jobs nur **30-min-retry, KEIN Alerting** ("use the replication log").

---

## Sequencing (was MUSS dem Cutover vorausgehen)
1. **Blocker #4 (Repl-Monitoring) ZUERST** — ist Voraussetzung, um #1/#3 überhaupt verifizieren zu können
   (Failover-Garantie messbar machen, bevor man sich auf sie verlässt).
2. **#1 (Fencing/Lease) + #2 (spawnerd-Reconcile)** zusammen — sie sind gekoppelt (respawn erst nach Fence;
   Reconcile braucht die Lease-/Epoch-Semantik).
3. **#3 (app-konsist. Snapshots)** parallel — lokal in agent-master, unabhängig.
4. **DANN** echter cross-lab Codex-Refute auf Spec+Diffs → Schnüffi (LAN-Bind) → Netzi (nftables) → Cutover-Drill.

---

## Blocker #1 — [KRITISCH] Fencing/Lease gegen Split-Brain
**Owner: Broker (claude-peers-mcp) + Cluster-API-Caller (spawnerd).** Schraubi koordiniert.

**Problem:** Netz-Isolation (2,5G-Link-Flap, Switch-Port-Reset — häufiger als echter Node-Tod) ohne Prozess-
Tod ⇒ der alte Peer läuft auf der isolierten Node weiter, während spawnerd ihn auf einem Survivor respawnt
⇒ zwei Instanzen am selben Broker, beide pushen dasselbe git-Repo, **beide bedienen externe Singleton-Kanäle
doppelt** (wa-bridge Doppel-Login, telegram 409). Beleg: R22-Refute #1 + systemd/README:48-49.

**Design-Position (gewählt): Lease/Epoch am Broker + STONITH vor respawn (Defense-in-Depth, beide Schichten).**
- **(a) Broker-seitige Peer-Lease mit Epoch:** Jeder Peer registriert sich am Broker mit `(peer_id, epoch)`.
  Eine frische (respawnte) Session bumpt die Epoch. Der Broker hält pro `peer_id` nur die **höchste Epoch**
  als gültig und **DROPpt Frames veralteter Epoch** (send_message vom alten isolierten Prozess landet im
  Leeren, sobald die Partition heilt). Das ist die *innere* Linie — wirkt auch, wenn STONITH (a-typisch)
  scheitert. Klein: ein Feld + ein Vergleich im Routing.
- **(b) STONITH vor respawn:** spawnerd `pct stop <peer-runner-LXC>` der verdächtigen Node **über die
  Cluster-API** (die quorate ist, auch wenn der *Daten*-Link wackelt — Corosync-Ring kann separat laufen),
  und respawnt **erst nach bestätigtem Stop**. Verhindert, dass der alte Prozess überhaupt weiterläuft.

**Verworfene Alternativen + Tradeoffs:**
- *Nur Heartbeat-Timeout → respawn (Ist-Design):* die unsichere textbook-Variante (kann tot vs. isoliert
  nicht unterscheiden) — **verworfen**, ist exakt der Bug.
- *Nur STONITH ohne Lease:* wenn die Cluster-API im Partitions-Moment nicht erreichbar ist, fehlt die innere
  Linie → Lease als Backstop nötig. *Nur Lease ohne STONITH:* der alte Prozess läuft weiter (CPU/Repo-Writes),
  auch wenn seine Frames gedroppt werden — STONITH räumt ihn echt weg. ⇒ **beide**, nicht entweder/oder.
- *Proxmox-HA für alle Peer-Runner statt App-Fencing:* HA kennt nur LXC-Granularität + kann keine fette
  Peer-LXC auf einen vollen Node restarten — **verworfen** (Design-Doc §5).

**Akzeptanzkriterium (R31, messbar):** Drill — Peer-Runner-Node per `iptables`-Drop netz-isolieren (Prozess
lebt). Erwartung: (1) spawnerd respawnt NICHT vor bestätigtem `pct stop`; (2) nach Partitions-Heilung
empfängt der Broker **0 Frames** mit alter Epoch (Counter); (3) externe Kanäle erhalten **genau 1**
Zustellung (kein 409/Doppel-Login im Bridge-Log). Zahl vor dem Test fixieren.

**Offene Fragen (Owner/Codex):** Läuft der Corosync-Ring physisch getrennt vom 2,5G-Daten-Link (sonst ist
„API quorate trotz Daten-Link-down" nicht gegeben)? Wo lebt der Epoch-Zähler bei Broker-Failover (→ #3)?

---

## Blocker #2 — [KRITISCH] spawnerd-Reentrancy + RAM-Singleton
**Owner: spawnerd (orchestrator).** Schraubi koordiniert.

**Problem:** Stirbt der fleet-core-Host, ist GLEICHZEITIG der Controller (spawnerd lebt IN fleet-core) UND
die Peers dort weg. Im HA-Restart-Fenster (**~2 min**, PVE-Primärquelle) respawnt NIEMAND. Peer→Node-Map im
RAM = nach Restart weg → Discovery rät → Doppel-Spawns. Beleg: R22-Refute #2.

**Design-Position (gewählt): deklarative Soll-Map in git + Reconcile-Loop + Anti-Affinity.**
- **Peer→Node-Soll-Map deklarativ in git** (`home_node` + `failover_node` pro Peer). Jede frisch gestartete
  spawnerd-Instanz kennt den SOLL-Zustand ohne Raten.
- **spawnerd-Start = Reconcile-Loop:** IST (Broker-Registry: wer ist online, mit welcher Epoch) vs SOLL (git)
  abgleichen, **nur die Differenz** spawnen — niemals blind respawn. Idempotent (koppelt an #1-Epoch).
- **Anti-Affinity:** fleet-core-LXC **NICHT** auf eine Node mit schwerer Peer-Population. (Playbook platziert
  aktuell fleet-core+peer-runner beide auf pz3 → in Szenario R: fleet-core auf pz3, schwere Peers auf **pve**
  — bereits getrennt; explizit als HA-Affinity-Constraint festschreiben.)

**Verworfene Alternativen:** *RAM-Map + Discovery-Raten* (Ist) — Doppel-Spawn-Quelle, verworfen. *Zweite
stehende spawnerd-Instanz (hot-standby) auf anderer Node* — Komplexität + Split-Decision-Risiko (zwei
Controller, vgl. Refute #7); das ~2-min-HA-Fenster ist mit Reconcile-on-restart akzeptabel (essential-Peers
sind stateless-am-git, ihr Verlust für 2 min ist gebounded). Verworfen zugunsten Einfachheit.

**Akzeptanzkriterium (R31):** Drill — fleet-core-Host hart stoppen. Erwartung: HA restartet fleet-core auf
Survivor; **nach Restart** spawnt spawnerd die fehlenden essential-Peers exakt einmal (Reconcile-Diff,
gemessen über Broker-Registry: keine doppelten peer_id), und git-Soll-Map ist die Quelle (kein Discovery-Log).

**Offene Fragen:** Wer/was schreibt die Soll-Map (manuell vs. abgeleitet)? Granularität „essential vs
best-effort" — welche Peers werden im Failover gedroppt (Design-Doc §2-Partitionierung)?

---

## Blocker #3 — [HOCH] App-konsistente Snapshots fürs agent-master `data/`
**Owner: agent-master (Brettli).** Schraubi liefert die PVE-Repl-Constraint-Belege.

**Problem:** PVE-ZFS-Repl ist **crash-, nicht app-konsistent** (Primärquelle: keine Konsistenz-Garantie, kein
Quiescing). agent-master `data/` (JSON/SQLite, **nicht-git-getrackt**, Design-Doc §3) hängt allein an der
1-min-Repl ⇒ beim Failover-Restart drohen SQLite-WAL-Recovery / halb-geschriebenes JSON = **korrupt**
(schlimmer als „1 min verloren": blockiert evtl. Hub-Start / Fehlrouting). Die Design-Aussage „Verlust
unkritisch (State in git)" gilt NUR für git-getrackten State. Beleg: R22-Refute #3.

**Design-Position (gewählt): app-seitige Konsistenz erzwingen (nicht auf Plattform verlassen).**
- **SQLite:** entweder pre-snapshot-Hook `PRAGMA wal_checkpoint(TRUNCATE)` ODER Umstellung auf periodischen
  `.backup`/Backup-API-Dump in ein atomar-rename'tes File, das repliziert wird.
- **JSON:** `write-tmp + atomic-rename` erzwingen (schützt auch ohne Failover gegen jeden ungünstig getimten
  Crash — generelle Härtung, kein reiner T-0204-Fix).
- **Idempotente Spawn-/Lifecycle-Befehle** (Spawn-ID), damit ein nach Failover verlorener/doppelt gelesener
  Befehl nicht zu Geister-/Doppel-Peers führt (koppelt an #1/#2).

**Verworfene Alternativen:** *Auf ZFS-Atomarität vertrauen* — ZFS ist pro-Dataset atomar (gut), aber das löst
WAL-Recovery/halbe-JSON NICHT (App-Ebene) — verworfen. *agent-master `data/` nach git/Forgejo persistieren
statt ZFS-Repl* — denkbar (macht es git-getrackt = „unkritisch"), aber höhere Schreibfrequenz gegen Forgejo
(vgl. Refute #6 Bottleneck) → Owner-Entscheid; Default = app-konsistente Snapshots.

**Akzeptanzkriterium (R31):** Test — Hub unter Last (aktive Ledger-/Registry-Writes), Snapshot ziehen,
fleet-core aus dem Snapshot auf Survivor starten. Erwartung: Hub startet sauber (kein Korruptions-Abbruch),
SQLite `PRAGMA integrity_check` = `ok`, kein leeres/halbes JSON in `data/`. Gemessen, nicht „sieht ok".

**Offene Fragen:** Welche Files in `data/` sind kritisch (Registry/Ledger/llm-access)? Schreibt agent-master
JSON heute schon atomar (tmp+rename) oder direkt?

---

## Blocker #4 — [HOCH] Repl-Health-Monitoring VOR Cutover (Reihenfolge-Korrektur)
**Owner: Kuma (orchestrator-monitoring).** Schraubi liefert die Anforderung + den 102-0-Beleg.

**Problem:** Das ganze ZFS-Repl-Failover-Versprechen ist eine **ungeprüfte Annahme**, solange Repl-Health
nicht überwacht wird. Empirie + Primärquelle: failed jobs nur 30-min-retry, **KEIN Alerting**; Bestands-Job
**102-0 seit 19.05. tot (FailCount 1158), fiel niemandem auf**. Das Playbook hat das Monitoring als VERIFY-
Schritt 8 = NACH Cutover — **falsche Reihenfolge**. Beleg: R22-Refute #4 + Playbook:96-97.

**Design-Position (gewählt): Repl-Monitoring ist ein PRE-Cutover-Gate, kein Post-Build-Verify.**
- **Kuma-Check** auf den fleet-core-Repl-Job: `pvesr status` → **FailCount == 0** UND **Snapshot-Alter < N**
  (z.B. 3 min bei 1-min-Schedule) — via Push-Heartbeat oder API-Probe.
- **Alert-Test ist Teil des Gates:** einen Repl-Fail **bewusst herbeiführen** und messen, dass er **innerhalb
  Minuten alarmiert** (Test des Alerts selbst, nicht nur des Jobs) — sonst wiederholt sich 102-0.
- **Bestehenden 102-0 vorher fixen/löschen** — ein bekannt-kaputter Repl-Job im selben Cluster beweist, dass
  die Betriebsdisziplin fürs neue Modell noch nicht steht.

**Verworfene Alternativen:** *Monitoring nach Cutover (Ist-Playbook)* — verworfen, lässt die Failover-Garantie
ungeprüft scharfschalten. *Nur auf `pvesr`-Auto-Retry vertrauen* — die Primärquelle zeigt, dass das lautlos
ist; verworfen.

**Akzeptanzkriterium (R31):** Kuma zeigt den fleet-core-Repl-Job grün (FailCount 0, Snapshot-Alter < N); ein
absichtlich gebrochener Repl-Job triggert in Kuma **innerhalb < 5 min** einen sichtbaren Alert; 102-0 ist
grün ODER entfernt. Erst dann ist Gate #4 offen.

---

## Cross-Component-Koordinationsplan
| Blocker | Owner | Schraubi-Beitrag | Status |
|---|---|---|---|
| #1 Fencing/Lease | Broker + spawnerd | Cluster-API-STONITH-Mechanik (`pct stop`), Drill-Design | Spec → Owner-Review offen |
| #2 spawnerd-Reconcile | spawnerd/orchestrator | git-Soll-Map-Schema, Anti-Affinity-HA-Rule | Spec → Owner-Review offen |
| #3 app-konsist. Snapshots | agent-master/Brettli | PVE-Repl-Constraint-Beleg (Merkel) | Spec → Owner-Review offen |
| #4 Repl-Monitoring | Kuma | Anforderung + 102-0-Beleg + Gate-Definition | Spec → Owner-Review offen |

**Vorgehen:** (1) ✅ **echter cross-lab Codex-Refute DURCHGEFÜHRT** (2026-06-13, gpt-5-codex via
`/usr/bin/codex exec` — der bisherige Refute war same-model; codex IST in diesem Harness verfügbar, die
v1-Annahme „kein codex-worker" war falsch). 12 Findings → Amendments A1–A11 unten; Roh-Evidenz
`T0204-HARDENING-SPEC-CODEX-REFUTE.md`. **R22-Gate „cross-lab Refute" damit geschlossen.** (2) Spec **+
Amendments** den 4 Ownern zur Review schicken (nicht-blockierend; über Hub koordiniert, kein 4am-Fanout).
(3) Konsens je Blocker → Implementierung beim Owner. (4) Erst wenn #1–#4 grün + Schnüffi (LAN-Bind) + Netzi
(nftables) → Cutover-Drill (Design-Doc §8).

**Leitplanke:** Nichts hiervon ist live ausgeführt; jeder Owner implementiert seinen Teil in seinem Repo.
Schraubi baut die infra-/cluster-Seite (HA-Affinity, `pct`-STONITH-Caller-Verdrahtung, Repl-Job + Kuma-Probe)
erst nach Owner-Konsens + den restlichen Gates.

---

## Cross-Lab Codex-Refute (gpt-5-codex, 2026-06-13) — Findings + Spec-Amendments
**Echter cross-lab Refute** via `/usr/bin/codex exec` (codex-cli 0.139, gpt-5-codex) auf den **literalen
Spec-Volltext** (v2-Lauf; ein v1-Lauf refutierte wegen Sandbox-Read-Fail nur gegen die Prosa-Beschreibung —
beide Läufe konvergierten auf dieselbe schwerwiegendste Schwachstelle). **Damit ist das R22-Gate „echter
cross-lab Codex-Refute" geschlossen** (der frühere war same-model = Claude general-purpose). Refute-Modus
(nicht bestätigend): 12 Findings. Roh-Evidenz: `T0204-HARDENING-SPEC-CODEX-REFUTE.md`.

### 🔴 Schwerwiegendste Schwachstelle (Codex-Konsens beider Läufe) — spec-defining
`pct stop` + Broker-Epoch schützen NUR **Broker-geroutete Frames**, NICHT externe **Seiteneffekte**. Kann die
alte Node nicht beweisbar gekillt/isoliert werden, schreibt sie weiter git + Singleton-Kanäle (WA-/Telegram-
Provider-Session, Direkt-Egress), WÄHREND der Ersatz startet → genau der Doppel-Owner, den #1 verhindern soll.
**Die Kern-Sicherheits-Eigenschaft ist also NICHT bewiesen** → Amendments A1+A2+A3 sind Pflicht, bevor #1
review-fertig ist.

### Amendments (ändern die Design-Positionen — Owner-Review)
**A1 — #1: `pct stop` ist KEIN Fence (fail-CLOSED-Semantik).** Management-Aktion (kann hängen/scheitern/stale-
View), kein Power-Fence. „bestätigter Stop" muss definiert werden (aus wessen Sicht; was bei NICHT-erlangbarer
Bestätigung). **Regel fail-closed:** KEIN respawn UND KEIN Singleton-Start ohne positiven Fence-Beweis (HA-
Watchdog-Self-Fence / IPMI/PDU-Power-Fence / Node hat self-gefenced). Timeout → fail-closed, nie fail-open.
Ersetzt das implizite „command issued = alter Owner tot".

**A2 — #1: Singletons brauchen EIGENE Fence-Lease, nicht nur Broker-Epoch.** Die Epoch droppt nur Frames —
hindert den alten Prozess NICHT, WA/Telegram/git direkt zu bedienen. Akzeptanz (3) „genau 1 Zustellung" ist
behauptet, nicht garantiert. **Singleton-Adapter starten nach Failover DISABLED** und aktivieren erst nach
Fence-Bestätigung + Provider-Session-Check (eigene Leader-Lease mit durable CAS ODER Egress-/Credential-Entzug
des alten Peers). Fehlende Verteidigungslinie AUF Adapter-Ebene — der eigentliche Hebel.

**A3 — #1: Epoch braucht monotonen, durable Store über Broker-Failover (Eskalation der offenen Frage).**
Failover aus STALE ZFS-Replik → Epoch-Rollback → alte Epoch wieder akzeptiert/wiederverwendet. Die offene
Frage „wo lebt der Epoch-Zähler" ist KEINE Nebensache, sondern zentral für Split-Brain-Schutz. **Anforderung:**
quorum-backed / git-CAS (strict, fast-forward-only) / synchron-durable SQLite auf nicht-rollback-Storage /
externer Consensus. Monotonie über Hub/Broker-Failover + Replik-Rollback definieren. (koppelt an #3-Durability.)

**A4 — #3: `wal_checkpoint(TRUNCATE)` friert Writer NICHT ein.** Checkpoint drained WAL zum Zeitpunkt t; Writes
laufen zwischen t und dem ZFS-Snapshot weiter → kein kohärenter App-Schnitt. **Echtes Quiesce-Protokoll:**
read-only/quiesce → flush SQLite+JSON → fsync Files+Dirs → Snapshot → resume. ODER: Failover restored aus dem
atomar-rename'ten `.backup`-**ARTEFAKT**, NICHT aus live `data/` (die Spec muss das explizit festlegen).

**A5 — #3: Multi-File-Kohärenz (SQLite vs JSON vs Lifecycle-Cmd-Files).** Atomic-rename pro Datei ≠
Transaktionsgrenze über Dateien (Registry-Epoch 42 in SQLite, Ledger 41 in JSON). **Manifest/Generation-
Marker:** jede Snapshot/Backup trägt eine Generation-ID; Hub-Start lehnt mixed-generation-State ab / repariert.
„Kein korruptes JSON" < „semantisch kohärent".

**A6 — #3: atomic-rename JSON braucht fsync-Disziplin.** tmp schreiben → fsync(tmp) → rename → fsync(dir) → bei
Read validieren + Vorgänger-Generation als Fallback. Sonst nach crash-konsistentem Failover: File fehlt/alt/0-Byte.

**A7 — #4: Repl-Monitoring misst Job-Frische, NICHT Recoverability.** FailCount==0 + Snapshot-Alter beweisen
NICHT: Replik bootet, Hub-DB öffnet, Platzierung passt, Singletons nicht doppelt. **Recoverability-Gate dazu:**
periodischer automatisierter Restore-Drill auf der echten Target-Klasse (Replik booten, integrity_check,
Broker/Peer-Reconcile-Check, Singleton-Exklusivitäts-Check) + Alert auf veralteten/fehlenden Restore-Test. (Das
Restore-Booten steckt aktuell in #3-Akzeptanz als Einmal-Test → als wiederkehrendes #4-Gate hochziehen.)

**A8 — #2: spawnerd-Spawn-Claim braucht Runtime-Lock + CAS — git-Soll-Map ist KEINE Laufzeit-Sperre.**
Idempotenter Reconcile ist nur so stark wie die Atomarität des Spawn-Claims; Broker-Registry ist während
Partition/Broker-Failover unzuverlässig. **Controller-Lease (gefenced) + durable Owner-Epoch + per-`peer_id`
CAS-Claim:** claim → spawn → register → confirm → release/repair. (verträgt sich mit der Hot-Standby-Ablehnung
— kein zweiter stehender Controller, aber der EINE Claim muss transaktional sein.)

**A9 — Cross-cutting: pz2 (git-only) = harte Platzierungs-Ausschlüsse.** Hub/Broker/fleet-core (lokales
`data/`) dürfen NIE auf pz2 starten (kein ZFS → kommt nur mit git-State hoch, ohne Hub-local-State/Epoch-
History/Singleton-Ownership). **Als Proxmox-HA-Group/Constraint HART kodieren**, nicht nur Prosa. Für git-only-
Nodes definieren, welche Peers erlaubt sind + welchen State sie rekonstruieren.

**A10 — Cross-cutting: git-Konflikt-Policy.** Zwei Peers pushen dasselbe Repo während Partition → divergente
Commits/Force-Push-Risiko, auch wenn Broker später Frames droppt. **Per-Repo/Branch-Ownership-Lease, protected
branches, kein Agent-Force-Push, deterministische Konflikt-Reconciliation nach Failover.**

**A11 — Sequencing + Akzeptanz-Fault-Matrix.** #4-zuerst nur teils richtig: frische Repliken sind für manche
Drills nötig, verifizieren aber NICHT Fencing/Epoch/Quiesce/semantische Recovery. **Gate layern:** Repl-Health
→ Restore-Drill → App-Konsistenz-Drill → Fencing-Drill → Singleton-Drill. Akzeptanz #1 darf nicht an EINEM
iptables-Drop hängen → **Fault-Matrix:** asymmetrische Partition, Corosync-Verlust, Mgmt-API-Verlust, Node-
Hang, LXC-stop-Hang, stale-Replik-Promotion, Internet-only-Isolation.

### Bewertung (Schraubi)
Der Refute **bestätigt die 4-Blocker-Struktur**, verschärft aber die Sicherheits-Anforderung erheblich: Spec-v1
behandelte Epoch+STONITH als ausreichend; Codex zeigt, beide decken nur Broker-Frames + Happy-Path. **Der
eigentliche Fix ist nicht „besser fencen", sondern (A2) Singleton-Adapter fail-closed + (A1) echte Fence-
Semantik mit fail-closed-Timeout + (A3) durable monotone Epoch.** Das verschiebt Arbeit von „spawn-ordering" zu
„Adapter-/Lease-Design" (Owner Broker+spawnerd). **Kein Dissens, der den Cutover-Plan umwirft — aber #1 ist
NICHT review-fertig ohne A1–A3, #3 nicht ohne A4.** → Owner-Koordination mit diesen Amendments (über Hub).
