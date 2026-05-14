"""Authentication subsystem (Plan 01-05).

Implements local-auth surface per CONTEXT.md §GUI Auth Surface (D-09..D-13):

- :mod:`app.auth.service` — login / refresh / logout / change_password.
- :mod:`app.auth.dependencies` — ``get_current_principal`` (cookie OR Bearer
  PAT), ``require_admin``, ``csrf_protect``.
- :mod:`app.auth.refresh` — DB-stored refresh token rotation with chain-replay
  detection (Pitfall 22).
- :mod:`app.auth.rate_limit` — per-IP in-memory bucket limiter for the login
  route (v1; Phase 5 may harden).
- :mod:`app.auth.routes` — /api/v1/auth/{login,refresh,logout} HTTP surface.
- :mod:`app.auth.schemas` — pydantic request/response models.
"""
