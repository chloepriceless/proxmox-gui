# Forgejo Secrets-Server — SOPS+age at-rest + Bootstrap-Credential-Modell (konsolidiert)

**Owner:** vm-deployment-gui (Schraubi). **Datum:** 2026-06-22. **Status:** DESIGN — R22-Gate-Input.
**Schließt:** die zwei load-bearing Lücken aus Schnüffis Lens (`orchestrator-security/reviews/2026-06-22-secrets-forgejo-hardening-lens.md`, commit bed6212) §1 (at-rest) + §2 (Bootstrap-Cred-Rekursion).
**Vorgänger-SSOT:** `.planning/FORGEJO-SECRETS-SERVER.md`. **Base steht:** LXC 160 `forgejo-sec` @ pz3, Web http://192.168.20.59:3000, SSH-clone `ssh://git@192.168.20.59:2222`.
**Gate-Pfad:** dieses Doc → kombinierter Codex-Refute (fresh-context Claude-Lens + Schnüffis GPT-codex-Lens) → Schnüffi-Sign-off → DANN Härtung+Deploy-Keys → Green-Light. **Default=BLOCK bis dahin. Kein Klartext-Secret landet vorher.**

---

## 0. Was dieses Modell garantiert (Akzeptanzkriterium, vor allem anderen)
Drei prüfbare Eigenschaften, gegen die das Verifikations-Oracle (§7) misst:
- **G1 (at-rest / post-acceptance — ehrlich verengt, R2/B3):** Auf der **gesamten Forgejo-LXC-Disk** — Git-Objekte (inkl. unreachable/pack/reflog), **DB, LFS-Store, Attachment-/Avatar-Store, alle ref-Typen (tags/notes/refs/*)** — liegt im **akzeptierten (post-pre-receive) Zustand ausschließlich Ciphertext** für jedes Secret. Eine vollständige Forgejo-Host-Kompromittierung (App-RCE / Admin-Cred-Diebstahl / LXC-Escape) liefert dann **kein** lesbares Secret. **Grenze (R2/B3):** git nimmt eingehende Objekte in eine **Quarantine VOR** dem pre-receive-Hook; ein **bereits** kompromittierter Host kann ein in-flight gepushtes Klartext-Objekt lesen, **auch wenn der Hook es danach ablehnt** und der Ref nie landet. G1 schützt also den **at-rest-Zustand**, nicht ein In-Flight-Fenster auf einem schon-kompromittierten Host. → ergänzt durch **Producer-Seite (§2.6): nur vertrauenswürdige Producer mit Push-Recht, kein Klartext über den Transport** + TLS (§4). *(R1: G1 umfasst Non-Git-Speicher — H1 — und alle Schreibpfade, nicht nur `repo.git`+Working-Tree.)*
- **G2 (Decryption-Key off-host) — Garantie auf Forgejo-Seite, DISZIPLIN auf Konsument-Seite (R1/M3, ehrlich abgestuft):** Kein age-Private-Key liegt jemals auf dem **Forgejo-Host** (das ist server-seitig erzwingbar, §1.7+M2). Beim **Konsumenten** passiert Decryption in-memory — das ist **Konsument-Disziplin + Audit**, NICHT server-seitig erzwungen (es gibt keinen pre-receive-analogen Enforcement-Punkt für „Konsument schreibt Klartext nach `/tmp`"). Echte Garantie nur mit attestierten/ephemeren Konsumenten (§1.5). Restrisiko, benannt, nicht beschönigt.
- **G3 (kein Bootstrap-Sprawl):** Weder der Forgejo-Auth-Credential noch der age-Private-Key eines Konsumenten liegt jemals committed / im Repo / als Klartext-Env-Var auf persistenter Disk. Die Vertrauenskette bottom-out bei operator-gehaltenen Roots — **ehrlich: es sind ZWEI** (op-connect-Root für den Live-Pfad + Offline-Recovery-Root für Break-Glass, §1.6/M1), nicht einer. Beide operator-custody, nicht verstreut.

Alles Weitere (ACL, TLS, Egress-deny, Webhooks-off) ist Defense-in-Depth — **G1–G3 tragen die Last.**

---

## 1. Teil A — SOPS+age at-rest-Modell

### 1.1 Krypto-Wahl: age (entschieden, Schnüffi-endorsed)
**SOPS mit age-Backend.** Begründung gegen die Alternativen:
| Option | Verworfen, weil |
|---|---|
| **git-crypt** | EIN symmetrischer Key (keine per-Konsument-Granularität), Smudge/Clean-Filter muss Key präsent haben → versehentliches Klartext-Commit bei fehlendem Filter. Für Multi-Agent-Store unterlegen. |
| **Vault/Transit (HashiCorp)** | Eigener HA-Dienst + Egress + Unseal-Rekursion. Massiver Overhead für einen LAN-Secrets-Git-Store. R12-Überengineering. |
| **Cloud-KMS (AWS/GCP)** | Externe Abhängigkeit + Egress vom Secrets-Host/Konsument → widerspricht Egress-default-deny + Datenresidenz. |
| **✅ SOPS+age** | per-Recipient-Encryption = **least-privilege by construction**; Struktur/Keys diffbar ohne Decrypt; CI-los sauber; Revocation via `sops updatekeys`; age-Keys sind simple X25519, keine Infra. |

### 1.2 Recipient-Modell (wer darf was entschlüsseln)
- **Pro Konsument ein age-Keypair.** Public-Key = Recipient (darf zum Verschlüsseln verwendet werden, kein Geheimnis → **committet** in `recipients/<name>.pub`). Private-Key = nur beim Konsumenten, vaulted (§2), nie auf Forgejo.
- **Jede Secret-Datei wird an genau die Recipients verschlüsselt, die sie lesen DÜRFEN.** DVhub-Secrets → DVhub-Recipient. Merkel-Vault → die autorisierten Vault-Konsumenten. Least-privilege ist damit kryptografisch erzwungen, nicht ACL-gehofft.
- **Break-Glass-Recovery-Recipient (Pflicht, jede Datei) — PER-TENANT, nicht global (R1/M1):** zusätzlich zu den Konsumenten wird jede Datei an einen **operator-gehaltenen Offline-Recovery-Key** verschlüsselt (Custody §6). Adressiert Schnüffi §3 „verlorener Key = Brick". **NICHT ein globaler Universal-Key** (der wäre ein zweiter allmächtiger Root, der die per-Recipient-least-privilege-Konstruktion über alle Tenants hinweg aushebelt — R1/M1). Stattdessen: **getrennte Recovery-Keys pro Tenant/Domäne** (DVhub-Recovery ≠ Merkel-Recovery ≠ Fleet-Recovery) → Diebstahl eines Recovery-Keys kompromittiert nur SEINEN Tenant. **Der Recovery-Key liegt NICHT in op-connect** (sonst = op-connect-Compromise entschlüsselt alles inkl. Recovery) — offline, Operator-Custody. **Empfehlung gegen Verlust+Diebstahl zugleich: m-of-n Shamir-Split** des Recovery-Privkeys über mehrere Custodians (weder ein verlorener noch ein gestohlener Share ist fatal). Medium+Custodian+Schwelle VOR Sign-off festnageln (§8).

### 1.3 Repo-Tier-Modell (die Enforcement-Frage — load-bearing)
Die kritische Frage ist nicht „verschlüsseln wir", sondern „**wie garantieren wir, dass NIE Klartext durchrutscht**". Zwei Tiers, nach Inhalt:

- **Tier A — dedizierter Secret-Repo (`default-encrypt-all`), BEVORZUGT.** Für reine Secret-Stores (Merkel-Vault, Credential-Bündel). Regel: **JEDE Datei muss ein gültiger SOPS-Envelope sein**, Ausnahme nur eine explizite Allowlist nicht-geheimer Metadaten (`README.md`, `.sops.yaml`, `recipients/*.pub`, `LICENSE`). → „Ist Klartext erlaubt?" ist **deterministisch + fail-closed**: Default nein, Allowlist ist die Ausnahme. Stärkste, einfachste Enforcement. **🔴 Format = SOPS-`--input-type binary`/dotenv (R2/B1):** ganzer Inhalt = EIN ENC-Blob unter `data`, KEINE sichtbaren Struktur-Keys → schließt die Klartext-in-Keys-Fläche (B1) by construction; strukturierte YAML/JSON-Envelopes (sichtbare Keys) nur, wo Diffbarkeit zwingend gebraucht wird (dann greift der Metadaten-Scan §1.4.2).
- **Tier B — Mixed-Repo (Path-Policy + Scan).** Für `.planning`-artige Repos (überwiegend Doku mit eingebetteten Secrets, z.B. DVhubs Auslagerung). Regel: `.sops.yaml`-Creation-Rules markieren Secret-Pfade; **PLUS** ein deterministischer Secret-Pattern/Entropy-Scan (gitleaks) über ALLE Dateien, fail-closed. Tier B trägt eine **Restschwäche** (ein Secret in einem nicht-konfigurierten Pfad in novel Format kann den Scanner umgehen) — Tier A hat sie nicht.
- **Empfehlung an Brettli/DVhub:** echte Secrets in einen Tier-A-`dvhub/secrets`-Repo splitten, aus dem (Tier-B-oder-privat) Planning-Repo referenzieren. Brettli entscheidet den Split; ich liefere beide Mechanismen.

### 1.4 LOAD-BEARING Enforcement: server-side `pre-receive`-Hook (fail-closed) — R1-gehärtet
Client-seitige SOPS-Disziplin (pre-commit-Hook) ist **notwendig, aber nicht hinreichend** — ein fehlkonfigurierter/buggy/böswilliger Client kann sie umgehen. Der pre-receive-Hook ist der **wichtigste** nicht-client-umgehbare Erzwingungspunkt — **aber NICHT der einzige Schreibpfad** (R1/B1+H1: Mirror-Pulls + Non-Git-Speicher schreiben am Hook vorbei → §1.7 schließt die mit ab). Hook + §1.7-Lockdown zusammen erzwingen G1.

**Installation:** admin-installierter Hook in `<repo>.git/hooks/pre-receive.d/` (Forgejo besitzt die Haupt-`pre-receive`, iteriert `.d/`); `[security] DISABLE_GIT_HOOKS=true` bleibt → Konsumenten können ihn NICHT anlegen/editieren/entfernen.

**Was er prüft — deterministisch + positiv-bestätigend (R32):**
1. **ref-Tripel `<old> <new> <refname>` iterieren — für ref-NAMEN-Validierung (R1/H3):** nicht nur `refs/heads/*`: explizit `refs/tags/*`, `refs/notes/*`, jeder unbekannte ref-Namespace → **default-deny REJECT**; der **Refname selbst** wird auf Secret-Pattern gescannt. **ABER die ref-Tripel sind NICHT die Quelle, WELCHE Objekte gescannt werden (R4/B2)** → Punkt 2.
2. **🔴 Scan ALLER physischen QUARANTINE-Objekte, nicht der Ref-Diffs (R4/B1+B2 + R5/B1 — Mechanismus festgenagelt):** ein Rev-Walk `<old>..<new>` / `rev-list --objects` erfasst **nicht** alle eingegangenen Objekte — ein **unreachable Klartext-Blob im gepushten Pack** + der **signed-push-cert-Blob (`GIT_PUSH_CERT`)** landen nach Accept auf Disk, würden aber von einem Ref-Diff-Scan übersehen (G1 deckt „unreachable/pack" explizit ab; §1.7-`gc` ist reaktiv, nicht präventiv). **🔴 `git cat-file --batch-all-objects` ist FALSCH (R5/B1):** es gibt laut git-Doku Repo **+ Alternates** aus → over-included den ganzen bestehenden Main-Store, beweist NICHT „physisch in Quarantine". → **Exakte physische Quarantine-OID-Menge** so bilden (kein rev-list, kein batch-all-objects):
   - **loose:** OIDs aus `$GIT_QUARANTINE_PATH/[0-9a-f][0-9a-f]/*` (Verzeichnis-Prefix + Dateiname = OID);
   - **packed:** aus `$GIT_QUARANTINE_PATH/pack/*.idx` via `git show-index` / `git verify-pack -v` die enthaltenen OIDs;
   - Vereinigung = `PHYS_OIDS`. Je OID `git cat-file -t/-p` **NUL-sicher**, scannen **nach Typ**:
   - **commit/tag-Objekt:** komplett roh (`git cat-file -p`) — Header, `tagger`, `gpgsig`/Signed-Payload, `mergetag`, `encoding`, Message, Identity MÜSSEN rein (reine Object-IDs ignorierbar). Feld-für-Feld = Whack-a-Mole (T-0244-R7/R8).
   - **🔴 TREE-Objekt (R4/B1 — fehlte):** `git ls-tree -rz` → **Datei-/Verzeichnis-Namen, Gitlink-Pfade, `.gitmodules`** auf Secret-Pattern (Tree-Namen sind eine eigene Klartext-Fläche, die der Commit/Tag-Scan NICHT erfasst). NUL-getrennt; `rev-list --objects`-Pfade nie als Autorität.
   - **blob:** Inhalt nach Tier-Regeln (SOPS-Envelope-Pflicht / gitleaks).
   - **`GIT_PUSH_CERT`-Blob** (falls signed-push) mitscannen.
   Treffer irgendwo → **REJECT.** Annotated Tags inkl. vollem Objekt = default-deny. **Tier-A-Empfehlung: SOPS-`--input-type binary`/dotenv** (ganzer Inhalt = EIN ENC-Blob, KEINE sichtbaren Keys) — eliminiert die Klartext-Key-Fläche *in* der Datei by construction; Objekt-Header + Tree-Namen bleiben über den Quarantine-Scan abgedeckt.
3. **Vollverschlüsselung statt Partial (R1/B2):** SOPS-`encrypted_regex`/`unencrypted_suffix`/`mac_only_encrypted` → strukturell gültiger Envelope kann Secret als **Klartext-Leaf** enthalten. Hook erzwingt **positiv: JEDER nicht-allowlisted Leaf-Wert MUSS `ENC[AES256_GCM,data:…,iv:…,tag:…,type:…]` sein.** Partial-Configs, die irgendeinen Leaf Klartext lassen → REJECT.
4. **Nur native age, KEINE Zusatz-Backends — `key_groups` HART REJECT (R2/B2 + R3-B2 + R4/B3):** SOPS kann **PGP/AWS-KMS/GCP-KMS/Azure-KV/hc_vault/SSH-age als ZUSÄTZLICHE Master-Keys** tragen → 2. Decrypt-Pfad, age-Liste bleibt scheinbar konform. → Hook erzwingt: `sops`-Felder `pgp`/`kms`/`gcp_kms`/`azure_kv`/`hc_vault` MÜSSEN **absent ODER leere Liste** sein (null/String/Objekt/unbekannter Typ → REJECT, kein „truthy"-Schlupfloch). **`key_groups` (kann Backends VERSCHACHTELN) für ein Secrets-Gate HART REJECT (R4/B3) — NICHT die „rekursiv-age"-Option** (die ist version-drift-fragil: ein künftiges SOPS-Feld in der Gruppe würde stillschweigend durchrutschen). Zusätzlich: **`shamir_threshold` absent oder `0`** (sonst Multi-Group-Semantik). **🔴 unbekannte Felder REKURSIV REJECT, nicht nur top-level (R5/HIGH-1):** ein neues Feld INNERHALB `sops.age[]` könnte bei laxem Unmarshal durchrutschen → **strikte rekursive Schema-Whitelist** (`KnownFields`/strict-Decode): jeder `sops.age[]`-Eintrag hat exakt `{recipient, enc}`, sonst REJECT; jedes unbekannte Feld auf jeder Ebene der `sops`-Stanza → REJECT. Nur top-level `age:` mit `age1…`. Negativtests (Zusatz-Backend top-level, `key_groups`, `shamir_threshold>0`, Fremdfeld top-level UND nested in `age[]`) ins Oracle.
5. **Strikter SOPS-Parser statt ad-hoc-YAML+regex (R2/MED-7):** der Hook nutzt **SOPS' eigenen Parse-/Metadata-Pfad** zur Envelope-Validierung (nicht handgeschnitztes YAML+grep) ODER lehnt unsupported Konstrukte hart ab: **YAML-Anchors/Merge-Keys (`<<`), duplicate Keys, top-level-Arrays, leere Dateien** → REJECT (sie können den ad-hoc-Parser täuschen, gleiche Klasse wie die systemd-Inline-`#`-Falle aus T-0244-Stufe-1).
6. **Envelope-Struktur:** Top-Level-`sops:` mit `mac`, `lastmodified`, `age:`-Recipients; binary/dotenv analog (`sops_*`-Meta + ENC[...]-Daten). Nicht parsebar → REJECT.
7. **Recipient-Containment aus OUT-OF-BAND-Policy (R1/B3 — Self-Auth geschlossen):** die erlaubte-Recipients-Menge stammt **NICHT** aus der gepushten `.sops.yaml` (= Self-Authorization), sondern aus **admin-gepflegter, konsument-nicht-beschreibbarer Quelle** `/etc/forgejo-secrets-policy/<org>/<repo>.allow` (root-only). `sops.age[].recipient` MUSS ⊆ admin-Liste sein UND der **Recovery-Recipient MUSS enthalten** sein (sonst REJECT). `.sops.yaml` wird höchstens GEGEN die admin-Policy validiert, ist nie selbst Autorität.
8. **Privkey-Detektor über ALLE Dateien (R1/M2), inkl. Allowlist:** jede Datei auf `AGE-SECRET-KEY-` (+ PEM `BEGIN OPENSSH/RSA/EC PRIVATE KEY`) → Treffer = REJECT. `recipients/*.pub` zusätzlich positiv als age-Pubkey (`age1…`) validiert.
9. **Tier-B-Zusatz:** gitleaks-Pattern/Entropy-Scan über ALLE Dateien (auch Klartext-Leaves von „SOPS"-Dateien) → Treffer = REJECT.
10. **Fail-CLOSED, ausnahmslos:** Datei/Tool/Policy-Fehler, fehlende admin-Policy, fehlender Recovery-Recipient, unbekannter ref-Typ, Zusatz-Backend, unsupported YAML → **REJECT**. Nie fail-open.

**🔴 REJECT-Message darf NIE den Klartext echoen (R2/HIGH-6):** der Hook gibt bei Ablehnung nur Datei/Ref/Regel-ID aus, **nie den getroffenen Secret-Wert** — sonst landet das Secret im Forgejo-Push-Log/journald (= genau der Non-Disk-Leak, den HIGH-6 adressiert).

**🔴 push-options sperren (R4/HIGH-2 — Log-Leak-Kanal):** `git push -o <wert>` reicht beliebige Strings in Server-Logs/Hook-Env (`GIT_PUSH_OPTION_*`). Ein Secret als push-option landet im Forgejo-/journald-Log, nie auf der Repo-Disk → vom Objekt-Scan unsichtbar. → Hook erzwingt **`GIT_PUSH_OPTION_COUNT == 0`, sonst REJECT** (ohne den Optionswert zu echoen). Auf der Secrets-Instanz gibt es keinen legitimen push-option-Use-Case.

**🔴 NON-VACUITY-Selbstcheck auf die PHYSISCHE Menge (R4/HIGH-1 + R5/B2 — korrigiert):** ein Hook, der einen **leeren** Objektsatz scannt, PASST alles vacuously durch. **Die alte Form (`git cat-file -e <new_oid>` auf die Ref-Tips) beweist die FALSCHE Eigenschaft (R5/B2):** Ref-Tips lösen via **Alternates auf Altobjekte** auf → der Anti-Vacuity-Check wäre selbst vacuous. → Korrekt: der Hook prüft fail-closed die **Mengeninvariante über die physische Quarantine-Menge** aus Punkt 2: **`$GIT_QUARANTINE_PATH` gesetzt+existent UND `count(PHYS_OIDS) > 0`** (mind. ein physisch in der Quarantine liegendes Objekt). `count==0` bei nicht-leerem Push → **REJECT** (etwas stimmt nicht mit der Enumeration; nicht „nichts zu tun → pass"). Harte Oracle-PASS-Bedingung (§7 Kriterium 7) mit **Positiv-Kontrolle gegen unabhängiges Signal**: ein injizierter unreachable-bad-blob + ein push-cert-Marker MÜSSEN in `PHYS_OIDS` auftauchen und REJECTED werden — beweist, dass die Enumeration die physische Menge wirklich erfasst (nicht den eigenen Erwartungsraum).

**🔴 Perf-DoS-Grenzen, fail-closed (R5/HIGH-2):** der Vollscan jedes Quarantine-Objekts ist teuer → ein riesiger Push könnte den Hook in einen Timeout treiben, der (je nach Default) **fail-OPEN** liefe. → **`receive.maxInputSize`** (Push-Größenlimit) + **Blob-Größen- und Objekt-Count-Limit** auf der Secrets-Instanz + **Hook-eigener Timeout, der bei Überschreitung REJECT** liefert (nie pass). Oracle-Test: oversized-Push / zu-viele-Objekte → **REJECT** (nicht Timeout-Pass).

**🔴 Hook-Integritäts-Wache (R1/B4 — der Hook überlebt `regenerate hooks`/Upgrade NICHT garantiert):** `forgejo admin regenerate hooks`, Repo-Migration oder ein Forgejo-Upgrade kann den `.d/`-Security-Hook **lautlos entfernen** → Instanz fällt **fail-OPEN**. Gegenmaßnahme: ein **externer systemd-Timer (außerhalb Forgejo)** prüft minütlich Existenz+sha256+exec-bit des Security-Hooks UND der Haupt-`pre-receive` in JEDEM Secret-Repo; bei Abweichung → Repo/Instanz **read-only schalten + alarmieren**, bis der Hook re-provisioniert ist. Upgrades nur mit Hook-Re-Provision+Verify-Schritt (Runbook).

**Bekannte Grenze (ehrlich):** der Hook beweist *Vollverschlüsselungs-Form + erlaubte Recipients + kein Privkey*, NICHT MAC-Gültigkeit (braucht Data-Key, = Decrypt-Zeit beim Konsumenten) und nicht die Korrektheit des Klartexts vor Verschlüsselung (GIGO). Er garantiert: **kein Klartext-Secret + kein Privkey + nur erlaubte Recipients landen über den Push-Pfad auf Disk.** Mirror/Non-Git-Pfade → §1.7.

### 1.5 Decryption-Disziplin (G2-Konsument-Seite — DISZIPLIN, nicht server-erzwungen; R1/M3)
**Ehrlich (R1/M3):** Dies ist Konsument-Disziplin ohne pre-receive-analogen Enforcement-Punkt — dieselbe Fehlerklasse, die §1.4 client-seitig zu Recht als „umgehbar" verwirft. Nichts hindert einen Konsumenten daran, `sops -d > /tmp/secret.txt` zu schreiben. Best-effort + Audit, kein Garantie-Niveau, sofern Konsumenten nicht attestiert/ephemer sind.
- age-Privkey zur Laufzeit aus op-connect in **`SOPS_AGE_KEY` (Prozess-Env, nur RAM)**; `sops -d` → stdout/in-memory, App konsumiert. **Nie auf persistente Disk.**
- Tool braucht zwingend Key-Datei → **tmpfs** (`/run/secrets`, 0700, RAM-backed), nach Gebrauch wipe. `SOPS_AGE_KEY_FILE`→tmpfs zulässig; `SOPS_AGE_KEY`-Env Default.
- Host-Hygiene: kein Shell-History-Leak (`set +o history` um `op read`), kein Klartext in Logs.
- **Echtes Enforcement (Empfehlung, wo G2-Konsument-Garantie gefordert):** Konsumenten als **ephemere Spawn-Umgebungen ohne persistente Disk** (tmpfs-root) ODER attestiert; ein `sops`-Wrapper, der Datei-Output unterbindet. Für nicht-attestierte Konsumenten bleibt G2-Konsument-Seite ein **dokumentiertes Restrisiko** (Risiko-Register Bizzi/Schnüffi), keine erfüllte Garantie.

### 1.6 Rotation / Revocation
- **Konsument decommissionen:** `sops updatekeys` auf allen Dateien mit ihm als Recipient → re-encrypt ohne ihn. Braucht Decrypt-Zugriff → der Rotations-Operator MUSS Recipient sein → macht der **Recovery-Key-Custodian** (§6). Danach: Forgejo-Deploy-Key + op-connect-Service-Account-Token des Konsumenten revozieren.
- **Geleakten age-Key rotieren:** neues Keypair, `sops updatekeys` Recipient-Swap, op-connect-Item updaten, alter Pubkey aus `recipients/` raus.
- Rotation ist **operatives Runbook** (Schritte + WER darf = Recovery-Custodian) — kein Selbstläufer; gehört in die Härtungs-Phase als Runbook-Artefakt.

### 1.7 🔴 Non-Push-Schreibpfade abriegeln (R1/B1+H1+H2 — der Hook ist nicht der einzige Schreibpfad)
Der pre-receive-Hook feuert NUR bei `git push`/`receive-pack`. Andere Pfade schreiben Content am Hook vorbei → ohne diesen Lockdown ist G1 löchrig:
- **Mirror AUS (R1/B1):** Forgejo-Pull-Mirror holt Content per `git fetch` → **kein pre-receive**. Push-Mirror-Ziel ebenso. → `[mirror] ENABLED=false` instanzweit + pro-Repo-Verifikation (kein Repo ist Mirror). **Der Merkel-Vault-Sync ist KEIN Forgejo-Mirror** — der Curator liefert per **`git push`** (damit der Hook greift), nie per Mirror-Pull. „Mirror" terminologisch aus §3 gestrichen.
- **LFS AUS (R1/H1):** ein LFS-Push legt nur einen **Pointer** ins Git-Objekt; der echte Blob geht in den LFS-Store → Hook blind. → `[lfs] ENABLED=false` instanzweit; ein LFS-Pointer im Push = REJECT.
- **Non-Git-Content-Surfaces HART AUS — Teil von G1, nicht „später härten" (R1/H1):** Issues/PRs/Wiki/Attachments/Avatare/Packages/Web-Editor/Releases-Attachments persistieren in DB/Attachment-Store, NIE über den Hook. Auf einem reinen Secrets-Store sind sie reine Angriffsfläche → **deaktivieren** (`[repository] DISABLE_*`, `[attachment] ENABLED=false`, Packages aus, Web-Editor aus). (Schnüffi §4 listete sie als Defense-in-Depth — R1 zieht sie in G1 hoch: solange aktiv, sind sie Klartext-Landeplätze.)
- **Unreachable-Objekte / Force-Push-History (R1/H2 + R4/B2):** **Präventiv = der Quarantine-Vollscan (§1.4.2) erfasst unreachable Pack-Blobs schon VOR Accept** — sie landen gar nicht erst. `gc` ist nur der **reaktive Backstop** für bereits gelandete: nach jedem Force-Push auf Secret-Repos **`git gc --prune=now`** (Automatik+Runbook). **Ein versehentlich gelandetes Klartext-Secret gilt als kompromittiert → ROTATION, nicht nur Löschung.**
- **🔴 Repo-/Org-Erzeugung gesperrt — sonst Governance-Bypass (R2/HIGH-5 + R3-Caveat):** legt ein Konsument ein **NEUES** Repo/eine neue Org an (oder importiert/fork't/migriert eins), ist der pre-receive-Hook **dort nicht installiert** → Klartext-Push landet ungeprüft. **PRIMÄRKONTROLLE = die RECHTE verhindern es vorab** (nicht die Wache — die ist Detektion-mit-Race und käme zu spät für den 1. Push): Konsumenten dürfen **keine** Orgs/Repos **erzeugen/importieren/forken/migrieren/mirror-en/umbenennen** (Forgejo-Member-Rechte minimal: nur push auf admin-vorprovisionierte Repos; `MAX_CREATION_LIMIT=0`, Org-`Repo-Admin`-Recht entzogen). Repos werden **ausschließlich admin per Template** angelegt, wobei **Hook + admin-Policy ATOMAR installiert sind, BEVOR das Repo seinen ersten Push annehmen kann** (kein Fenster hook-los). Die **Integritäts-Wache (§1.4) ist nur der BACKSTOP:** entdeckt neue/umbenannte Repos ohne Security-Hook und schaltet sie read-only + alarmiert — fängt Konfig-Drift, ersetzt aber nicht die vorab greifende Rechte-Sperre.

---

## 2. Teil B — Bootstrap-Credential-Modell (löst die Rekursion, G3)

### 2.1 Die Rekursion, präzise
Ein Konsument braucht ZWEI Secrets, um Secrets zu nutzen:
1. **Forgejo-Auth** (um Ciphertext zu pullen), und
2. **age-Private-Key** (um zu entschlüsseln).
Beide sind selbst Secrets. Klartext im Repo/Env jedes Agenten = Sprawl nur verschoben, und der Forgejo-Token ist die Krone. Auflösung muss die Kette zu **einem** operator-gehaltenen Root verkürzen, nicht zu N.

### 2.2 Root-of-Trust: op-connect (primär) + Deploy-Zeit-Injektion (Fallback)
**Primär — 1Password op-connect Runtime-Broker (T-0206).** Die Fleet hat op-connect bereits (LXC 141). Modell:
- age-Privkeys + Forgejo-Deploy-Key-Privhälften liegen als op-Items in einem **eigenen Vault PRO Konsument** (Konsument A → Vault `forgejo-A`, B → `forgejo-B`; KEIN geteilter Vault).
- **🔴 VAULT-scoped, nicht „item-scoped" (R2/B4 — korrigiert):** die 1Password-Connect-API ist **vault-orientiert** — ein Connect-Token gewährt Zugriff auf die ihm zugewiesenen **Vaults**, nicht feingranular auf einzelne Items innerhalb eines geteilten Vaults. „Item-scoped" wäre also nicht garantiert, wenn A+B im selben Vault lägen. Darum: jeder Konsument bekommt einen **eigenen Connect-Token + eigenen Vault**, read-only; A's Token kann B's Vault **nicht** lesen (cross-Vault = 403). Konsistent mit §2.5.2. Fetch zur Laufzeit (`op read`/Connect-API) direkt in Env/tmpfs.
- **Dieser Connect-Token ist DER Bootstrap-Secret des Konsumenten.**

**Fallback — Deploy-Zeit-Injektion.** Wo op-connect nicht erreichbar/erwünscht: der Spawn-/Deploy-Prozess injiziert Deploy-Key + age-Key zur Spawn-Zeit in Env/tmpfs des Konsumenten (aus operator-gehaltener Quelle), Konsument persistiert nichts. Session-lebensdauer-gebunden.

**Verworfen:** Klartext-Key im Konsument-Repo/`.env` (= der Sprawl, den wir lösen). Cloud-KMS (Egress/externe Abhängigkeit).

### 2.3 Forgejo-Auth-Detail
- **Per-Repo read-only SSH-Deploy-Keys** für Maschinen-Konsumenten (least-privilege, einzeln revozierbar) — bevorzugt vor account-weiten PATs. (Falls PAT: Forgejo-≥1.20 scoped, per-Repo, read-only.)
- Privhälfte in op-connect; Pubhälfte als Deploy-Key am Forgejo-Repo hinterlegt (kein Geheimnis).
- **Forgejo-SSH-Host-Key (:2222) gepinnt** in committed `known_hosts` (MITM-Schutz im LAN; Host-Pubkey ist nicht geheim).
- Admin-Account = Krone (liest ALLE Repos) → 2FA, kein stehender Session, Token rotiert.

### 2.4 Wo die Kette bottom-out (ehrlich)
- op-connect-SA-Token → injiziert zur Spawn-Zeit aus **op-connect-Root** (`1password-credentials.json` + Connect-Token).
- op-connect-Root → **operator-provisioniert beim op-connect-Deploy, nie committed.** Das ist **EIN** Root-Secret in Operator-Custody — das irreduzible „Schildkröten enden beim Operator". Standard-1Password-Connect-Modell, akzeptiert.

### 2.5 🔴 Zirkularität/Verfügbarkeit (Refute-vorweggenommen, MUSS adressiert werden)
1. **op-connect = LXC 141 @ proxmox/.240 — dem T-0247-Flaky-Node** (IMC-Overload, reproduzierbare Hard-Resets, RCA offen). .240 down ⇒ kein Fetch von Deploy-/age-Keys ⇒ Konsumenten können **nicht pullen/entschlüsseln**, obwohl Forgejo (pz3) UP ist. **Cross-Link T-0247.**
   - **🔴 Mitigation (i) = VORBEDINGUNG, nicht „interim akzeptieren" (R1/H5):** op-connect VOR dem ersten echten Secret weg von .240 migrieren (stabiler Node) ODER eine **zweite unabhängige Connect-Instanz**. „Interim auf Flaky-HW betreiben" ist KEIN tragfähiger Zustand für den Live-Decrypt-Pfad. Gated auf proxmox-master-Kapazität bzw. T-0247-Fix → Operator/proxmox-master-Entscheid (§8).
   - **Mitigation (ii):** laufende Konsumenten cachen ihren Key in tmpfs für die Session → überleben transiente Ausfälle NUR solange der Prozess lebt. **Greift NICHT bei Neustart/Spawn/Reboot eines Konsumenten während .240 down** (R1/H5) — dann kein Fetch → tot. Darum reicht (ii) allein nicht, (i) ist nötig.
   - **🔴 Mitigation (iii) = Break-Glass MUSS GEÜBT sein, nicht Papier (R1/H5):** der Offline-Recovery-Pfad (§1.6/§6) wird **vor** dem ersten echten Secret **end-to-end getestet** (Recovery-Key entschlüsselt Canary von einem op-connect-UNABHÄNGIGEN Host) und als Oracle-Kriterium (§7) geführt. Ungeübter Break-Glass = in der Krise wertlos.
   - **Deadlock-Check (R1/H5):** der op-connect-Root-Injektionspfad (wer hält `1password-credentials.json`+Connect-Token, woher beim allerersten Bootstrap) MUSS **Forgejo- UND op-connect-unabhängig** sein — der op-connect-Root und der Forgejo-Admin-Token dürfen sich nicht gegenseitig gaten (sonst Zirkel: Recovery braucht ein Secret aus dem System, das gerade down ist). Explizit als zirkelfrei dokumentieren (§2.4) + im Oracle prüfen.
2. **op-connect wird zur neuen Krone:** wer op-connect kompromittiert, fetcht alle dort gehaltenen age-Privkeys → entschlüsselt alles, was die abdecken. **Ehrliche Restkonzentration** (= der zweite Root neben Recovery, G3 ist NICHT „ein Root"). Mitigation: **per-Konsument eigener Vault + eigener Connect-Token (Vault-Scoping, R2/B4)** — A's Token kann B's Vault nicht lesen (cross-Vault = 403); die Connect-API ist vault-orientiert, also ist Vault-Trennung das erzwingbare Granular, NICHT Item-Scoping in einem geteilten Vault. Oracle §7.4 testet „A liest B's Vault = 403". op-connect gehärtet + Audit. **Strikt besser als Klartext-Env-Sprawl**, aber die Konzentration gehört in Bizzis/Schnüffis Risiko-Register.

### 2.6 Producer-Seite (R2/B3 — In-Flight-Klartext schließen)
G1 schützt at-rest (§0/B3), nicht ein In-Flight-Quarantine-Fenster auf einem schon-kompromittierten Host. Ergänzend producer-seitig:
- **Nur vertrauenswürdige Producer mit Push-Recht** (per-Repo Deploy-Key write, §2.3) — kein anonymer/breiter Push.
- **Kein Klartext über den Transport:** Producer verschlüsselt SOPS **vor** dem Push (lokal), pusht nur Ciphertext; selbst das In-Flight-Quarantine-Objekt ist dann Ciphertext. + **TLS** (§4) gegen LAN-Sniffing des Push-Streams.
- Damit ist auch das In-Flight-Fenster ciphertext-only, solange der Producer diszipliniert verschlüsselt (= dieselbe Producer-Disziplin-Klasse wie G2-Konsument-Seite, ehrlich benannt; der Hook ist die fail-closed-Netz dahinter, das un-verschlüsselten Push ablehnt).

---

## 3. Vault-Sync (merkel-curator, Schnüffi §3-d)
- merkel-curator **verschlüsselt den Vault mit SOPS/age (Recipients = Pubkeys der autorisierten Konsumenten + per-Tenant-Recovery) VOR dem git-push** in den `merkel-vault/*`-Repo (Tier A, default-encrypt-all). **Liefert per `git push` — NICHT als Forgejo-Mirror-Pull (R1/B1), damit der pre-receive-Hook greift.** Forgejo empfängt nur Ciphertext; **Klartext-Vault landet NIE auf Forgejo-Disk.**
- Curator hält Klartext (er ist Source-of-Truth) + die age-**Public**-Keys → braucht **keinen** Private-Key (Public-Key-Crypto = encrypt-only). Konsumenten halten ihren Privkey off-Forgejo (§2).
- Schwächste Stelle hier: Recipient-Key-Management-Disziplin (§1.6) + der Curator→Forgejo-Push-Credential (= ein per-Repo Deploy-Key write auf `merkel-vault/*`, §2.3).

---

## 4. Härtung (folgt nach Sign-off, mit aufgenommen für Vollständigkeit)
Aus Schnüffi §3+§4 — Defense-in-Depth, NACH G1–G3:
- **TLS auch im LAN** für Web/API (:3000) — Token/Ciphertext-Pulls sonst sniffbar; interne CA oder Caddy-Reverse-Proxy. (SSH :2222 ist schon verschlüsselt.)
- **LXC-Egress default-deny** (nur PBS + NTP/DNS; kein Exfil-Pivot).
- **Webhooks AUS** (SSRF/Exfil), unused Features aus (Package-Reg/Web-Editor/Issues/Wiki/OAuth).
- **Audit append-only** weggeshippt (wer pullte welches Repo wann); Logs secret-frei (Webhooks-aus hilft).
- **CVE-Watch:** Schnüffi nimmt die Secrets-Forgejo in ihren Scan auf (Version gepinnt+gepatcht).
- **Statische IP** (Netzi) statt DHCP (.59) — clone-URL-Stabilität über Backup-Reboots.

---

## 5. Alternativen-Register (DELIBERATE — verworfene Optionen + Grund)
| Entscheidung | Gewählt | Verworfen + Grund |
|---|---|---|
| Krypto | SOPS+age | git-crypt (kein per-Recipient), Vault (Overhead), Cloud-KMS (Egress) |
| Enforcement | server pre-receive fail-closed | nur client pre-commit (umgehbar), Forgejo-Actions (auf Secrets-Host AUS) |
| Repo-Tier | A default-encrypt-all bevorzugt, B für mixed | nur Path-Policy ohne Scan (fail-open auf unkonfig. Pfade) |
| Bootstrap-Root | op-connect primär + Deploy-Injektion-Fallback | Klartext-Env (Sprawl), Cloud-KMS (Egress) |
| Recovery-Key | offline Operator-Custody | in op-connect (Compromise = alles), kein Recovery (Brick-Risiko) |
| Auth | per-Repo SSH-Deploy-Key read-only | account-weiter PAT (zu breit) |

---

## 6. Schlüssel-Custody (Übersicht — wer hält was)
| Key | Wer hält | Wo | Geheim? |
|---|---|---|---|
| Konsument age-**Privkey** | nur Konsument | op-connect-Item → Laufzeit-Env/tmpfs | ja, off-Forgejo |
| Konsument age-**Pubkey** | alle | committed `recipients/<name>.pub` | nein |
| Forgejo Deploy-Key Privhälfte | nur Konsument | op-connect → Laufzeit | ja, off-Forgejo |
| **Recovery age-Privkey** | Operator | **offline** (HW-Token/Offline-Medium), NICHT op-connect | ja, höchste Stufe |
| op-connect-SA-Token | Konsument-Prozess | Spawn-Zeit-Injektion, Session-Env | ja, bootstrap |
| op-connect-Root | Operator | op-connect-Deploy-Provisionierung | ja, irreduzibler Root |
| Forgejo-Admin-Token | Operator | `/root/.forgejo160-admin-token` (pz3, 600) | ja, Krone — 2FA, no standing session |

---

## 7. Verifikations-Oracle (PROOF des Gates VOR dem ersten echten Secret) — R1-gehärtet
End-to-End-Dry-Run auf einem **Canary** (Fake-Secret mit eindeutigem Marker), bevor irgendein echtes Secret landet. **Kern (R1/H4): gegen ein UNABHÄNGIGES Vollplatten-Signal messen, nicht nur dort suchen, wo Ciphertext erwartet wird** (sonst false-PASS = Selbstbestätigung). Erfolgskriterien als Zahlen/Artefakte:

1. **G1-at-rest (Vollplatten-Signal — R1/H4 + R2/HIGH-6, jetzt ALLE Oberflächen):** Canary an A-Recipient + per-Tenant-Recovery verschlüsseln, pushen. `grep`/`zgrep` auf den Fake-Marker über **alles**, wo Klartext landen könnte — Treffer-Zahl **== 0**:
   - `/var/lib/forgejo` komplett (Git-Repos, **DB-Datei**, LFS-Store, Attachment-/Avatar-Store);
   - `git cat-file --batch-all-objects | grep` (**unreachable** Objekte);
   - **SQLite-WAL/-SHM** (`*-wal`/`*-shm` — committed-aber-noch-nicht-gemergt);
   - **journald** (`journalctl | grep`, inkl. komprimierter Rotates) — fängt einen Hook-REJECT, der den Klartext echote (→ §1.4-REJECT-echo-Verbot);
   - **Swap** (`swapoff -a` für den Test bzw. kein fstab-Swap auf der Secrets-LXC) + **coredumps** (`coredumpctl`);
   - **`/tmp`,`/run`,deleted-but-open** (`lsof +L1`). **Process-Memory (R3-Caveat, ehrlich):** `/proc/<pid>/maps` ist eine **Mapping-Heuristik, KEIN Memory-Scan** — der Oracle-Punkt behauptet NICHT „beweist Prozessspeicher-Freiheit"; echtes RAM-Scanning wäre ein eigenes Werkzeug (gcore+grep, separat zu bewerten). Hier nur als schwaches Indiz geführt.
2. **G2-key-off-host:** clone von einem Host OHNE A's age-Key → `sops -d` **MUSS scheitern**. Auf A's Host: Key aus op-connect → Env → `sops -d` **MUSS** den Marker liefern. Disk-Check auf A: age-Key nicht persistent.
3. **Enforcement-Negativ-Matrix — JEDER muss REJECT (R1+R2):**
   - (a) Klartext-Datei in Secret-Repo → REJECT.
   - (b) SOPS an NICHT-erlaubten Recipient (admin-Policy) → REJECT (B3).
   - (c) partial-encrypted Envelope (`unencrypted_suffix`) → REJECT (R1/B2).
   - (d) self-authored `.sops.yaml` + Angreifer-Recipient → REJECT (B3).
   - (e) Tag-Message-Klartext + `refs/notes/*`-Klartext → REJECT (H3).
   - (f) LFS-Pointer / Mirror-Pull-Klartext → REJECT / Mirror deaktiviert (B1+H1).
   - (g) Privkey (`AGE-SECRET-KEY-`) in beliebiger Datei inkl. `recipients/*.pub` → REJECT (M2).
   - (h) gitleaks-Pattern in Tier-B → REJECT.
   - **(i) Secret im DATEINAMEN / Verzeichnis / Commit-Message / Author-Feld / YAML-KEY (R2/B1)** → REJECT.
   - **(j) SOPS-Envelope mit ZUSATZ-Backend** (`pgp:`/`kms:`/`gcp_kms:` neben `age:`) → REJECT (R2/B2).
   - **(k) unsupported YAML** (Anchor/Merge/duplicate-Key/top-level-Array/leere Datei) → REJECT — **mit ECHTEN Fixtures nachgewiesen** (jedes Konstrukt real abgelehnt, „verify by real consumer", R3-Caveat/MED-7), nicht nur behauptet.
   - **(l) Konsument-Versuch Repo/Org zu erzeugen/forken/importieren/mirror-en/umbenennen → schon die RECHTE verweigern es (HIGH-5 primär)**; zusätzlich Push in ein (hypothetisch) hook-loses Repo → Wache hat es read-only (Backstop).
   - **(m) Roh-Objekt-Scan (R3-B1):** Secret in annotated-tag `tagger` / `gpgsig` / `mergetag` / Commit-Header → REJECT.
   - **(n) SOPS `key_groups` mit nested Nicht-age-Backend (R3-B2)** → REJECT.
   - **(o) Secret im TREE (R4/B1):** Dateiname / Gitlink-Pfad / `.gitmodules`-Eintrag → REJECT.
   - **(p) unreachable Klartext-Blob im gepushten Pack + `GIT_PUSH_CERT`-Blob (R4/B2):** beide werden vom Quarantine-Scan erfasst → REJECT (NICHT erst reaktives `gc`).
   - **(q) `git push -o <secret>` (R4/HIGH-2):** `GIT_PUSH_OPTION_COUNT>0` → REJECT, ohne Wert-Echo (Log-Check: Wert NICHT in journald).
   - **(r) `key_groups` (top-level) / `shamir_threshold>0` / unbekanntes `sops`-Metafeld (R4/B3)** → REJECT.
   - **(s) unbekanntes Feld NESTED in `sops.age[]` (R5/HIGH-1)** → REJECT (rekursive Schema-Whitelist, nicht nur top-level).
   - **(t) oversized-Push / zu-viele-Objekte (R5/HIGH-2)** → REJECT (nicht Timeout-fail-open).
4. **G3-bootstrap + VAULT-Scoping (R2/B4 + R3-Caveat):** auf A's Host kein persistenter Klartext von age-/Deploy-Key; **A's Connect-Token kann B's VAULT weder LESEN NOCH LISTEN → 403 auf beidem** (nicht nur „Item B nicht lesbar" — auch `vaults.list`/`items.list` auf B's Vault muss scheitern).
5. **Hook-Survival (R1/B4):** nach `forgejo admin regenerate hooks` UND simuliertem Forgejo-Upgrade → Security-Hook noch aktiv (sonst Wache → read-only) → Negativ-Push danach noch REJECT. **Wiederkehrende** PASS-Bedingung.
6. **Break-Glass-Drill (R1/H5 + R2/M1):** per-Tenant-Recovery entschlüsselt Canary von einem **op-connect-unabhängigen** Host → Marker. **Bei m-of-n Shamir: die REKONSTRUKTION selbst drillen** (m Shares zusammenführen → Key → decrypt), nicht nur Single-Key — sonst ist die Schwelle ungetestet.
7. **🔴 Non-Vacuity über die PHYSISCHE Quarantine-Menge (R4/HIGH-1 + R5/B2, load-bearing):** beweisen, dass der Hook die physisch eingegangenen Objekte erfasst (nicht via Alternates die Altobjekte). PASS-Bedingung: (a) `$GIT_QUARANTINE_PATH` gesetzt+existent und **`count(PHYS_OIDS) > 0`** (physische Menge aus loose+pack, §1.4.2) bei nicht-leerem Push, sonst REJECT — **NICHT** `cat-file -e` auf Ref-Tips (die lösen via Alternates auf, = selbst vacuous); (b) **Positiv-Kontrolle gegen unabhängiges Signal:** ein injizierter **unreachable-bad-blob** (nur im Pack, von keinem Ref erreichbar) + ein **push-cert-Marker** MÜSSEN in `PHYS_OIDS` erscheinen UND REJECTED werden — beweist, dass die physische Enumeration greift; (c) `count==0`/0-Objekt-Push schmuggelt kein Secret. Pflicht VOR allen anderen Negativtests (validiert, dass die Matrix nicht vacuously grün ist).

**Sign-off-Bedingung:** alle **7 Kriterien** grün (inkl. der erweiterten **20-Punkt-Negativ-Matrix a–t** UND der physischen-Mengen-Non-Vacuity-Invariante) + Schnüffis GPT-codex-Bestätigungs-Lens findet keinen build-blockierenden Befund + Schnüffi-Sign-off + §8-Vorbedingungen erfüllt. Analog zum T-0244-Triple-Oracle-Gate.

---

## 8. Offene Operator-/Peer-Entscheidungen (NICHT autonom)
- **🔴 op-connect-Migration weg von .240 (R1/H5) = Pre-Sign-off-Vorbedingung, nicht „interim akzeptieren":** stabiler Node ODER zweite unabhängige Connect-Instanz. Kapazität → proxmox-master; Timing → Operator. Bis dahin BLOCK für den Live-Decrypt-Pfad.
- **🔴 Recovery-Key-Custody (R1/M1) = vor Sign-off festnageln:** per-Tenant getrennt + **m-of-n Shamir-Schwelle** + konkretes Medium (HW-Token/Offline) + Custodians. Operator-Entscheid.
- **DVhub Tier-A-Split:** legt Brettli echte Secrets in einen `dvhub/secrets`-Tier-A-Repo (default-encrypt-all, stärkste Enforcement), oder Mixed-Tier-B mit Scan (Restschwäche)? → Brettli/DVhub.
- **Codex-Refute-Lens:** `codex-worker` ist in diesem Harness NICHT als Subagent-Typ verfügbar → fresh-context Claude-Lens (mein Refute, R26 — §9 gefoldet) + Schnüffis echte GPT-codex-Lens (§10 gefoldet, modell-divers). Etablierter T-0244-Pattern. **Stand: R1–R5 gefoldet (Befund-Trend 12→7→2→5→4, keine Regressionen). R5 bestätigte Tree-Scan/key_groups/push-options/4 Caveats mechanisch, nagelte die physische Quarantine-OID-Menge + korrigierte Non-Vacuity fest. Sehr nah. Schnüffis R6-Bestätigungs-Lens ausstehend.**

---

## 9. Refute-Round-1 (R26 fresh-context Claude-Lens) — gefoldet (2026-06-22)
Verdikt der Lens: **NOT SECRET-LANDING-READY** → 4 BLOCKER + 5 HIGH + 3 MED, ALLE in den Body eingearbeitet (mechanisch gegen git/SOPS/Forgejo-Primärquellen verifiziert):
- **B1** Pull-Mirror umgeht pre-receive → §1.7 Mirror-AUS, Curator pusht (§3).
- **B2** SOPS-partial-encryption = gültiger Envelope mit Klartext-Leaf → §1.4 erzwingt JEDEN nicht-allowlisted Leaf = ENC[...], lehnt partielle Configs ab.
- **B3** Recipient-Containment self-authorizing (Konsument pusht `.sops.yaml`) → §1.4 Policy aus admin-out-of-band-Quelle `/etc/forgejo-secrets-policy/`, nie aus Repo.
- **B4** Hook überlebt `regenerate hooks`/Upgrade nicht → §1.4 externe Integritäts-Wache (systemd-Timer, sha256, read-only bei Abweichung).
- **H1** Non-Git-Speicher (DB/LFS/Attachments) → §1.7 LFS+Issues/Wiki/Attachments/Packages HART aus, in G1 hochgezogen.
- **H2** unreachable-Objekte/Force-Push → §1.7 `gc --prune=now` + Rotation bei Landing.
- **H3** alle ref-Typen (tags/notes/refs/*) → §1.4 iteriert alle ref-Tripel, unbekannt = REJECT.
- **H4** Oracle maß Konsistenz → §7 Vollplatten-grep + `batch-all-objects` + erweiterte Negativ-Matrix.
- **H5** op-connect Flaky-Node + ungeübter Break-Glass → §2.5 Migration=Vorbedingung, Break-Glass-Drill=Oracle-Kriterium, Deadlock-Check.
- **M1** globaler Recovery-Key = 2. allmächtiger Root → §1.6 per-Tenant + m-of-n Shamir.
- **M2** Privkey-statt-Pubkey committed → §1.4 Privkey-Detektor über ALLE Dateien inkl. Allowlist.
- **M3** G2-Konsument-Disziplin ≠ Garantie → §0+§1.5 ehrlich abgestuft (Restrisiko, nicht erfüllte Garantie).

**Saubere Achse:** Krypto-Wahl SOPS+age selbst (Primitive korrekt; Bruch lag in Enforcement + Bootstrap-Root, nicht in age).

---

## 10. Refute-Round-2 (Schnüffi GPT-codex-Lens, modell-divers) — gefoldet (2026-06-22)
Verdikt: **NOT-READY, KONVERGIERT mit R1** → R22-Default=BLOCK hält. GPT-codex fand **4 BLOCKER + 2 HIGH + 1 MED, die die R1-Claude-Lens übersah** — alle primärquellen-belegt (SOPS-Doku / git-hooks / 1Password-Connect-API). Genau der Cross-Lab-Wert (modell-diverse 2. Lens). ALLE in den Body gefoldet:
- **B1 (schärfster)** Klartext in Git-METADATEN, nicht nur Leaf-Werten (SOPS verschlüsselt nur Werte → Dateiname/Refname/Commit-Message/Author/YAML-KEY bleiben Klartext) → §1.4.2 Metadaten-Scan (Commit/Identity/Tree-Pfade/Refnames/Struktur-Keys) + §1.3 Tier-A → SOPS-`binary` (keine sichtbaren Keys).
- **B2** Zusatz-SOPS-Backends (PGP/KMS/…) umgehen den age-Containment-Check → §1.4.4 pgp/kms/gcp_kms/azure_kv/hc_vault MÜSSEN leer/abwesend = REJECT, nur native age.
- **B3** Quarantine/in-flight: schon-kompromittierter Host liest Objekte VOR pre-receive → §0 G1-Wording ehrlich auf at-rest/post-acceptance verengt + §2.6 Producer-Trust (nur Ciphertext über Transport).
- **B4** 1Password „item-scoped" nicht belegt (Connect-API ist VAULT-orientiert) → §2.2/§2.5.2 durchgängig per-Konsument eigener Vault + vault-scoped Token; §7.4 cross-Vault-403.
- **HIGH-5** Repo/Org-Erzeugung = Governance-Bypass (neues Repo ohne Hook) → §1.7 Konsumenten dürfen keine Repos/Orgs erzeugen/importieren/mirror-en; Wache schaltet neue/umbenannte Repos read-only.
- **HIGH-6** §7-Oracle zu schmal (journald/swap/proc-mem/SQLite-WAL/deleted-but-open/coredump fehlten + Hook-REJECT-echo) → §7.1 ALLE Oberflächen + §1.4 REJECT-Message echot nie Klartext.
- **MED-7** ad-hoc-YAML+regex täuschbar → §1.4.5 strikter SOPS-Parser / reject Anchors/Merge/duplicate-Keys/top-level-Arrays/leere Dateien (gleiche Klasse wie die systemd-Inline-#-Falle aus T-0244).

**Schnüffis Antworten gefoldet:** (b) Co-Gate-MECHANISMUS trägt nicht (Forgejo decrypted nie, kein Egress-Detektor), aber das META-Pattern 1:1 — positive-Allowlist-fail-closed (=pre-receive) + non-vacuous-Oracle-gegen-unabhängiges-Signal (=§7); B1/B2/MED/HIGH-6 sind genau ihre T-0244-Failure-Modes. (c) §7 als Sign-off-Gate endorsed, Negativ-Matrix auf 12 Punkte gewachsen. **H5** (op-connect weg von .240) = harte Pre-Sign-off-Vorbedingung (Verfügbarkeit IST Art-32-Sicherheit), **M1** m-of-n + **Rekonstruktion gedrillt** (§7.6).

**Saubere Achse (bestätigt, R1+R2 konvergent):** age + Gesamt-Architektur sound; der Bruch liegt durchweg in Enforcement-Vollständigkeit + Bootstrap-Scope, nicht im Primitiv.

---

## 11. Refute-Round-3 (Schnüffi GPT-codex Bestätigungs-Lens) — gefoldet (2026-06-22)
Verdikt: **NOT-READY, aber STARK konvergent** — die 7 R2-Folds halten mechanisch weitgehend; codex: **nach diesen 2 Verfeinerungen → SECRET-LANDING-READY** (vorbehaltlich grünem §7-Oracle + §8). T-0244-Endspurt-Trend. Beide + 4 Caveats gefoldet:
- **R3-B1** (B1-Verfeinerung) Metadaten-Scan war unvollständig (annotated-tag `tagger`, rohe Tag-Header, Commit-`encoding`/`gpgsig`/`mergetag`) → §1.4.2 **generisch: ganzes rohes Commit/Tag-Objekt durch den Scanner** (`git cat-file -p`), nicht Feld-für-Feld (Whack-a-Mole, T-0244-R7/R8-Lehre); annotated Tags inkl. vollem Objekt = default-deny.
- **R3-B2** (B2-Verfeinerung) SOPS `key_groups` kann Backends VERSCHACHTELN → §1.4.4 `key_groups` hart REJECT ODER rekursiv nur-age validieren; präzise leer-Semantik (nur absent/leere-Liste ok; null/String/Objekt → REJECT).
- **Caveat B4** → §7.4 A kann B's Vault weder LESEN NOCH LISTEN (403 auf beidem).
- **Caveat HIGH-5** → §1.7 Rechte = PRIMÄRKONTROLLE (verhindern vorab, atomar Hook+Policy vor 1. Push); Wache = Backstop (Detektion-mit-Race), nicht Primärkontrolle.
- **Caveat HIGH-6** → §7.1 `/proc/<pid>/maps` ehrlich als Heuristik gelabelt, KEIN Memory-Scan-Beweis.
- **Caveat MED-7** → §7.3(k) Parser-Reject mit ECHTEN Fixtures nachgewiesen (real abgelehnt = „verify by real consumer").
Negativ-Matrix jetzt 14 Punkte (a–n).

**Nächster Gate-Schritt:** Schnüffis R4-Lens auf diese R3-Fassung. Trend klar Richtung ready.

---

## 12. Refute-Round-4 (Schnüffi GPT-codex-Lens) — gefoldet (2026-06-22)
Verdikt: **NOT-READY** — die R3-Folds (Commit/Tag-Roh-Scan, key_groups) halten mechanisch; R4 trifft eine **TIEFERE Enforcement-Schicht: WELCHE Objekte der Hook scannt + ob er sie überhaupt SIEHT.** 3 BLOCKER + 2 HIGH, alle git-primärquellen-belegt, ALLE gefoldet. Befund-Trend R1:12→R2:7→R3:2→R4:5 (andere/tiefere Klasse, KEINE Regressionen):
- **R4-B1** §1.4.2 ließ **TREE-Objekte** aus → Secret im Dateinamen/Gitlink/`.gitmodules` vom Commit/Tag-Roh-Scan nicht erfasst; `rev-list --objects`-Pfade sind nur „Hints". → Scan jetzt über **TREE-Objekte (`ls-tree -rz`, NUL-sicher)**, rev-list nie als Autorität.
- **R4-B2 (schärfster)** Rev-Walk `<old>..<new>` ≠ alle eingegangenen Quarantine-Objekte → unreachable Klartext-Blob im Pack + `GIT_PUSH_CERT`-Blob landen ungescannt. → §1.4.2 enumeriert **ALLE physischen `$GIT_QUARANTINE_PATH`-Objekte** (nicht Ref-Diffs); §1.7-`gc` als reaktiver Backstop kenntlich, Quarantine-Scan = präventiv.
- **R4-B3** `key_groups` für ein Secrets-Gate **HART REJECT** (rekursiv-age ist version-drift-fragil) + `shamir_threshold` absent/0 + unbekannte `sops`-Metafelder REJECT → §1.4.4.
- **R4-HIGH-1 (load-bearing fürs Oracle)** Hook könnte einen leeren Objektsatz scannen = vacuous PASS → §1.4 Non-Vacuity-Selbstcheck (`$GIT_QUARANTINE_PATH` gesetzt + `cat-file -e <new_oid>`) + §7 Kriterium 7 (Positiv-Kontrolle: bekannt-böses Objekt MUSS REJECTED werden).
- **R4-HIGH-2** push-options (`git push -o`) = Log-Leak-Kanal → §1.4 `GIT_PUSH_OPTION_COUNT==0` sonst REJECT (ohne Wert-Echo).
Negativ-Matrix jetzt **18 Punkte (a–r)** + Non-Vacuity-Invariante. **Meine 4 R3-Caveats von Schnüffi als korrekt bestätigt.**

**Nächster Gate-Schritt:** Schnüffis R5-Bestätigungs-Lens auf diese R4-Fassung. Trend weiter Richtung ready.

---

## 13. Refute-Round-5 (Schnüffi GPT-codex-Lens) — gefoldet (2026-06-22)
Verdikt: **NOT-READY, aber sehr nah** — **Tree-Scan (R4-B1), key_groups, push-options, alle 4 R3-Caveats von Schnüffi mechanisch BESTÄTIGT.** 2 BLOCKER + 2 HIGH, ALLE auf EINEM Thema: die exakte physische Quarantine-OID-Menge festnageln (Spec-Exaktheit, wie T-0244 R8→R9). Trend R1:12→R2:7→R3:2→R4:5→R5:4. Gefoldet:
- **R5-B1** §1.4.2 nagelte den Enumerations-Mechanismus nicht fest, und `git cat-file --batch-all-objects` ist FALSCH (gibt Repo **+ Alternates** → over-included Main-Store) → **exakte physische Menge** aus loose (`$GIT_QUARANTINE_PATH/[0-9a-f][0-9a-f]/*`) + packed (`pack/*.idx` via `show-index`/`verify-pack`) = `PHYS_OIDS`, je OID `cat-file -t/-p`.
- **R5-B2 (tiefster)** Non-Vacuity-Selbstcheck `cat-file -e <new_oid>` testete die FALSCHE Eigenschaft (Ref-Tips lösen via Alternates auf Altobjekte → selbst vacuous) → §1.4 Mengeninvariante `count(PHYS_OIDS)>0` + §7-Kriterium-7 Positiv-Kontrolle (unreachable-bad-blob + push-cert-Marker MÜSSEN in `PHYS_OIDS` erscheinen + REJECTED).
- **R5-HIGH-1** unknown-field-REJECT nur top-level → ein neues Feld in `sops.age[]` rutscht durch → §1.4.4 **rekursive Schema-Whitelist** (`KnownFields`/strict, `age[]` exakt `{recipient, enc}`).
- **R5-HIGH-2 (neu)** Perf-DoS: Vollscan-Timeout könnte fail-OPEN → §1.4 `receive.maxInputSize` + Blob/Count-Limit + Hook-Timeout-fail-closed + Oracle oversized→REJECT.
Negativ-Matrix jetzt **20 Punkte (a–t)** + korrigierte physische-Mengen-Non-Vacuity-Invariante.

**Nächster Gate-Schritt:** Schnüffis R6-Bestätigungs-Lens auf diese R5-Fassung. Sehr nah (alles Spec-Exaktheit auf demselben Quarantine-Thema, keine neuen Klassen). Kein Klartext-Secret vor grünem §7-Oracle inkl. korrigierter physischer-Mengen-Invariante + Sign-off + §8.
