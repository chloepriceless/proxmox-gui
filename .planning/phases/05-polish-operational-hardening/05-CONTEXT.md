# Phase 5: Polish & Operational Hardening - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Take the working v1 product and make it production-ready: mobile-usable, secure-by-default
for long-lived deployments, self-updating, and packaged for one-line install into a single
production-ready LXC. The phase delivers four requirements — UI-03 (mobile + accessibility),
AUTH-06 (idle session timeout), AUDIT-06 (audit retention/rotation), DEPLOY-04 (self-update) —
plus two mandated cleanups: the full Phase-1 carryover debt block (~17 review/verification
items) and the deferred UAT-1c blocker (community-script SSH trust).

No new product capabilities. New features belong in v2.

</domain>

<decisions>
## Implementation Decisions

### Idle Session Timeout & Re-Auth (AUTH-06)
- **D-01:** Runtime-configurable operational settings move into a new **DB-backed admin
  Settings page** — a settings table + admin Settings UI + GET/PATCH endpoint. This is the
  canonical home for both the idle-timeout value (AUTH-06) and the audit-retention value
  (AUDIT-06). Changing a value takes effect without a service restart.
- **D-02:** Default idle timeout is **30 minutes**, configurable in the Settings page.
- **D-03:** On idle expiry the user sees a **modal overlay** ("session expired — sign back
  in") over the current page. After re-auth the user stays exactly where they were — route
  and transient in-page view state are preserved. No 401 wall, no redirect that loses state.
- **D-04:** A **countdown warning** fires ~2 minutes before idle logout — a live countdown
  with a "Stay signed in" button that pings the server to extend the session.
- **D-05:** Idle timeout applies to interactive cookie sessions only. PATs (automation) are
  unaffected and keep their own expiry semantics (boundary clarification — derived).

### Audit Log Retention & Rotation (AUDIT-06)
- **D-06:** Retention default is **1 year**, configurable via the Settings page (D-01).
- **D-07:** A **nightly arq cron job** — reusing the `cron_jobs` slot in `WorkerSettings`
  and the `backups_cron.py` pattern — rolls `audit_log` rows past the retention window into
  compressed **CSV.gz** archive files (reusing the existing `app/audit/csv.py` exporter),
  then deletes the rolled rows.
- **D-08:** Archive files are **downloadable from the admin Audit page** — the page lists
  archive files with download links. Archived history stays a product artifact, not just a
  filesystem blob.

### Self-Update (DEPLOY-04)
- **D-09:** Two update triggers: an **in-app admin button** AND a **helper-script flag**
  (`install.sh --update`). The script flag is the recovery path when the UI itself is broken.
- **D-10:** Self-update pulls from **tagged semver releases**; the payload is verified
  against a published **SHA-256 manifest**. `master` stays the dev branch — updates only land
  on tagged, tested releases. This also closes carryover ME-03 (install.sh integrity check).
- **D-11:** Update safety: back up the SQLite DB before updating; if a migration or the
  post-update health check fails, **automatically restore the DB and revert to the previous
  code**. Persistent state — the master key and the GUI SSH private key — is never touched
  or clobbered by an update (Phase 1 D-14; Pitfall 22).
- **D-12:** Re-running the helper-script against an **existing CTID updates that LXC in
  place** (routes into the self-update path: migrate + rebuild + restart) instead of failing.
  This satisfies the "idempotent on every subsequent run" success criterion.

### Mobile Responsiveness & Accessibility (UI-03)
- **D-13:** Mobile navigation = **hamburger drawer** — the sidebar collapses behind a
  hamburger button and slides in as an overlay drawer; handles the full nav set.
- **D-14:** The inventory list reflows to a **card stack** on mobile — each VM/LXC becomes a
  tappable card; the row action menu becomes a card action menu.
- **D-15:** The noVNC console **scales to fit** the mobile viewport — view plus basic touch
  interaction is acceptable; it is not a phone-optimized experience.
- **D-16:** The `/create` wizards are **gated on small screens** — they show a graceful
  "best on a larger screen" notice rather than rendering cramped (UI-03 exempts wizards).
- **D-17:** Accessibility pass = automated audit (axe/Lighthouse) against shadcn-svelte
  defaults **plus a deeper manual audit**: keyboard-navigation sweep, ARIA review of the
  hand-rolled components (snapshot tree, Tasks drawer, console embed), contrast check, and a
  screen-reader smoke test.

### Phase-1 Carryover Debt
- **D-18:** **Fix all ~17 carryover items in Phase 5** — nothing is accepted as v2 debt.
  Scope: ME-01..05, LO-01..04, IN-01..03, the `ssh-rsa` validator bug (backlog 999.1), the
  COOKIE_SECURE dev-only documentation + startup warning, the Caddy CSP header, and the
  scheduled cluster health probe.
- **D-19:** All carryover fixes land in **one consolidated carryover plan** (a single
  Phase-5 plan), not scattered across feature plans or split into sub-plans.
- **D-20:** TLS fingerprint pinning (a carryover verification item) uses a **capture-on-
  register (TOFU)** model — during the existing cluster "Test" step the GUI fetches the PVE
  certificate's SHA-256 fingerprint and displays it; the admin confirms it; it is pinned and
  validated on every subsequent connection, replacing `verify_ssl=False` for self-signed PVE.

### Community-Script SSH Trust (UAT-1c) & Packaging
- **D-21:** The GUI gets a dedicated **Ed25519 SSH keypair**, and the **installer auto-
  establishes trust on the hosting PVE node** — `install.sh` (running as root on that host)
  generates the keypair and writes the public key into the hosting node's
  `/root/.ssh/authorized_keys`. Community-scripts then work out-of-the-box for the hosting
  node with zero manual steps. The private key is GUI persistent state and MUST be included
  in the self-backup flow — same class as the master key (Phase 1 D-14; Pitfall 22).
- **D-22:** For **additional clusters** registered after install, the register-cluster flow
  **displays the GUI's public key** with a copy-paste one-liner to run on each node, plus a
  **"Verify SSH" check button** (mirrors the existing Test-cluster button). Admin-driven — no
  root password is ever handed to the GUI.
- **D-23:** A **preflight SSH check** runs before a community-script deploy: the GUI probes
  `pct exec` reachability and, on failure, blocks *only* the community-script wizard path
  with a clear "SSH trust not configured — here's how" message. Plain-LXC and VM provisioning
  paths stay fully available (they do not need SSH). Mirrors the snippets-storage preflight.

### Claude's Discretion
- **ME-02 rate limiter:** in-memory vs Redis-backed is Claude's call. Lean — move the
  token-bucket state to Redis (a hard dependency since Phase 3) so it stops being a
  per-uvicorn-worker blind spot; acceptable fallback is keeping it in-memory and asserting
  single-worker uvicorn at startup if the systemd unit is single-worker by design.
- **Idle-timeout enforcement model:** server-side authoritative (refuse refresh once the
  idle window lapses, leveraging the existing refresh-token rotation that already records
  per-session recency) with the client-side timer driving the warning + proactive re-auth.
  Up-to-15-min granularity (the access-JWT TTL) is acceptable.
- Audit-rotation cron cadence (nightly assumed), on-disk archive directory, file naming.
- Self-update progress UX — how the in-progress update + restart blip is surfaced to the
  admin's browser (maintenance page vs reconnect-polling).
- LXC SSH client config / `known_hosts` handling — the existing
  `StrictHostKeyChecking=accept-new` TOFU host-key pinning is retained.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 requirements & scope
- `.planning/ROADMAP.md` — Phase 5 section (goal, 4 success criteria) and the **Phase-1
  carryover table** (the authoritative ~17-item list with per-item IDs and file locations).
- `.planning/REQUIREMENTS.md` — UI-03, AUTH-06, AUDIT-06, DEPLOY-04 definitions + traceability.
- `HANDOFF.md` — UAT-1c deferral rationale; live-system access details (LXC 192.168.20.171).

### Carryover source documents
- `.planning/phases/01-foundation/01-REVIEW.md` — origin of ME-01..05, LO-01..04, IN-01..03
  (the consolidated carryover plan must read this for each item's full description).
- `.planning/phases/01-foundation/01-VERIFICATION.md` — origin of the TLS fingerprint
  pinning, CSP header, and scheduled health-probe carryover items.
- `.planning/phases/04-provisioning-networking-console/04-HUMAN-UAT.md` — UAT-1c (community-
  script deploy) deferral record.

### Prior-phase decisions that constrain this phase
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-09/D-10/D-11 (cookie sessions, 15-min
  access JWT / 7-day rotating refresh, DB-stored revocable refresh tokens — AUTH-06 layers on
  this); D-14 (master key is persistent state, must be in self-backup); D-16/D-17 (Debian 12
  LXC, three systemd units, journald — self-update + packaging build on this).

### Constraints & spike findings
- `.planning/research/PITFALLS.md` — Pitfall 22 (self-backup must include the master key and
  now the SSH private key); Pitfall 19 (unprivileged LXC — install.sh must not regress this).
- `.planning/phases/04-provisioning-networking-console/04-SPIKE-community-scripts.md` §3 —
  the authoritative SSH `pct exec` mechanism for UAT-1c (no PVE REST endpoint exists).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/jobs/worker.py` (`WorkerSettings.cron_jobs`) + `backend/app/jobs/backups_cron.py`
  — the established arq-cron pattern. Both the audit-rotation job (D-07) and the scheduled
  cluster health probe (carryover) plug straight into `cron_jobs`.
- `backend/app/audit/csv.py` — the existing audit CSV exporter; the rotation archive (D-07)
  reuses it to write CSV.gz files.
- Cluster "Test" flow + separate Test/Register buttons (Phase 1, `admin/clusters/new`) — the
  surface TLS fingerprint capture (D-20) and the SSH "Verify" button (D-22) attach to.
- `backend/app/clusters/connector.py` `_call_with_breaker` + the snippets-storage preflight
  pattern — the SSH preflight check (D-23) follows the same shape.

### Established Patterns
- `backend/app/config.py` — env-driven pydantic `BaseSettings`. The new Settings page (D-01)
  is a *new* DB-backed layer; the COOKIE_SECURE startup warning (carryover) lands in config.py.
- `backend/app/clusters/connector.py` `_ssh_pct_exec` — already shells out
  `ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new root@<node>` then `pct exec`.
  UAT-1c is purely the missing *trust setup* (keypair + authorized_keys), not new transport.
- Alembic migrations (`0001`..`0006_phase4`) — the Settings table and any carryover schema
  change add the next-numbered revision.

### Integration Points
- New admin Settings page → sidebar nav, admin route group, GET/PATCH endpoint, settings table.
- Self-update → the three systemd units (`api`/`worker`/`caddy`), Alembic, the frontend build,
  and `deploy/install.sh` (the `--update` path + existing-CTID idempotency).
- TLS pinning → `backend/app/clusters/connector.py` + the `clusters` table (store fingerprint)
  + the cluster registration UI.
- SSH trust → `deploy/install.sh` (keypair gen + hosting-node authorized_keys), cluster
  registration UI (pubkey display + Verify button), community-script wizard preflight.
- Carryover files (per the ROADMAP table): `backend/app/security/rate_limit.py`,
  `backend/app/setup/service.py`, `backend/app/clusters/connector.py`, `backend/app/auth/`,
  `backend/app/pats/service.py`, `backend/app/teams/service.py`, `backend/app/{users,teams,
  clusters}/schemas.py`, `backend/app/ssh_keys/service.py`, `deploy/lxc/bootstrap.sh`,
  `deploy/caddy/Caddyfile.template`, `frontend/src/hooks.server.ts`, and a new
  `backend/app/clusters/probe.py`.

</code_context>

<specifics>
## Specific Ideas

- Re-auth must feel like a modal interruption, not a navigation event — the user's place in
  the app survives a session expiry (D-03).
- "One command for install and update" — re-running the helper-script just works (D-12).
- Community-scripts should be zero-config on the hosting node and an explicit, guided
  one-time step on every other cluster (D-21/D-22).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The whole Phase-1 carryover block was folded
into this phase (D-18) rather than deferred.

</deferred>

---

*Phase: 05-polish-operational-hardening*
*Context gathered: 2026-05-19*
