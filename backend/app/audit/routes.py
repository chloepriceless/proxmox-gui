"""Audit log HTTP surface (AUDIT-03, AUDIT-04, AUDIT-05).

Endpoints:
  GET /api/v1/audit/            -- paginated AuditPage (RBAC-scoped)
  GET /api/v1/audit/export.csv  -- streaming UTF-8-BOM CSV (RBAC-scoped)

Both endpoints accept cookie session auth AND Bearer PAT auth (same Principal
path -- Pitfall 9 mitigation, T-02-02-05).

CSV export is limited to HARD_EXPORT_LIMIT rows. If the filtered count
exceeds this limit, returns 409 with the limit in the response body
(T-02-02-06 DoS mitigation, D-19 UX "Export filtered (X rows)").
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.archive import list_archives, resolve_archive_path
from app.audit.csv import audit_csv_stream
from app.audit.reader import HARD_EXPORT_LIMIT, count_export, list_audit
from app.audit.schemas import AuditFilter, AuditPage
from app.auth.dependencies import Principal, get_current_principal, require_admin
from app.core.db import get_db

router = APIRouter()


def _parse_csv_param(value: str | None) -> list[str] | None:
    """Split a comma-separated query param into a list; return None if empty."""
    if not value:
        return None
    return [v for v in (s.strip() for s in value.split(",")) if v]


def _build_filter(
    from_: datetime | None,
    to: datetime | None,
    action: str | None,
    user_id: int | None,
    target_type: str | None,
    vmid: int | None,
    cluster_id: int | None,
    show_team_actions: bool,
) -> AuditFilter:
    return AuditFilter.model_validate(
        {
            "from": from_,
            "to": to,
            "action": _parse_csv_param(action),
            "user_id": user_id,
            "target_type": _parse_csv_param(target_type),
            "vmid": vmid,
            "cluster_id": cluster_id,
            "show_team_actions": show_team_actions,
        }
    )


@router.get(
    "/",
    response_model=AuditPage,
    summary="List audit entries (RBAC-scoped)",
    operation_id="audit_list",
)
async def list_audit_route(
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
    action: str | None = None,
    user_id: int | None = None,
    target_type: str | None = None,
    vmid: int | None = None,
    cluster_id: int | None = None,
    show_team_actions: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> AuditPage:
    filters = _build_filter(
        from_, to, action, user_id, target_type, vmid, cluster_id, show_team_actions
    )
    rows, total = await list_audit(
        db, principal=principal, filters=filters, page=page, page_size=page_size
    )
    return AuditPage(rows=rows, total=total, page=page, page_size=page_size)


@router.get(
    "/export.csv",
    summary="Stream filtered audit entries as UTF-8-BOM CSV",
    operation_id="audit_export_csv",
)
async def export_audit_csv(
    request: Request,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
    action: str | None = None,
    user_id: int | None = None,
    target_type: str | None = None,
    vmid: int | None = None,
    cluster_id: int | None = None,
    show_team_actions: bool = False,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    filters = _build_filter(
        from_, to, action, user_id, target_type, vmid, cluster_id, show_team_actions
    )
    # Hard limit guard: count first; if > 50000, refuse with 409
    # (T-02-02-06 DoS mitigation; D-19 "refine your filter" UX).
    total = await count_export(db, principal=principal, filters=filters)
    if total > HARD_EXPORT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Too many rows; refine filter", "limit": HARD_EXPORT_LIMIT},
        )
    filename = f"audit-{date.today().isoformat()}.csv"
    return StreamingResponse(
        audit_csv_stream(db, principal=principal, filters=filters),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Audit-archive list + download (plan 05-03, D-08)
#
# Both routes are require_admin: the .csv.gz archives are the UNSCOPED
# compliance dump produced by the nightly retention cron, so they must NEVER
# be reachable by a regular user (T-05-03-02). The download route additionally
# delegates path validation to ``resolve_archive_path`` which rejects any
# traversal attempt with a 400 (T-05-03-01 / Pitfall 5).
# ---------------------------------------------------------------------------


@router.get(
    "/archives",
    summary="List audit archive files (admin only)",
    operation_id="audit_archives_list",
    dependencies=[Depends(require_admin)],
)
async def audit_archives_list() -> list[dict]:
    """Return ``{name, size_bytes, ctime}`` for every ``.csv.gz`` archive."""
    return list_archives()


@router.get(
    "/archives/{name}",
    summary="Download an audit archive file (admin only)",
    operation_id="audit_archive_download",
    dependencies=[Depends(require_admin)],
)
async def audit_archive_download(name: str) -> FileResponse:
    """Stream the archive file as a gzip download.

    ``resolve_archive_path`` raises 400 on any path-traversal attempt
    (T-05-03-01). The route does not need to re-check the path — the guard
    is centralised so the test surface stays one function.
    """
    path = resolve_archive_path(name)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="archive not found",
        )
    return FileResponse(
        path,
        media_type="application/gzip",
        filename=name,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
