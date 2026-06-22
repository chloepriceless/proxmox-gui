# Empfehlung: EIN interner Git — Forgejo-Konsolidierung (Christin RE-CHECK 2026-06-22)

**Frage (Christin):** „Ich wollte EINEN internen Git für ALLES Interne." Zwei-Forgejo-Lösung hinterfragt; Default = bestehendes `.172` nutzen, neues `.59`/LXC160 abreißen, außer hartem Security-Blocker.

**Empfehlung (Schraubi + Schnüffi + GPT-codex konvergent, R22):**
> **JA — auf EINEN internen Git (`.172`/LXC 153) konsolidieren, `.59`/LXC 160 abreißen. ABER als CONDITIONAL gated Migration, nicht als sofortiger freier Umschalter.** Es gibt KEINEN harten Security-Blocker für physische Trennung — aber 5 verifizierbare Bedingungen müssen vor dem Abriss / vor dem ersten echten Secret auf `.172` erfüllt sein.

Refute-Beleg: `orchestrator-security/reviews/2026-06-22-secrets-forgejo-consolidation-R22-refute.md` (commit f46a52d, Schnüffi+codex konvergent, kein Dissens).

---

## 1. Faktenlage (live-verifiziert, `pct config`, nicht Doku)
| Box | LXC | Rolle | Privileg | Node |
|---|---|---|---|---|
| `.172` | **153** | Fleet-Forgejo (`forgejo`, CI-aktiv) | **unprivileged** | pz3 |
| `.173` | **154** | `forgejo-runner` (CI für .172) | **PRIVILEGED + nesting + keyctl + DinD** | pz2 |
| `.59` | **160** | Secrets-Forgejo (neu, locked-down) | unprivileged | pz3 |
| `.153` | (andere Box) | **Grafana** (≠ Forgejo) | — | — |

- **LXC-ID-Label korrigiert/bestätigt:** die `.172`-Box ist **LXC 153** — mein altes „LXC 153"-Label war RICHTIG. Die Verwirrung war nur, dass IP `.153` = Grafana eine ANDERE Box ist (LXC-ID ≠ IP-Oktett).
- **pz2 + pz3 = EIN Proxmox-Cluster** (`/etc/pve/nodes/{pz2,pz3}` shared) → Root auf irgendeinem Node liest `/etc/pve/priv` → Cluster-Root → `pct enter` jeden Container jedes Nodes.
- `.172` app.ini IST-Stand: `[actions] ENABLED=true`, `[server] DISABLE_SSH=true` (HTTP-only push), sonst permissive Defaults → Web-Editor / API-`/contents` / Merge / LFS wahrscheinlich alle verfügbar.

## 2. Warum KEIN harter Separations-Blocker
1. **Die separate Box stoppt den dominanten Vektor eh nicht.** Der privilegierte DinD-Runner (154) ist cluster-root-fähig → ein CI-Job-Escape gibt Cluster-Root → erreicht `153` UND `160` gleichermaßen (beide pz3, beide aus `/etc/pve/priv`). Die Zwei-Box-Trennung adressiert die falsche Schicht.
2. **Confidentiality ruht auf Krypto, nicht auf der Box.** SOPS+age: At-Rest = nur Ciphertext, age-Privkeys + @recovery-Shamir off-host (G2/§8). Host-Root der Secrets-Box leakt KEINEN Klartext.
3. **Trust-Modell unverändert.** Die jetzige in-cluster-160 operiert bereits im „Cluster-Root-trusted"-Modell. Konsolidieren auf `.172` macht die Posture NICHT schlechter als der aktuelle 160-Plan.

## 3. Warum trotzdem CONDITIONAL (Schnüffis berechtigter Punkt)
Die „worst-case = Ciphertext"-Aussage hängt an einer **versteckten Integritäts-Invariante: „nie landet un-SOPS'ter Klartext im Repo" — ob versehentlich ODER böswillig via API-`/contents`/Web-Editor injiziert.** Einmal committet ist Klartext app-level lesbar, krypto-ungeschützt, persistent. (Schnüffi-Schärfung: NICHT bloß Unfall-Prävention — der bewusste Klartext-Inject über einen offenen Schreibpfad ist exakt der Write-Path-Threat.) Diese Invariante erzwingt der fail-closed `pre-receive`-Hook + Config-Lockdown — der auf der locked-down 160 fest ist, auf der CI-aktiven permissiv-default-`.172` aber materiell schwächer.

**🔑 Load-bearing [UNCERTAIN], Default=BLOCK bis bewiesen:** Feuern Web-Editor / API-`/contents` / Merge/Squash/Rebase / Actions-Commits / LFS den `pre-receive`-Hook — oder UMGEHEN sie ihn? (Git: pre-receive hängt an `git push`/receive-pack; läuft eine Op nicht als echter Push, ist der Hook nicht im Pfad. Forgejo-Branch-Protection ist app-level ≠ git-Hook.) Auf `.172` pro Pfad am Canary BEWEISEN, dass `50-secrets` feuert, ODER den Pfad für Secret-Repos hart abschalten.

## 4. Die 5 Bedingungen vor Abriss / erstem Secret auf `.172` (Schnüffi f46a52d)
1. **Alle Write-Pfade** für Secret-Repos scanner-abgedeckt (canary-bewiesen) ODER hart aus: Web-Editor, Contents-API, Merge/Squash/Rebase, Actions-Commits, LFS, Mirrors, Uploads/Packages, Wiki.
2. **Actions für Secrets-Org hart AUS** ODER Runner kann Secrets-Org nicht treffen (Actions = RCE-Pfad).
3. **Kein CI-Token an die Secrets-Org** außer minimalem repo-Deploy-Key ohne Admin. (Codex-Catch: der Actions-Auto-Token ist eh repo-scoped/404-fremd → das Token-Bedenken gilt NUR bei zusätzlich konfigurierten breiten PATs/Admin-Tokens → inventarisieren.)
4. **Scanner-Invariante = Push-Hook + periodischer Full-Repo-Object-Scan** (reachable refs/tags/PR-refs/LFS/Wiki/Packages) — verzahnt mit dem Alternates-Befund (a532d19/a3957c3).
5. **Decrypt-Surface separat modelliert** (op-connect/Consumer/Backups/Logs/Memory/Swap/Runner-Artefakte) = §8.

## 5. Unabhängiger dominanter Fix: der privilegierte DinD-Runner (154)
Er macht Cluster-Root low-effort und ist ein **fleet-weites Risiko unabhängig von der Forgejo-Frage**. Rootless/unprivileged fixen = höchste-Hebel-Sicherheitsaktion, egal wie die Topologie-Entscheidung fällt. → separater Fleet-Security-Task (Schnüffi + proxmox-master).

## 6. Die EINE echte Christin-Entscheidung (Risiko-Appetit, nicht herleitbar)
- **Akzeptierst du das „Cluster-Root-trusted"-Modell** (= Status quo seit 160-Build) → **konsolidieren auf `.172` mit den 5 Bedingungen** [EMPFOHLEN, deckt dein „ein interner Git"].
- **Willst du HARTE Cluster-Root-Isolation** der Secrets → die Secrets-Forge müsste AUS der Proxmox-Trust-Domain raus (eigene Box, kein shared `/etc/pve`). Weder `.172` noch das jetzige `160` liefert das. Größere, eigene Entscheidung; widerspricht „ein interner Git".

## 7. Migrations-Skizze (wenn konsolidieren gewählt)
1. Lockdown-Stack (fail-closed `50-secrets`-Hook + `hook-integrity-watch` + chattr-Immutabilität) auf `.172` für Secret-Repos deployen — Artefakte aus `.planning/forgejo-secrets-artifacts/` sind direkt übertragbar.
2. **Write-Path-Canary auf `.172`** (der `CANARY-RUNBOOK-LXC160.md` adaptiert direkt): pro Schreibpfad beweisen `50-secrets` feuert ODER Pfad aus. + die 5 Bedingungen verifizieren.
3. dvhub/planning + Merkel-Vault-Sync-Org auf `.172` anlegen; DVhub/Völtchen-Zugang zielt dann auf `.172` (**HTTP-only**, kein :2222).
4. Erst nach grüner Verifikation + Schnüffi-Re-Sign-off: `.59`/LXC 160 abreißen.
- **Verlustfrei JETZT:** auf `.59` ist noch KEIN Secret gelandet → der Umzug kostet keine Datenmigration.

---
**Status:** Schnüffi reviewt diese Empfehlungs-Formulierung gegen (R22), BEVOR sie an Christin geht. Danach an dashboard/Brettli → Christin.
