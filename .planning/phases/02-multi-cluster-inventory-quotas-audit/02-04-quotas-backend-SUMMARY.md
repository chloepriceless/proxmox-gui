---
phase: 02-multi-cluster-inventory-quotas-audit
plan: "04"
subsystem: quotas, api, admission
tags: [quotas, admission, sqlite, begin-immediate, fastapi, pydantic, tdd, audit]

# Dependency graph
requires:
  - phase: 02-02-audit-schema-writer
    provides: audit_write FLUSH-not-COMMIT writer
  - phase: 02-03-inventory-backend
    provides: connector.list_resources() resource cache
  - phase: 02-01-connector-extension
    provides: PVEConnectorRegistry.get_for_team
  - phase: 01-foundation
    provides: User, Team, Quota, AuditLog models; Principal; auth dependencies

provides:
  - "GET /api/v1/teams/{id}/quotas: per-cluster quota grid + live usage (admin)"
  - "PUT /api/v1/teams/{id}/quotas: upsert per-cluster limits + audit (admin + CSRF)"
  - "GET /api/v1/me/quotas: aggregate + per-cluster breakdown for principal's teams"
  - "POST /api/v1/quotas/preview: admission preview returning QuotaPreview with dimensions (auth + CSRF)"
  - "compute_team_usage: usage derived from connector resource cache, pool-filtered, never cached"
  - "check_and_preview: TOCTOU-safe BEGIN IMMEDIATE admission primitive for Phase 3 reuse"
  - "set_team_quotas: UPSERT + audit-on-every-change; D-12 409 protection; allow_over bypass"
  - "get_my_quotas: aggregate = sum-of-clusters (None if any unlimited)"

affects:
  - 02-05-frontend-inventory
  - 02-06-frontend-audit-quotas
  - 03-job-queue-lifecycle

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEGIN IMMEDIATE admission: check_and_preview opens BEGIN IMMEDIATE, holds write lock, commits at end; Phase 3 sibling check_and_reserve will INSERT reservation row in same tx"
    - "Usage derived not counted: compute_team_usage always recomputes from connector.list_resources(), filtered by tok.poolid; never an in-memory counter (02-RESEARCH anti-pattern guard)"
    - "audit-on-every-quota-change: set_team_quotas flush audit row inside same transaction as UPSERT; commits together; payload_before/payload_after captured including allow_over bypass"
    - "D-12 lower-below-usage: set_team_quotas checks usage > new limit before upsert; 409 with cluster_id + usage payload; allow_over=True bypasses check but still audits"
    - "Phase 2 user-scoped quota rows ignored: check_and_preview and set_team_quotas SELECT Quota WHERE team_id only (Pitfall 9 / T-02-04-07)"
    - "QuotaLimit cluster_id=0 sentinel for aggregate: /me/quotas aggregator uses cluster_id=0 as sentinel in aggregate_limit; all per-cluster rows have cluster_id >= 1"

key-files:
  created:
    - backend/app/quotas/__init__.py
    - backend/app/quotas/schemas.py
    - backend/app/quotas/usage.py
    - backend/app/quotas/admission.py
    - backend/app/quotas/service.py
    - backend/app/quotas/routes.py
    - backend/tests/test_quotas_usage.py
    - backend/tests/test_quotas_admission.py
    - backend/tests/test_quotas_service.py
    - backend/tests/test_quotas_routes.py
  modified:
    - backend/app/main.py

key-decisions:
  - "busy_timeout PRAGMA already present from Phase 1 (db.py line 69 — PRAGMA busy_timeout = 5000); no change needed"
  - "QuotaLimit.cluster_id uses ge=0 (not ge=1) to allow cluster_id=0 sentinel for /me/quotas aggregate_limit; per-cluster rows always have cluster_id >= 1"
  - "Phase 2 ships check_and_preview (read-only admission preview); check_and_reserve (reservation write) is Phase 3 carveout"
  - "User-scoped Quota rows ignored in Phase 2: service queries WHERE team_id only; user-scoped rows have user_id set so they never match"

patterns-established:
  - "Pattern: BEGIN IMMEDIATE via SQLAlchemy text() — await db.execute(text('BEGIN IMMEDIATE')); OperationalError maps to 503 with retry advice"
  - "Pattern: usage = compute_team_usage; never maintain in-memory counter — always derive from resource cache"

requirements-completed:
  - TENT-01
  - TENT-02
  - TENT-03
  - TENT-04
  - TENT-05
  - API-05

# Metrics
duration: approx 8min
completed: 2026-05-14
---

# Phase 02 Plan 04: Quotas Backend Summary

Per-team per-cluster quota CRUD with BEGIN IMMEDIATE admission primitive, /me/quotas aggregator, and audit-on-every-change — usage always derived from PVE resource cache, never a drifting counter.

## Performance

- **Duration:** approx 8 min
- **Completed:** 2026-05-14
- **Tasks:** 2 (each with RED + GREEN TDD commits)
- **Files created:** 10 new, 1 modified
- **New tests:** 30 (18 service + 12 routes)
- **Total passing:** 279 (249 prior + 30 new)

## Accomplishments

- Complete quota CRUD: `list_team_quotas`, `set_team_quotas` (UPSERT + audit + D-12 409 guard), `get_my_quotas` (aggregate + per-cluster)
- TOCTOU-safe `check_and_preview` admission using `BEGIN IMMEDIATE`; 503 on `SQLITE_BUSY` with retry advice
- `compute_team_usage` derives usage from `connector.list_resources()` pool-filtered; never cached
- Four endpoints: GET/PUT `/teams/{id}/quotas` (admin), GET `/me/quotas`, POST `/quotas/preview`
- Cookie + PAT auth coexistence verified; CSRF enforced on mutations
- 279 tests passing; ruff clean

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| 1 | RED | `4404ad7` | Failing tests: quota usage, admission, service |
| 1 | GREEN | `0fde7f2` | Schemas, usage, admission, service layer |
| 2 | RED | `ffde2c7` | Failing tests: quota HTTP routes |
| 2 | GREEN | `1aca76f` | Quota routes + main.py wiring |

## Files Created/Modified

- `backend/app/quotas/__init__.py` — Package init
- `backend/app/quotas/schemas.py` — `QuotaLimit`, `QuotaUsage`, `QuotaUsagePresentable`, `ClusterQuotaRow`, `TeamQuotaPage`, `QuotaLimitsUpdate`, `QuotaPreviewRequest`, `QuotaDimension`, `QuotaPreview`, `MyTeamQuota`, `MyQuotasResponse`
- `backend/app/quotas/usage.py` — `compute_team_usage`: always recomputes from connector cache, pool-filtered
- `backend/app/quotas/admission.py` — `check_and_preview`: BEGIN IMMEDIATE, read-only in Phase 2
- `backend/app/quotas/service.py` — `list_team_quotas`, `set_team_quotas`, `get_my_quotas`
- `backend/app/quotas/routes.py` — 4 endpoints; `/quotas/preview` declared BEFORE `/{id}` paths
- `backend/app/main.py` — `quotas_router` registered at `/api/v1`
- `backend/tests/test_quotas_usage.py` — 3 tests
- `backend/tests/test_quotas_admission.py` — 6 tests
- `backend/tests/test_quotas_service.py` — 9 tests (incl. 404 helper)
- `backend/tests/test_quotas_routes.py` — 12 tests

## Decisions Made

- **`busy_timeout` already in db.py:** `PRAGMA busy_timeout = 5000` was set in Phase 1 (line 69); no change required.
- **`cluster_id=0` sentinel for aggregate:** `QuotaLimit.cluster_id` uses `ge=0` instead of `ge=1` to allow the aggregate sentinel value in `/me/quotas`. All real per-cluster rows use `cluster_id >= 1`.
- **Phase 2 user-scoped quotas ignored:** `check_and_preview` and `set_team_quotas` query `WHERE Quota.team_id == team_id` only; user-scoped rows (with `user_id` set) never match. Test `test_check_and_preview_user_scoped_quota_ignored_in_phase2` verifies this (T-02-04-07).
- **`check_and_preview` is read-only in Phase 2:** No reservation row is inserted. Phase 3 will add `check_and_reserve` in the same `BEGIN IMMEDIATE` transaction.

## MyQuotasResponse shape (for Plan 02-06 frontend)

```json
{
  "teams": [
    {
      "team_id": 42,
      "team_name": "team-foo",
      "clusters": [
        {
          "cluster_id": 1,
          "cluster_name": "pve-prod",
          "limit": {
            "cluster_id": 1,
            "cpu_cores": 16,
            "ram_gb": 64,
            "disk_gb": 500,
            "vm_count": 10
          },
          "usage": {
            "cpu_cores": 8,
            "ram_gb": 32,
            "disk_gb": 120,
            "vm_count": 3,
            "lxc_count": 1
          }
        }
      ],
      "aggregate_limit": {
        "cluster_id": 0,
        "cpu_cores": 16,
        "ram_gb": 64,
        "disk_gb": 500,
        "vm_count": 10
      },
      "aggregate_usage": {
        "cpu_cores": 8,
        "ram_gb": 32,
        "disk_gb": 120,
        "vm_count": 3,
        "lxc_count": 1
      }
    }
  ]
}
```

**Notes for QuotaIndicator:**
- `aggregate_limit.cpu_cores == null` means ANY cluster in the team is unlimited on that dimension → show "∞"
- `aggregate_limit.cluster_id == 0` is a sentinel; use `team_id` not `cluster_id` for identity
- Usage is in human units: `ram_gb`/`disk_gb` not bytes; `cpu_cores` and `vm_count` are counts

## 409 detail body shape (for Plan 02-06 UI-SPEC §"Lower quota limit")

When `PUT /teams/{id}/quotas` is called with a limit below current usage:

```json
{
  "detail": {
    "message": "Current usage exceeds the new limit.",
    "cluster_id": 1,
    "usage": {
      "cpu_cores": 20,
      "ram_gb": 48,
      "disk_gb": 300,
      "vm_count": 5,
      "lxc_count": 2
    },
    "requested_limit": {
      "cluster_id": 1,
      "cpu_cores": 10,
      "ram_gb": null,
      "disk_gb": null,
      "vm_count": null
    }
  }
}
```

To bypass: send `{"rows": [...], "allow_over": true}`. The override is still audited with `payload_before`/`payload_after` diff.

## User-scoped Quota rows — Pitfall 9 acceptance

User-scoped `Quota` rows (where `user_id IS NOT NULL`) exist in the schema from Phase 1 but are **intentionally ignored in Phase 2**. The admission check and quota CRUD service query exclusively on `Quota.team_id == team_id`. This matches the Phase 2 scope (D-11 — admin UI is team-only) and prevents accidental enforcement of user-level limits that have no admin-facing surface yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Principal` uses `mode=` not `via_pat=` keyword argument**
- **Found during:** Task 1 GREEN (test_quotas_service.py test helper)
- **Issue:** Test helper `_make_admin_principal` used `Principal(user=user, via_pat=False)` but the `Principal` dataclass has `mode: Literal["session", "pat"]` with a derived `via_pat` property
- **Fix:** Changed to `Principal(user=user, mode="session")`
- **Files modified:** `backend/tests/test_quotas_service.py`

**2. [Rule 1 - Bug] `QuotaLimit.cluster_id` validation rejects sentinel `cluster_id=0`**
- **Found during:** Task 1 GREEN (`test_get_my_quotas_aggregates_across_clusters`)
- **Issue:** Schema had `cluster_id: int = Field(..., ge=1)` but `get_my_quotas` uses `cluster_id=0` as aggregate sentinel per plan spec
- **Fix:** Changed to `ge=0` with a docstring explaining the sentinel convention
- **Files modified:** `backend/app/quotas/schemas.py`

**3. [Rule 1 - Bug] Ruff lint issues in test files**
- **Found during:** Task 1 + 2 GREEN (ruff check)
- **Issues:** Unused imports (`AsyncMock`, `MagicMock`, `create_async_engine`, `async_sessionmaker`), unused variables (`eng`, `page`), un-sorted import blocks, f-string without placeholders
- **Fix:** `ruff --fix` auto-fixed 22/24 errors; 2 F841 (`eng = None`, `page = ...`) fixed manually
- **Files modified:** all 4 test files

**Total deviations:** 3 auto-fixed (all Rule 1 bugs/lint)

## Known Stubs

None. All endpoints return live data derived from PVE resource cache or database. No hardcoded empty values flow to responses.

## Threat Mitigations Verified

| Threat ID | Status | Verification |
|-----------|--------|-------------|
| T-02-04-01 | Mitigated | `test_check_and_preview_uses_begin_immediate` asserts "BEGIN IMMEDIATE" in executed SQL |
| T-02-04-02 | Mitigated | `test_post_quotas_preview_non_admin_denied_for_other_team` → 403 |
| T-02-04-03 | Mitigated | `test_set_team_quotas_upserts_and_audits` + `test_put_team_quotas_admin_writes_and_audits` assert AuditLog row |
| T-02-04-04 | Mitigated | `test_set_team_quotas_rejects_unbound_cluster_422` → 422 |
| T-02-04-05 | Accepted | 30s ResourceCache from 02-01 covers this; no additional rate limiting needed |
| T-02-04-06 | Mitigated | Audit written regardless of allow_over; `test_set_team_quotas_allow_over_bypasses_409` verifies audit row |
| T-02-04-07 | Mitigated | `test_check_and_preview_user_scoped_quota_ignored_in_phase2` verifies user-scoped row not honored |

## Self-Check: PASSED

- [x] `backend/app/quotas/__init__.py` exists
- [x] `backend/app/quotas/schemas.py` exists
- [x] `backend/app/quotas/usage.py` exists
- [x] `backend/app/quotas/admission.py` exists
- [x] `backend/app/quotas/service.py` exists
- [x] `backend/app/quotas/routes.py` exists
- [x] Commits `4404ad7`, `0fde7f2`, `ffde2c7`, `1aca76f` present in git log
- [x] 279 tests passing (249 prior + 30 new)
- [x] ruff clean
- [x] busy_timeout PRAGMA confirmed in db.py line 69
