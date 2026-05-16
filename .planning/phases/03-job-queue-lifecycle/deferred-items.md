# Phase 3 — Deferred Items

Out-of-scope discoveries logged during plan execution. NOT fixed (scope boundary).

## Pre-existing ruff lint errors (not introduced by Phase 3)

Discovered during Plan 03-01 execution. `ruff check .` flags these in files
the plan did not create — they pre-date this plan (confirmed via
`git show HEAD:...`). The ruff pin (0.15.12) flags imports that an earlier
ruff version tolerated.

- `backend/app/inventory/service.py:11` — F401 `app.clusters.connector.PVEConnector`
  imported but unused. Unrelated to Phase 3; owned by Plan 02-03 (inventory).

(The `backend/app/main.py:73` I001 import-sort error WAS fixed in Plan 03-01
Task 2, since that task legitimately modifies `main.py`.)

## Test-ordering flake (not introduced by Phase 3)

Observed once during Plan 03-02 execution, then self-resolved.

- `backend/tests/test_jwt.py::test_decode_tampered_signature_raises` —
  failed once when run as part of an intermediate full-suite run but PASSED
  in isolation and PASSES in every subsequent full run (331 passed) once the
  Plan 03-02 test files shifted collection order. A latent test-isolation
  sensitivity in the JWT suite (ephemeral signing-key randomness). Unrelated
  to Plan 03-02's lifecycle/jobs work — owned by the auth subsystem
  (Phase 1, Plan 01-05) if it ever recurs.
