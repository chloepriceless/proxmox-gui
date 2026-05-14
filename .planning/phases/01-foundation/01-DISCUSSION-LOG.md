# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 01-foundation
**Areas discussed:** Tenant ↔ Proxmox auth, Tenancy & ownership model, GUI auth surface (sessions + PATs), First-run wizard + LXC packaging

---

## Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| Tenant ↔ Proxmox auth | Per-tenant tokens vs super-token (open ADR, Pitfall 5) | ✓ |
| Tenancy & ownership model | Team-primary vs user-primary; pool mapping | ✓ |
| GUI auth surface (sessions + PATs) | JWT/cookie/CSRF/PAT shape | ✓ |
| First-run wizard + LXC packaging | Base OS, supervision, wizard UX | ✓ |

User selected all four areas.

---

## Tenant ↔ Proxmox Auth

### Which Proxmox auth model for tenants?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tenant tokens | PVE user + pool + privilege-separated API token per tenant; PVE enforces ACLs | ✓ |
| Single super-token + filter-in-app | One high-priv token; filter in code (Pitfall 5: "never for a multi-tenant product") | |
| Hybrid: super-token for admin, per-tenant for reads | Super-token writes + per-tenant reads | |

**User's choice:** Per-tenant tokens (recommended).
**Notes:** Aligned with research recommendation; mitigates Pitfall 5 at the Proxmox layer rather than relying on app-level filtering.

### When does the GUI provision the per-tenant PVE user + pool + token?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-bootstrap on tenant create | Create PVE user/pool/token on every registered cluster when admin creates a team | ✓ |
| Admin provisions in PVE first, then registers | Manual PVE setup, paste token | |
| Lazy: provision on first VM create | Defer PVE-side creation until first use | |

**User's choice:** Auto-bootstrap on tenant create (recommended).

### What privilege does the cluster-registration token need?

| Option | Description | Selected |
|--------|-------------|----------|
| High-privilege bootstrap token | Administrator-level; kept encrypted; used for both bootstrap + runtime | ✓ |
| Two-token model (bootstrap + runtime) | Bootstrap token used once; lower-priv runtime token created and used after | |
| PAM root + temporary ticket | Operator types root password once; GUI bootstraps gui@pam token and forgets root | |

**User's choice:** High-privilege bootstrap token (recommended).
**Notes:** Simpler operationally for v1. Two-token model noted as future hardening (Deferred Ideas).

### When a GUI tenant/user/team is deleted, what happens to the PVE-side objects?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete in GUI; PVE objects untouched | Tenant disabled; PVE user/pool/token preserved | |
| Cascade delete | Remove PVE user, revoke token, drop pool when GUI tenant deleted | |
| Block delete if tenant owns any VMs/LXCs | Admin must migrate/delete resources first | ✓ |

**User's choice:** Block delete if tenant owns any VMs/LXCs.
**Notes:** Most defensive. Soft-delete behavior for the "disable user" flow is captured separately in Claude's Discretion (user-disable semantics).

---

## Tenancy & Ownership Model

### What's the primary tenant boundary in the schema?

| Option | Description | Selected |
|--------|-------------|----------|
| Team-primary, user is a member | Team is the tenant; user has personal + may join shared teams | ✓ |
| User-primary, teams are a sharing overlay | User owns; teams = sharing layer | |
| Tenant entity = either user OR team, polymorphic | Single `tenant` table, type discriminator | |

**User's choice:** Team-primary (recommended).

### How are PVE pools provisioned?

| Option | Description | Selected |
|--------|-------------|----------|
| One PVE pool per team | One pool per team, including personal teams | ✓ |
| One pool per user | Per-user pools; teams are GUI-side metadata only | |
| Pool per team + pool per user | Both | |

**User's choice:** One PVE pool per team (recommended).

### Can a user belong to multiple teams?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — personal team + N shared teams | Many-to-many user↔team | ✓ |
| No — one team per user besides personal | At most one shared team | |
| Skip teams entirely in v1 | Each user is their own tenant; TENT-02 deferred | |

**User's choice:** Multi-team (recommended).

### Resource ownership: who 'owns' a VM/LXC?

| Option | Description | Selected |
|--------|-------------|----------|
| Team owns; created_by user_id is metadata | Equal team-member access; creator is audit metadata only | ✓ |
| User owns; team grants visibility only | Owner + share semantics | |
| Team owns, but creator has elevated rights | Role split within team | |

**User's choice:** Team owns (recommended).

### When per-user AND per-team quotas both exist, how do they combine?

| Option | Description | Selected |
|--------|-------------|----------|
| Both must pass | User AND team headroom required | |
| Team only — user quota ignored when user is in a team | Team-quota wins when user has any shared team membership | ✓ |
| User quota is the cap; team quota is informational | Per-user enforced; team is soft target | |

**User's choice:** Team only — user quota is ignored when user is in a team.
**Notes:** Deviates from recommended "both must pass". Per-user quota only takes effect when the user is solo in their personal team (i.e., not in any shared team). Captured exactly in CONTEXT.md D-08.

---

## GUI Auth Surface (sessions + PATs + token-at-rest)

### How does SvelteKit present session credentials to FastAPI?

| Option | Description | Selected |
|--------|-------------|----------|
| httpOnly cookie for access + refresh | Both tokens in httpOnly+Secure+SameSite=Lax cookies; JS never touches | ✓ |
| Access in JS memory (Bearer) + refresh in cookie | Hybrid; access briefly XSS-reachable | |
| Both in JS-readable cookies / localStorage | Easiest, worst XSS posture | |

**User's choice:** httpOnly cookie (recommended).

### Access JWT lifetime and refresh rotation policy?

| Option | Description | Selected |
|--------|-------------|----------|
| 15-min access, 7-day refresh, rotate on use | Industry standard | ✓ |
| 60-min access, 30-day refresh, rotate weekly | Longer; less defensive | |
| Stateless JWT only, no refresh, 24h TTL | Cannot revoke before expiry | |

**User's choice:** 15-min access, 7-day refresh, rotate-on-use (recommended).

### How are PATs presented and scoped?

| Option | Description | Selected |
|--------|-------------|----------|
| Authorization: Bearer; inherits user's tenancy + role | Same surface as session JWT; no per-PAT scope in v1 | ✓ |
| Authorization: Bearer + per-PAT scope | Read-only / read-write / per-team scopes | |
| Separate X-API-Token header, no scope | Different header, no scope | |

**User's choice:** Authorization: Bearer, inherits user perms (recommended).
**Notes:** Per-PAT scope deferred to v2 (Deferred Ideas).

### CSRF protection strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Double-submit cookie + SameSite=Lax | CSRF cookie + X-CSRF-Token header echo | ✓ |
| SameSite=Strict only, no token | Breaks legitimate external link nav | |
| Server-side CSRF token in session | Per-request server state read | |

**User's choice:** Double-submit cookie + SameSite=Lax (recommended).

### Master encryption key provisioning?

| Option | Description | Selected |
|--------|-------------|----------|
| Generated by installer, stored in /etc with 0600 | Helper-script writes /etc/proxmox-gui/master.key | ✓ |
| Derived from admin-supplied passphrase at first-run | Re-enter on every restart; high friction | |
| Hybrid: random key in /etc + optional passphrase wrap | Default safe, opt-in hardening | |

**User's choice:** Installer-generated, /etc/proxmox-gui/master.key 0600 (recommended).

### Symmetric crypto primitive?

| Option | Description | Selected |
|--------|-------------|----------|
| Fernet (cryptography lib) | AES-128-CBC + HMAC-SHA256, versioned | ✓ |
| AES-GCM via cryptography lib directly | More control, no TTL semantics | |
| libsodium / pynacl SecretBox | XSalsa20-Poly1305; adds dep | |

**User's choice:** Fernet (recommended).

---

## First-Run Wizard + LXC Packaging

### Which base OS for the LXC?

| Option | Description | Selected |
|--------|-------------|----------|
| Debian 12 | Matches Proxmox host; community-scripts familiar | ✓ |
| Debian 13 (Trixie) | Newer; less Proxmox-tested | |
| Ubuntu 24.04 LTS | Newer Python; some unprivileged-LXC quirks | |
| Alpine 3.20+ | Tiny but musl-libc pain for Python wheels | |

**User's choice:** Debian 12 (recommended).

### How is the FastAPI + arq worker + Caddy stack supervised?

| Option | Description | Selected |
|--------|-------------|----------|
| systemd units inside the LXC | Three units; requires nesting | ✓ |
| s6-overlay | Minimal container init; less Proxmox-operator familiar | |
| Single FastAPI process with in-process arq worker | Couples job lifecycle to API restart | |

**User's choice:** systemd units (recommended).

### What does the first-run wizard validate?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: test PVE token, require admin password + SSH key | Highest barrier | |
| Lenient: admin user mandatory, cluster + SSH key optional | Lower friction; finish wizard with just admin user | ✓ |
| Two-step: bootstrap-then-onboard | Admin in wizard; cluster/SSH in post-login onboarding dashboard | |

**User's choice:** Lenient.
**Notes:** Deviates from recommended "strict". Operator can boot the GUI and explore before committing PVE creds. Captured in D-18.

### Wizard UX shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step stepper (3–4 steps) | Welcome → Admin → Cluster (skippable) → Done | ✓ |
| Single-page progressive form | All fields, one submit | |
| Chat-style guided onboarding | Conversational | |

**User's choice:** Multi-step stepper (recommended).

---

## Claude's Discretion

User deferred the following to Claude's judgment during planning/implementation:
- Unprivileged LXC feature set beyond `nesting=1` (likely add `keyctl=1`)
- Default LXC sizing in the helper-script
- Caddy auto-HTTPS strategy (Let's Encrypt vs self-signed)
- FastAPI non-root service user
- Logging strategy (journald + structured JSON)
- Alembic baseline approach
- UI shell layout (sidebar + topbar pattern) and shadcn-svelte default theme as starting palette
- Light/dark mode mechanism (class strategy + system preference + persisted override)
- SSH key storage shape (normalized entries)
- User-disable semantics (soft flag; immediate session/PAT revocation)
- OpenAPI doc paths (`/api/docs`, `/api/redoc`, `/api/openapi.json`)
- Password complexity policy + login rate-limiting
- PVE-side naming conventions
- Half-bootstrap cleanup on partial PVE failure
- API endpoint versioning (`/api/v1/` mandatory from day one)

---

## Deferred Ideas

Surfaced during discussion, not in Phase 1 scope:
- Per-PAT scope (read-only / read-write / per-team) → v2
- Team-role split (viewer/editor/admin within a team) → v2
- Hybrid PVE auth (super-token writes + per-tenant reads) → v1.x if needed
- Passphrase-wrapped master key → v1.x enhancement
- Two-token PVE model (bootstrap + scoped runtime token) → future hardening
- 2FA / WebAuthn / OIDC → v2 (per PROJECT.md)
- Cascade-delete tenant + PVE objects → rejected (admin cleanup is manual)
