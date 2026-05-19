# Phase 5: Polish & Operational Hardening - Research

**Researched:** 2026-05-19
**Domain:** Operational hardening of a single-LXC FastAPI + SvelteKit product — self-update, TLS pinning, idle session timeout, audit retention, mobile/a11y, SSH trust, carryover debt
**Confidence:** HIGH (codebase patterns verified by direct file read; library mechanics verified against installed versions and official docs)

## Summary

Phase 5 ships **no new product capability**. It delivers four requirements (UI-03 mobile/a11y, AUTH-06 idle timeout, AUDIT-06 audit retention, DEPLOY-04 self-update) plus the full Phase-1 carryover debt block and the deferred UAT-1c community-script SSH-trust blocker. The CONTEXT.md decisions D-01..D-23 are **locked** — this research is about *how* to implement them well, not whether.

The single highest-risk task is **self-update (DEPLOY-04)**. A FastAPI process under systemd cannot restart itself synchronously — the moment `systemctl restart` lands, the process running the update is killed mid-flight. The verified pattern is a **detached handoff**: the API enqueues an update *job*, the worker (or a `systemd-run` transient unit) runs the swap/migrate/rebuild/restart sequence in a process the API's death cannot interrupt, and the browser reconnect-polls `/api/v1/health` to detect when the new code is up. DB safety uses SQLite's online-backup-API copy (`.backup` / `VACUUM INTO`) — a plain `cp` of a WAL-mode DB silently loses the `-wal` file's uncommitted pages. Rollback is code-symlink-swap + DB-file-restore.

The other six areas are lower-risk and map cleanly onto existing codebase patterns: TLS fingerprint pinning slots into the `PVEConnector` constructor via a custom `requests` `HTTPAdapter` (proxmoxer exposes `ProxmoxHttpSession(requests.Session)`); idle timeout is a server-authoritative check inside the existing `/auth/refresh` route reading a new `last_active_at` column on `refresh_tokens`; audit retention is an arq cron job reusing `backups_cron.py` + `audit/csv.py`; DB-backed Settings is a one-row table + admin GET/PATCH with an in-process cache; mobile/a11y is Tailwind v4 responsive variants + shadcn-svelte `Sheet`; SSH trust is `install.sh` keypair generation + `authorized_keys` write, mirroring the existing `_ssh_pct_exec` transport.

**Primary recommendation:** Implement self-update as a **worker-owned arq job** (`run_self_update`) — the worker is a *separate systemd unit* from the API, so the worker survives the API restart and can itself be restarted last. This is strictly simpler and more observable than `systemd-run` and reuses the existing job/UPID/Tasks-drawer infrastructure. Land all carryover items in one consolidated plan (D-19). Sequence the self-update plan last and gate it behind every other plan being merged.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Idle Session Timeout & Re-Auth (AUTH-06)**
- **D-01:** Runtime-configurable operational settings move into a new **DB-backed admin Settings page** — a settings table + admin Settings UI + GET/PATCH endpoint. Canonical home for both the idle-timeout value (AUTH-06) and the audit-retention value (AUDIT-06). Changing a value takes effect without a service restart.
- **D-02:** Default idle timeout is **30 minutes**, configurable in the Settings page.
- **D-03:** On idle expiry the user sees a **modal overlay** ("session expired — sign back in") over the current page. After re-auth the user stays exactly where they were — route and transient in-page view state preserved. No 401 wall, no redirect that loses state.
- **D-04:** A **countdown warning** fires ~2 minutes before idle logout — a live countdown with a "Stay signed in" button that pings the server to extend the session.
- **D-05:** Idle timeout applies to interactive cookie sessions only. PATs (automation) are unaffected and keep their own expiry semantics (boundary clarification — derived).

**Audit Log Retention & Rotation (AUDIT-06)**
- **D-06:** Retention default is **1 year**, configurable via the Settings page (D-01).
- **D-07:** A **nightly arq cron job** — reusing the `cron_jobs` slot in `WorkerSettings` and the `backups_cron.py` pattern — rolls `audit_log` rows past the retention window into compressed **CSV.gz** archive files (reusing the existing `app/audit/csv.py` exporter), then deletes the rolled rows.
- **D-08:** Archive files are **downloadable from the admin Audit page** — the page lists archive files with download links.

**Self-Update (DEPLOY-04)**
- **D-09:** Two update triggers: an **in-app admin button** AND a **helper-script flag** (`install.sh --update`). The script flag is the recovery path when the UI itself is broken.
- **D-10:** Self-update pulls from **tagged semver releases**; the payload is verified against a published **SHA-256 manifest**. `master` stays the dev branch — updates only land on tagged, tested releases. Also closes carryover ME-03 (install.sh integrity check).
- **D-11:** Update safety: back up the SQLite DB before updating; if a migration or the post-update health check fails, **automatically restore the DB and revert to the previous code**. Persistent state — master key and GUI SSH private key — never touched or clobbered by an update (Phase 1 D-14; Pitfall 22).
- **D-12:** Re-running the helper-script against an **existing CTID updates that LXC in place** (routes into the self-update path: migrate + rebuild + restart) instead of failing.

**Mobile Responsiveness & Accessibility (UI-03)**
- **D-13:** Mobile navigation = **hamburger drawer** — sidebar collapses behind a hamburger button, slides in as an overlay drawer; handles the full nav set.
- **D-14:** The inventory list reflows to a **card stack** on mobile — each VM/LXC becomes a tappable card; the row action menu becomes a card action menu.
- **D-15:** The noVNC console **scales to fit** the mobile viewport — view plus basic touch interaction is acceptable; not a phone-optimized experience.
- **D-16:** The `/create` wizards are **gated on small screens** — they show a graceful "best on a larger screen" notice (UI-03 exempts wizards).
- **D-17:** Accessibility pass = automated audit (axe/Lighthouse) against shadcn-svelte defaults **plus a deeper manual audit**: keyboard-navigation sweep, ARIA review of the hand-rolled components (snapshot tree, Tasks drawer, console embed), contrast check, screen-reader smoke test.

**Phase-1 Carryover Debt**
- **D-18:** **Fix all ~17 carryover items in Phase 5** — nothing accepted as v2 debt. Scope: ME-01..05, LO-01..04, IN-01..03, the `ssh-rsa` validator bug (backlog 999.1), the COOKIE_SECURE dev-only documentation + startup warning, the Caddy CSP header, and the scheduled cluster health probe.
- **D-19:** All carryover fixes land in **one consolidated carryover plan** (a single Phase-5 plan), not scattered or split into sub-plans.
- **D-20:** TLS fingerprint pinning uses a **capture-on-register (TOFU)** model — during the existing cluster "Test" step the GUI fetches the PVE certificate's SHA-256 fingerprint and displays it; the admin confirms it; it is pinned and validated on every subsequent connection, replacing `verify_ssl=False` for self-signed PVE.

**Community-Script SSH Trust (UAT-1c) & Packaging**
- **D-21:** The GUI gets a dedicated **Ed25519 SSH keypair**; the **installer auto-establishes trust on the hosting PVE node** — `install.sh` (running as root on that host) generates the keypair and writes the public key into the hosting node's `/root/.ssh/authorized_keys`. The private key is GUI persistent state and MUST be included in the self-backup flow — same class as the master key (Phase 1 D-14; Pitfall 22).
- **D-22:** For **additional clusters** registered after install, the register-cluster flow **displays the GUI's public key** with a copy-paste one-liner to run on each node, plus a **"Verify SSH" check button** (mirrors the existing Test-cluster button). Admin-driven — no root password ever handed to the GUI.
- **D-23:** A **preflight SSH check** runs before a community-script deploy: the GUI probes `pct exec` reachability and, on failure, blocks *only* the community-script wizard path with a clear "SSH trust not configured — here's how" message. Plain-LXC and VM provisioning paths stay fully available. Mirrors the snippets-storage preflight.

### Claude's Discretion
- **ME-02 rate limiter:** in-memory vs Redis-backed is Claude's call. Lean — move the token-bucket state to Redis (a hard dependency since Phase 3) so it stops being a per-uvicorn-worker blind spot; acceptable fallback is keeping it in-memory and asserting single-worker uvicorn at startup if the systemd unit is single-worker by design.
- **Idle-timeout enforcement model:** server-side authoritative (refuse refresh once the idle window lapses, leveraging the existing refresh-token rotation that already records per-session recency) with the client-side timer driving the warning + proactive re-auth. Up-to-15-min granularity (the access-JWT TTL) is acceptable.
- Audit-rotation cron cadence (nightly assumed), on-disk archive directory, file naming.
- Self-update progress UX — how the in-progress update + restart blip is surfaced to the admin's browser (maintenance page vs reconnect-polling).
- LXC SSH client config / `known_hosts` handling — the existing `StrictHostKeyChecking=accept-new` TOFU host-key pinning is retained.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. The whole Phase-1 carryover block was folded into this phase (D-18) rather than deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **UI-03** | Mobile-responsive (list, detail, console reflow; wizards may be desktop-only) | §Mobile & Accessibility — Tailwind v4 responsive variants, shadcn-svelte `Sheet` for the hamburger drawer (D-13), card-stack reflow pattern (D-14), `aspect-ratio` + viewport scaling for noVNC (D-15), small-screen wizard gate (D-16), axe-core + Lighthouse audit tooling (D-17). |
| **AUTH-06** | Session expires after configurable idle timeout | §Idle Session Timeout — server-authoritative `last_active_at` column on `refresh_tokens`, idle check inside `/auth/refresh`, client countdown + "stay signed in" ping, modal-overlay re-auth preserving route state (D-01..D-05). |
| **AUDIT-06** | Audit log retention/rotation policy (configurable, default 1 year) | §Audit Retention & Rotation — arq cron via `WorkerSettings.cron_jobs`, reuse `backups_cron.py` shape + `audit/csv.py` for CSV.gz archive, archive listing + download endpoint (D-06..D-08). |
| **DEPLOY-04** | Self-update path from inside the app (or via helper-script flag) | §Self-Update — worker-owned arq `run_self_update` job (detached handoff), SHA-256 manifest verification of tagged release, SQLite online-backup-API DB snapshot, atomic code symlink swap, auto-rollback, `install.sh --update` + existing-CTID idempotency (D-09..D-12). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Idle-timeout enforcement (refuse stale refresh) | API / Backend | — | Authoritative gate must be server-side; a client-only timer is bypassable. The `/auth/refresh` route is the single chokepoint that already rotates session state. |
| Idle countdown + "stay signed in" warning | Browser / Client | API / Backend | UX timer + proactive ping originate in the SPA; the backend only honours the ping by updating `last_active_at`. |
| Re-auth modal overlay (route-state preservation) | Browser / Client | — | Pure SPA concern — overlay a component, do not navigate. |
| DB-backed runtime Settings | API / Backend | Database | A `settings` table + GET/PATCH endpoint; an in-process cache makes reads restart-free. |
| Audit retention cron | Worker (arq) | Database, Filesystem | A scheduled background job — belongs in the worker process, not the request path. Writes CSV.gz to the LXC filesystem, deletes DB rows. |
| Audit archive download | API / Backend | Filesystem | A `FileResponse` / `StreamingResponse` streaming an on-disk `.csv.gz`. |
| Self-update orchestration | Worker (arq) | Filesystem, systemd, Database | The worker is a *separate systemd unit* — it survives the API restart. It does the git pull / pip install / migrate / rebuild / `systemctl restart`. |
| Self-update trigger (button) | API / Backend | Worker | A 202-enqueue route, same contract as every other mutation. |
| Self-update trigger (`install.sh --update`) | Helper-script (PVE host) | LXC shell | Runs `pct exec` into the LXC and invokes the same in-LXC update script the worker job calls. |
| TLS fingerprint pinning | API / Backend | — | A custom `requests` `HTTPAdapter` mounted on proxmoxer's session — connector-layer concern. |
| TLS fingerprint capture | API / Backend | Browser / Client | Backend fetches + computes the SHA-256; the SPA displays it for admin confirmation during cluster Test. |
| SSH keypair generation + trust | Helper-script (PVE host) | API / Backend | `install.sh` (root on the PVE host) generates the keypair and writes `authorized_keys`. The backend reads the private key for `pct exec`. |
| SSH "Verify" + preflight | API / Backend | Browser / Client | Backend probes `pct exec`; the SPA renders the pubkey one-liner + Verify button + the wizard block. |
| Mobile reflow / a11y | Browser / Client | — | Pure SvelteKit + Tailwind + shadcn-svelte. |
| Caddy CSP header | CDN / Static (Caddy) | — | A response header set by the reverse proxy. |
| Scheduled cluster health probe | Worker (arq) | Database | An arq cron job updating `clusters.status`-equivalent state. |

## Standard Stack

No new runtime dependencies are required for Phase 5. Every locked decision is implementable with libraries already pinned in `backend/pyproject.toml` and `frontend/package.json`. This is deliberate — Phase 5 is hardening, not feature work.

### Core — already present, verified against installed versions

| Library | Version (verified) | Purpose in Phase 5 | Why Standard |
|---------|--------------------|--------------------|--------------|
| `arq` | 0.26.3 | `run_self_update` job + audit-retention cron + scheduled health-probe cron | Already the job queue; `WorkerSettings.cron_jobs` already used by `backups_cron.py`. |
| `requests` | 2.33.0 | TLS fingerprint pinning via a custom `HTTPAdapter` | proxmoxer's HTTPS backend *is* a `requests.Session` subclass — pinning mounts onto it. `[VERIFIED: .venv]` |
| `urllib3` | 2.7.0 | `assert_fingerprint` — the actual pin enforcement primitive | `urllib3` natively supports `assert_fingerprint` on its connection pools; `requests` delegates to it. `[CITED: deepwiki.com/urllib3/urllib3]` |
| `cryptography` | 46.0.7 | SSH key parse/fingerprint (already used in `ssh_keys/service.py`); SHA-256 manifest verification | Already a dependency; `serialization.load_ssh_public_key` already in use. |
| `proxmoxer` | 2.3.0 | PVE API client; its `ProxmoxHttpSession(requests.Session)` is the pinning mount point | The only mature PVE client; constructor accepts the host/port/verify posture the connector already stores. `[VERIFIED: .venv proxmoxer/backends/https.py]` |
| `sqlalchemy[asyncio]` | 2.0.49 + `aiosqlite` 0.22.1 | The `settings` table model + idle-timeout `last_active_at` column | Established ORM; new Alembic revision adds the schema. |
| `alembic` | 1.18.4 | `0007_phase5` migration — `settings` table + `refresh_tokens.last_active_at` + any carryover schema change (e.g. cluster `tls_fingerprint` is already a column) | Migrations `0001`..`0006` exist; next is `0007`. |

### Supporting — Python stdlib (no install)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `gzip` | Write `.csv.gz` audit archives | In the audit-retention cron — wrap `audit/csv.py` output. |
| `hashlib` | SHA-256 of the downloaded release tarball vs the manifest | In `run_self_update` payload verification (D-10). |
| `sqlite3` (`.backup` via `connection.backup()`) OR `VACUUM INTO` | Safe DB snapshot before update (D-11) | A WAL-mode DB **cannot** be backed up with `cp` — see Pitfall 1. |
| `subprocess` / `asyncio.create_subprocess_exec` | `git`, `pip`, `pnpm`/`vite`, `alembic`, `systemctl` calls in `run_self_update`; `ssh-keygen` in `install.sh` (bash) | Same shell-out pattern already used by `_ssh_pct_exec`. |
| `tempfile` / `shutil` | Stage the downloaded release; atomic directory swap | Stage in a temp dir, then `os.rename`/symlink swap. |

### Supporting — frontend dev tooling (new dev dependencies — D-17)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@axe-core/playwright` *or* `axe-core` + `vitest`/`happy-dom` | Automated a11y audit against rendered components (D-17) | The repo already has `vitest` 3 + `happy-dom` 20. `axe-core` can run inside a `vitest` component test against `happy-dom`'s DOM. Playwright is heavier (new browser binary) — prefer the `vitest` + `axe-core` route for CI; reserve Lighthouse for a one-off manual audit. `[CITED: deque.com/axe/axe-core]` |
| Lighthouse (CLI, one-off) | Manual a11y/perf snapshot of key routes | Not a CI dependency — run `npx lighthouse` ad hoc during the manual audit half of D-17. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Worker-owned `run_self_update` arq job | `systemd-run --no-block` transient unit spawned by the API | `systemd-run` works (detached, survives parent — `[CITED: freedesktop.org/.../systemd-run.html]`) but the LXC's API service user is unprivileged and cannot reliably create system-scope transient units; it also bypasses the Tasks-drawer/job-row observability the worker job gets for free. **Recommendation: worker job.** |
| `connection.backup()` (Python sqlite3 online-backup API) | `VACUUM INTO 'file'` | Both are WAL-safe. `.backup` is a byte-faithful page copy; `VACUUM INTO` compacts. For a pre-update snapshot a faithful copy is preferable (restore must reproduce exact state) — use `.backup`. |
| `requests` `HTTPAdapter` subclass for pinning | `verify=<CA bundle path>` with the PVE node cert as a trusted CA | Pinning the *leaf fingerprint* (D-20 TOFU) is what the decision mandates; a CA-bundle approach trusts anything that cert's issuer signs. Fingerprint pin is strictly tighter and matches PVE's own `pvecm`/PBS fingerprint model. |
| arq cron for audit retention | systemd timer running a one-shot script | The arq cron path is already established (`backups_cron.py`), keeps everything in one observability surface, and reuses `audit/csv.py` in-process. systemd timer would re-implement DB access outside the app. |

**Installation:**
```bash
# Backend: no new packages.
# Frontend (D-17 automated audit — dev dependency only):
cd frontend && pnpm add -D axe-core
```

**Version verification performed:**
- `requests 2.33.0`, `urllib3 2.7.0`, `cryptography 46.0.7` — confirmed via `.venv/bin/python -c "import ..."`.
- `proxmoxer 2.3.0` — pinned in `pyproject.toml`; HTTPS backend source inspected in `.venv`.
- Frontend versions read from `frontend/package.json` (SvelteKit `^2.59.1`, Svelte `^5.55.5`, Tailwind `^4.3.0`, `bits-ui ^2.18.1`).

## Architecture Patterns

### System Architecture Diagram — Self-Update Data Flow (the highest-risk path)

```
  ADMIN BROWSER                  API process            WORKER process            FILESYSTEM / systemd
  (SvelteKit SPA)               (proxmox-gui-api)       (proxmox-gui-worker)
        |                             |                       |
   click "Update"                     |                       |
        |--- POST /api/v1/admin/self-update -->|               |
        |                             |-- enqueue job ------->|  (arq → Redis)
        |<-- 202 {job_id} ------------ |                       |
        |                             |                       |
   reconnect-poll                     |                       |--[1] GET release manifest + tarball
   GET /api/v1/health  (loop)         |                       |--[2] verify SHA-256 vs manifest
        |                             |                       |--[3] sqlite .backup → app.db.pre-update
        |                             |                       |--[4] stage new code in /opt/.../src-<tag>
        |                             |                       |--[5] pip install -e  +  pnpm build
        |                             |                       |--[6] alembic upgrade head
        |                             |                       |--[7] symlink swap: current -> src-<tag>
        |                             |                       |--[8] systemctl restart api  ((API DIES HERE))
        |   ... /health fails ...     X (restarting)           |
        |                             |                       |--[9] poll new API /health (up to 60s)
        |                             |  (new API boots)       |--[10a] healthy -> done, mark job ok
        |   ... /health 200 ...       |<----------------------/ |--[10b] UNHEALTHY -> restore app.db,
        |<-- /health 200 ------------ |                       |         revert symlink, restart api,
   reload page on the new code        |                       |         mark job failed
        |                             |                       |--[11] systemctl restart worker (LAST,
        |                             |                       |        re-exec self on new code)
```

Key insight from the diagram: **step [8] kills the API but not the worker** (separate systemd units — verified: `proxmox-gui-api.service` and `proxmox-gui-worker.service` are distinct). The worker is the durable orchestrator. The browser never holds a connection across the restart — it *reconnect-polls* `/api/v1/health` (which already exists, unauthenticated, in `main.py`). The worker restarts *itself* last (step [11]) so the new worker code takes over; an arq job that calls `systemctl restart proxmox-gui-worker` will be terminated, which is fine because the job has already recorded its terminal state.

### Recommended Project Structure (additive — no restructuring)

```
backend/app/
├── settings/                 # NEW — DB-backed runtime settings (D-01)
│   ├── __init__.py
│   ├── model.py              # AppSetting ORM (or add to models/)
│   ├── service.py            # get_setting / set_setting + in-process cache
│   ├── routes.py             # GET/PATCH /api/v1/admin/settings
│   └── schemas.py
├── selfupdate/               # NEW — self-update (DEPLOY-04)
│   ├── __init__.py
│   ├── routes.py             # POST /api/v1/admin/self-update (202 enqueue)
│   ├── service.py            # release-manifest fetch + SHA-256 verify helpers
│   └── schemas.py
├── jobs/
│   ├── selfupdate_functions.py   # NEW — run_self_update arq job function
│   └── retention_cron.py         # NEW — audit-retention nightly cron
├── clusters/
│   ├── probe.py              # NEW — scheduled cluster health probe (carryover)
│   ├── connector.py          # EDIT — TLS pinning adapter (D-20)
│   └── pinning.py            # NEW — FingerprintPinningAdapter + capture helper
└── audit/
    └── archive.py            # NEW — CSV.gz archive write + listing + download

frontend/src/
├── lib/components/layout/
│   ├── Sidebar.svelte        # EDIT — wrap in Sheet on mobile (D-13)
│   └── MobileNav.svelte      # NEW — hamburger trigger
├── lib/components/auth/
│   ├── SessionExpiredModal.svelte   # NEW — re-auth overlay (D-03)
│   └── IdleCountdownToast.svelte    # NEW — 2-min warning (D-04)
├── lib/stores/
│   └── idle.svelte.ts        # NEW — client idle timer
└── routes/admin/
    ├── settings/+page.svelte # NEW — admin Settings page (D-01)
    └── self-update/+page.svelte  # NEW — update button + progress (or fold into settings)
```

### Pattern 1: TLS Fingerprint Pinning via a custom `requests` HTTPAdapter (D-20)

**What:** Replace `verify_ssl=False` for self-signed PVE with leaf-certificate SHA-256 fingerprint validation. proxmoxer's HTTPS backend builds a `ProxmoxHttpSession(requests.Session)` — mount a pinning adapter on it. `requests` itself has no fingerprint API, but `urllib3` (which `requests` delegates to) supports `assert_fingerprint` on its connection pool.

**When to use:** Every `PVEConnector` whose cluster row has a non-null `tls_fingerprint` and `verify_ssl=False`. The connector constructor already stores `tls_fingerprint` (verified — `connector.py:140`); the Phase-1 `NotImplementedError` guard at `connector.py:95-100` is the exact line to *remove and replace*.

**Mechanism:** `urllib3`'s `HTTPSConnectionPool` accepts `assert_fingerprint="<hex>"`. Subclass `requests.adapters.HTTPAdapter` and override `init_poolmanager` / `proxy_manager_for` to pass `assert_fingerprint` into `pool_kwargs`. With a fingerprint pinned, set `verify=False` on the pool (cert-chain validation is intentionally off — the fingerprint *is* the trust anchor).

```python
# Source pattern: requests HTTPAdapter subclassing for pinning
# [CITED: gist.github.com/dlenski/fc42156c00a615f4aa18a6d19d67e208 — fingerprint-based validation]
# [CITED: deepwiki.com/urllib3/urllib3 — assert_fingerprint native support]
from requests.adapters import HTTPAdapter

class FingerprintPinningAdapter(HTTPAdapter):
    """Pins the PVE leaf cert by SHA-256 fingerprint (D-20 TOFU).

    `assert_fingerprint` is a urllib3 connection-pool kwarg. When set,
    urllib3 verifies the presented leaf cert's SHA-256 against it and
    raises ssl.SSLError on mismatch — independently of CA-chain checks.
    The fingerprint is the colon-free lowercase hex of the DER SHA-256.
    """
    def __init__(self, fingerprint: str, **kw):
        self._fingerprint = fingerprint.replace(":", "").lower()
        super().__init__(**kw)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        pool_kwargs["assert_fingerprint"] = self._fingerprint
        # Disable hostname/CA checks — the fingerprint is the trust anchor.
        pool_kwargs["assert_hostname"] = False
        super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)
```

**Wiring into the connector:** proxmoxer 2.3's `ProxmoxAPI` does not expose its internal session for mounting *after* construction in a documented way — but the session is built lazily by `Backend.get_session()`. The robust approach: after constructing `ProxmoxAPI`, reach the session via the backend (`self._client._backend.get_session()` is called per-request, so adapters set on the *session object* matter). The verified, simpler path is to pass `verify_ssl=False` to `ProxmoxAPI` and then **post-construction, mount the adapter on the session proxmoxer uses**. Because proxmoxer rebuilds a session per-call in some paths, the *most reliable* implementation is a thin pre-flight: capture the fingerprint once at register-time and, on every connection, pass a pre-built `requests.Session` with the adapter mounted into a custom proxmoxer backend, OR validate the fingerprint in a lightweight pre-flight call before trusting the connector. **`[ASSUMED]`** — proxmoxer 2.3.0's exact session-injection seam should be confirmed against the installed source during planning (see Open Questions Q1); the `FingerprintPinningAdapter` class itself is verified-correct, the *mount point* needs a spike-grade check.

**Capture-on-register (TOFU):** During the existing `POST /api/v1/clusters/test` flow, fetch the cert and compute the fingerprint with stdlib only — no proxmoxer needed:
```python
# Source: Python stdlib ssl — fetch + fingerprint a leaf cert
# [CITED: docs.python.org/3/library/ssl.html — getpeercert(binary_form=True)]
import ssl, socket, hashlib

def capture_fingerprint(host: str, port: int) -> str:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with socket.create_connection((host, port), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            der = ssock.getpeercert(binary_form=True)
    return hashlib.sha256(der).hexdigest()  # colon-free lowercase hex
```
The Test response surfaces this string; the admin confirms; it is persisted to `clusters.tls_fingerprint` (column already exists).

### Pattern 2: Server-authoritative idle timeout layered on refresh rotation (AUTH-06)

**What:** The existing session model is a 15-min access JWT + a 7-day rotating DB-stored refresh token (`refresh_tokens` table). Idle timeout is enforced by **refusing a refresh once the idle window has lapsed**. The refresh token already records `created_at` per row and rotates on every use — add a `last_active_at` column (or reuse the chain's most-recent `created_at`).

**When to use:** Inside `auth/refresh.py::consume_refresh` (or the `/auth/refresh` route). This is the single server-side chokepoint — the access JWT expires every 15 min, so a refused refresh logs the user out within ≤15 min of the idle deadline (the discretion note explicitly accepts 15-min granularity).

**Mechanism:**
1. Add `last_active_at: datetime` to `refresh_tokens` (Alembic `0007`). On `issue_refresh` set it to `now`. On every refresh, `consume_refresh` checks `now - last_active_at > idle_timeout` → raise a new `IdleExpired(InvalidRefresh)` exception → route clears cookies → SPA shows the modal (D-03).
2. The "Stay signed in" ping (D-04) is just a normal refresh call OR a lightweight `POST /api/v1/auth/keepalive` that bumps `last_active_at` without rotating the token. A dedicated keepalive is cleaner — it avoids burning a rotation on every 2-min warning dismissal.
3. Idle window value comes from the DB-backed `settings` table (D-01/D-02), read via the settings service's in-process cache — no restart coupling.
4. **D-05 boundary:** PATs never touch `refresh_tokens` — they resolve via `pats/service.py`. The idle check lives only in the refresh path, so PATs are automatically unaffected. No extra code needed; document the invariant.

**Client side (D-03/D-04):** A `$state`-based idle store in the SPA tracks last user interaction (`mousemove`/`keydown`/`click`/`scroll` listeners, debounced). At `idle_timeout - 2min` it shows `IdleCountdownToast` with a live countdown; at `idle_timeout` it shows `SessionExpiredModal`. Critically, the modal is an **overlay component, not a route navigation** — render it conditionally above `{@render children()}` in the root layout so the underlying route and its component state survive (D-03). On successful re-login the modal unmounts and the user is exactly where they were.

### Pattern 3: DB-backed runtime Settings with an in-process cache (D-01)

**What:** A `settings` table coexisting with the env-driven `config.py` `BaseSettings`. The env settings stay for *secrets and deploy-time config* (paths, JWT secret, DB URL); the new DB table holds *operator-tunable runtime values* (idle timeout, audit retention).

**When to use:** Any value an admin should change without a restart. Two values in Phase 5: `idle_timeout_minutes` (D-02) and `audit_retention_days` (D-06).

**Mechanism — key/value vs typed-columns:** Use a **single-row typed-columns table** (`id=1`, `idle_timeout_minutes INT`, `audit_retention_days INT`, `updated_at`, `updated_by_user_id`). This gives Alembic-checked types, a trivial GET/PATCH, and avoids string-parsing a key/value store. The GET/PATCH endpoints are admin-gated (`require_admin`). PATCH writes an audit entry with before/after diff (AUDIT-02 pattern already exists).

**No-restart propagation:** A module-level cache (`_cache: AppSetting | None`) loaded lazily and invalidated on PATCH. The worker process reads the same table directly (it has its own DB session via `ctx['sessionmaker']`) — the audit-retention cron reads `audit_retention_days` fresh each run, so a PATCH from the API is visible to the worker on its next run with zero IPC. **No cross-process cache invalidation needed** because each process reads the DB; only invalidate the *local* API-process cache on PATCH.

### Pattern 4: Audit retention cron — reuse `backups_cron.py` shape (AUDIT-06)

**What:** A nightly arq cron job that rolls `audit_log` rows older than `audit_retention_days` into a `.csv.gz` archive, then deletes them.

**When to use:** Registered in `WorkerSettings.cron_jobs` alongside the existing `fire_due_scheduled_backups`. Cadence: nightly (e.g. `cron(roll_audit_log, hour={3}, minute={0})`).

**Mechanism:**
1. Compute the cutoff: `now - timedelta(days=audit_retention_days)` (read from `settings` table).
2. Query `audit_log` rows with `occurred_at < cutoff`. If none, exit.
3. Stream them through the **existing `audit/csv.py` serialization logic** into a `gzip.open(...)` file at e.g. `/var/lib/proxmox-gui/audit-archives/audit-<from>-<to>.csv.gz`. `audit/csv.py`'s `audit_csv_stream` is RBAC-scoped for the *user-facing* export; the retention job needs an *unscoped* dump — factor the row-formatting (the `csv.writer` rows) into a shared helper so both call sites reuse it without the RBAC predicate.
4. `DELETE FROM audit_log WHERE occurred_at < cutoff` — only after the gz file is fsync'd and closed (write-then-delete ordering: never delete rows before the archive is durable).
5. The cron carries no `team_id` (system action) — mirror how `backups_cron.py` handles attribution.

**Archive download (D-08):** `GET /api/v1/audit/archives` lists files in the archive dir (name, size, row-range, ctime); `GET /api/v1/audit/archives/{name}` streams the `.csv.gz` via `FileResponse`. Both `require_admin`. Path-sanitize `{name}` (reject `/`, `..`) — see Pitfall 5.

### Pattern 5: Self-update as a worker-owned arq job with auto-rollback (DEPLOY-04)

**What:** `run_self_update` — an arq job function the worker executes. The API only enqueues it (202). The worker survives the API restart because it is a separate systemd unit.

**Atomic code swap:** The current install lays code at `/opt/proxmox-gui/{backend,frontend,deploy}` (verified — `bootstrap.sh` Step 4). For atomic swap + rollback, restructure to a **symlink-with-versioned-dirs** layout: `/opt/proxmox-gui/releases/<tag>/` holds each release; `/opt/proxmox-gui/current` is a symlink the systemd units' `WorkingDirectory`/`ExecStart` point at. Update = stage new release dir, `pip install`, `pnpm build`, migrate, then `ln -sfn releases/<tag> current` (atomic on POSIX) + `systemctl restart`. Rollback = repoint the symlink to the previous release dir. **This is a structural change to the deploy layout** — `bootstrap.sh` and the three systemd units must be updated to use `/opt/proxmox-gui/current`. Plan this as part of the self-update plan, not the carryover plan.

**Sequence inside `run_self_update`** (matches the diagram):
1. Fetch the release manifest (JSON listing the tagged version + tarball URL + SHA-256) and the tarball over HTTPS.
2. `hashlib.sha256` the tarball, compare to the manifest entry — abort on mismatch (D-10, also closes ME-03).
3. **DB snapshot** — `sqlite3` `.backup` of `/var/lib/proxmox-gui/app.db` → `app.db.pre-update` (WAL-safe — Pitfall 1).
4. Unpack into `releases/<tag>/`; `pip install -e backend`; build/copy `frontend/build` (the repo ships a pre-built `frontend/build/` artifact — verified `bootstrap.sh` Step 7 — so the update can reuse the committed artifact rather than running `pnpm build` in the LXC; this sidesteps the documented LXC build fragility).
5. `alembic upgrade head`.
6. Symlink swap `current → releases/<tag>`.
7. `systemctl restart proxmox-gui-api proxmox-gui-frontend` — the API dies here.
8. Poll the new API `GET /api/v1/health` for up to ~60s.
9. Healthy → mark the job done, `systemctl restart proxmox-gui-worker` last (the worker re-execs on new code).
10. Unhealthy → **auto-rollback**: restore `app.db` from `app.db.pre-update`, repoint the symlink to the previous release, `systemctl restart` the API, mark the job failed with the captured logs.

**Persistent state never clobbered (D-11):** `/etc/proxmox-gui/master.key`, `/etc/proxmox-gui/jwt.secret`, `/etc/proxmox-gui/pat.pepper`, the new GUI SSH private key (D-21), `/var/lib/proxmox-gui/app.db`, and `/var/lib/proxmox-gui/audit-archives/` all live **outside** `/opt/proxmox-gui` — the symlink swap only touches `/opt`. Confirm no update step writes into `/etc/proxmox-gui` or `/var/lib/proxmox-gui` except the deliberate DB migration.

**`install.sh --update` + existing-CTID idempotency (D-09/D-12):** `install.sh` gains an `--update` flag and an existing-CTID detector. When the target CTID already exists (or `--update` is passed), instead of `pct create` it `pct exec`s into the LXC and runs the *same in-LXC update routine* the worker job calls — factor that routine into a standalone script (e.g. `deploy/lxc/update.sh`) that both `run_self_update` and `install.sh --update` invoke. This satisfies "one command for install and update" (D-12) and is the recovery path when the UI is broken (D-09).

### Pattern 6: Mobile reflow with Tailwind v4 + shadcn-svelte (UI-03)

**Hamburger drawer (D-13):** shadcn-svelte ships a `Sheet` component (a `bits-ui` Dialog variant that slides from an edge). On `<lg` viewports, hide the static `Sidebar` and render it inside a `Sheet` triggered by a hamburger button in the `Topbar`. Tailwind v4 responsive variants (`lg:flex hidden` on the static rail, `lg:hidden` on the trigger) do the breakpoint switch — no JS media-query needed. The `Sidebar` content (`resourceItems`/`accountItems`/`adminItems` arrays — verified in `Sidebar.svelte`) is reused verbatim inside the Sheet.

**Card-stack reflow (D-14):** The inventory list is currently a table. The standard responsive pattern: render the `<table>` at `md:` and above, and a stacked `<div>`-of-cards at `<md` (`hidden md:table` / `md:hidden block`). Each card shows the same fields; the per-row action menu (a `DropdownMenu`) becomes a per-card action menu — same component, different container.

**noVNC scale-to-fit (D-15):** The console embed is an iframe (verified — `routes/console/embed`, vendored noVNC at `lib/vendor/novnc`). Wrap it in a container with `aspect-ratio` and `max-width: 100%`; noVNC's RFB client supports a `scaleViewport`/`resizeSession` option — set `scaleViewport: true` so the framebuffer scales to the container. "View + basic touch" is the accepted bar (D-15) — noVNC has built-in touch event translation.

**Wizard small-screen gate (D-16):** The `/create` route group renders a "best on a larger screen" notice when the viewport is `<md`. A simple `+layout.svelte` check in the `create/` route group: at `<md` render the notice instead of the wizard. UI-03 explicitly exempts wizards, so this is a graceful block, not a reflow.

**Accessibility (D-17):** Automated half — `axe-core` run inside `vitest` component tests (the repo has `vitest 3` + `happy-dom 20`); add a test that renders each major page/component and asserts `axe()` finds no violations. Manual half — keyboard-nav sweep, ARIA review of the three hand-rolled components (snapshot tree `routes`/`lifecycle`, Tasks drawer, console embed), contrast check, screen-reader smoke test. shadcn-svelte primitives (`bits-ui`) are accessible by default; the risk is the *hand-rolled* components.

### Anti-Patterns to Avoid

- **`cp app.db backup.db` for the pre-update snapshot.** The DB is WAL-mode (`CLAUDE.md` says WAL). A plain copy omits the `-wal` file's uncommitted pages → silent data loss / corruption. Use the SQLite online-backup API. (Pitfall 1.)
- **API process restarting itself synchronously.** `systemctl restart proxmox-gui-api` from inside the API kills the request handler running it. The restart MUST be issued by a process that survives — the worker. (Pitfall 2.)
- **Client-only idle timeout.** A timer that just calls `logout()` client-side is bypassable (disable JS, replay the cookie). The authoritative gate is server-side refusal of refresh. The client timer is *UX only*.
- **Deleting `audit_log` rows before the archive file is durable.** Write-then-fsync-then-delete. A crash between delete and write loses audit history irrecoverably.
- **Trusting `verify_ssl=False` as "pinned".** Phase 1 explicitly raised `NotImplementedError` for the `tls_fingerprint + verify_ssl=False` combination (`connector.py:95`). Removing the guard without implementing the adapter would silently ship *no* TLS validation.
- **Putting the GUI SSH private key inside `/opt/proxmox-gui`.** It must live in `/etc/proxmox-gui` (persistent state) so the symlink swap never touches it and the self-backup includes it (D-21, Pitfall 22).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAL-safe DB snapshot | A file-copy + WAL-checkpoint dance | `sqlite3.Connection.backup()` (online-backup API) or `VACUUM INTO` | The backup API correctly serialises against live writers and includes WAL pages; hand-rolling the checkpoint is a known corruption source. `[CITED: sqlite.org/wal.html]` |
| Cert fingerprint validation | Manual `getpeercert` + per-request compare in the request path | `urllib3` `assert_fingerprint` via an `HTTPAdapter` | `urllib3` validates the fingerprint inside the TLS handshake on the right thread; a manual post-hoc check has a TOCTOU window. `[CITED: deepwiki.com/urllib3/urllib3]` |
| Accessibility rule checking | A custom ARIA/contrast linter | `axe-core` | axe-core encodes WCAG 2.0/2.1/2.2 A/AA/AAA and is the engine behind Lighthouse. `[CITED: deque.com/axe/axe-core]` |
| Detached process that survives a service restart | `nohup` / `disown` / a double-fork daemon spawned by the API | The arq worker (already a separate systemd unit) | The worker is already a durable, observable, separate-process executor with job rows + Tasks-drawer streaming. |
| Scheduled jobs | A `while True: sleep()` thread or a systemd timer + standalone script | `arq` `WorkerSettings.cron_jobs` | The cron slot is already used by `backups_cron.py`; consistency + one observability surface. |
| Hamburger / slide-in drawer | A hand-built positioned `<div>` + overlay + focus trap | shadcn-svelte `Sheet` (`bits-ui` Dialog) | Focus trapping, escape handling, ARIA roles, and scroll-lock are all handled — and accessible by default (helps D-17). |
| SSH keypair generation | A Python `cryptography`-based Ed25519 keygen writing OpenSSH format | `ssh-keygen -t ed25519` in `install.sh` | `install.sh` is bash running as root on the PVE host; `ssh-keygen` is universally present and produces the exact on-disk format `ssh` expects. |

**Key insight:** Phase 5's risk is *operational correctness under failure* (a half-applied update, a corrupted backup, a bypassed timeout), not algorithmic complexity. Every "don't hand-roll" above replaces a subtly-wrong custom solution with a battle-tested primitive whose failure modes are documented.

## Runtime State Inventory

> This phase is partly a refactor/migration phase (deploy-layout change for self-update, carryover renames). The five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `app.db` (`/var/lib/proxmox-gui/app.db`) — WAL-mode SQLite. The `0007_phase5` migration adds the `settings` table + `refresh_tokens.last_active_at`. Existing `refresh_tokens` rows will have a NULL `last_active_at` — the migration must backfill it (set to `created_at`) so existing sessions don't all instantly idle-expire. | Code edit (migration) + **data migration** (backfill `last_active_at = created_at` for existing rows). |
| **Live service config** | The three systemd units (`proxmox-gui-api/-worker/-frontend.service`) carry `WorkingDirectory`/`ExecStart` paths into `/opt/proxmox-gui/...`. If self-update introduces the `releases/<tag>` + `current` symlink layout, **the installed unit files on every existing LXC must be rewritten** to point at `/opt/proxmox-gui/current/...`. These unit files live on the LXC filesystem, not just in git. | Re-install systemd units (the self-update job and `bootstrap.sh` both must lay down the new unit content). |
| **OS-registered state** | systemd has the three units enabled/loaded by name. Unit *names* do not change — only their file contents (paths). `systemctl daemon-reload` is required after rewriting them. The PVE host gains a new `authorized_keys` entry (D-21) — registered OS state on the *host*, not the LXC. | `systemctl daemon-reload` after unit rewrite; `install.sh` writes the host `authorized_keys` entry idempotently (must not duplicate on re-run). |
| **Secrets / env vars** | `/etc/proxmox-gui/master.key`, `jwt.secret`, `pat.pepper` — code rename only if anything; values unchanged by an update (D-11). **NEW persistent secret:** the GUI Ed25519 SSH private key (D-21) — must land in `/etc/proxmox-gui/` so it is (a) outside the `/opt` swap and (b) included in the self-backup. The systemd API unit's `Environment=` lines reference these by path — unchanged. | None for existing secrets. New: generate + place the SSH key under `/etc/proxmox-gui/` with 0400 perms (mirror `gen-master-key.sh`). |
| **Build artifacts** | `frontend/build/` is a **committed git artifact** (verified — `bootstrap.sh` Step 7 + MEMORY note "frontend build node_modules trap"). A self-update that pulls a tagged release gets the committed `build/` for free — but if the update ever runs `pnpm build` in the LXC it will wipe `frontend/build/node_modules`. The Python package installs as `pip install -e backend` → a `proxmox_gui.egg-info/` is created in `backend/`; after a code swap this is stale until `pip install -e` re-runs. | Self-update must `pip install -e backend` after the code swap (not just symlink). Prefer using the *committed* `frontend/build/` over an in-LXC `pnpm build`. |

**The canonical question — after every file in the repo is updated, what runtime systems still have the old string/state cached?** Answer for Phase 5: (1) systemd unit *file contents* on the LXC (paths) — must be rewritten and `daemon-reload`'d; (2) the `pip install -e` egg-info — must be refreshed; (3) the Python process's loaded code — handled by the `systemctl restart`; (4) the API-process settings cache — handled by PATCH invalidation. Nothing in ChromaDB/Mem0/n8n/Redis-keys/Task-Scheduler classes applies (this product has none of those).

## Common Pitfalls

### Pitfall 1: WAL-mode DB snapshot taken with a plain file copy
**What goes wrong:** `run_self_update` copies `app.db` with `shutil.copy` before migrating; the `-wal` sidecar (holding committed-but-not-checkpointed pages) is missed. The "backup" is a torn, older, possibly corrupt state. On rollback the restore reverts further than intended or fails integrity checks.
**Why it happens:** SQLite in WAL mode keeps recent transactions in `app.db-wal`; the main file alone is not a consistent snapshot. `[CITED: sqlite.org/wal.html]`
**How to avoid:** Use `sqlite3.connect(src).backup(dst_conn)` (the C online-backup API, exposed in Python's stdlib `sqlite3`) or `VACUUM INTO`. Both serialise correctly against live writers and fold in the WAL.
**Warning signs:** A restored DB that's missing the last few minutes of audit rows; `PRAGMA integrity_check` failures on the backup file.

### Pitfall 2: The API tries to restart itself and the update dies mid-flight
**What goes wrong:** A self-update routine running inside the API process calls `systemctl restart proxmox-gui-api`; systemd kills the process, the update sequence terminates between "code swapped" and "health verified" — no rollback runs, the install is bricked.
**Why it happens:** A process cannot outlive its own SIGTERM.
**How to avoid:** Run the orchestration in the **worker** process (separate systemd unit — verified). The worker restarts the API, verifies health, rolls back if needed, and restarts itself *last*.
**Warning signs:** Update jobs that never reach a terminal state; the API down with no rollback after a failed update.

### Pitfall 3: Existing sessions instantly idle-expire after the `0007` migration
**What goes wrong:** `refresh_tokens.last_active_at` is added as a new column; existing rows get NULL; the idle check `now - last_active_at > timeout` treats NULL as epoch-zero → every logged-in user is logged out on their next refresh the moment Phase 5 deploys.
**Why it happens:** A new non-defaulted timestamp column on an existing table.
**How to avoid:** The Alembic `0007` migration must backfill: `UPDATE refresh_tokens SET last_active_at = created_at WHERE last_active_at IS NULL`. Make the idle check treat NULL defensively (= "active now") as belt-and-braces.
**Warning signs:** A flood of "session expired" modals immediately after deploy.

### Pitfall 4: TLS pinning silently disabled because the adapter isn't actually mounted
**What goes wrong:** The `FingerprintPinningAdapter` is written but proxmoxer rebuilds its session per-call and the adapter never reaches the live session — connections succeed with `verify_ssl=False` and zero validation, looking identical to a working pin.
**Why it happens:** proxmoxer 2.3's session lifecycle (`Backend.get_session()` is called per-request) — mounting on a session object proxmoxer then discards is a no-op.
**How to avoid:** Confirm the mount seam against the installed proxmoxer source (Open Question Q1). Add a *negative test*: point the connector at a host whose cert does NOT match the pinned fingerprint and assert the connection is refused. A pin that can't fail isn't a pin.
**Warning signs:** Pinning "works" against every cert, including wrong ones.

### Pitfall 5: Path traversal in the audit-archive download endpoint
**What goes wrong:** `GET /api/v1/audit/archives/{name}` interpolates `{name}` into a filesystem path; `name=../../etc/proxmox-gui/master.key` leaks the master key.
**Why it happens:** Untrusted path component used to build a file path.
**How to avoid:** Reject any `{name}` containing `/`, `\`, or `..`; resolve the final path and assert it is still inside the archive directory (`Path(resolved).is_relative_to(archive_dir)`); `require_admin`.
**Warning signs:** `..` or absolute paths accepted by the route.

### Pitfall 6: `install.sh --update` re-appends the SSH pubkey to `authorized_keys` on every run
**What goes wrong:** D-12 makes re-running `install.sh` an update path; the SSH-trust step (D-21) appends the GUI pubkey to the host's `authorized_keys` each time → the file grows unbounded with duplicates.
**Why it happens:** A non-idempotent append.
**How to avoid:** `grep -qF "$PUBKEY" authorized_keys || echo "$PUBKEY" >> authorized_keys`. Mirror the idempotent guards already in `bootstrap.sh` (e.g. the redis `bind` line check).
**Warning signs:** A growing `/root/.ssh/authorized_keys` on the PVE host.

### Pitfall 7: Self-update deletes/overwrites the GUI SSH private key or the master key
**What goes wrong:** The update unpacks a release tarball over the install directory and either the tarball contains a placeholder key path or the swap touches `/etc/proxmox-gui` → the master key or the SSH private key is clobbered → all encrypted data unreadable, all community-script SSH trust broken.
**Why it happens:** Persistent state stored inside (or adjacent to) the swapped code tree.
**How to avoid:** Keep ALL persistent state under `/etc/proxmox-gui` and `/var/lib/proxmox-gui`; the symlink swap touches only `/opt/proxmox-gui`. Assert in the update job that the swap target is `/opt/...` only. Include both keys in the self-backup (Pitfall 22 / D-11 / D-21).
**Warning signs:** Post-update "cipher key invalid" errors; community-script deploys failing SSH after an update.

## Code Examples

### Idle-expiry check inside refresh (AUTH-06)
```python
# Source pattern: extends app/auth/refresh.py::consume_refresh (verified existing file)
class IdleExpired(InvalidRefresh):
    """The session's idle window lapsed — distinct from a benign expiry so the
    route returns a 'session expired, sign back in' message (D-03)."""

# inside consume_refresh, after the revoked/replay checks:
idle_minutes = await get_setting(db, "idle_timeout_minutes")  # D-01 settings cache
last_active = row.last_active_at or row.created_at            # NULL-defensive (Pitfall 3)
if last_active.tzinfo is None:
    last_active = last_active.replace(tzinfo=UTC)
if (datetime.now(UTC) - last_active) > timedelta(minutes=idle_minutes):
    raise IdleExpired("idle timeout")
```

### Audit-retention cron registered alongside the backup cron (AUDIT-06)
```python
# Source: extends WorkerSettings.cron_jobs in app/jobs/worker.py (verified existing)
from arq import cron
from app.jobs.retention_cron import roll_audit_log

cron_jobs: list = [
    cron(fire_due_scheduled_backups, minute=set(range(0, 60, 5))),  # existing
    cron(roll_audit_log, hour={3}, minute={0}),                     # NEW — nightly 03:00
]
```

### WAL-safe DB snapshot for the pre-update backup (DEPLOY-04, Pitfall 1)
```python
# Source: Python stdlib sqlite3 online-backup API
# [CITED: docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup]
import sqlite3

def snapshot_db(src_path: str, dst_path: str) -> None:
    """WAL-safe copy of the app DB — folds in the -wal file, serialises
    against live writers. A plain shutil.copy would lose uncommitted pages."""
    with sqlite3.connect(src_path) as src, sqlite3.connect(dst_path) as dst:
        src.backup(dst)
```

### Idempotent SSH-trust establishment in install.sh (UAT-1c, D-21, Pitfall 6)
```bash
# Source pattern: mirrors the idempotent guards in deploy/lxc/bootstrap.sh
KEY="/etc/proxmox-gui/gui_ed25519"
if [[ ! -f "$KEY" ]]; then
    ssh-keygen -t ed25519 -f "$KEY" -N "" -C "proxmox-gui@$(hostname)"
    chown proxmox-gui:proxmox-gui "$KEY" "$KEY.pub"
    chmod 0400 "$KEY"
fi
PUBKEY="$(cat "$KEY.pub")"
AUTH="/root/.ssh/authorized_keys"
mkdir -p /root/.ssh && chmod 700 /root/.ssh
grep -qF "$PUBKEY" "$AUTH" 2>/dev/null || echo "$PUBKEY" >> "$AUTH"  # idempotent
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `verify_ssl=False` for self-signed PVE (Phase 1) | TOFU fingerprint pin via `urllib3 assert_fingerprint` | Phase 5 (D-20) | Connections are validated against a known cert, not blindly trusted. |
| Bootstrap-marker re-run = `alembic upgrade head` only (`bootstrap.sh` idempotent branch) | `install.sh --update` / existing-CTID = full self-update path (migrate + rebuild + restart, with rollback) | Phase 5 (D-12) | Re-running the installer is a real update, not just a migration. |
| In-memory per-process rate limiter (`auth/rate_limit.py`) | Redis-backed token bucket (Claude's discretion — recommended) | Phase 5 (ME-02) | Rate limiting is consistent regardless of uvicorn worker count. |
| Code at `/opt/proxmox-gui/{backend,frontend,deploy}` directly | `/opt/proxmox-gui/releases/<tag>` + `current` symlink | Phase 5 (DEPLOY-04) | Enables atomic swap + instant rollback. |
| Env-only config (`config.py` BaseSettings) | Env config + DB-backed runtime `settings` table | Phase 5 (D-01) | Operators tune idle timeout / retention without a restart. |

**Deprecated/outdated:**
- The Phase-1 `NotImplementedError` guard at `connector.py:95-100` ("Per-cluster TLS fingerprint pinning is Phase 5 polish") — Phase 5 removes it and ships the real implementation.
- The `bootstrap.sh` comment "This is the upgrade path until Phase 5 ships proper self-update (DEPLOY-04)" — Phase 5 ships that.
- The Caddyfile comment "CSP intentionally omitted in Phase 1; Phase 5 polish hardens (T-01-04-06)" — Phase 5 adds the CSP header.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | proxmoxer 2.3.0's session/adapter mount seam for TLS pinning can be reached cleanly enough to mount `FingerprintPinningAdapter` on the live session. The adapter class itself is verified-correct; the *mount point* is the uncertainty. | Pattern 1, Pitfall 4 | If proxmoxer rebuilds the session per-call in a way the adapter can't survive, pinning needs either a proxmoxer custom-backend subclass or a pre-flight fingerprint validation wrapper. Plan a short spike (Open Question Q1). |
| A2 | A `vitest` + `axe-core` + `happy-dom` setup can run axe against rendered Svelte 5 components without a real browser. axe-core is DOM-based and `happy-dom` is a DOM impl, so this should hold — but some axe rules (contrast, layout) need real rendering. | Standard Stack, Pattern 6 | If `happy-dom` is insufficient for the rules that matter, the automated half of D-17 needs Playwright (a heavier dev dependency + browser binary). The *manual* half of D-17 is unaffected. |
| A3 | The committed `frontend/build/` artifact in a tagged release is current/correct, so `run_self_update` can use it directly instead of running `pnpm build` in the LXC. | Pattern 5 | If a release ever ships a stale `build/`, the updated UI is wrong. Mitigation: the release-tagging process must rebuild `frontend/build/` and the SHA-256 manifest covers the whole tarball including `build/`. |
| A4 | The cluster `tls_fingerprint` column (already in the `clusters` model) is the right storage and no schema change is needed for D-20 — only the `settings` table + `refresh_tokens.last_active_at` need migration `0007`. | Standard Stack, Pattern 1 | Verified the column exists (`models/cluster.py:41`); low risk. |
| A5 | The worker process can issue `systemctl restart` — i.e. the worker's systemd unit either runs with enough privilege or the service user has a polkit rule / is permitted to manage these specific units. The API unit runs as unprivileged `proxmox-gui`; the worker likely does too. | Pattern 5, Pitfall 2 | If neither the worker nor the API can call `systemctl`, the restart step needs a privileged helper (a tiny root-owned `systemd` path unit watching for a trigger file, or a sudoers entry scoped to the three `systemctl restart` commands). This must be resolved in the self-update plan — see Open Question Q2. |
| A6 | A nightly cadence for the audit-retention cron is acceptable (CONTEXT lists cadence as Claude's discretion, "nightly assumed"). | Pattern 4 | Low risk — explicitly delegated. |

**If this table is non-empty:** A1 and A5 are the two assumptions that warrant a planning-time check or a short spike before the self-update / TLS-pinning plans are finalised. A2/A3/A4/A6 are low-risk.

## Open Questions

1. **proxmoxer session/adapter injection seam (A1).**
   - What we know: proxmoxer's HTTPS backend is `ProxmoxHttpSession(requests.Session)`; `Backend.get_session()` builds it; `requests` delegates fingerprint validation to `urllib3`'s `assert_fingerprint`.
   - What's unclear: whether mounting a custom `HTTPAdapter` on the session survives proxmoxer's per-call session handling in 2.3.0.
   - Recommendation: a 1-task spike at the start of the TLS-pinning work — inspect `proxmoxer/backends/https.py` in `.venv`, write the negative test (wrong cert → refused) first, and if the mount seam is awkward, fall back to a stdlib `ssl` pre-flight validation on every connector acquisition (cheap — one handshake) plus `verify_ssl=False`.

2. **`systemctl restart` privilege for the self-update job (A5).**
   - What we know: the API and worker run as the unprivileged `proxmox-gui` user inside the LXC.
   - What's unclear: whether that user can `systemctl restart` the three units.
   - Recommendation: resolve in the self-update plan. Cleanest option if unprivileged: a scoped sudoers entry (`proxmox-gui ALL=(root) NOPASSWD: /usr/bin/systemctl restart proxmox-gui-api.service proxmox-gui-frontend.service proxmox-gui-worker.service`) laid down by `bootstrap.sh`. Document the security rationale (narrowly scoped to three exact commands).

3. **Audit-archive directory location and retention-of-archives policy.**
   - What we know: archives go on the LXC filesystem; D-08 makes them downloadable.
   - What's unclear: whether archives themselves are ever pruned (an LXC with an 8 GB rootfs could fill over years).
   - Recommendation: store under `/var/lib/proxmox-gui/audit-archives/`; do NOT auto-prune archives in v1 (they are the compliance artifact); surface total archive size in the admin Audit page so an operator can manually clear. Note as a possible v2 enhancement.

4. **Release manifest hosting + format.**
   - What we know: D-10 says tagged semver releases verified against a published SHA-256 manifest.
   - What's unclear: where the manifest lives (GitHub Releases assets vs a `manifest.json` at a stable URL) and its exact schema.
   - Recommendation: GitHub Releases — each release attaches the source tarball + a `manifest.json` (`{version, tarball_url, sha256}`). The self-update job fetches the *latest release* via the GitHub API, or a pinned `latest-manifest.json`. Decide in the self-update plan; it is a packaging convention, not a code risk.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `git` | `run_self_update` / `install.sh --update` source pull | ✓ (installed by `bootstrap.sh` Step 1) | system | — |
| `systemctl` (systemd) | Self-update restart sequence; scheduled units | ✓ (LXC runs systemd — `nesting=1`) | system | privileged helper if the service user lacks permission (Q2) |
| `sqlite3` Python stdlib `.backup` | WAL-safe pre-update DB snapshot | ✓ (stdlib, Python 3.12) | 3.12 | `VACUUM INTO` |
| `ssh` / `ssh-keygen` | D-21 keypair gen; `pct exec` transport (already used) | ✓ (`ssh` confirmed reachable to PVE host — spike 04-01; `ssh-keygen` part of openssh) | system | — |
| Redis | ME-02 Redis-backed rate limiter; arq queue/cron | ✓ (hard dependency since Phase 3 — `bootstrap.sh` Step 1b) | 7.x (Debian) | in-memory limiter + single-worker assertion (CONTEXT's accepted fallback) |
| `gzip` Python stdlib | CSV.gz audit archives | ✓ (stdlib) | 3.12 | — |
| `pip` / venv | `pip install -e backend` after a code swap | ✓ (`bootstrap.sh` Step 6) | venv | — |
| Node.js | Frontend runtime (`adapter-node`) | ✓ (`bootstrap.sh` Step 1) | system nodejs | — |
| `axe-core` (frontend dev dep) | D-17 automated a11y audit | ✗ — not yet installed | — | manual a11y audit only (D-17's manual half) if install is undesirable |
| `npx lighthouse` | D-17 one-off manual audit | ✗ — run ad hoc, not a CI dependency | — | manual keyboard/screen-reader audit |
| GitHub Releases / network egress | Self-update release+manifest fetch | ✓ (LXC has outbound HTTPS — used for community-scripts already) | — | `install.sh --update` from a local checkout (operator-driven) |

**Missing dependencies with no fallback:** none — every blocking dependency is already present.
**Missing dependencies with fallback:** `axe-core` (install as a dev dependency, or do D-17's automated half manually); Lighthouse (ad-hoc, not CI).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Idle timeout (AUTH-06) — server-authoritative refresh refusal; LO-01 disabled-user timing-leak fix; the `ssh-rsa` validator fix preserves Argon2id/JWT model. |
| V3 Session Management | yes | Idle expiry on the existing 7-day rotating refresh-token model; refresh-rotation chain-replay detection already present; idle check is the new layer. |
| V4 Access Control | yes | Admin Settings GET/PATCH, self-update trigger, audit-archive download, SSH "Verify" — all `require_admin`-gated. IN-01 (PAT-after-disable audit), IN-03 (cluster PATCH validation). |
| V5 Input Validation | yes | Audit-archive `{name}` path-traversal guard (Pitfall 5); ME-05 PATCH-clear-nullable-fields fix; release-tag/version string validation in self-update. |
| V6 Cryptography | yes | SHA-256 manifest verification of the release payload (`hashlib`); TLS leaf-cert fingerprint pinning (`urllib3 assert_fingerprint`); Fernet master key + Ed25519 SSH key never clobbered by update — never hand-roll any of these. |
| V9 Communications (TLS) | yes | TLS fingerprint pinning replacing `verify_ssl=False` (D-20); Caddy CSP header + retained HSTS. |
| V14 Configuration | yes | Caddy CSP directives; `COOKIE_SECURE` dev-only documentation + startup warning; unprivileged-LXC posture not regressed by `install.sh` (Pitfall 19); scoped sudoers (if needed for Q2). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-update supply-chain — a tampered release tarball | Tampering | SHA-256 manifest verification before unpack (D-10); pull only from tagged releases, never `master`. |
| Self-update bricks the install with no recovery | Denial of Service | Auto-rollback (DB restore + symlink revert + restart); `install.sh --update` as the out-of-band recovery path (D-09). |
| Idle-timeout bypass via replayed cookie / disabled JS | Spoofing / Elevation | Server-authoritative refresh refusal — the client timer is UX-only and cannot be the gate. |
| Audit-archive path traversal leaking secrets | Information Disclosure | Reject `..`/`/`; resolve-and-confine the path under the archive dir; `require_admin`. |
| MITM on the PVE API connection (self-signed, `verify_ssl=False`) | Tampering / Information Disclosure | TOFU fingerprint pinning — admin confirms the SHA-256 once at register-time, validated every connection thereafter. |
| Pinning that silently can't fail (adapter not mounted) | Tampering | Negative test: wrong-cert host MUST be refused (Pitfall 4). |
| `install.sh --update` re-run injecting/duplicating SSH trust | Tampering | Idempotent `grep -qF || append` for `authorized_keys` (Pitfall 6). |
| Rate-limit bypass across uvicorn workers | Spoofing (brute-force) | Redis-backed token bucket (ME-02) — shared state regardless of worker count. |
| XSS via the SPA without a CSP | Cross-Site Scripting | Caddy CSP header compatible with SvelteKit + shadcn-svelte (carryover). |
| Master key / SSH key clobbered by an update | Tampering / DoS | All persistent state under `/etc` + `/var/lib`; the swap touches only `/opt`; both keys in the self-backup (D-11, D-21, Pitfall 22). |

**CSP note for the carryover plan:** SvelteKit injects inline `<script>`/`<style>` and uses hydration; a strict `script-src 'self'` will break it. SvelteKit supports CSP nonce/hash generation via `kit.csp` in `svelte.config.js` — the cleanest path is to let SvelteKit emit the CSP (nonce-based) rather than hard-coding it in Caddy, OR set a permissive-but-meaningful Caddy CSP (`default-src 'self'; frame-ancestors 'self'; img-src 'self' data: https:`) with `'unsafe-inline'` for styles. The decision (Caddy header vs `svelte.config.js` `kit.csp`) should be made in the carryover plan; `frame-ancestors 'self'` is the load-bearing directive (replaces the current `X-Frame-Options: SAMEORIGIN`) and is safe for the same-origin noVNC iframe.

## Sources

### Primary (HIGH confidence)
- Codebase — direct file reads: `backend/app/config.py`, `auth/rate_limit.py`, `auth/refresh.py`, `auth/routes.py`, `auth/dependencies.py`, `clusters/connector.py`, `clusters/health.py`, `models/cluster.py`, `models/refresh_token.py`, `jobs/worker.py`, `jobs/backups_cron.py`, `audit/csv.py`, `audit/routes.py`, `ssh_keys/service.py`, `main.py`, `deploy/install.sh`, `deploy/lxc/bootstrap.sh`, `deploy/caddy/Caddyfile.template`, `deploy/systemd/proxmox-gui-api.service`, `deploy/scripts/gen-master-key.sh`, `backend/pyproject.toml`, `frontend/package.json`, `frontend/src/hooks.server.ts`, `Sidebar.svelte`.
- `.venv` — `proxmoxer/backends/https.py` source inspection (session/backend construction); installed versions of `requests 2.33.0`, `urllib3 2.7.0`, `cryptography 46.0.7`, OpenSSL 3.0.13.
- `.planning/` — `05-CONTEXT.md` (D-01..D-23 locked), `ROADMAP.md` (Phase 5 + carryover table), `REQUIREMENTS.md`, `01-REVIEW.md` (ME/LO/IN carryover origins), `01-VERIFICATION.md` (TLS/CSP/health-probe carryover origins), `01-CONTEXT.md` (Phase-1 auth/deploy decisions), `04-SPIKE-community-scripts.md` (`pct exec` SSH mechanism for UAT-1c), `research/PITFALLS.md` (Pitfall 19, 21, 22).
- [sqlite.org/wal.html](https://sqlite.org/wal.html) — WAL backup semantics; [sqlite.org/howtocorrupt.html](https://sqlite.org/howtocorrupt.html).
- [docs.python.org sqlite3 backup API](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup) — online-backup API.
- [freedesktop.org systemd-run](https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html) — transient-unit detachment semantics.

### Secondary (MEDIUM confidence)
- [deepwiki.com/urllib3/urllib3 — SSL/TLS Support](https://deepwiki.com/urllib3/urllib3/2.2-ssltls-support) — `assert_fingerprint` native support, confirmed against `requests` delegating to `urllib3`.
- [deque.com/axe/axe-core](https://www.deque.com/axe/axe-core/) and [github.com/dequelabs/axe-core](https://github.com/dequelabs/axe-core) — axe-core WCAG coverage, the engine behind Lighthouse.
- [rodneylab.com SvelteKit accessibility testing](https://rodneylab.com/sveltekit-accessibility-testing/) — axe in a SvelteKit CI workflow.

### Tertiary (LOW confidence — verify during planning)
- [gist.github.com/dlenski — fingerprint-based cert validation in Python](https://gist.github.com/dlenski/fc42156c00a615f4aa18a6d19d67e208) — `HTTPAdapter` subclassing pattern for pinning; the *pattern* is sound, the *proxmoxer mount seam* (Open Question Q1) still needs in-source confirmation.
- [oldmoe.blog — SQLite backup strategies](https://oldmoe.blog/2024/04/30/backup-strategies-for-sqlite-in-production/) — corroborates `.backup` / `VACUUM INTO` over file copy.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new runtime deps; every version verified against the installed `.venv` / `package.json`.
- Architecture (self-update worker-handoff, idle-timeout chokepoint, settings table, retention cron): HIGH — all map onto verified existing patterns (`backups_cron.py`, `consume_refresh`, separate systemd units).
- TLS pinning mechanism: MEDIUM — the `urllib3 assert_fingerprint` + `HTTPAdapter` approach is verified-correct; the proxmoxer 2.3.0 *mount seam* is the one MEDIUM-confidence spot (Open Question Q1 / Assumption A1).
- `systemctl` privilege for the worker: MEDIUM — Assumption A5 needs a planning-time check (Open Question Q2).
- Pitfalls: HIGH — each is grounded in a verified codebase fact (WAL mode, separate units, the `0007` migration, the Phase-1 `NotImplementedError` guard) or an authoritative source.
- Mobile/a11y: HIGH for the reflow patterns (shadcn-svelte `Sheet`, Tailwind v4 variants — standard); MEDIUM for the `happy-dom`+axe automated-audit feasibility (Assumption A2).

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (30 days — stable stack; no fast-moving dependency. The two MEDIUM items are spike-resolvable at planning time, not time-decaying.)
