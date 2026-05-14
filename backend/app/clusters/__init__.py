"""Cluster registration + per-cluster connector + tenant bootstrap (Plan 06).

Public surface (consumed by ``app.main`` and ``app.teams``):

- :class:`app.clusters.connector.PVEConnector` — proxmoxer wrapped in
  ``asyncio.to_thread`` (Pitfall A3).
- :class:`app.clusters.registry.PVEConnectorRegistry` — lazy per-cluster
  connector cache, invalidated on cluster edit/delete.
- :mod:`app.clusters.service` — register / list / update / delete + the
  ``test_cluster`` dry-run used by the admin "Test" button.
- :mod:`app.clusters.routes` — admin-only ``/api/v1/clusters`` router.
- :mod:`app.clusters.errors` — ``PVEUnreachable`` / ``PVEAuthError`` /
  ``PVEAPIError`` — mapped to HTTP via exception handlers in
  ``app.main``.

D-03 reminder: the bootstrap token persisted here is Administrator-level on
the PVE side and is used both for tenant provisioning (Plan 06) and runtime
operations (Phase 2+). Per-tenant privilege-separated tokens are minted into
``team_cluster_tokens`` by :mod:`app.teams.bootstrap`.
"""
