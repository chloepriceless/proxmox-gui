"""Self-update package — DEPLOY-04 (plan 05-04).

This package owns the user-facing surface of the self-update flow:

- :mod:`app.selfupdate.schemas` — request/response Pydantic models.
- :mod:`app.selfupdate.service` — pure helpers (manifest fetch, SHA-256 verify,
  WAL-safe DB snapshot) usable from both the API route and the worker job.
- :mod:`app.selfupdate.routes` — ``POST /api/v1/admin/self-update`` (202-enqueue
  contract; admin-gated; CSRF-protected).

The orchestration body lives in :mod:`app.jobs.selfupdate_functions` so the
update can run in the WORKER process (which survives the API restart in
RESEARCH §Pattern 5 step 5).
"""
