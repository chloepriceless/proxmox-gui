"""First-run setup wizard backend (Plan 01-07 Task 1).

Implements the lenient first-run contract from CONTEXT D-18:

- ``GET /api/v1/setup/status`` is OPEN (no auth) and returns the predicate
  flags ``{no_admin_yet, cluster_count}``. Always 200.
- ``POST /api/v1/setup/admin`` is OPEN if and only if ``no_admin_yet`` is
  True; once an admin exists this endpoint returns 409.
- The admin step is the ONLY mandatory step. Cluster registration during
  the wizard goes through the regular ``POST /api/v1/clusters`` once the
  admin is logged in (Plan 08's UI handles this transparently).

There is intentionally NO ``/api/v1/setup/cluster`` route. Theme /
preferences are entirely a frontend concern (Plan 08).

Threat-model notes (T-01-07-02):
The ``no_admin_yet`` predicate is the SOLE gate on ``POST /setup/admin``.
We accept this for v1: the operator just installed the LXC and only their
browser can plausibly reach it on first boot. CONTEXT D-19 calls out a
bootstrap-token sidecar option which we explicitly DEFER (Q2 resolution
in Plan 06's plan-check).
"""

from app.setup.routes import router  # noqa: F401 — re-export for app.main

__all__ = ["router"]
