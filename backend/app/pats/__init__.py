"""Personal Access Tokens (PATs) for the REST API (API-02, Plan 01-05 Task 2).

- :mod:`app.pats.service` — :func:`mint_pat`, :func:`resolve_pat`,
  :func:`revoke_pat`. Mint returns plaintext exactly ONCE; resolve is
  constant-time within the indexed prefix lookup.
- :mod:`app.pats.routes` — ``/api/v1/me/tokens`` CRUD.
- :mod:`app.pats.schemas` — request/response models.
"""
