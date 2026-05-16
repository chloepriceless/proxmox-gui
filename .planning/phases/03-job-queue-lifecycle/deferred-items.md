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
</content>
</invoke>
