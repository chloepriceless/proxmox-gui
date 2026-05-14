"""Admin user CRUD package (Plan 01-07 Task 2).

Implements AUTH-07 (admin user management) + AUTH-08 (admin team-membership
management) as a small service layer + admin-gated routes:

- :mod:`app.users.service` — ``create_user``, ``list_users``, ``get_user``,
  ``update_user``, ``delete_user``, ``set_user_password``, plus the
  membership add/remove helpers ``add_user_to_team`` / ``remove_user_from_team``.
- :mod:`app.users.routes` — admin-only ``/api/v1/users`` router. Every
  mutating route composes ``Depends(require_admin)`` and
  ``Depends(csrf_protect)``; read routes only require admin.

Critical invariants (enforced in service layer):

- Disabling a user (is_active True→False transition on PATCH) synchronously
  calls :func:`app.auth.service.revoke_user_sessions` (AUTH-07; T-01-07-06).
- Admin self-modification is guarded — admin cannot disable themselves,
  remove their own admin flag, or delete themselves (T-01-07-03..05).
- Personal teams are auto-created on user creation, named ``personal-<id>``
  (D-05). Plan 06's ``create_team(registry=None, auto_bootstrap=False)``
  signature accommodates this.
- ``team_ids`` REPLACE-semantics on PATCH only affects non-personal teams;
  the personal-team membership row is never touched.
- Personal team membership is rejected on ``POST /users/{id}/teams`` with
  a personal team_id (D-05 immutability).
"""

from app.users.routes import router  # noqa: F401 — re-export for app.main

__all__ = ["router"]
