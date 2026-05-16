"""Networks HTTP surface — NET-01..04 (Plan 04-07).

Modelled on ``app.quotas.routes``:

- ``GET /clusters/{id}/networks`` — the team-scoped grouped picker (NET-01,
  NET-03, NET-04). NOT admin-gated — any authenticated team-scoped user. The
  principal's team for the cluster is resolved from ``team_cluster_tokens``;
  SDN VNets are filtered to that team's ``NetworkScope`` grants (D-19).
- ``GET /admin/teams/{tid}/clusters/{cid}/networks`` — the Networks-tab GET
  (NET-02). ``Depends(require_admin)`` — returns the cluster's full SDN/bridge
  inventory + the team's current grants.
- ``PUT /admin/teams/{tid}/clusters/{cid}/networks`` — the Networks-tab save.
  ``Depends(require_admin)`` + ``Depends(csrf_protect)`` — persists the grant
  set via ``scoping.set_team_network_scope``.

RBAC (spike §7): the SDN/bridge reads behind these routes run with the
cluster-admin connector inside the service layer — never the per-team privsep
token. The per-team visibility filter is applied APP-SIDE (D-18/D-19).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal,
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.inventory.access import _team_ids_for_user, _team_tokens_for_cluster
from app.networks import scoping, service
from app.networks.schemas import (
    NetworkPickerResponse,
    NetworkScopeResponse,
    NetworkScopeUpdate,
)

router = APIRouter()


def _get_registry(request: Request) -> PVEConnectorRegistry:
    """Extract the connector registry from app.state, building on demand for tests."""
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine

        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False)
        )
        request.app.state.registry = registry
    return registry


# ---------------------------------------------------------------------------
# GET /clusters/{id}/networks — the team-scoped grouped picker
# ---------------------------------------------------------------------------


@router.get(
    "/clusters/{cluster_id}/networks",
    response_model=NetworkPickerResponse,
    summary="SDN-aware network picker — SDN VNets (granted) + legacy bridges",
    operation_id="networks_picker",
)
async def get_networks(
    cluster_id: int = Path(..., ge=1),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> NetworkPickerResponse:
    """Return the grouped network picker for the principal's team on the cluster.

    NOT admin-gated — any authenticated team-scoped user. Legacy bridges are
    always present (default-visible, D-19); SDN VNets appear only when an
    admin has granted them on the Networks tab (NET-02). The principal's team
    for ``cluster_id`` is resolved from ``team_cluster_tokens``; a principal
    with no team bound to the cluster → 403 (T-04-07-01 — cross-tenant).
    """
    user_team_ids = await _team_ids_for_user(db, user_id=principal.user.id)
    tokens = await _team_tokens_for_cluster(
        db, team_ids=user_team_ids, cluster_id=cluster_id,
    )
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have no team bound to that cluster.",
        )
    # A user is bound to a cluster via exactly one team token per (team,
    # cluster); pick the first team — the picker is per-team-per-cluster.
    team_id = tokens[0].team_id
    return await service.list_networks_for_team(
        db, registry, cluster_id=cluster_id, team_id=team_id,
    )


# ---------------------------------------------------------------------------
# GET /admin/teams/{tid}/clusters/{cid}/networks — the Networks-tab view
# ---------------------------------------------------------------------------


@router.get(
    "/admin/teams/{team_id}/clusters/{cluster_id}/networks",
    response_model=NetworkScopeResponse,
    summary="Team network scope — full cluster inventory + current grants (admin)",
    operation_id="admin_get_team_network_scope",
    dependencies=[Depends(require_admin)],
)
async def get_team_network_scope_route(
    team_id: int = Path(..., ge=1),
    cluster_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> NetworkScopeResponse:
    """Return the cluster's full SDN/bridge inventory + the team's grants.

    Admin-only — feeds the Networks admin tab (D-18). The full inventory lets
    the UI offer only valid grants (T-04-07-03).
    """
    sdn_capable, sdn_vnets, bridges = await service.list_cluster_network_inventory(
        db, registry, cluster_id=cluster_id,
    )
    granted = await scoping.get_team_network_scope(
        db, team_id=team_id, cluster_id=cluster_id,
    )
    return NetworkScopeResponse(
        team_id=team_id,
        cluster_id=cluster_id,
        sdn_capable=sdn_capable,
        available_sdn_vnets=sdn_vnets,
        available_bridges=bridges,
        granted=granted,
    )


# ---------------------------------------------------------------------------
# PUT /admin/teams/{tid}/clusters/{cid}/networks — save the grant set
# ---------------------------------------------------------------------------


@router.put(
    "/admin/teams/{team_id}/clusters/{cluster_id}/networks",
    response_model=NetworkScopeResponse,
    summary="Save the team's SDN/bridge network scope for a cluster (admin)",
    operation_id="admin_set_team_network_scope",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def put_team_network_scope_route(
    payload: NetworkScopeUpdate,
    team_id: int = Path(..., ge=1),
    cluster_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> NetworkScopeResponse:
    """Persist the team's network grant set for the cluster (NET-02).

    Admin-only (+ CSRF on the write). The grant set is keyed by ``cluster_id``
    so a grant never leaks across clusters (T-04-07-03). Returns the refreshed
    Networks-tab view.
    """
    await scoping.set_team_network_scope(
        db,
        team_id=team_id,
        cluster_id=cluster_id,
        sdn_vnets=payload.sdn_vnets,
        bridges=payload.bridges,
    )
    sdn_capable, sdn_vnets, bridges = await service.list_cluster_network_inventory(
        db, registry, cluster_id=cluster_id,
    )
    granted = await scoping.get_team_network_scope(
        db, team_id=team_id, cluster_id=cluster_id,
    )
    return NetworkScopeResponse(
        team_id=team_id,
        cluster_id=cluster_id,
        sdn_capable=sdn_capable,
        available_sdn_vnets=sdn_vnets,
        available_bridges=bridges,
        granted=granted,
    )
