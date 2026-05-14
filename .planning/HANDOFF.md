---
handoff_date: 2026-05-14
paused_at: Phase 2 discuss-phase — Bereich 1 (Inventory Dashboard Shape), 4 Fragen ausstehend
resume_command: /gsd-resume-work
next_phase: 2
---

# Session Handoff — Phase 2 Discuss In Progress

## Where We Are

**Phase 1 is COMPLETE** ✓
- 10/10 Plans abgeschlossen + Operator-Smoke-Test 21/21 approved
- Code-Review fand 2 BLOCKER + 3 HIGH → alle 5 von gsd-code-fixer auto-gefixt
- Phase 5 Carryover-Liste hat 16 Items (5 MED + 4 LOW + 3 INFO + ssh-rsa Backlog + 4 deferred Phase-1-Items)
- Branch `master`, alles committed bis Commit `4f6ea2b`

**Phase 2 ist GESTARTET** (in `discuss-phase` Stage)
- User hat alle 4 Gray Areas zur Diskussion ausgewählt:
  1. Inventory Dashboard Shape
  2. Quota UI & Admission UX
  3. Tagging + Notes System
  4. Audit Log UX

**Wo unterbrochen:** Mitten in Bereich 1, kurz bevor 4 Fragen gestellt wurden.

## Resume — die offenen 4 Fragen (Bereich 1: Inventory Dashboard Shape)

Diese müssen beim Resume zuerst beantwortet werden:

### Frage 1.1 — Layout: Wie soll der Inventory-View über Cluster hinweg strukturiert sein?
- **A. Unified flat list** (Recommended) — Eine paginierte Liste mit Spalte 'Cluster'. Hetzner-Style.
- B. Cluster-grouped sections — Pro Cluster collapsible Section.
- C. Context-switched — Header-Dropdown wählt aktiven Cluster, Liste zeigt nur den.

### Frage 1.2 — Cluster-Context-Picker im Header
- **A. 'All clusters' default + filter** (Recommended) — Default 'Alle', persistiert pro Session in localStorage.
- B. Pro Page sticky — Auswahl persistiert pro Seite.
- C. Nur expliziter Switch — Default 'alle', kein localStorage.

### Frage 1.3 — Unreachable Cluster Degradation
- **A. Pro-Cluster Banner + stale cache** (Recommended) — Andere Cluster bleiben funktional.
- B. Cluster ausblenden — Verschwindet aus Liste mit Toast.
- C. Globaler Read-only Mode — Wenn EINER fällt, alles read-only.

### Frage 1.4 — Search & Filter UX
- **A. Filter chips + URL params** (Recommended) — Shareable links, browser-back works.
- B. Left sidebar filters — Mehr Platzbedarf, Hetzner-Style.
- C. Toolbar dropdown + search box — Kompakter.

Nach Bereich 1 kommen noch Bereiche 2-4 (Quota UI, Tagging/Notes, Audit Log).

## Already Locked (carry forward — nicht nochmal fragen)

Aus Phase 1 (`01-CONTEXT.md` Decisions D-01..D-19):
- Team = primärer Tenant. Jeder User hat personal team + N shared teams.
- Quota-Math: per-team OR per-user XOR (D-08).
- Per-tenant PVE Tokens + 1 Pool/Team — Proxmox enforced ACLs.
- ClusterStatusPill component existiert und kann wiederverwendet werden.
- ConnectorRegistry mit asyncio.to_thread Pattern aus Plan 01-06.

Aus ROADMAP Phase 2 Notes (technical-locked, planner befolgt automatisch):
- 30s resource cache + Circuit-Breaker auf Connector
- Synchroner Audit-Writer (vor HTTP-Return)
- DB-Level Row-Locking für Quota-Admission (SELECT FOR UPDATE auf aiosqlite)
- Storage/SDN-Refs namespaced by `cluster_id`

## Environment State at Pause

**Backend** (uvicorn auf 127.0.0.1:8000, PID 1802157) — **läuft mit ALTEM Code**, vor den Auto-Fix-Commits.

**Frontend** (adapter-node auf 0.0.0.0:5173, PID 1800408) — auch alter Build vor Auto-Fixes.

**DB** in `backend/app.db` — enthält:
- User `chrissi` (admin) — Passwort: `TestPass2026!` (mein letzter Reset)
- User `alice` (non-admin) — Passwort: `AlicePass2026!`
- 1 registered Cluster (192.168.20.240, verify_ssl=false weil self-signed)

**Wichtige Dev-Setup-Workarounds in `.env` und Code (NICHT committed, gitignored bzw. dokumentiert):**
- `backend/.env`: `PROXMOX_GUI_COOKIE_SECURE=false` (HTTP-Dev)
- `backend/.dev-secrets/master.key` (32-byte raw) und `jwt.secret` — generated, nicht in git
- `frontend/src/hooks.server.ts`: `/api/*` Proxy fallback (COMMITTED, Production hat Caddy davor)
- `frontend/build/` — adapter-node build, älter als die Auto-Fix-Commits

## Beim Resume zu tun

1. **Backend restarten** mit aktuellem Code (für die Auto-Fixes):
   ```bash
   cd /home/dev/vm-deployment-gui/backend
   pkill -f "uvicorn app.main"
   .venv/bin/alembic upgrade head  # Migration 0002 (uq_one_admin) muss laufen
   setsid sh -c '.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level warning > /tmp/uvicorn.log 2>&1' & disown
   ```

2. **Frontend rebuilden** (mit den ssh-keys Dialog-Fixes + hooks.ts Proxy):
   ```bash
   cd /home/dev/vm-deployment-gui/frontend
   pkill -f "node build/index.js"
   NODE_OPTIONS="--max-old-space-size=8192" pnpm run build
   PORT=5173 HOST=0.0.0.0 ORIGIN=http://localhost:5173 PROXMOX_GUI_BACKEND_URL=http://127.0.0.1:8000 \
     setsid sh -c 'node build/index.js > /tmp/preview.log 2>&1' & disown
   ```

3. **Resume Phase 2 discuss:**
   ```
   /gsd-resume-work
   ```
   Oder direkt:
   ```
   /gsd-discuss-phase 2
   ```
   → Sagen "ich habe gerade die 4 Fragen zu Bereich 1 (Inventory Dashboard Shape) offen". Claude soll dann genau die 4 oben listed Fragen stellen.

## Git State

```
4f6ea2b docs(roadmap): carry Phase-1 review/verification findings into Phase 5
a7bda99 docs(01): review-fix summary
4890ee7 fix(01-07-HI03): flatten delete_user into single atomic transaction
657bcb1 fix(01-05-HI02): remove dead selectinload branch in resolve_pat
cc18d19 fix(01-05-HI01): trust X-Forwarded-For only from configured proxies
d2600e5 fix(01-07-BL02): close TOCTOU race on first-run admin via partial unique index
b83409b fix(01-04-BL01): close shell injection in pct exec heredoc
6f4e30e docs(01): code-review + phase-verification reports
8bed8d5 docs(backlog): track ssh-rsa key rejection (smoke-test finding)
3042196 fix(01-08,01-09): dev-proxy + ssh-key dialog UX
efa28df docs(01-10): finalize plan after operator smoke-test approval
```

`git status` should be clean (nichts uncommitted).

## Phase 5 Carryover (zur Erinnerung)

In ROADMAP.md Phase 5 Notes stehen jetzt 16 Items die beim späteren `/gsd-discuss-phase 5` automatisch aufgegriffen werden:
- 5 MEDIUM Findings (ME-01..ME-05)
- 4 LOW Findings (LO-01..LO-04)
- 3 INFO Findings (IN-01..IN-03)
- ssh-rsa Backlog (999.1)
- 3 explicitly deferred Phase-1-Items (TLS fingerprint pinning, CSP, periodic cluster probe)
- 1 deploy-doc Item (COOKIE_SECURE=true Production-Default + startup-warning)

---

*Sicher fortsetzbar mit `/gsd-resume-work` nach `/clear`. Phase 2 ist eingerichtet aber nichts geschrieben — keine halben CONTEXT.md-Files. Bei Resume einfach die 4 oben gelisteten Fragen abarbeiten, dann gehts mit Bereich 2 weiter.*
