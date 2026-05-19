# Phase 5: Polish & Operational Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 05-polish-operational-hardening
**Areas discussed:** Carryover debt triage, Idle timeout & re-auth, Self-update & audit retention, Mobile & accessibility, Helper-script packaging & UAT-1c

---

## Carryover debt triage

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all of it now | All ~17 carryover items fixed in Phase 5; nothing carries to v2 | ✓ |
| Fix all but defer TLS pinning | Defer TLS fingerprint pinning to v2 | |
| You triage per-item | Claude classifies each item inline/plan/debt for review | |

**User's choice:** Fix all of it now.

| Option | Description | Selected |
|--------|-------------|----------|
| Move limiter to Redis | Shared token-bucket state across workers | |
| Keep in-memory, enforce single-worker | Document + assert single-worker uvicorn | |
| You decide | Claude picks based on the systemd unit config | ✓ |

**User's choice:** You decide (ME-02 rate limiter → Claude's Discretion).

| Option | Description | Selected |
|--------|-------------|----------|
| Capture-on-register (TOFU) | Fetch + show fingerprint at cluster Test step, admin confirms, pin | ✓ |
| Manual fingerprint entry | Admin pastes the expected SHA-256 fingerprint | |
| Keep verify_ssl=False, just document | Defer real pinning to v2 | |

**User's choice:** Capture-on-register (TOFU).

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped into 2-3 hardening plans | Backend / deploy / security-feature groups | |
| One consolidated carryover plan | All ~17 fixes in a single plan | ✓ |
| You decide | Planner groups by wave/file-conflict analysis | |

**User's choice:** One consolidated carryover plan.

**Notes:** TLS fingerprint pinning, CSP header, and the scheduled health probe — all
verification carryover items — are in scope. The consolidated plan reads `01-REVIEW.md` and
`01-VERIFICATION.md` for each item's full description.

---

## Idle timeout & re-auth (AUTH-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Env var in config.py | Add `idle_timeout_seconds` to pydantic BaseSettings | |
| DB-backed admin Settings page | New settings table + admin page + GET/PATCH; also hosts audit retention | ✓ |
| You decide | Claude picks effort vs the 'configurable' criterion | |

**User's choice:** DB-backed admin Settings page (also the home for AUDIT-06 retention).

| Option | Description | Selected |
|--------|-------------|----------|
| 30 minutes | Common admin-dashboard default | ✓ |
| 15 minutes | Tighter, aligns with the access-JWT TTL | |
| 60 minutes | Relaxed, fewer interruptions | |

**User's choice:** 30 minutes.

| Option | Description | Selected |
|--------|-------------|----------|
| Modal overlay, preserve page | 'Session expired' modal; user stays on the same page | ✓ |
| Redirect to login, return after | Full redirect to /login then back | |
| You decide | Claude picks the re-auth presentation | |

**User's choice:** Modal overlay, preserve page.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — countdown with 'Stay signed in' | ~2-min countdown + extend button | ✓ |
| No — just the re-auth flow | No pre-warning | |

**User's choice:** Yes — countdown with 'Stay signed in'.

---

## Self-update & audit retention (DEPLOY-04, AUDIT-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Both: in-app button + script flag | UI button + install.sh --update recovery path | ✓ |
| In-app admin button only | Single UI update path | |
| Helper-script flag only | Update from the PVE host only | |

**User's choice:** Both — in-app button + helper-script flag.

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-update backup + auto-rollback | DB backup; auto-restore + revert on failure | ✓ |
| Pre-update backup, manual rollback | DB backup; operator owns recovery | |
| You decide | Claude picks the safety mechanism | |

**User's choice:** Pre-update backup + auto-rollback.

| Option | Description | Selected |
|--------|-------------|----------|
| Tagged releases, checksum-verified | Latest semver tag, SHA-256 manifest (closes ME-03) | ✓ |
| Track the master branch | Pull latest master | |
| You decide | Claude picks the release channel | |

**User's choice:** Tagged releases, checksum-verified.

| Option | Description | Selected |
|--------|-------------|----------|
| CSV.gz, downloadable in the UI | Nightly arq cron; archives listed on the Audit page | ✓ |
| Compressed files on disk, no UI | Filesystem-only archives | |
| You decide | Claude picks format + UI surfacing | |

**User's choice:** CSV.gz archives, downloadable in the admin UI.

---

## Mobile & accessibility (UI-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger drawer | Sidebar collapses into a slide-out overlay drawer | ✓ |
| Bottom tab bar | Fixed bottom bar + 'More' sheet | |
| You decide | Claude picks the mobile nav pattern | |

**User's choice:** Hamburger drawer.

| Option | Description | Selected |
|--------|-------------|----------|
| Card stack | Each VM/LXC becomes a tappable card | ✓ |
| Horizontal scroll | Keep the table, scroll sideways | |
| You decide | Claude picks the reflow strategy | |

**User's choice:** Card stack.

| Option | Description | Selected |
|--------|-------------|----------|
| Console scales; wizards gated | Console canvas scales; /create wizards show a desktop notice | ✓ |
| Both gated behind a notice | Console and wizards both gated on mobile | |
| Console scales; wizards reflow too | Also make wizards mobile-usable | |

**User's choice:** Console scales to fit; wizards gated behind a desktop-recommended notice.

| Option | Description | Selected |
|--------|-------------|----------|
| Automated check, fix violations | axe/Lighthouse against shadcn defaults | |
| Deeper manual audit too | + keyboard nav, ARIA, contrast, screen-reader smoke test | ✓ |
| You decide | Claude picks the accessibility scope | |

**User's choice:** Deeper manual audit too.

---

## Helper-script packaging & community-script SSH trust (UAT-1c)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — installer auto-trusts host | install.sh writes the GUI pubkey into the hosting node's authorized_keys | ✓ |
| No — print key, admin installs it | Installer prints the pubkey + instructions | |
| You decide | Claude picks keypair gen + hosting-node trust | |

**User's choice:** Yes — installer auto-trusts the hosting node.

| Option | Description | Selected |
|--------|-------------|----------|
| Show pubkey + verify step at registration | Register-cluster flow shows the pubkey + 'Verify SSH' button | ✓ |
| One-time root password auto-push | GUI ssh-copy-id's its key with a one-time root password | |
| You decide | Claude picks the additional-cluster trust mechanism | |

**User's choice:** Show pubkey + verify step at registration.

| Option | Description | Selected |
|--------|-------------|----------|
| Preflight check blocks the path | SSH probe before deploy; blocks only the community-script path | ✓ |
| Let it fail at job time | Job errors with a human-readable SSH-failure message | |
| You decide | Claude picks the degradation behaviour | |

**User's choice:** Preflight check blocks the path.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run updates the LXC in place | Existing CTID → route into the self-update path | ✓ |
| Re-run exits cleanly with guidance | Existing CTID → exit 0 with --update guidance | |
| You decide | Claude picks the re-run behaviour | |

**User's choice:** Re-run updates the LXC in place.

---

## Claude's Discretion

- ME-02 rate limiter — in-memory vs Redis-backed (lean: Redis-backed, already a hard dependency).
- Idle-timeout enforcement model — server-side authoritative via refresh-token rotation, with
  the client timer driving the warning + proactive re-auth.
- Audit-rotation cron cadence, archive directory location, archive file naming.
- Self-update in-progress UX (maintenance page vs reconnect polling).
- LXC SSH client config / known_hosts handling (`StrictHostKeyChecking=accept-new` retained).

## Deferred Ideas

None — discussion stayed within phase scope.
