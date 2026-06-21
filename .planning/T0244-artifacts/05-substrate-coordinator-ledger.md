# T-0244 Artefakt 05 — Substrat: Koordinator + SQLite-Epoch-Fencing-Ledger (Build-Plan §4)

**Owner:** Schraubi (`vm-deployment-gui`) — liefert WO/WIE + Store + Fencing-Primitive. **Continuity-Policy DARAUF:** Tüftli (offline → dieses Artefakt = sein konkreter Unterbau).
**Status:** SPEC/DRAFT. Topologie-UNABHÄNGIG (unberührt von Codex-Lens-2 / Separate-Broker-VM-Fallback). Reversibel, prod-frei.
**Bezug:** Build-Plan §4/§6, Datenvertrag in `04-data-protection.md` (Ledger GETRENNT von Pseudonym-Map, enthält KEINE PII — nur Tokens/Seat-IDs/Epochen). T-0214-Fix-Muster.

---

## 0. Zweck + Abgrenzung
Der **Koordinator** ist der zone-interne, authentifizierte Eigentümer des **Seat-Rotation-State** (Claim/Lease/Epoch) — **NICHT** fleet-registriert, **kein** claude-peers-MCP/Hub-Broker. Er macht die Continuity (Tüftli) **epoch-fencing-tauglich**: ein zurückkehrender erschöpfter Seat darf mit veralteter Epoch NICHT weiterschreiben (verhindert Split-Brain bei Seat-Rotation).
- **Ich liefere:** Store (SQLite WAL) + DDL + die fencing-korrekten RPC-Primitive (claim/renew/release/fenced-write) + Access-Channel + Reboot/Backup-Resilienz.
- **Tüftli liefert:** die Continuity-POLICY darauf (wann rotiert wird, wer claimt, Erschöpfungs-Erkennung, Reattach-Logik).

## 1. SQLite-Schema (DDL) — `zone-ledger.sql`
```sql
PRAGMA journal_mode=WAL;       -- crash-sicher, ein Writer + viele Reader
PRAGMA synchronous=NORMAL;     -- WAL: NORMAL ist haltbar genug, schneller als FULL
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;

-- Feste Seat-Slots (4 autonom + 1 interaktiv)
CREATE TABLE IF NOT EXISTS seats (
  seat_id     TEXT PRIMARY KEY,            -- 'seat0'..'seat3','seatI'
  kind        TEXT NOT NULL CHECK(kind IN ('autonomous','interactive')),
  created_at  INTEGER NOT NULL
);

-- Lease pro Seat, mit monotonem Fencing-Token (epoch)
CREATE TABLE IF NOT EXISTS leases (
  seat_id     TEXT PRIMARY KEY REFERENCES seats(seat_id),
  holder      TEXT,                        -- opaker Worker-/Session-Token; NULL = frei
  epoch       INTEGER NOT NULL DEFAULT 0,  -- erhöht sich bei JEDEM erfolgreichen claim
  state       TEXT NOT NULL DEFAULT 'free'
              CHECK(state IN ('free','claimed','running','draining','exhausted')),
  lease_until INTEGER,                     -- unix-ts; abgelaufen => reclaimable
  updated_at  INTEGER NOT NULL
);

-- Append-only-Audit (NUR Tokens/Epochen, KEINE PII — Datenvertrag 04)
CREATE TABLE IF NOT EXISTS rotation_audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  seat_id   TEXT NOT NULL,
  event     TEXT NOT NULL CHECK(event IN
            ('claim','renew','release','expire','fence_reject','state')),
  epoch     INTEGER NOT NULL,
  holder    TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_seat_ts ON rotation_audit(seat_id, ts);
```

## 2. Epoch-Fencing-Semantik (das Kern-Primitiv, T-0214-Fix)
Alle Mutationen laufen in EINER Transaktion (`BEGIN IMMEDIATE` → ein serialisierter Writer). Der **fencing guard** ist das `WHERE epoch=:expected`:

| Primitiv | Vorbedingung (atomar) | Effekt | Rückgabe |
|---|---|---|---|
| **claim(seat, holder)** | `state='free' OR lease_until < now` | `epoch=epoch+1`, `holder=:holder`, `state='claimed'`, `lease_until=now+TTL` | neue `epoch` E (= Fencing-Token) |
| **renew(seat, holder, E)** | `holder=:holder AND epoch=:E AND state IN('claimed','running')` | `lease_until=now+TTL` | ok / `STALE_EPOCH` |
| **release(seat, holder, E)** | `holder=:holder AND epoch=:E` | `holder=NULL`, `state='free'` | ok / `STALE_EPOCH` |
| **set_state(seat, holder, E, s)** | `holder=:holder AND epoch=:E` | `state=:s` (z.B. 'draining'/'exhausted') | ok / `STALE_EPOCH` |

**Die Invariante (T-0214-Fix):** Ein zurückkehrender erschöpfter Seat hält eine ALTE `epoch` E_alt. Hat der Koordinator den Seat bereits rotiert (neuer Claim → `epoch=E_alt+1`), schlägt JEDE seiner Schreib-Operationen am `WHERE epoch=:E_alt` fehl → `STALE_EPOCH` → Audit `fence_reject`. **Kein Split-Brain-Write.** Beispiel-Statement:
```sql
-- renew, fencing-geschützt:
UPDATE leases SET lease_until=:now+:ttl, updated_at=:now
 WHERE seat_id=:seat AND holder=:holder AND epoch=:E
   AND state IN ('claimed','running');
-- changes()==0  =>  STALE_EPOCH (Seat ist gefenced) => audit 'fence_reject'
```

## 3. Koordinator-Dienst + Access-Channel
- **Prozess:** `zone-coordinator` (eigener UID, root-ns), hält die einzige Writer-Connection (WAL). Klein, kein Netz-Egress (steht im root-nft-default-drop → kein eth0).
- **Channel = Unix-Domain-Socket** `/run/zone/coord.sock` (mode 0660, group `zone`). **Bewusst KEIN Netz** — UDS ist filesystem-, nicht netns-namespaced. Wenn Tüftlis Continuity-Policy einem Seat erlaubt, selbst zu renewen, wird der Socket per `BindReadOnlyPaths=/run/zone/coord.sock` in die jeweilige `zone-seat@.service` gemountet (kontrollierter Control-Plane-Kanal, FIXE RPC, schema-validiert, KEIN Daten-Egress). Default: nur der **Spawner** (root-ns) spricht den Koordinator; Seats gar nicht → minimalste Seat-Fläche.
- **Auth:** SO_PEERCRED (UID-Check) am Socket; jede RPC trägt `holder`+`epoch`; der Koordinator validiert das Schema (fixe Methoden, keine Freitext-SQL von außen).
- **Bezug Negativ-Oracle:** Der Koordinator-Socket ist KEIN Netzpfad → das Seat-Negativ-Oracle (Artefakt 02) bleibt unberührt (es testet Netz-Erreichbarkeit; der UDS taucht dort nicht auf — korrekt, da kein Egress).

## 4. Reboot-/Backup-Resilienz (Fleet-Policy + H3)
- **systemd:** `zone-coordinator.service` `WantedBy=multi-user.target` + `enabled` (überlebt Backup-Reboot). Startet NACH der LUKS-Disk-Unlock-Unit (Ledger liegt auf der verschlüsselten Disk), VOR dem `zone-spawner`.
- **WAL-Recovery:** WAL-Mode → unsauberer Shutdown wird beim nächsten Open automatisch recovered (kein Korruptions-Fenster). `synchronous=NORMAL` ist WAL-haltbar.
- **Backup (H3):** Der Ledger enthält KEINE PII (nur Tokens/Epochen) → darf — im Gegensatz zur Pseudonym-Map — zone-intern client-verschlüsselt gebackupt werden (`sqlite3 .backup` → `age`-verschlüsselt, zone-eigener Key, NICHT auf Fleet-PBS). Zone-VM bleibt aus Cluster-vzdump RAUS (H3).
- **Frugaler Idle:** Koordinator idlet bei 0 aktiven Leases nahe Null-Last (event-/socket-getrieben, kein Poll-Loop); kein Egress, kein Fleet-Heartbeat.

## 5. Was hier NICHT entschieden wird (Tüftli-Co-Design)
Rotations-TRIGGER, Erschöpfungs-DETEKTION, Reattach-Logik des interaktiven Seats (ttyd/tmux), Lease-TTL-Werte, Claim-Strategie (welcher freie Seat zuerst). Dieses Artefakt liefert NUR den fencing-korrekten Store + die Primitive, auf denen Tüftli das baut. → Bei Tüftli-Rückkehr: DDL + §2-Primitive gegenchecken, TTL/Policy gemeinsam fixieren.

## 6. Status (R31)
SPEC/DRAFT — verifizierbar beim Bau: `sqlite3 :memory: < zone-ledger.sql` (Schema lädt fehlerfrei) + ein Fencing-Unit-Test (claim→E; stale renew mit E-1 → changes()==0/`fence_reject`). Kein Live-Touch.
