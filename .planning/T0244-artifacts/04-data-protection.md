# T-0244 Artefakt 04 — Daten-Schutz: vzdump-Policy, Pseudonym-Map-Datenvertrag, Vault-Scoping (H3/H6/M2)

**Owner:** Schraubi (`vm-deployment-gui`) · Pseudonym-Map/Vault co-concern **Schnüffi** · **Substrat-Continuity** baut Tüftli darauf.
**Schließt:** H3 (vzdump/LUKS-Hebel), H6 (Pseudonym-Map = hochkritische PII, Datenvertrag), M2 (Fleet-Vault-Scoping).

---

## H3 — vzdump/Backup hebelt LUKS-at-rest + Pseudonym-Map aus

**Befund:** Cluster-vzdump/PBS sichert RAM/Disk-State auf geteiltem PBS → LUKS-at-rest (nur gegen Disk-Diebstahl) ist ausgehebelt; ein Backup enthält die entschlüsselten Daten + ggf. die Pseudonym-Map im Klartext, auf geteiltem Storage außerhalb der Zone.

### Policy (Default — HART)
1. **Zone-VM aus Cluster-vzdump/PBS HART ausschließen.**
   - Proxmox: VMID der Zone NICHT in einem Backup-Job; zusätzlich `Backup: no` im VM-Optionen-Flag (`qm set <vmid> --protection 0` + Job-Exclude, belt+suspenders).
   - Verify: `pvesh get /cluster/backup` → Zone-VMID in KEINEM Job; `grep -L <vmid>` über alle `vzdump`-Job-Configs.
2. **Falls Backup gewünscht (GO-LIVE-Entscheid Christin/Bizzi):** NUR **zone-eigenes, app-konsistentes, client-seitig verschlüsseltes** Backup —
   - DB-Dump (SQLite-Ledger) + definierter State → `age`/`gpg`-verschlüsselt mit einem **zone-eigenen Key**, der NICHT auf dem geteilten PBS/Cluster liegt.
   - Ziel-Storage getrennt (eigenes Dataset, eigener Key), NICHT der Fleet-PBS-Datastore mit Fleet-weitem Restore-Recht.
   - **Pseudonym-Map ist NIE im selben Backup-Artefakt wie die Nutzdaten** (siehe H6).
3. **Snapshot-Caveat:** Live-Snapshot (RAM-State) der laufenden VM = entschlüsselte Daten im Snapshot. → Zone-VM-Snapshots deaktivieren/ausschließen; falls je nötig, nur im heruntergefahrenen Zustand (cold), getrennt verschlüsselt.

**Backup-Reboot-Resilienz (Fleet-Policy):** Da die Zone aus dem stop-mode-vzdump RAUS ist, betrifft sie der Backup-Reboot nicht direkt — ABER alle Zone-systemd-Units MÜSSEN `enabled` sein (`WantedBy=multi-user.target`), damit nach einem Host-Reboot (anderer Grund) die Enforcement-Kette (netns→nft→Broker→Seats→selftest→spawner) sauber + fail-closed wieder hochkommt. (Artefakt 01 §6 setzt das.)

---

## H6 — Pseudonym-Map-Datenvertrag (hochkritische PII, Schicht-A-Primärgarantie)

**Kontext:** Schicht-A-Pseudonymisierung (PII gelangt gar nicht erst in die VM/zu den Seats) ist die PRIMÄRgarantie (Verdikt B3). Die **Pseudonym-Map** (Token ↔ echte PII) ist damit das WERTVOLLSTE Geheimnis des Systems — wer sie hat, re-identifiziert alles. Sie ist KEIN normales Substrat-Datum.

### Datenvertrag (verbindlich)
| Eigenschaft | Regel |
|---|---|
| **Speicherort** | Eigener Store, **getrennt** vom SQLite-Arbeits-Ledger (§Substrat). NICHT in derselben DB/Datei wie die Nutzdaten. |
| **Verschlüsselung** | **Envelope-Encryption:** Daten-Key (DEK) verschlüsselt die Map; DEK selbst verschlüsselt von einem Key-Encryption-Key (KEK). KEK NICHT auf der Zone-Disk im Klartext — TPM-sealed ODER operator-unlock beim Boot (wie der LUKS-Root-Key, Build-Plan §1). |
| **Zugriff** | NUR der/die Prozess(e), die de-/re-pseudonymisieren (Ingest-Gateway / ein dedizierter `zmap`-Dienst, eigener UID). **Seats haben KEINEN Zugriff** — die Map ist NICHT in den Seat-netns/FS gemountet (`zone-seat@.service` `ReadWritePaths` enthält sie NICHT; `ProtectSystem=strict`). |
| **Logging** | **KEINE** Klartext-PII und KEINE Map-Einträge in irgendein Log (Zone-Audit, journald, Broker-Log). Audit referenziert nur Tokens. |
| **Backup** | **NIE zusammen mit den Nutzdaten** gebackupt (H3). Falls Map-Backup nötig: eigenes Artefakt, eigener Key, eigener Aufbewahrungsort; Key getrennt vom Map-Backup. |
| **Löschung (Art. 17)** | Map-Eintrag löschen ⇒ Token wird dauerhaft nicht-re-identifizierbar (Krypto-Schreddern: DEK rotieren/löschen). Löschkonzept dokumentpflichtig für Bizzi-DSFA. |
| **In-Memory** | Re-Identifikation nur transient; kein Dauer-Cache der entschlüsselten Map; Prozess `MemoryDenyWriteExecute` wo möglich, kein Swap (`/proc/sys/vm/swappiness=0` + Swap aus auf der Zone-VM, sonst landet PII im Swap). |

### Abgrenzung zu Schnüffi
- **Ingest-seitige Pseudonymisierung + Anhang-OCR/Tokenisierung VOR dem Seat (H4)** = Schnüffi (`T-0244-gate-artifacts-spec.md`).
- **WO/WIE die Map liegt + Krypto-Hülle + Backup-Trennung + FS-Nichterreichbarkeit aus Seats** = ich (dieses Artefakt). Sync: Schnüffis Ingest-Dienst ist der einzige Map-Leser/Schreiber; ich liefere den Store + ACL + Krypto.

### ttyd/mTLS-Querverweis (H6-Teil)
Der interaktive Seat (ttyd) MUSS mTLS-Client-Cert (hw-gebunden, short-TTL), zone-ingress-only, Session-Audit nicht-abschaltbar (Build-Plan §5). Auth-Härtung = Schnüffi; die netns-Einbettung (ttyd im seatI-netns OHNE direkten Egress, nur Broker-veth) = Artefakt 01 (`seatI` 10.99.0.20).

---

## M2 — Fleet-Vault-Scoping (revidierter Scope: GLEICHER Fleet-1Password)

**Befund:** Der geteilte Fleet-Vault macht das Team-Credential potenziell fleet-weit ziehbar — Widerspruch zur Zonen-Isolation.
**Constraint (revidiert):** Christin hat den GLEICHEN Fleet-1Password vorgegeben (kein separater Zone-Store), weil er keine Kunden-Zugangsdaten verwaltet — nur das Claude-Team-API-Credential muss rein.

### Scoping (Minimal-Exposure trotz geteiltem Vault)
1. **Eigenes Vault-Item** `zone-t0244-claude-team` — NICHT in einem Sammel-Item mit Fleet-Credentials.
2. **ACL/Zugriff:** NUR der LLM-Broker-Service-Account (op-connect-Token mit Vault-Item-Scope auf genau dieses Item) darf es lesen. Kein Seat, kein Fleet-Agent-Default-Token.
3. **Bezug zur Laufzeit:** Der LLM-Broker (uid 8001) zieht das Credential beim Start aus op-connect über das gescopte Token; es liegt NICHT im Klartext auf der Zone-Disk/im Image. Token selbst envelope-/TPM-geschützt wie der KEK.
4. **Audit + Rotation:** jeder Zugriff aufs Item auditiert (1Password-Audit); Credential rotierbar ohne VM-Rebuild (Broker liest beim (Re-)Start neu).
5. **Restbefund für Bizzi-DSFA:** „geteilter Vault" = dokumentierter Residual-Pfad (wer Fleet-Vault-Admin ist, kann theoretisch zugreifen) → in der DSFA als bewusst akzeptiertes Restrisiko mit der ACL-Minimierung als Kontrolle.

---

## Substrat-Datenvertrag (mein Kern — Koordinator/SQLite-Ledger, Epoch-Fencing)

Für Tüftlis Continuity-Logik liefere ich den Unterbau-Vertrag (Build-Plan §4):
- **SQLite-Ledger (WAL-Mode)**, zone-intern, auf der LUKS-Disk. Hält Seat-Rotation-State: `claim/lease/epoch` pro Seat.
- **Epoch-Fencing:** jeder Seat-Claim trägt eine monoton steigende `epoch`. Ein zurückkehrender erschöpfter Seat mit veralteter `epoch` wird beim Schreiben abgewiesen (`WHERE epoch = :current` schlägt fehl → kein Split-Brain-Write). = T-0214-Fix-Muster.
- **GETRENNT von der Pseudonym-Map** (H6): der Arbeits-Ledger (Rotation/Lease) enthält KEINE PII, keine Map-Einträge — nur Tokens/Seat-IDs/Epochen. Damit darf der Ledger (anders als die Map) zone-intern verschlüsselt gebackupt werden.
- **Audit-Log** zonen-lokal, getrennt von Fleet-Loki/journald (Art. 30): FW-/Egress-/Broker-/Ingress-Events, referenziert NUR Tokens.

---

## Status (R31)
SPEC. Verifizierbar beim Bau: vzdump-Exclude via `pvesh`-Query (read-only), Map-FS-Nichterreichbarkeit via `seat-negative-oracle`-Erweiterung (`ip netns exec seatN test -e <map-path>` → MUSS fehlen), Vault-Scope via op-connect-Token-Audit. Kein Live-Touch erfolgt.
