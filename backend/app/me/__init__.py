"""``/api/v1/me`` — current-user routes (Plan 01-05).

- ``GET /api/v1/me/`` returns the current :class:`~app.auth.dependencies.Principal`
  as a :class:`~app.auth.schemas.MeResponse`.
- ``POST /api/v1/me/password`` rotates the user's password.

SSH key + PAT CRUD live in their own routers under ``/api/v1/me/ssh-keys`` and
``/api/v1/me/tokens`` respectively — see :mod:`app.ssh_keys` and :mod:`app.pats`.
"""
