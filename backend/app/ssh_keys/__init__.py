"""SSH public-key management for users (AUTH-05, Plan 01-05 Task 2).

- :mod:`app.ssh_keys.service` — :func:`parse_ssh_pubkey`, :func:`add_ssh_key`,
  :func:`delete_ssh_key`. Parsing uses
  :func:`cryptography.hazmat.primitives.serialization.load_ssh_public_key`
  (no shell execution) and derives a ``SHA256:<base64>`` fingerprint.
- :mod:`app.ssh_keys.routes` — ``/api/v1/me/ssh-keys`` CRUD under
  :func:`~app.auth.dependencies.get_current_principal`.
- :mod:`app.ssh_keys.schemas` — request/response models.
"""
