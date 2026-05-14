---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 4
status: executing
stopped_at: Completed Phase 02 Plan 02-05-frontend-inventory
last_updated: "2026-05-14T17:45:31.424Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 17
  completed_plans: 15
  percent: 88
---

# STATE: Proxmox Self-Service GUI

**Last updated:** 2026-05-14
**Mode:** yolo
**Granularity:** coarse

## Project Reference

**Core value:** Users can self-provision and manage VMs/LXCs on Proxmox through a polished, opinionated UI — without ever needing to open the Proxmox web interface.

**Current focus:** Phase 02 — multi-cluster-inventory-quotas-audit

## Current Position

Phase: 02 (multi-cluster-inventory-quotas-audit) — EXECUTING
Plan: 4 of 7
Current Plan: 4

- **Milestone:** v1
- **Phase:** 01 — Foundation (executing)
- **Plan:** 01-01 backend-scaffold ✅ complete
- **Plan:** 01-02 db-schema ✅ complete
- **Plan:** 01-03 frontend-scaffold ✅ complete
- **Plan:** 01-04 deployment-skeleton ✅ complete
- **Plan:** 01-05 auth-subsystem ✅ complete
- **Plan:** 01-06 clusters-tenant-bootstrap ✅ complete
- **Plan:** 01-07 users-admin-setup ✅ complete
- **Plan:** 01-08 frontend-auth-shell ✅ complete
- **Plan:** 01-09 frontend-account ✅ complete
- **Status:** Executing Phase 02
- **Progress:** [█████████░] 88%

## Phases at a Glance

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Foundation | Not started | 19 |
| 2 | Multi-Cluster Inventory, Quotas & Audit | Not started | 23 |
| 3 | Job Queue & Lifecycle | Not started | 16 |
| 4 | Provisioning, Networking & Console | Not started | 27 |
| 5 | Polish & Operational Hardening | Not started | 4 |

**Coverage:** 89/89 v1 requirements mapped.

## Performance Metrics

- **Phases complete:** 0/5
- **Plans complete:** 9/10
- **Requirements shipped:** 22/89 (API-01, API-03 via Plan 01-01; AUTH-01, AUTH-02, AUTH-05, AUTH-07, AUTH-08, CLUST-01, CLUST-05 schema-landed via Plan 01-02; UI-01, UI-02 frontend-shell via Plan 01-03; DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-05 helper-script skeleton via Plan 01-04; AUTH-01..05 fully shipped + API-01..03 fully shipped via Plan 01-05; CLUST-01, CLUST-05, CLUST-06, AUTH-08 fully shipped via Plan 01-06; AUTH-07, AUTH-08, DEPLOY-05 fully shipped via Plan 01-07; AUTH-01, AUTH-02 (login surface), UI-01, UI-02 (auth gate + login + setup wizard frontend), DEPLOY-05 (wizard frontend) frontend-completed via Plan 01-08; AUTH-03, AUTH-04, AUTH-05 (account self-service surface), API-02 (PAT frontend mint/list/revoke + show-once dialog) frontend-completed via Plan 01-09)
- **Out-of-scope items deferred:** see REQUIREMENTS.md v2 section

### Plan Metrics

| Phase | Plan | Duration | Tasks | Files | Tests    |
|-------|------|----------|-------|-------|----------|
| 01    | 01   | ~25 min  | 2     | 25    | 33 pass  |
| 01    | 02   | ~9 min   | 2     | 19    | 56 pass  |
| 01    | 03   | ~10 min  | 2     | 162   | 3 pass   |
| 01    | 04   | ~7 min   | 2     | 10    | n/a (no test phase — shellcheck-clean + caddy validate ok) |
| 01    | 05   | ~14 min  | 2     | 25    | 90 pass  |
| 01    | 06   | ~21 min  | 2     | 19    | 132 pass |
| 01    | 07   | ~11 min  | 2     | 13    | 166 pass |
| 01    | 08   | ~14 min  | 2     | 27    | 26 pass  |
| 01    | 09   | ~10 min  | 2     | 11    | 26 pass  |
| 02    | 01   | ~9 min   | 2     | 10    | 221 pass |
| 02    | 02   | ~90 min  | 2     | 16    | 221 pass |
| 02    | 03   | ~90 min  | 2     | 14    | 249 pass |
| Phase 02 P02-04-quotas-backend | ~75 min | 2 tasks | 11 files |
| Phase 02 P05 | 35 | 2 tasks | 29 files |

## Accumulated Context

### Decisions (locked in during initialization)

| Decision | Rationale | Locked at |
|----------|-----------|-----------|
| Multi-tenant + quotas in v1 | Hetzner-style self-service from day one; cannot retrofit | PROJECT.md |
| Multi-cluster from v1 | User has the need now; URL-shape decision can't be deferred | PROJECT.md |
| Local auth in v1; OIDC v2 | Faster ship; minimize external dependencies | PROJECT.md |
| Embedded noVNC via iframe | Fastest path; custom console deferred to v2 | PROJECT.md |
| REST API as primary contract; UI consumes it | Forces parity; enables Terraform/Ansible from day one | PROJECT.md |
| Helper-script install | Dogfoods the community-scripts pattern | PROJECT.md |
| Tech stack: Python 3.12 + FastAPI + SvelteKit + SQLite (WAL) + arq | Single mature Proxmox client (proxmoxer); single-LXC fit | research/STACK.md |
| Per-cluster API token (not user-ticket forwarding) | Tokens are stateless, no 2h expiry, no CSRF dance | research/PITFALLS.md (Pitfall 9) |
| Cluster ID in URL path (`/clusters/{id}/...`) from day one | Cannot retrofit; prevents ambient-context bugs | research/ARCHITECTURE.md |
| Plan 01 owns app/main.py + app/core/*; Plan 02 owns app/models/__init__.py | Ownership split keeps the foundation isolated from concrete model imports | Plan 01-01 |
| Settings.__repr__ redacts jwt_secret/pat_pepper as defense-in-depth | T-01-01-07 mitigation beyond the docstring prohibition; attribute stays plain str so jwt.encode/sha256 contracts hold | Plan 01-01 SUMMARY |
| run_migrations tolerates missing alembic.ini until Plan 02 lands the migrations directory | Lets Plan 01 ship the lifespan call without coupling to Plan 02's timing | Plan 01-01 SUMMARY |
| EncryptedSecret reads its cipher via module-level install_cipher / _get_cipher singleton | SQLAlchemy TypeDecorator runs outside FastAPI request context — request.app.state is unreachable | Plan 01-01 (RESEARCH §Pattern 3) |
| EncryptedSecret renders as sa.LargeBinary in 0001_initial migration (not the decorator class) | Keeps the migration portable across docstring/annotation changes; SQLAlchemy stores BLOB either way | Plan 01-02 SUMMARY |
| Personal team name format is `personal-<user_id>`, not `<username>-personal` | D-05 immutability + 01-RESEARCH §Anti-Patterns; format enforcement happens at write time in Plan 07 | Plan 01-02 SUMMARY |
| Alembic migrations are hand-written, not autogenerated; every FK/UQ/CK/IX has an explicit name | Anonymous constraints break round-trip downgrade in SQLite batch mode | Plan 01-02 SUMMARY |
| Schema-invariant test ALLOWLIST documents per-table rationale inline | Pitfall A5 — new tables are NOT team-exempt by default; developer must justify | Plan 01-02 SUMMARY |
| `prepend_sys_path = .` in alembic.ini | Installer-time CLI invocation (Plan 04) needs to import app.models; pytest already had this via pyproject pythonpath | Plan 01-02 SUMMARY |
| alembic.ini is ASCII-only (no em-dashes) | Defensive against broken-locale environments where configparser falls back to ASCII codec | Plan 01-02 SUMMARY |
| shadcn-svelte v1.2.7 auto-migrated style preset from 'default' to 'nova' | Upstream deprecation; baseColor kept at slate per UI-SPEC | Plan 01-03 SUMMARY |
| vitest pinned to 3.x | vite-plugin-svelte 5 requires vite 6, and vitest 2 ships vite 5 types — incompatible | Plan 01-03 SUMMARY |
| `$lib/utils.ts` is canonical for shared FE helpers; `$lib/utils/` subdirectory holds feature helpers (csrf.ts, api.ts) | Modern shadcn-svelte primitives import cn + WithElementRef from `$lib/utils.js`; plan-manifest path lives in a re-export shim at `$lib/utils/cn.ts` | Plan 01-03 SUMMARY |
| Modern shadcn-svelte registry components import from `@lucide/svelte` (scoped), not `lucide-svelte` | Upstream package rename; both kept in deps but registry code uses scoped name | Plan 01-03 SUMMARY |
| `+layout.server.ts` ships STUB with explicit `// TODO(01-08): replace with real auth probe` comment | Plan 08 (frontend-auth-shell) replaces with `/api/v1/me` + `/api/v1/setup/status` probe | Plan 01-03 SUMMARY |
| Inter Variable woff2 sourced from rsms/inter master at `docs/font-files/InterVariable.woff2` | Self-hosted air-gap requirement (UI-SPEC §Typography, threat T-01-03-06); 352KB binary committed | Plan 01-03 SUMMARY |
| `kit.csrf.checkOrigin` removed (deprecated) — relying on default SvelteKit CSRF + API-side `csrf_protect` from Plan 01-01 | Plan 01-01's API CSRF dependency is authoritative; SvelteKit defaults are correct for its form actions | Plan 01-03 SUMMARY |
| `pnpm-workspace.yaml` with `allowBuilds.esbuild: true` | pnpm 11 refuses install on unapproved build scripts; required for non-interactive CI | Plan 01-03 SUMMARY |
| master.key + jwt.secret + pat.pepper ship at mode 0400 (more restrictive than CONTEXT D-14's 0600 minimum) | Principle of least privilege; FastAPI service user never writes after generation; still satisfies Pitfall A6's `st_mode & 0o077 == 0` | Plan 01-04 SUMMARY |
| Debian 12 python3.12 sourced from bookworm-backports; pyenv fallback deferred to Phase 5 (DEPLOY-04) | Cleanest Debian path; pyenv build-from-source is operational complexity for Phase 5 polish | Plan 01-04 SUMMARY |
| Worker systemd unit ships installed but DISABLED in Phase 1 (ExecStart=sleep infinity placeholder) | D-17 mandates the unit ship now; arq wiring is Phase 3 (Job Queue & Lifecycle) | Plan 01-04 SUMMARY |
| Caddy auto-sets X-Forwarded-For + X-Forwarded-Proto; we only set Host + X-Real-IP explicitly | Silences `caddy validate` warnings without behavior change | Plan 01-04 SUMMARY |
| CSP intentionally omitted from Caddyfile in Phase 1 (documented gap; Phase 5 polish) | Acceptable v1 risk per ASVS V14.4 + V14.5 split — HSTS/X-Frame/X-Content-Type-Options/Referrer-Policy ship now | Plan 01-04 SUMMARY |
| Caddyfile committed in `caddy fmt`-canonical (tab-indented) form | Future edits stay lint-clean; matches `caddy validate` formatter expectation | Plan 01-04 SUMMARY |
| `consume_refresh` commits chain-revoke BEFORE raising `ReplayDetected` | `get_db` rolls back on exception, which would silently undo the cascade revocation; T-01-05-02 mitigation requires persistence | Plan 01-05 SUMMARY |
| `POST /api/v1/auth/refresh` has NO `csrf_protect` dependency | httpOnly refresh cookie + SameSite=Lax is sufficient; route still rotates CSRF on success (Q4) | Plan 01-05 SUMMARY |
| Bearer regex `^pat_[A-Za-z0-9_-]{8,}$` rejects all non-PAT Bearer values 401 | Pitfall A8: no JWT-via-Bearer fallthrough; eliminates auth-scheme ambiguity | Plan 01-05 SUMMARY |
| Cross-user DELETE/revoke returns 404 (not 403) | T-01-05-11 don't-leak-existence; same response shape as not-found | Plan 01-05 SUMMARY |
| PAT auth on `/api/v1/me/tokens/*` rejected 403 | T-01-05-10 elevation-of-privilege; a PAT cannot manage other PATs | Plan 01-05 SUMMARY |
| Autouse rate-limit reset fixture in conftest.py | Module-level `_buckets` is by-design (single-process v1); test harness owns isolation, not production | Plan 01-05 SUMMARY |
| Service layer commits state before raising HTTPException | get_db rolls back on exception; revocations / audit writes must survive | Plan 01-05 SUMMARY |
| FakeProxmox over respx for proxmoxer mocking | proxmoxer 2.3 uses sync `requests`; respx is httpx-only. Class-level recording fake (chained-attribute path → dotted-string keys) is more readable than a requests-level mocker for proxmoxer's chained API | Plan 01-06 SUMMARY |
| `PVEConnectorRegistry.get(*, db=None)` accepts caller-supplied session | In-memory SQLite + connection-isolation breaks separate-session reads of flushed-but-uncommitted rows; also the right read-your-writes semantics in production multi-cluster bootstrap | Plan 01-06 SUMMARY |
| `ClusterResponse` is a separate class from `ClusterCreate` (no Field-exclude) | Type-system contract: response NEVER includes `api_token_secret`. T-01-06-01 mitigation. Greps stay honest | Plan 01-06 SUMMARY |
| Route declaration order: `/clusters/test` BEFORE `/clusters/{cluster_id}/test` | FastAPI's path matcher is order-sensitive — int-coerced `{cluster_id}` would otherwise eat the literal `/test` segment | Plan 01-06 SUMMARY |
| Bootstrap step order: pool → user → token → ACL; rollback inverse | ACL last so token-mint failure leaves no orphan ACL pointing at non-existent user; delete_user before delete_pool so cascade ACLs go cleanly | Plan 01-06 SUMMARY |
| `delete_team` does NOT call `teardown_tenant_on_clusters` (D-04 option-a) | Operator must explicitly unbind via Phase-2 endpoint first; `teardown_tenant_on_clusters` shipped for Phase 2 use, never invoked from Plan 06 | Plan 01-06 SUMMARY |
| `create_team(registry: ConnectorRegistry | None = None, ...)` signature | Plan-07-friendly: first-run admin's personal team is created without a registry when zero clusters exist; service raises if registry=None AND clusters present AND auto_bootstrap=True | Plan 01-06 SUMMARY |
| `TeamCreate` uses `ConfigDict(extra="forbid")` | D-05 personal-immutability defense-in-depth: schema layer rejects `personal=True` before the service-layer 422 ever fires | Plan 01-06 SUMMARY |
| Disable-revocation transaction sequencing in `update_user` | Detect is_active True→False BEFORE applying; setattr+flush; revoke_user_sessions commits the user UPDATE in same tx as token revocations — no window where is_active=False is committed but tokens still live | Plan 01-07 SUMMARY |
| `team_ids` on PATCH /users/{id} has REPLACE semantics on non-personal teams only | Personal-team membership row never touched; PATCH with team_ids=[] correctly leaves user with only their personal team | Plan 01-07 SUMMARY |
| Admin self-modification guards live at service layer with `current_admin_user_id` from principal | Direct callers (admin CLI, tests) get same protection as HTTP routes; T-01-07-03/04/05 mitigation | Plan 01-07 SUMMARY |
| Setup endpoints are CSRF-free; admin-creation is one-shot gated on `no_admin_yet` predicate inside insert tx | T-01-07-01 race mitigation; CSRF requires a session which doesn't exist yet | Plan 01-07 SUMMARY |
| Admin password reset bypasses old-password check (T-01-07-08 accept-by-design) | Recovery flow; sessions revoked so user must log in with new password; audit log Phase 2 records who-reset-whom | Plan 01-07 SUMMARY |
| There is intentionally NO `/api/v1/setup/cluster` route — wizard cluster registration goes through authenticated `/api/v1/clusters` | CONTEXT D-18 lenient first-run; Plan 08 UI auto-logs-in after admin step | Plan 01-07 SUMMARY |
| `email-validator==2.3.0` added to pyproject.toml (was missing from Plan 01) | pydantic.EmailStr requires it; tests use @example.com (email-validator rejects @example.test per RFC 6761) | Plan 01-07 SUMMARY |
| Personal team auto-creation pattern: any User-mint code path MUST also create `personal-<user_id>` team via `teams.service.create_team(registry=None, _internal=True, auto_bootstrap=False)` and insert membership row | D-05 + Plan 06's WARNING-6 signature; setup.create_initial_admin and users.create_user both follow | Plan 01-07 SUMMARY |
| AppShell mounts the sonner Toaster (bottom-right, richColors); /login and /setup deliberately do NOT mount it | Toast UX needed for Plan 09 password-change success + every Plan 09/10 mutate flow; minimal-chrome routes don't need the dependency | Plan 01-09 SUMMARY |
| `$derived(localOverride ?? data.list)` pattern for SSR-seeded list state with optimistic mutate | Svelte 5 warns on `$state(data.x)` (captures-initial-value); derived-with-override gives the SSR seed AND post-mutate UX without the warning. Plan 10 + Phase 2 follow | Plan 01-09 SUMMARY |
| Per-page `+page.server.ts` auth gates re-check `event.locals.user` and redirect to /login despite layout already gating | Defence-in-depth: stale browser tab landing on /profile after remote session-revoke never renders a phantom UI. Plan 10 + Phase 2 follow | Plan 01-09 SUMMARY |
| PAT expires-at promoted to 23:59:59 UTC of the chosen date (HTML date input emits YYYY-MM-DD with no time) | Same-day expiry would otherwise fire immediately; end-of-day matches user expectation. Phase 2 quotas + Phase 3 backups reuse the helper | Plan 01-09 SUMMARY |
| Re-fetch list after every destructive PAT/SSH-key mutate (revoke, delete) before clearing the dialog | Backend is the source of truth for status badges (T-01-09-04); never derive `revoked` purely from client-side timestamps | Plan 01-09 SUMMARY |
| PasswordChange 403 (current password incorrect) maps to inline error on the current_password field, not the summary alert | UI-SPEC §Form Patterns: offending field gets the inline error; user keeps typed new password and retypes only the current one | Plan 01-09 SUMMARY |
| Domain-named modules `api/ssh-keys.ts` + `api/tokens.ts` ship as thin re-exports of `api.me.{...}` | Plan 04 (Phase 4 SSH-key VM wiring) and any future code-gen step can import from a domain-named module without touching the canonical `me.ts` surface | Plan 01-09 SUMMARY |
| audit_write FLUSHES not COMMITS: the writer never calls db.commit(); caller owns the transaction and MUST commit before raising HTTPException so the audit row survives the rollback | get_db rolls back on exception — commit-before-raise is the only safe pattern; matches Plan 01-05's service-layer commit-before-raise decision | Plan 02-02 SUMMARY |
| resolve_resource returns 403 (not 404) whether VM doesn't exist OR belongs to a different tenant — avoids cross-tenant existence leaks (T-02-03-01) | D-INV-01: don't-leak-existence invariant for cross-tenant access | Plan 02-03 SUMMARY |
| actor_pat_id propagation deferred — Principal does not yet expose pat_id; audit rows have actor_pat_id=NULL for PAT-auth writes | D-INV-03: Phase 3 follow-up to extend Principal with pat_id | Plan 02-03 SUMMARY |
| FakeProxmox queue_response pattern for dual-call list_resources (type=vm then type=lxc) — each call gets its own queued response | D-INV-04: test double pattern for any code that calls list_resources | Plan 02-03 SUMMARY |
| Composite partial UNIQUE indices replace flat UniqueConstraints on quotas.team_id / quotas.user_id | Enables per-cluster quota rows (one quota per team+cluster pair); SQLite batch_alter_table drops old named constraints and creates new index | Plan 02-02 SUMMARY |
| Static code inspection for FLUSH-not-COMMIT test: inspect.getsource(audit_write) asserts 'await db.commit()' absent | SQLite in-memory DB shares state across aiosqlite sessions making transaction isolation untestable; static analysis is the only reliable gate | Plan 02-02 SUMMARY |
| PersonalAccessToken exposes lookup_prefix (not prefix_preview) for PAT actor attribution in audit reader | Confirmed field name from Phase 1 PAT model; reader LEFT JOINs PAT table on actor_pat_id and surfaces as actor_pat_prefix in AuditEntry | Plan 02-02 SUMMARY |

### Open Questions (resolve before/during named phase)

- **Phase 1 ADR:** Single super-token vs. per-tenant privilege-separated Proxmox tokens — research strongly favors per-tenant; complexity tradeoff must be weighed.
- **Phase 1 ADR:** `asyncio.to_thread()` vs. async proxmoxer backend — confirm thread-pool sizing for concurrent calls.
- **Phase 4 spike:** SDN reload/applied semantics through proxmoxer (MEDIUM-LOW confidence).
- **Phase 4 spike:** noVNC vncticket single-encoding verification.
- **Phase 4 spike:** Community-scripts non-interactive execution mechanics.

### Todos

- [x] Plan Phase 1 via `/gsd-plan-phase 1`
- [x] Execute Plan 01-01 backend-scaffold
- [x] Execute Plan 01-02 db-schema (11 ORM models + Alembic 0001_initial + invariant tests)
- [x] Execute Plan 01-03 frontend-scaffold (SvelteKit 2 + Svelte 5 + Tailwind v4 + shadcn-svelte app shell)
- [x] Execute Plan 01-04 deployment-skeleton (install.sh + bootstrap.sh + systemd units + Caddyfile + key generators)
- [x] Execute Plan 01-05 auth-subsystem (Argon2id login + 3-cookie sessions + refresh rotation with replay detection + CSRF + PAT + SSH-key + /me; 90 tests passing)
- [x] Execute Plan 01-06 clusters-tenant-bootstrap (PVEConnector + registry + cluster CRUD with validate-before-persist + dry-run /test + D-02 tenant bootstrap with PVE rollback + team CRUD with D-04 option-a delete gate + membership routes; 132 tests passing)
- [x] Execute Plan 01-07 users-admin-setup (admin user CRUD with self-guard + disable revocation; first-run setup wizard backend; AUTH-07 + AUTH-08 + DEPLOY-05 fully shipped; 166 tests passing)
- [x] Execute Plan 01-08 frontend-auth-shell (login UI + 4-step setup wizard + 4 shared form components + real auth probe; 26 frontend tests; AUTH-01, AUTH-02, UI-01, UI-02, DEPLOY-05 frontend-completed)
- [x] Execute Plan 01-09 frontend-account (/profile change-password + appearance + /profile/ssh-keys CRUD + /profile/tokens mint/revoke with SecretRevealDialog show-once; api.me extended additively; AppShell Toaster mounted; AUTH-03, AUTH-04, AUTH-05, API-02 frontend-completed)
- [ ] Execute Plan 01-10 frontend-admin (next — /admin/users + /admin/clusters CRUD; the only remaining plan in Phase 1)
- [ ] Schedule SDN/noVNC/community-scripts spikes in Phase 4 planning
- [ ] Manual A6 verification: bootstrap-token PVE permissions (User.Modify, Pool.Allocate, Realm.Allocate, Sys.Audit at /) — required before Phase 2 starts consuming per-tenant tokens

### Blockers

None.

## Session Continuity

**To resume:** Run `/gsd-execute-phase 2` to continue with Plan 02-04 (quotas-backend).

**Next milestone:** First end-to-end "click → running VM/LXC" lands at the end of Phase 4.

**Recently completed:**

- 2026-05-14 — Plan 02-03 inventory-backend (28 new tests; 249 total; inventory read/write API with per-team privsep RBAC, pool-match defense-in-depth, stale-cache graceful degradation, token-scrubbing before audit persistence; commit-before-raise on failure paths; 10 endpoints shipped; INV-01..08 + TENT-06 + API-05 marked complete)
- 2026-05-14 — Plan 02-02 audit-schema-writer (Alembic 0003_phase2 migration with per-cluster quota columns and composite partial UNIQUE indices; full audit subsystem: audit_write FLUSH-not-COMMIT writer, RBAC reader list_audit/count_export, streaming CSV exporter with UTF-8 BOM and OWASP CSV-injection mitigation, GET /api/v1/audit + GET /api/v1/audit/export.csv with 409 hard-limit guard, csv_safe.escape_cell, extract_source_ip X-Forwarded-For trust; 4 TDD commits; 221 tests passing; AUDIT-01..05 marked complete)
- 2026-05-14 — Plan 02-01 connector-extension
- 2026-05-14 — Plan 01-09 frontend-account (account self-service surface: /profile change-password + appearance theme picker; /profile/ssh-keys list/add/delete with ConfirmByNameDialog; /profile/tokens list/create/revoke with SecretRevealDialog show-once + active/revoked/expired status badges; api.me extended additively with changePassword + listSshKeys + addSshKey + deleteSshKey + listTokens + mintToken + revokeToken; AppShell mounts sonner Toaster; per-page +page.server.ts defence-in-depth auth gates + SSR pre-fetch; $derived(localOverride ?? data.list) pattern for SSR-seeded mutable lists; 26 tests still passing; AUTH-03, AUTH-04, AUTH-05, API-02 marked complete; zero UI-SPEC deviations)
- 2026-05-14 — Plan 01-08 frontend-auth-shell (login UI + 4-step first-run setup wizard + 4 shared form components — ConfirmByNameDialog + SecretRevealDialog + PasswordInput + FormSummaryAlert; real auth probe in +layout.server.ts replacing the Plan 03 stub via /api/v1/setup/status + /api/v1/me; typed api client with optional SSR fetch injection; open-redirect guard on ?next= post-login; wizard auto-login between step 2 and step 3; 26 tests passing across 4 suites; AUTH-01, AUTH-02 + UI-01, UI-02 + DEPLOY-05 frontend-completed)
- 2026-05-14 — Plan 01-07 users-admin-setup (first-run wizard backend GET /setup/status + POST /setup/admin per CONTEXT D-18 lenient first-run; admin user CRUD on /api/v1/users with auto-personal-team D-05; self-guard preventing admin lockout T-01-07-03/04/05; team_ids REPLACE semantics on PATCH preserving personal-team membership; synchronous session revocation on disable via revoke_user_sessions hook AUTH-07 / T-01-07-06; admin password reset that revokes all sessions; end-to-end test verifying disabled user's refresh cookie AND PAT both return 401; 34 new tests; total 166 passing; ruff clean; OpenAPI 25 paths; AUTH-07, AUTH-08, DEPLOY-05 marked complete)
- 2026-05-14 — Plan 01-06 clusters-tenant-bootstrap (PVEConnector wrapping proxmoxer with asyncio.to_thread per Pitfall A3; PVEConnectorRegistry lazy per-cluster cache with invalidate(id); cluster CRUD with validate-before-persist per Pitfall A4 + dry-run POST /clusters/test for the admin Test button; D-02 tenant bootstrap minting PVE pool/user/privsep token + PVEVMUser ACL on every active cluster, with best-effort delete_user+delete_pool rollback on partial failure per T-01-06-04; team CRUD + membership routes; D-04 option-a delete-team gate returning 409 on active cluster bindings; D-05 personal-team immutability via ConfigDict(extra=forbid) + service guard; create_team(registry=None) signature for Plan 07 first-run admin; 42 new tests; total 132 passing; ruff clean; CLUST-01, CLUST-05, CLUST-06, AUTH-08 marked complete)
- 2026-05-14 — Plan 01-05 auth-subsystem (login/refresh/logout with 3-cookie sessions per D-09; refresh rotation with replay-detection chain-revoke per Pitfall 22 / T-01-05-02; dual-mode get_current_principal cookie OR Bearer pat_*; double-submit CSRF dependency per D-13; per-IP login rate limiter; /me + SSH-key CRUD with cryptography-validated parse + SHA256 fingerprint; PAT CRUD with show-once plaintext + prefix_preview metadata; revoke_user_sessions hook for Plan 07; 34 new tests; total 90 passing; ruff clean; AUTH-01..05 + API-01..03 marked complete)
- 2026-05-14 — Plan 01-04 deployment-skeleton (one-line helper-script installer, idempotent bootstrap.sh, three systemd units, Caddyfile + tls internal, master.key + jwt.secret + pat.pepper generators at mode 0400; shellcheck-clean; caddy validate Valid configuration; DEPLOY-01/02/03/05 marked complete)
- 2026-05-14 — Plan 01-03 frontend-scaffold (SvelteKit 2 + Tailwind v4 + shadcn-svelte; 20 UI primitives; app shell + theme store + CSRF helper; 3 sanity tests green; production build clean)
- 2026-05-14 — Plan 01-02 db-schema (11 ORM models, Alembic 0001_initial, 23 new tests; 56 total green)
- 2026-05-14 — Plan 01-01 backend-scaffold (FastAPI app factory + 7 core primitives, 33 tests green)
- 2026-05-14 — Project research (STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md)
- 2026-05-14 — Requirements definition (89 v1 requirements across 13 categories)
- 2026-05-14 — Roadmap (5-phase structure, 100% coverage)

**Last session:** 2026-05-14T17:45:31.416Z
**Stopped at:** Completed Phase 02 Plan 02-05-frontend-inventory
**Resume file:** None

---
*State managed by GSD; do not edit phase counts manually — use `/gsd-transition` and `/gsd-progress`.*

**Planned Phase:** 2 (Multi-Cluster Inventory, Quotas & Audit) — 7 plans — 2026-05-14T16:21:02.171Z
