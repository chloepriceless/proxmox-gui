"""ISO / cloud-image library HTTP surface — VM-08, VM-01/D-15.

Modelled on ``app.lifecycle.clone_migrate_routes`` + ``app.quotas.routes``:

- ``GET /clusters/{id}/iso`` — the ISO library across the node's
  content-filtered storages (Pitfall 16). A team-scoped read; NOT admin-gated.
- ``GET /clusters/{id}/iso/cloud-images`` — the curated cloud-image list
  (D-15) — static config data.
- ``POST /clusters/{id}/iso/download`` — a 202 ``storage.download`` job. NOT
  admin-gated (D-17 — any authenticated, team-scoped user). Carries
  ``Depends(csrf_protect)``; the service rejects a non-http(s) URL 422 (SSRF —
  T-04-05-01) and a cross-tenant team 403.

Route order: the fixed ``/iso/cloud-images`` segment is declared BEFORE the
parameterised library route is irrelevant here (``/iso`` and
``/iso/cloud-images`` share no parameter), but ``/iso/cloud-images`` and
``/iso/download`` are distinct literal paths so order does not matter.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Principal, csrf_protect, get_current_principal
from app.clusters.registry import PVEConnectorRegistry
from app.core.db import get_db
from app.core.source_ip import extract_source_ip
from app.inventory.access import _get_registry
from app.iso import service
from app.iso.cloud_images import CURATED_CLOUD_IMAGES
from app.lifecycle.routes import _require_arq_pool
from app.lifecycle.schemas import JobAcceptedResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class IsoItem(BaseModel):
    """One ISO volume present on a storage."""

    model_config = ConfigDict(extra="forbid")
    volid: str
    filename: str
    size: int
    storage: str
    format: str | None = None


class IsoLibraryResponse(BaseModel):
    """``200`` body for ``GET .../iso`` — the content-filtered ISO list."""

    model_config = ConfigDict(extra="forbid")
    isos: list[IsoItem]


class CloudImageItem(BaseModel):
    """One curated cloud image (D-15)."""

    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    os_family: str
    version: str
    url: str


class CloudImageListResponse(BaseModel):
    """``200`` body for ``GET .../iso/cloud-images`` — the curated list."""

    model_config = ConfigDict(extra="forbid")
    images: list[CloudImageItem]


class IsoDownloadRequest(BaseModel):
    """Body of ``POST .../iso/download``.

    ``team_id`` names the owning team (a download has no existing resource to
    resolve the team from). ``content`` is the PVE storage content type
    (``iso`` for an ISO, ``import`` for a cloud image). The URL scheme is
    validated http(s)-only by the service (SSRF — T-04-05-01).
    """

    model_config = ConfigDict(extra="forbid")
    team_id: int = Field(..., ge=1)
    node: str = Field(..., min_length=1, max_length=64)
    storage: str = Field(..., min_length=1, max_length=128)
    url: str = Field(..., min_length=1, max_length=2048)
    content: str = Field(default="iso", max_length=32)
    filename: str = Field(..., min_length=1, max_length=256)


# ---------------------------------------------------------------------------
# GET /clusters/{id}/iso/cloud-images — fixed segment (static curated list)
# ---------------------------------------------------------------------------


@router.get(
    "/clusters/{cluster_id}/iso/cloud-images",
    response_model=CloudImageListResponse,
    summary="The curated official cloud-image list (VM-01 / D-15)",
    operation_id="iso_cloud_images",
)
async def get_cloud_images(
    cluster_id: int = Path(..., ge=1),
    principal: Principal = Depends(get_current_principal),
) -> CloudImageListResponse:
    """Return the vendored curated cloud-image catalogue.

    The list is static config data — no PVE call, no DB. ``cluster_id`` is in
    the path purely for URL consistency with the rest of the ISO surface.
    """
    return CloudImageListResponse(
        images=[CloudImageItem(**img) for img in CURATED_CLOUD_IMAGES]
    )


# ---------------------------------------------------------------------------
# GET /clusters/{id}/iso — the ISO library across storages
# ---------------------------------------------------------------------------


@router.get(
    "/clusters/{cluster_id}/iso",
    response_model=IsoLibraryResponse,
    summary="List the ISOs present across the node's iso-capable storages (VM-08)",
    operation_id="iso_library",
)
async def get_iso_library(
    cluster_id: int = Path(..., ge=1),
    team_id: int = Query(..., ge=1),
    node: str = Query(..., min_length=1, max_length=64),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> IsoLibraryResponse:
    """Return the content-filtered ISO list — a team-scoped read (Pitfall 16).

    Not admin-gated: any authenticated member of ``team_id`` may browse the
    ISO library. A cross-tenant ``team_id`` is rejected 403 in the service.
    """
    isos = await service.list_isos(
        db, registry,
        principal=principal,
        cluster_id=cluster_id,
        team_id=team_id,
        node=node,
    )
    return IsoLibraryResponse(isos=[IsoItem(**row) for row in isos])


# ---------------------------------------------------------------------------
# POST /clusters/{id}/iso/download — 202 storage.download job
# ---------------------------------------------------------------------------


@router.post(
    "/clusters/{cluster_id}/iso/download",
    response_model=JobAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Download an ISO / cloud image by URL (enqueues a job — D-17, open)",
    operation_id="iso_download",
    dependencies=[Depends(csrf_protect)],
)
async def download_iso(
    cluster_id: int,
    request: Request,
    payload: IsoDownloadRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
    registry: PVEConnectorRegistry = Depends(_get_registry),
) -> JobAcceptedResponse:
    """Enqueue a URL-download — PVE fetches the file (Pitfall 7).

    NOT admin-gated (D-17): any authenticated, team-scoped user may trigger a
    download. The service rejects a non-http(s) URL 422 (SSRF — T-04-05-01)
    and a cross-tenant team 403.
    """
    job = await service.enqueue_iso_download(
        db,
        _require_arq_pool(request),
        principal=principal,
        cluster_id=cluster_id,
        team_id=payload.team_id,
        node=payload.node,
        storage=payload.storage,
        url=payload.url,
        content=payload.content,
        filename=payload.filename,
        registry=registry,
        source_ip=extract_source_ip(request),
    )
    return JobAcceptedResponse(job_id=job.id, state=job.state, kind=job.kind)
