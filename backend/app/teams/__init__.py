"""Team CRUD + D-02 tenant bootstrap (Plan 06 Task 2).

Public surface:

- :mod:`app.teams.service` — ``create_team``, ``update_team``, ``delete_team``,
  ``add_member``, ``remove_member``.
- :mod:`app.teams.bootstrap` — ``bootstrap_tenant_on_clusters``,
  ``teardown_tenant_on_clusters``, ``BootstrapFailed``.
- :mod:`app.teams.routes` — admin-only ``/api/v1/teams`` router.
- :mod:`app.teams.schemas` — request/response models.

Decision boundaries this package enforces:

- **D-02:** ``create_team`` (when called with a registry + active clusters)
  auto-bootstraps PVE pool/user/privsep token + ACL on every active cluster
  inside the same DB transaction. Failure rolls back DB AND best-effort PVE.
- **D-04 (option-a, WARNING-7 fix):** ``delete_team`` returns 409 if any
  ``team_cluster_tokens`` row references the team. The admin must manually
  unbind via a Phase-2 endpoint first; we never call
  ``teardown_tenant_on_clusters`` from the delete path.
- **D-05:** Personal teams can NOT be created via the API and can NOT be
  deleted. Personal team membership is immutable.
- **D-06:** One PVE pool per team. Pool name = ``gui-team-<id>``.
"""
