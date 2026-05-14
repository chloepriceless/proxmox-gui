"""Inventory HTTP surface — INV-01..08 + TENT-06 + API-05."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory import service
from app.inventory.access import ResolvedResource, require_resource_access
from app.inventory.schemas import (
    ClusterInventory,
    NotesUpdate,
    RRDQuery,
    RRDSample,
    TagsUpdate,
    VMDetail,
)

router = APIRouter()


def _get_registry(request: Request) -> PVEConnectorRegistry:
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        # Fallback for tests that don't run the full lifespan.
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from app.core.db import engine

        registry = PVEConnectorRegistry(
            None, async_sessionmaker(engine, expire_on_commit=False)
        )
        request.app.state.registry = registry
    return registry


# ---- /me/inventory aggregated across clusters ----
@router.get(
    "/me/inventory",
    response_model=list[ClusterInventory],
    summary="Aggregated inventory across all clusters the user can see",
    operation_id="inventory_me",
)
async def list_my_inventory(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> list[ClusterInventory]:
    return await service.list_inventory_for_principal(
        db,
        registry,
        principal=principal,
    )


# ---- /clusters/{cluster_id}/inventory per-cluster list ----
@router.get(
    "/clusters/{cluster_id}/inventory",
    response_model=ClusterInventory,
    summary="Per-cluster inventory (RBAC-scoped to principal's teams)",
    operation_id="inventory_for_cluster",
)
async def list_cluster_inventory(
    cluster_id: Annotated[int, Path(..., ge=1)],
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> ClusterInventory:
    return await service.list_inventory_for_cluster(
        db,
        registry,
        principal=principal,
        cluster_id=cluster_id,
    )


# ---- VM detail ----
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}",
    response_model=VMDetail,
    summary="VM detail (status + config) with RBAC + stale-cache fallback",
    operation_id="inventory_vm_detail",
)
async def get_vm_detail_route(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.get_vm_detail(db, resolved=resolved)


# ---- LXC detail (mirror) ----
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}",
    response_model=VMDetail,
    summary="LXC detail",
    operation_id="inventory_lxc_detail",
)
async def get_lxc_detail_route(
    resolved: ResolvedResource = Depends(require_resource_access),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.get_vm_detail(db, resolved=resolved)


# ---- RRD metrics (VM) ----
@router.get(
    "/clusters/{cluster_id}/vms/{vmid}/rrd",
    response_model=list[RRDSample],
    summary="RRD metric samples for sparklines",
    operation_id="inventory_vm_rrd",
)
async def get_vm_rrd_route(
    timeframe: Annotated[Literal["hour", "day", "week", "month", "year"], Query()] = "hour",
    cf: Annotated[Literal["AVERAGE", "MAX"], Query()] = "AVERAGE",
    resolved: ResolvedResource = Depends(require_resource_access),
) -> list[RRDSample]:
    return await service.get_vm_rrd(
        resolved=resolved,
        query=RRDQuery(timeframe=timeframe, cf=cf),
    )


# ---- RRD metrics (LXC) ----
@router.get(
    "/clusters/{cluster_id}/lxcs/{vmid}/rrd",
    response_model=list[RRDSample],
    summary="LXC RRD samples",
    operation_id="inventory_lxc_rrd",
)
async def get_lxc_rrd_route(
    timeframe: Annotated[Literal["hour", "day", "week", "month", "year"], Query()] = "hour",
    cf: Annotated[Literal["AVERAGE", "MAX"], Query()] = "AVERAGE",
    resolved: ResolvedResource = Depends(require_resource_access),
) -> list[RRDSample]:
    return await service.get_vm_rrd(
        resolved=resolved,
        query=RRDQuery(timeframe=timeframe, cf=cf),
    )


# ---- PUT tags (VM) ----
@router.put(
    "/clusters/{cluster_id}/vms/{vmid}/tags",
    response_model=VMDetail,
    summary="Replace tags on a VM (PVE last-write-wins)",
    operation_id="inventory_vm_tags_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_vm_tags(
    request: Request,
    payload: TagsUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_tags(
        db,
        principal=principal,
        resolved=resolved,
        new_tags=payload.tags,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


# ---- PUT tags (LXC) ----
@router.put(
    "/clusters/{cluster_id}/lxcs/{vmid}/tags",
    response_model=VMDetail,
    summary="Replace tags on an LXC",
    operation_id="inventory_lxc_tags_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_lxc_tags(
    request: Request,
    payload: TagsUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_tags(
        db,
        principal=principal,
        resolved=resolved,
        new_tags=payload.tags,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


# ---- PUT notes (VM) ----
@router.put(
    "/clusters/{cluster_id}/vms/{vmid}/notes",
    response_model=VMDetail,
    summary="Update PVE description (Markdown notes)",
    operation_id="inventory_vm_notes_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_vm_notes(
    request: Request,
    payload: NotesUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_notes(
        db,
        principal=principal,
        resolved=resolved,
        new_notes=payload.notes,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )


# ---- PUT notes (LXC) ----
@router.put(
    "/clusters/{cluster_id}/lxcs/{vmid}/notes",
    response_model=VMDetail,
    summary="Update LXC description",
    operation_id="inventory_lxc_notes_put",
    dependencies=[Depends(csrf_protect)],
)
async def put_lxc_notes(
    request: Request,
    payload: NotesUpdate,
    resolved: ResolvedResource = Depends(require_resource_access),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VMDetail:
    return await service.update_vm_notes(
        db,
        principal=principal,
        resolved=resolved,
        new_notes=payload.notes,
        source_ip=extract_source_ip(request),
        correlation_id=request.headers.get("X-Request-Id"),
    )
