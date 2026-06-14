# Release-Review-Findings — Proxmox Self-Service GUI

**Datum:** 2026-06-14
**Projekt:** Proxmox Self-Service GUI (`/home/dev/vm-deployment-gui`)
**Release-Verdict:** **NOT-READY** — 6 Blocker, 25 konsolidierte Backlog-Items

---

## Methode

Ultracode Multi-Agent-Review im Auftrag Christins: Find-Phase (Agenten suchen
Findings) → adversariale Verify-Phase (jedes Finding am echten Code mit
`Datei:Zeile` per Grep/Read gegenverifiziert). Alle 26 gelieferten Findings
wurden bestätigt; zwei Resize-Findings sind identisch
(`resize_functions.py:99-128`) und wurden zu einem Item zusammengeführt →
**25 konsolidierte Backlog-Items**.

---

## Summary

Release-/Qualitäts-Review der Proxmox Self-Service GUI
(`/home/dev/vm-deployment-gui`). Alle 26 gelieferten Findings wurden am echten
Code mit Datei:Zeile verifiziert (Grep/Read); zwei Resize-Findings sind
identisch (`resize_functions.py:99-128`) und wurden zu einem Item zusammengeführt
→ 25 konsolidierte Backlog-Items.

**ERGEBNIS: NOT-READY.** Es bestehen 6 Blocker, die ein Release verhindern.

Funktional am gravierendsten:

1. Der Orphan-Reaper enqueued in `reaper.py:131` die Job-Art `job.reattach`, die
   in der arq-Worker-Registry (`worker.py:125-159`) NICHT registriert ist → nach
   Worker-Restart bleiben laufende Jobs für immer hängen (arq verwirft unbekannte
   job kinds).
2. Quota-Admission ist read-only (`admission.py check_and_preview`, Docstring
   1-5/52-56 sagt selbst „no reservation row"): nebenläufige Creates lesen alle
   dieselbe Vor-Create-Nutzung und passieren gemeinsam (TOCTOU) → Quota nicht
   durchsetzbar; das in `clone.py`/`service.py` konsumierte `check_and_reserve`
   existiert nicht.

Test/CI-Blocker:

3. Es gibt KEINE CI (kein `.github/workflows`, keine andere Pipeline) → Tests
   laufen nie automatisch.
4. `test_mcp.py:16` importiert `app.mcp.server` → `server.py:16`
   `from mcp.server.fastmcp import FastMCP`; das Paket `mcp==1.27.2` steckt nur im
   optionalen `[mcp]`-Extra (`pyproject.toml:42-43`), NICHT in `[dev]` → unter dem
   dokumentierten `pip install -e .[dev]` bricht die gesamte Backend-Suite bereits
   beim Collect ab.
5. `deploy/README.md` ist grob veraltet (Status „Phase 2 of 5" :8, „No
   self-update" :192, „CSP intentionally omitted/not in Caddyfile" :185/197) — alle
   drei durch ausgelieferten Code widerlegt: `selfupdate_functions.py` +
   `worker.py:158` „admin.self-update", CSP liegt in
   `deploy/caddy/Caddyfile.template` → aktiv irreführende Deploy-Doku.

Daneben mehrere HIGH-Robustheitslücken in der Job-Engine: die UPID-Poll-Schleife
(`poller.py:84-125`) hat keine innere Fehlerbehandlung und ist unbegrenzt
(`while True`) → ein PVE-Aussetzer markiert einen real noch laufenden Langläufer
als „failed" (`functions.py:111` fängt PVE-Fehler ab), und ein arq-Timeout lässt
die DB-Zeile dauerhaft in `running`/`claimed` hängen; Clone-Kollisions-Retry
(`clone_migrate_functions.py:167-188`) landet auf einer anderen VMID als der an
UI/Audit zurückgegebenen (`clone.py:208/233`).

MEDIUM/LOW: ungeprüftes node-Feld im `ssh root@{node}`-Shellout
(`connector.py:1130-1137`; Command-Args sind via shlex gequotet, node selbst nicht
gegen die Cluster-Nodeliste validiert), totes `quota.lxc_count`
(`admission.py:85-86` nutzt `vm_count` als Limit für VM+LXC), event-pump ohne
Reconnect (`events.py:116-146`), Rate-Limit-Memory-Fallback ohne Bucket-Eviction
(`rate_limit.py:99-104`), stale-WS-Frame ohne Monotonie-Guard
(`jobs.svelte.ts:194-222`), Snapshot-Tree ohne Zyklus-Schutz
(`snapshot-tree.ts:41-66`), source_ip-Trust-Divergenz (`source_ip.py:19/34` vs
`auth/routes.py:72`), 2206 committete `frontend/build`-Dateien, fehlende Coverage,
gebrochenes ESLint-9-Setup, sowie diverse Doku-Drifts (`install.sh:110` default
„main" existiert nicht; `bootstrap.sh:20` „commit"-Claim & :364 fehlende
CONTRIBUTING.md; CHANGELOG nur 0.6.0-Linkref; README-Sample :163).

**Empfehlung:** Erst die 6 Blocker schließen (reaper/worker-Registrierung,
Quota-Reservation, CI + mcp-in-`[dev]`, deploy/README-Korrektur), dann die
HIGH-Job-Engine-Robustheit, bevor ein Release/Verkauf erfolgt.

---

## Release-Verdict

> **NOT-READY** — 6 Blocker offen. Kein Release/Verkauf vor Schließung der
> Blocker und der HIGH-Job-Engine-Robustheit.

---

## Priorisierte Backlog-Tabelle

| Severity | Blocker | Datei | Titel | Action |
|---|---|---|---|---|
| CRITICAL | JA | `backend/app/jobs/reaper.py:131` (`enqueue_job("job.reattach", ...)`) vs `backend/app/jobs/worker.py:125-159` (functions-Registry kennt kein `job.reattach`) | Orphan-Reaper enqueued nicht-registrierte Job-Art `job.reattach` — laufende Jobs hängen nach Worker-Restart für immer | Eine `job.reattach`-Funktion (Re-Attach-Poll auf die bestehende UPID) implementieren und in `WorkerSettings.functions` registrieren, ODER `reaper.py:131` auf eine bereits registrierte Re-Poll-Kind umstellen. Regressionstest: Reaper enqueued nur Kinds, die in der Registry existieren (Set-Vergleich gegen `WorkerSettings.functions`-Namen). |
| HIGH | JA | `backend/app/quotas/admission.py:46-91` (`check_and_preview`; Docstring 1-5/52-56 „no reservation row is inserted"), konsumiert von `backend/app/provisioning/service.py:140-151` und `backend/app/lifecycle/clone.py:120-131` (über `run_quota_admission`) | Quota-Admission ist read-only (kein Reservation-Row) — nebenläufige Creates passieren alle dieselbe Vor-Create-Nutzung (TOCTOU), Quota nicht durchsetzbar | Das im Docstring versprochene `check_and_reserve` liefern: innerhalb der bestehenden `BEGIN IMMEDIATE`-Transaktion (`admission.py:58`) eine reservations-Zeile INSERTen, sodass usage = committed + offene Reservierungen rechnet; Reservierung bei Job-Terminal/Abbruch wieder freigeben. Concurrency-Test: N parallele Creates bei Limit=1 → genau 1 darf passieren. |
| HIGH | JA | `backend/tests/test_mcp.py:16` (`from app.mcp.server import build_server`) → `backend/app/mcp/server.py:16` (`from mcp.server.fastmcp import FastMCP`); `mcp==1.27.2` nur im optionalen `[mcp]`-Extra (`backend/pyproject.toml:42-43`), nicht im dev-group (44-52) | `test_mcp.py` bricht gesamte Backend-Suite beim Collect ab unter dokumentiertem `pip install -e .[dev]` | Entweder mcp ins dev-dependency-group aufnehmen, ODER `test_mcp.py` mit `pytest.importorskip('mcp')`/`@pytest.mark.skipif` schützen, sodass das Fehlen des optionalen mcp-Extras nicht die ganze Collection killt. CI installiert `.[dev,mcp]`. |
| MEDIUM | JA | `/home/dev/vm-deployment-gui/` (Repo-Root: kein `.github/workflows`, keine `.gitlab-ci.yml`/`.woodpecker`/`Jenkinsfile`/`tox.ini`/`Makefile`/root `package.json` — verifiziert) | Keine CI-Pipeline — Tests laufen auf keinem Commit/PR automatisch | CI-Workflow (`.github/workflows/ci.yml`) anlegen: Backend `pip install -e .[dev,mcp]` + ruff + mypy + pytest, Frontend `pnpm install` + lint + `vitest run`. Auf push + PR triggern, Merge-Gate setzen. |
| MEDIUM | JA | `deploy/README.md:8` (Phase 2 of 5), :192 (No self-update), :185/:197 (CSP intentionally omitted / not in Caddyfile) — widerlegt durch `backend/app/jobs/selfupdate_functions.py` + `worker.py:158` (admin.self-update) und `deploy/caddy/Caddyfile.template` (CSP gesetzt) | `deploy/README.md` grob veraltet — „Phase 2 of 5", „No self-update", „CSP omitted" alle durch ausgelieferten Code widerlegt | Status auf den ausgelieferten Stand (alle 5 Phasen) aktualisieren; „No self-update" streichen (Self-Update via admin.self-update beschreiben); CSP-Abschnitt korrigieren (CSP ist in `Caddyfile.template` aktiv). Doku gegen Code prüfen. |
| HIGH | nein | `backend/app/jobs/poller.py:84-125` (`while True: connector.task_status(...)` ohne try/except), Aufrufkontext `backend/app/jobs/functions.py:108-120` (except PVEUnreachable/PVEAPIError/PVEAuthError → `_fail_job`) | UPID-Poll-Schleife ohne innere Fehlerbehandlung — ein transienter PVE-Aussetzer markiert einen real laufenden Langläufer als „failed" | `task_status`/`task_log` innerhalb der Schleife mit Retry-mit-Backoff gegen transiente PVEUnreachable/Timeout-Fehler kapseln (z.B. M aufeinanderfolgende Fehler tolerieren), erst nach erschöpftem Retry-Budget als failed werten; idealerweise mit dem Stuck-Running-Fix kombinieren. |
| HIGH | nein | `backend/app/jobs/clone_migrate_functions.py:165-188` (candidate = newid_start + attempt im Retry-Loop) vs `backend/app/lifecycle/clone.py:194-242` (newid an UI + audit target_id=str(newid), payload_after newid) / `backend/app/provisioning/schemas.py:369-378` | Clone-Kollisions-Retry landet auf anderer VMID als der an UI/Audit zurückgegebenen | Den real verwendeten candidate aus dem Dispatch zurückführen und nach erfolgreichem Clone Job/Audit-Zeile auf die tatsächliche VMID aktualisieren (z.B. final_vmid im Job-Result), statt newid_start zu fixieren. Alternativ Kollision hart fehlschlagen lassen, wenn der UI-versprochene newid belegt ist. |
| MEDIUM | nein | `backend/app/jobs/poller.py:82-126` (`while True` ohne Zeit-/Iterationsgrenze) + `backend/app/jobs/functions.py:108-120` / `clone_migrate_functions.py:124-138` (except-Pfade greifen nicht bei arq-Timeout-Cancel) | arq-Timeout lässt die DB-Job-Zeile dauerhaft in `running`/`claimed` hängen (unbegrenzte Poll-Schleife) | Bei arq-Timeout (`asyncio.CancelledError` / Worker-on_job-timeout-Hook) die DB-Zeile in einen terminalen Zustand (`timed_out`/`needs_review`) überführen. Zusätzlich obere Wand-Uhr-Grenze in der Poll-Schleife, die mit dem job-spezifischen arq-timeout korreliert. |
| MEDIUM | nein | `backend/app/jobs/events.py:116-146` (try/finally ohne except um `pubsub.listen()`) + `backend/app/main.py:115-116` (Background-Task ohne done-callback/Restart) | `jobs_event_pump` stirbt permanent bei Redis-Drop — keine Reconnect/Supervisor; Tasks-Drawer-Live-Updates bis API-Neustart tot | `pubsub.listen()` in eine Reconnect-Schleife (außer bei CancelledError) mit Backoff + neu-subscribe kapseln; alternativ done-callback in `main.py`, der den Task bei unerwartetem Exit neu startet und loggt. |
| MEDIUM | nein | `backend/app/clusters/connector.py:1130-1139` (Sink: ssh_argv `f"root@{node}"`); `backend/app/provisioning/schemas.py:315` (Source `CommunityScriptRequest.node`); `backend/app/jobs/provisioning_functions.py:271,376` (Flow) | node-Feld nie gegen die echte Cluster-Nodeliste validiert vor privilegiertem `ssh root@{node}`-Shellout | node vor dem Shellout gegen die bekannte Node-Liste des Ziel-Clusters allowlisten (registry/cluster-resolver); bei Unbekannt 422/400. (Command-Args sind via `shlex.quote` abgesichert (1120-1129), node selbst nicht.) |
| MEDIUM | nein | `backend/app/quotas/admission.py:85-86` (`usage.vm_count + usage.lxc_count` gegen Limit `row.vm_count`) + `backend/app/models/quota.py:70` + `backend/app/quotas/service.py:160-167` + `backend/app/quotas/schemas.py:8-21` | `quota.lxc_count` ist tote Spalte — nie setzbar, nie durchgesetzt; Count-Limit nutzt still `vm_count` für kombinierte VM+LXC-Nutzung | Entscheiden: getrennte VM-/LXC-Limits (`lxc_count` in `service.py`/`schemas.py` setzbar + in admission als eigene Dimension prüfen) ODER `lxc_count` entfernen und das Combined-Count-Limit explizit `count` nennen. Aktuell ist die Semantik (`vm_count`-Limit auf VM+LXC) irreführend. |
| MEDIUM | nein | `backend/app/jobs/resize_functions.py:99-128` (`set_vm_config` dann `resize_disk`-Loop in einem try; except → `_finish_resize` state='failed') | Resize wendet CPU/RAM und mehrere Disk-Grows nicht-atomar an — Teil-Fehler lässt CPU/RAM committed, meldet aber „failed" | Bei Teil-Fehler den real angewendeten Stand erfassen und als `partially_applied`/needs_review mit Detailtext melden (welche Felder/Disks geschafft) statt pauschal „failed"; UI entsprechend kennzeichnen. Falls möglich Disk-Grows vor Config-Write ordnen, um Rollback-Fenster zu minimieren. |
| MEDIUM | nein | `frontend/src/lib/stores/jobs.svelte.ts:182-222` (`#applyBackfill` / `upsertJob` ersetzt by-id ohne Versions-/Zeitstempel-Vergleich) | Stale WebSocket-Frame kann abgeschlossenen Job im Tasks-Drawer-Store wiederbeleben (kein Monotonie-Guard) | In `upsertJob`/`#applyBackfill` einen Monotonie-Guard einbauen: einen eingehenden Job nur übernehmen, wenn seine updated_at/Version >= der vorhandenen ist bzw. einen bereits-terminalen Job nicht durch einen nicht-terminalen Frame überschreiben. |
| MEDIUM | nein | `backend/app/core/source_ip.py:19,34` (hardcoded TRUSTED_PROXIES {127.0.0.1, ::1}, für AuditLog) vs `backend/app/auth/routes.py:72` (settings.trusted_proxies, getestet) | source_ip-Extraktion nutzt hardcodierte Trust-Liste, divergiert vom getesteten Rate-Limit-Pfad, ohne Test | `source_ip.extract_source_ip` auf `settings.trusted_proxies` umstellen (eine Quelle der Wahrheit), TRUSTED_PROXIES-Konstante entfernen; Unit-Test für XFF-Auflösung über vertrauenswürdige/nicht-vertrauenswürdige Direct-Clients ergänzen. |
| MEDIUM | nein | `README.md:138` (selbst-dokumentiert) + 2206 getrackte Dateien unter `frontend/build/*` (git ls-files); `deploy/lxc/bootstrap.sh:362-366` verlangt committetes `frontend/build/index.js` | `frontend/build` inkl. node_modules committet (2206 getrackte Dateien) — fragiles, selbst-dokumentiertes Release-Footgun | `frontend/build` aus dem Repo entfernen und `.gitignore`-en; Build-Artefakt im Deploy-Flow (CI/bootstrap) bauen statt committen, ODER als Release-Asset/Tarball bereitstellen. `bootstrap.sh` anpassen, sodass es das Frontend baut oder ein Release-Artefakt zieht. |
| LOW | nein | `backend/app/security/rate_limit.py:95-104` (`_check_rate_memory`; setdefault, In-Place-Filter, kein del) und `_buckets` at :53 | Rate-Limiter-In-Memory-Fallback evictet leere Per-Key-Buckets nie — unbegrenztes dict-Wachstum während Redis unerreichbar | In `_check_rate_memory` nach dem Cutoff-Filter Keys mit leerem Bucket löschen (`del _buckets[key]`); optional periodische Eviction/Größengrenze. Geringes Risiko, da LXC single-worker + Redis primär — trotzdem schließen. |
| LOW | nein | `frontend/src/lib/components/lifecycle/snapshot-tree.ts:41-66` (`buildSnapshotTree`/`flattenSnapshotOrder` rekursiv über childrenOf ohne visited-Set) | Snapshot-Tree-Builder ohne Zyklus-Schutz — fehlerhafte Parent-Pointer verursachen unbegrenzte Rekursion | visited-Set (Snapshot-Namen) durch build()/walk() führen und bereits besuchte Knoten überspringen; bei Zyklus defensiv abbrechen/loggen statt unendlich zu rekursieren. |
| LOW | nein | `frontend/package.json:16` (`"lint": "eslint ."`) + :46 (eslint ^9.16.0); `frontend/.eslintrc.json` (Legacy-Config, kein eslint.config.js) | `pnpm lint` kaputt — ESLint 9 installiert, nur Legacy-`.eslintrc.json` vorhanden (Exit 2) | Flat-Config `eslint.config.js` für ESLint 9 anlegen (Migration der `.eslintrc.json`-Regeln inkl. eslint-plugin-svelte) ODER `ESLINT_USE_FLAT_CONFIG=false` setzen. Danach in CI als Gate verdrahten. |
| LOW | nein | `backend/pyproject.toml:44-52` (dev-group ohne pytest-cov) + `frontend/package.json:14` (`"test": "vitest run"`, ohne @vitest/coverage) | Keine Coverage-Messung für beide Suiten konfiguriert — Lücken auf kritischen Pfaden unsichtbar | pytest-cov ins dev-group + `--cov`-Konfiguration; `@vitest/coverage-v8` + coverage in `package.json`. Coverage in CI ausgeben, Schwelle für kritische Module (jobs/, quotas/, auth/) setzen. |
| LOW | nein | `frontend/tests/e2e/auth.test.ts:22-29` (lokale mapError-Kopie) vs `frontend/src/routes/login/+page.svelte:62-68` (echte mapError) | Falsch beschrifteter `e2e/auth.test.ts` re-implementiert Produktions-mapError — Scheinsicherheit, fängt UI-Copy-Drift nicht | Die lokale mapError-Kopie entfernen und die echte Funktion aus `+page.svelte` importieren/exportieren und gegen sie testen, sodass Copy-Drift erkannt wird. (Datei ist zudem kein echter e2e-Test — Benennung korrigieren.) |
| LOW | nein | `deploy/install.sh:110` (default: main) vs `deploy/lxc/bootstrap.sh:20` (RELEASE default: master) | `install.sh --help` bewirbt falschen `--release`-Default (main) — dieser Branch existiert nicht | `install.sh:110` auf den real existierenden Default angleichen (master bzw. den kanonischen Release-Branch/Tag) und mit `bootstrap.sh` konsistent halten. |
| LOW | nein | `deploy/lxc/bootstrap.sh:20` (RELEASE branch/tag/commit, default master) | `bootstrap.sh` dokumentiert RELEASE als `commit`-fähig, aber der Clone kann keinen Commit-SHA nutzen | Entweder die Doku auf `branch/tag` beschränken (kein Commit), ODER den Clone-Pfad so erweitern, dass ein Commit-SHA tatsächlich ausgecheckt werden kann (fetch + checkout SHA statt shallow branch/tag clone). |
| LOW | nein | `deploy/lxc/bootstrap.sh:364` (Verweis „see CONTRIBUTING.md"); `CONTRIBUTING.md` fehlt im Repo (verifiziert) | `bootstrap.sh` + README referenzieren eine CONTRIBUTING.md, die im Repo nicht existiert | `CONTRIBUTING.md` anlegen (insb. Hinweis zum committeten/ge-bauten `frontend/build`-Artefakt) ODER die Referenz in `bootstrap.sh`/README auf eine existierende Doku umbiegen. |
| LOW | nein | `deploy/README.md:160-165` (Expected-output-Block) vs tatsächliche Echo-Ausgaben in `deploy/lxc/bootstrap.sh` | `deploy/README` idempotent-exit-Beispielausgabe stimmt nicht mit `bootstrap.sh`'s echter Ausgabe überein | Den Beispiel-Output-Block in `deploy/README.md` an die echten echo-Zeilen von `bootstrap.sh` angleichen. |
| LOW | nein | `CHANGELOG.md:71` (nur [0.6.0]-Linkref vorhanden) | CHANGELOG-Link-Referenzdefinitionen unvollständig (nur 0.6.0 definiert) | Fehlende Versions-Linkreferenzen (Unreleased + frühere Tags) ergänzen, sodass alle im CHANGELOG verlinkten Versionen auflösbar sind. |

---

_Methode: Ultracode Multi-Agent find→adversarial-verify, im Auftrag Christins._
