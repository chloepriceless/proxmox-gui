# Forgejo Secrets-Server — SOPS+age at-rest + Bootstrap-Credential-Modell (konsolidiert)

**Owner:** vm-deployment-gui (Schraubi). **Datum:** 2026-06-22. **Status:** DESIGN — R22-Gate-Input.
**Schließt:** die zwei load-bearing Lücken aus Schnüffis Lens (`orchestrator-security/reviews/2026-06-22-secrets-forgejo-hardening-lens.md`, commit bed6212) §1 (at-rest) + §2 (Bootstrap-Cred-Rekursion).
**Vorgänger-SSOT:** `.planning/FORGEJO-SECRETS-SERVER.md`. **Base steht:** LXC 160 `forgejo-sec` @ pz3, Web http://192.168.20.59:3000, SSH-clone `ssh://git@192.168.20.59:2222`.
**Gate-Pfad:** dieses Doc → kombinierter Codex-Refute (fresh-context Claude-Lens + Schnüffis GPT-codex-Lens) → Schnüffi-Sign-off → DANN Härtung+Deploy-Keys → Green-Light. **Default=BLOCK bis dahin. Kein Klartext-Secret landet vorher.**

---

## 0. Was dieses Modell garantiert (Akzeptanzkriterium, vor allem anderen)
Drei prüfbare Eigenschaften, gegen die das Verifikations-Oracle (§7) misst:
- **G1 (at-rest):** Auf der **gesamten Forgejo-LXC-Disk** — Git-Objekte (inkl. unreachable/pack/reflog), **DB, LFS-Store, Attachment-/Avatar-Store, alle ref-Typen (tags/notes/refs/*)** — liegt **ausschließlich Ciphertext** für jedes Secret. Eine vollständige Forgejo-Host-Kompromittierung (App-RCE / Admin-Cred-Diebstahl / LXC-Escape) liefert **kein** lesbares Secret. *(R1: G1 umfasst jetzt explizit Non-Git-Speicher — H1 — und alle Schreibpfade, nicht nur `repo.git`+Working-Tree.)*
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

- **Tier A — dedizierter Secret-Repo (`default-encrypt-all`), BEVORZUGT.** Für reine Secret-Stores (Merkel-Vault, Credential-Bündel). Regel: **JEDE Datei muss ein gültiger SOPS-Envelope sein**, Ausnahme nur eine explizite Allowlist nicht-geheimer Metadaten (`README.md`, `.sops.yaml`, `recipients/*.pub`, `LICENSE`). → „Ist Klartext erlaubt?" ist **deterministisch + fail-closed**: Default nein, Allowlist ist die Ausnahme. Stärkste, einfachste Enforcement.
- **Tier B — Mixed-Repo (Path-Policy + Scan).** Für `.planning`-artige Repos (überwiegend Doku mit eingebetteten Secrets, z.B. DVhubs Auslagerung). Regel: `.sops.yaml`-Creation-Rules markieren Secret-Pfade; **PLUS** ein deterministischer Secret-Pattern/Entropy-Scan (gitleaks) über ALLE Dateien, fail-closed. Tier B trägt eine **Restschwäche** (ein Secret in einem nicht-konfigurierten Pfad in novel Format kann den Scanner umgehen) — Tier A hat sie nicht.
- **Empfehlung an Brettli/DVhub:** echte Secrets in einen Tier-A-`dvhub/secrets`-Repo splitten, aus dem (Tier-B-oder-privat) Planning-Repo referenzieren. Brettli entscheidet den Split; ich liefere beide Mechanismen.

### 1.4 LOAD-BEARING Enforcement: server-side `pre-receive`-Hook (fail-closed) — R1-gehärtet
Client-seitige SOPS-Disziplin (pre-commit-Hook) ist **notwendig, aber nicht hinreichend** — ein fehlkonfigurierter/buggy/böswilliger Client kann sie umgehen. Der pre-receive-Hook ist der **wichtigste** nicht-client-umgehbare Erzwingungspunkt — **aber NICHT der einzige Schreibpfad** (R1/B1+H1: Mirror-Pulls + Non-Git-Speicher schreiben am Hook vorbei → §1.7 schließt die mit ab). Hook + §1.7-Lockdown zusammen erzwingen G1.

**Installation:** admin-installierter Hook in `<repo>.git/hooks/pre-receive.d/` (Forgejo besitzt die Haupt-`pre-receive`, iteriert `.d/`); `[security] DISABLE_GIT_HOOKS=true` bleibt → Konsumenten können ihn NICHT anlegen/editieren/entfernen.

**Was er prüft — deterministisch + positiv-bestätigend (R32):**
1. **Über ALLE ref-Tripel `<old> <new> <refname>` iterieren (R1/H3)** — nicht nur `refs/heads/*`: explizit `refs/tags/*` (inkl. **annotated-tag-Message-Bodies**, nicht nur Blobs), `refs/notes/*` (git notes = Klartext-Kanal), und JEDER unbekannte ref-Namespace → **default-deny REJECT**. Pro Ref die Diff-Objekte enumerieren.
2. **Vollverschlüsselung statt Partial (R1/B2 — der täuschbare Punkt):** SOPS unterstützt `encrypted_regex`/`unencrypted_suffix`/`mac_only_encrypted` → ein **strukturell gültiger** Envelope kann das Secret als **Klartext-Leaf** enthalten, wenn der Ersteller die Encryption-Rule so wählt. Der Hook prüft daher NICHT „jeder *verschlüsselte* Leaf ist ENC[...]" (vacuously true bei 0 verschlüsselten Leaves), sondern erzwingt **positiv: JEDER nicht-allowlisted Leaf-Wert MUSS `ENC[AES256_GCM,data:…,iv:…,tag:…,type:…]` sein.** Envelopes mit `unencrypted_suffix`/`unencrypted_regex`/partiellem `encrypted_regex`, die irgendeinen Secret-Leaf im Klartext lassen → **REJECT**. (Tier A: alles außer Allowlist. Tier B: alle policy-Secret-Pfade.)
3. **Envelope-Struktur:** Top-Level-`sops:` mit `mac`, `lastmodified`, `age:`-Recipients; binary/dotenv analog (`sops_*`-Meta + ENC[...]-Daten). Nicht parsebar → REJECT.
4. **Recipient-Containment aus OUT-OF-BAND-Policy (R1/B3 — Self-Auth geschlossen):** die erlaubte-Recipients-Menge stammt **NICHT** aus der vom Konsumenten gepushten `.sops.yaml` (= Self-Authorization), sondern aus einer **admin-gepflegten, konsument-nicht-beschreibbaren Quelle**: `/etc/forgejo-secrets-policy/<org>/<repo>.allow` auf der LXC (root-only). `sops.age[].recipient` MUSS ⊆ dieser admin-Liste sein UND der **Recovery-Recipient MUSS enthalten** sein (sonst REJECT). `.sops.yaml` aus dem Repo wird höchstens GEGEN die admin-Policy validiert, ist nie selbst die Autorität.
5. **Privkey-Detektor über ALLE Dateien (R1/M2), inkl. Allowlist:** jede Datei (auch `recipients/*.pub`, README etc.) wird auf `AGE-SECRET-KEY-`-Muster (+ PEM `BEGIN OPENSSH/RSA/EC PRIVATE KEY`) geprüft → Treffer = **REJECT**. `recipients/*.pub` wird zusätzlich positiv als **age-Pubkey** (`age1…`, X25519-Recipient) validiert — Format-Fehler = REJECT. Schließt „Privkey statt Pubkey committed".
6. **Tier-B-Zusatz:** gitleaks-Pattern/Entropy-Scan über ALLE Dateien (auch die Klartext-Leaves von „SOPS"-Dateien, R1/B2) → Treffer = REJECT.
7. **Fail-CLOSED, ausnahmslos:** Datei/Tool/Policy-Fehler, fehlende admin-Policy, fehlender Recovery-Recipient, unbekannter ref-Typ → **REJECT**. Nie fail-open.

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
- **Unreachable-Objekte / Force-Push-History (R1/H2):** ein einmal akzeptiertes (oder über Multi-Ref-Push durchgerutschtes) Klartext-Objekt bleibt nach Überschreiben als unreachable pack-Objekt lesbar bis `gc --prune`. → nach jedem Force-Push auf Secret-Repos **`git gc --prune=now`** (Automatik+Runbook). **Ein versehentlich gelandetes Klartext-Secret gilt als kompromittiert → ROTATION, nicht nur Löschung.**

---

## 2. Teil B — Bootstrap-Credential-Modell (löst die Rekursion, G3)

### 2.1 Die Rekursion, präzise
Ein Konsument braucht ZWEI Secrets, um Secrets zu nutzen:
1. **Forgejo-Auth** (um Ciphertext zu pullen), und
2. **age-Private-Key** (um zu entschlüsseln).
Beide sind selbst Secrets. Klartext im Repo/Env jedes Agenten = Sprawl nur verschoben, und der Forgejo-Token ist die Krone. Auflösung muss die Kette zu **einem** operator-gehaltenen Root verkürzen, nicht zu N.

### 2.2 Root-of-Trust: op-connect (primär) + Deploy-Zeit-Injektion (Fallback)
**Primär — 1Password op-connect Runtime-Broker (T-0206).** Die Fleet hat op-connect bereits (LXC 141). Modell:
- age-Privkeys + Forgejo-Deploy-Key-Privhälften liegen als **op-Items**, pro Konsument in einem eigenen Vault/Item.
- Konsument authentisiert sich an op-connect mit einem **op-connect-Service-Account-Token, item-scoped auf NUR seine eigenen Items** (Konsument A liest nur As Deploy-Key + As age-Key). Fetch zur Laufzeit (`op read` / Connect-API) direkt in Env/tmpfs.
- **Dieser SA-Token ist DER Bootstrap-Secret des Konsumenten.**

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
2. **op-connect wird zur neuen Krone:** wer op-connect kompromittiert, fetcht alle dort gehaltenen age-Privkeys → entschlüsselt alles, was die abdecken. **Ehrliche Restkonzentration** (= der zweite Root neben Recovery, G3 ist NICHT „ein Root"). Mitigation: per-Konsument-Service-Accounts mit **Item-Level-Scoping** (A liest NUR As Items — in 1Password Connect via getrennte Vaults pro Konsument + SA-Token mit Vault-Scope erzwingbar; NICHT wishful, aber Konfig-Disziplin → Oracle §7.4 testet „A kann B's Item nicht lesen = 403"), op-connect gehärtet, Audit. **Strikt besser als Klartext-Env-Sprawl**, aber die Konzentration gehört in Bizzis/Schnüffis Risiko-Register.

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

1. **G1-at-rest (Vollplatten-grep, R1/H4+H1+H2):** Canary an A-Recipient + per-Tenant-Recovery verschlüsseln, pushen. Dann **grep auf den Fake-Marker über die GESAMTE Forgejo-LXC-Disk** — `/var/lib/forgejo` komplett **inkl. DB-Datei, LFS-Store, Attachment-/Avatar-Store** PLUS `git cat-file --batch-all-objects | grep` (erfasst **unreachable** Objekte) PLUS Working-Trees → **Treffer-Zahl == 0**. Nur `repo.git`+Working-Tree zu prüfen (alte §7-Fassung) wäre genau das false-PASS-Loch.
2. **G2-key-off-host:** clone von einem Host OHNE A's age-Key (z.B. Forgejo-Host) → `sops -d` **MUSS scheitern**. Auf A's Host: Key aus op-connect → Env → `sops -d` **MUSS** den Marker liefern. Disk-Check auf A: age-Key nicht persistent (nur Env/tmpfs).
3. **Enforcement-Negativ-Matrix — JEDER muss REJECT (R1/B1-B4+H1+H3+M2):**
   - (a) Klartext-Datei in Secret-Repo → REJECT.
   - (b) SOPS-Datei an NICHT-erlaubten Recipient (aus admin-Policy, nicht `.sops.yaml`) → REJECT (B3).
   - (c) **partial-encrypted Envelope** (`unencrypted_suffix`/`encrypted_regex` lässt Secret-Leaf Klartext) → REJECT (B2).
   - (d) **self-authored `.sops.yaml`** mit zusätzlichem Angreifer-Recipient → REJECT (B3).
   - (e) **Tag-Message-Klartext + `refs/notes/*`-Klartext** → REJECT (H3).
   - (f) **LFS-Pointer / Mirror-Pull-Klartext** → REJECT bzw. Mirror ist deaktiviert (B1+H1).
   - (g) **Privkey** (`AGE-SECRET-KEY-`) in beliebiger Datei inkl. `recipients/*.pub` → REJECT (M2).
   - (h) gitleaks-Pattern in Tier-B → REJECT.
4. **G3-bootstrap + Item-Scoping:** auf A's Host kein persistenter Klartext von age-/Deploy-Key; **op-connect-SA item-scoped: A liest B's Item NICHT → 403** (R1/H5 Punkt 2).
5. **Hook-Survival (R1/B4):** nach `forgejo admin regenerate hooks` UND nach einem simulierten Forgejo-Upgrade → Security-Hook noch vorhanden+aktiv (sonst Integritäts-Wache schaltet read-only) → Negativ-Push danach noch REJECT. **Wiederkehrende** PASS-Bedingung, nicht einmalig.
6. **Break-Glass-Drill (R1/H5):** per-Tenant-Recovery-Key entschlüsselt den Canary von einem **op-connect-unabhängigen** Host → Marker geliefert. Beweist: Recovery-Pfad operabel ohne op-connect, kein Zirkel.

**Sign-off-Bedingung:** alle 6 grün + Schnüffis GPT-codex-Lens findet keinen build-blockierenden Befund + Schnüffi-Sign-off. Analog zum T-0244-Triple-Oracle-Gate.

---

## 8. Offene Operator-/Peer-Entscheidungen (NICHT autonom)
- **🔴 op-connect-Migration weg von .240 (R1/H5) = Pre-Sign-off-Vorbedingung, nicht „interim akzeptieren":** stabiler Node ODER zweite unabhängige Connect-Instanz. Kapazität → proxmox-master; Timing → Operator. Bis dahin BLOCK für den Live-Decrypt-Pfad.
- **🔴 Recovery-Key-Custody (R1/M1) = vor Sign-off festnageln:** per-Tenant getrennt + **m-of-n Shamir-Schwelle** + konkretes Medium (HW-Token/Offline) + Custodians. Operator-Entscheid.
- **DVhub Tier-A-Split:** legt Brettli echte Secrets in einen `dvhub/secrets`-Tier-A-Repo (default-encrypt-all, stärkste Enforcement), oder Mixed-Tier-B mit Scan (Restschwäche)? → Brettli/DVhub.
- **Codex-Refute-Lens:** `codex-worker` ist in diesem Harness NICHT als Subagent-Typ verfügbar → fresh-context Claude-Lens (mein Refute, R26 — Runde 1 unten gefoldet) + Schnüffis echte GPT-codex-Lens (ihr Side). Etablierter T-0244-Pattern.

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
**Nächster Gate-Schritt:** Schnüffis GPT-codex-Lens auf diese R1-gefoldete Fassung (2. konvergente Lens, R22 Default=BLOCK) + ihr Sign-off.
