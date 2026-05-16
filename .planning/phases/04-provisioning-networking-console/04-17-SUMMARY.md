---
phase: 04-provisioning-networking-console
plan: 17
subsystem: provisioning
tags: [security, supply-chain, community-scripts, validation, WR-01]
requires:
  - "run_community_script two-stage job (04-06)"
  - "_fail_job audited fail-fast path (app.jobs.functions)"
provides:
  - "_validate_commit_sha — git SHA-1 charset guard (^[0-9a-f]{40}$)"
  - "_validate_slug — catalog slug charset guard (^[a-z0-9][a-z0-9-]*$)"
  - "Job-boundary fail-fast guard in run_community_script for malformed pins"
affects:
  - "backend/app/jobs/provisioning_functions.py"
tech-stack:
  added: []
  patterns:
    - "Defense-at-the-use-site input validation before string interpolation"
    - "Fail-fast at the job boundary with a friendly audited error"
key-files:
  created: []
  modified:
    - "backend/app/jobs/provisioning_functions.py"
    - "backend/tests/test_catalog.py"
decisions:
  - "Validate commit_sha + slug at BOTH the job boundary (fail-fast, audited) and inside _build_install_command (defense in depth) — the job-boundary guard is mandatory so a bad value fails with a friendly error rather than an uncaught ValueError mid-stage-2."
  - "catalog_pin write-time validation left out of scope per the gap brief — the job-side use-site guard is the mandatory defense."
metrics:
  duration: "~12 min"
  completed: "2026-05-16"
  tasks: 1
  files: 2
---

# Phase 4 Plan 17: Community-Script Supply-Chain Hardening (WR-01) Summary

Closed the CLAUDE.md constraint #8 supply-chain hole: `run_community_script`'s
`_build_install_command` interpolated `commit_sha` and `slug` (from the
`catalog_pin` row) into a raw GitHub URL and a `bash -c` shell command without
validating them. Both inputs are now validated against strict charsets — a
git SHA-1 (`^[0-9a-f]{40}$`) and the catalog slug charset
(`^[a-z0-9][a-z0-9-]*$`) — before either can ever reach interpolation, both at
the job boundary (fail-fast with a friendly audited error) and inside
`_build_install_command` (defense in depth).

## What Was Built

**`backend/app/jobs/provisioning_functions.py`:**

- `import re` added to the top-of-file imports.
- Two module-level compiled patterns near `_SCRIPTS_REPO_RAW`:
  - `_COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")` — a 40-char lowercase hex
    git SHA-1; an off-spec value is not a valid pin.
  - `_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")` — lowercase alphanumeric
    plus hyphens, must start alphanumeric; blocks path traversal and shell
    metacharacters.
- `_validate_commit_sha(value)` / `_validate_slug(value)` — module-level
  helpers that return the value unchanged on success, raise `ValueError` with
  an explanatory message otherwise. Both are robust against a non-`str` input
  (`isinstance` check before the regex).
- `_build_install_command` now calls `_validate_slug(slug)` and
  `_validate_commit_sha(commit_sha)` at the top of the function, **before** the
  `script_url` f-string is built — defense at the use site.
- `run_community_script` gained a `try/except ValueError` guard wrapping both
  validators, placed **after** the connector is obtained but **before** the
  stage-1 LXC-create block. On a malformed value it calls `_fail_job` (the
  existing audited fail-fast path, mirroring the connector-unavailable branch)
  and `return`s — so a bad pin never creates an LXC and never builds the
  install command.

**`backend/tests/test_catalog.py`** — 16 new tests under a "WR-01" section:

- `_validate_commit_sha`: accepts a real SHA; rejects uppercase, too-short,
  non-hex, shell-metacharacter, and non-string values.
- `_validate_slug`: accepts real slugs (`plex`, `home-assistant`,
  `nextcloud`); rejects `../`-bearing, metacharacter-bearing, leading-hyphen,
  and empty values.
- `_build_install_command` rejects a bad `commit_sha` and a bad `slug`.
- `run_community_script` with a malformed `commit_sha` / malformed `slug`
  marks the job `failed` with an explanatory `friendly_error` and **never
  dispatches a stage-1 LXC create** (`fake.find_calls("nodes.pve-01.lxc.post")
  == []`).
- The fail-fast rejection is recorded to the audit log (`result == "failure"`,
  threat T-04-17-04).

## TDD Gate Compliance

- RED gate: `test(04-17): add failing tests...` — commit `ad67aed`
  (16 new tests, all failing — validators did not exist).
- GREEN gate: `feat(04-17): validate commit_sha + slug...` — commit `71ffef1`
  (validators added; all 16 tests pass).
- REFACTOR: not needed — the implementation is minimal and clean as written.

## Deviations from Plan

None for the implementation — the plan was executed exactly as written.

### Process notes (not deviations to the code)

- The plan's verify command says `cd backend && . venv/bin/activate`; the
  actual virtualenv is `backend/.venv` (dot-venv), so `. .venv/bin/activate`
  was used (per the execution brief).
- During the RED-test insertion, an `Edit` anchored on the last lines of the
  pre-existing `test_worker_registers_community_script_kind` function did not
  include that function's second assertion (`assert "max_tries=1" in src`),
  leaving it orphaned after the inserted block. Caught immediately by the
  GREEN test run (`NameError: name 'src' is not defined`) and corrected by
  moving the assertion back into its function. No code-behavior impact; both
  catalog-worker tests pass.

## Deferred / Out-of-Scope Items

- `ruff check tests/test_catalog.py` flags one pre-existing F841 unused-variable
  warning (`plain_slugs` ~line 164) in the curated-shortlist test. Confirmed
  present in `HEAD~1` (before this plan's changes) and unrelated to the WR-01
  path. Logged to `deferred-items.md`; not fixed (scope boundary). `ruff check
  app/jobs/provisioning_functions.py` — the file actually hardened — is clean.

## Known Stubs

None.

## Verification Results

| Check | Result |
|-------|--------|
| `pytest tests/test_catalog.py -q` | PASS — 38 passed (22 prior + 16 new) |
| `pytest -q` (full backend suite) | PASS — **506 passed**, 0 failed (≥485 required) |
| `ruff check app/jobs/provisioning_functions.py` | PASS — clean (the hardened file) |
| `ruff check tests/test_catalog.py` | 1 pre-existing F841 (`plain_slugs`), out of scope — deferred |
| `grep '[0-9a-f]{40}' provisioning_functions.py` | PASS — `_COMMIT_SHA_RE` pattern present |

Note: the known pre-existing flaky test
`test_jwt.py::test_decode_tampered_signature_raises` (base64 last-char
tampering) **passed** in this run — the full suite was green at 506/506.

## Threat Model Compliance

All four entries in the plan's STRIDE register are addressed:

- **T-04-17-01** (Tampering — `commit_sha` → install URL): `_validate_commit_sha`
  enforces `^[0-9a-f]{40}$` before interpolation. Mitigated.
- **T-04-17-02** (EoP — `commit_sha`/`slug` → `bash -c` command): both values
  validated against strict charsets that exclude shell metacharacters.
  Mitigated.
- **T-04-17-03** (Tampering — `slug` → `install/{slug}-install.sh`):
  `_validate_slug` rejects `/`, `..` and any non-`[a-z0-9-]` char. Mitigated.
- **T-04-17-04** (Repudiation — a rejected job): the fail-fast path routes
  through `_fail_job`, which writes an audit-log entry; verified by
  `test_run_community_script_malformed_input_is_audited`. Accepted/covered.

No new threat surface introduced.

## Self-Check: PASSED

- `backend/app/jobs/provisioning_functions.py` — FOUND, contains
  `_validate_commit_sha`, `_validate_slug`, and the `[0-9a-f]{40}` pattern.
- `backend/tests/test_catalog.py` — FOUND, contains the 16 WR-01 tests.
- Commit `ad67aed` (RED) — FOUND in git log.
- Commit `71ffef1` (GREEN) — FOUND in git log.
