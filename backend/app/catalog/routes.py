"""Community-scripts catalog HTTP surface — LXC-01/02/04 (Plan 04-06).

Modelled on ``app.quotas.routes``:

- ``GET /clusters/{id}/catalog`` — the curated shortlist (LXC-01, default) or
  the searchable full catalog (LXC-02, ``view=full``). A team-scoped read,
  open to any authenticated user — NOT admin-gated.
- ``GET /clusters/{id}/catalog/{slug}`` — the single script-detail payload
  including the LXC-04 attribution block.
- ``POST /catalog/sync`` — an admin re-pin of the ``catalog_pin`` row (D-05).
  Carries ``Depends(require_admin)`` + ``Depends(csrf_protect)``; a non-admin
  caller → 403.

Route order: ``/catalog/{slug}`` is parameterised but the parent ``/catalog``
carries no trailing path param of its own, so the two never collide. The
fixed ``/catalog/sync`` route lives on a DIFFERENT path prefix (no
``cluster_id``) so order is irrelevant.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    Principal,
    csrf_protect,
    get_current_principal,
    require_admin,
)
from app.catalog import service
from app.core.db import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class CatalogListResponse(BaseModel):
    """``200`` body for ``GET .../catalog`` — the entry list + the active pin."""

    model_config = ConfigDict(extra="forbid")
    view: str
    commit_sha: str
    last_reviewed: str
    entries: list[dict]


class CatalogEntryResponse(BaseModel):
    """``200`` body for ``GET .../catalog/{slug}`` — entry + attribution."""

    model_config = ConfigDict(extra="forbid")
    entry: dict
    attribution: dict


class CatalogSyncResponse(BaseModel):
    """``200`` body for ``POST /catalog/sync`` — the re-pin summary."""

    model_config = ConfigDict(extra="forbid")
    added: int
    updated: int
    commit_sha: str


# ---------------------------------------------------------------------------
# GET /clusters/{id}/catalog — curated shortlist / searchable full catalog
# ---------------------------------------------------------------------------


@router.get(
    "/clusters/{cluster_id}/catalog",
    response_model=CatalogListResponse,
    summary="Community-scripts catalog — curated shortlist or searchable full list",
    operation_id="catalog_list",
)
async def get_catalog(
    cluster_id: int = Path(..., ge=1),
    view: str = Query("curated", pattern="^(curated|full)$"),
    q: str | None = Query(None, max_length=128),
    category: str | None = Query(None, max_length=64),
    principal: Principal = Depends(get_current_principal),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
) -> CatalogListResponse:
    """Return the curated shortlist (LXC-01) or the full catalog (LXC-02).

    ``view=curated`` (default) → the featured + admin-override shortlist.
    ``view=full`` → the full catalog, optionally filtered by ``q`` (substring
    match on name/slug/description) and ``category`` (exact membership).

    Open to any authenticated user — browsing the catalog is NOT admin-gated.
    ``cluster_id`` is in the path for URL consistency with the rest of the
    provisioning surface; the catalog itself is cluster-agnostic global config.
    """
    catalog = await service.load_catalog(db)
    if view == "full":
        entries = await service.search_catalog(db, q=q, category=category)
    else:
        entries = await service.curated_shortlist(db)
    return CatalogListResponse(
        view=view,
        commit_sha=catalog.commit_sha,
        last_reviewed=catalog.synced_at,
        entries=[e.to_dict() for e in entries],
    )


# ---------------------------------------------------------------------------
# GET /clusters/{id}/catalog/{slug} — single script detail + LXC-04 attribution
# ---------------------------------------------------------------------------


@router.get(
    "/clusters/{cluster_id}/catalog/{slug}",
    response_model=CatalogEntryResponse,
    summary="A single community-script — detail + source/commit/last-reviewed",
    operation_id="catalog_entry",
)
async def get_catalog_entry(
    cluster_id: int = Path(..., ge=1),  # noqa: ARG001
    slug: str = Path(..., min_length=1, max_length=128),
    principal: Principal = Depends(get_current_principal),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
) -> CatalogEntryResponse:
    """Return one catalog entry with its LXC-04 attribution block.

    The attribution carries ``source_url`` (the GitHub install-script link),
    ``commit_sha`` (the active pin) and ``last_reviewed`` (the pin's
    ``synced_at``) — surfaced before the deploy button.
    """
    entry = await service.get_entry(slug, db)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No community-script catalog entry for '{slug}'.",
        )
    attribution = await service.attribution_for(slug, db)
    return CatalogEntryResponse(
        entry=entry.to_dict(), attribution=attribution or {}
    )


# ---------------------------------------------------------------------------
# POST /catalog/sync — admin re-pin (D-05)
# ---------------------------------------------------------------------------


@router.post(
    "/catalog/sync",
    response_model=CatalogSyncResponse,
    summary="Re-pin the community-scripts catalog to a fresher commit (admin)",
    operation_id="catalog_sync",
    dependencies=[Depends(require_admin), Depends(csrf_protect)],
)
async def sync_catalog(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> CatalogSyncResponse:
    """Pull the latest upstream commit and re-pin the ``catalog_pin`` row.

    Admin-only (``Depends(require_admin)``) — re-pinning the supply-chain floor
    is an operator act (threat T-04-06-03). A non-admin caller → 403.
    """
    summary = await service.sync_catalog(db, actor_user_id=principal.user.id)
    return CatalogSyncResponse(**summary)
