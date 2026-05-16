"""ISO / cloud-image library service — VM-08, VM-01/D-15.

Modelled on ``app.quotas.service`` + ``app.provisioning.service``:

- ``list_isos`` — a pure read: resolves the team's privsep connector and
  enumerates the content-filtered ISO volumes (Pitfall 16).
- ``enqueue_iso_download`` — the 202 path: validates the download URL scheme
  (SSRF — T-04-05-01 / V12), then enqueues a ``storage.download`` job (the
  ``run_download`` job function shipped by Plan 04-04 — this plan ENQUEUES it,
  it does not re-create it). PVE's ``download-url`` endpoint fetches the bytes
  on the PVE node; the GUI never resolves or proxies the URL (Pitfall 7).

The cross-tenant membership guard mirrors ``provisioning.service`` — an ISO
download names the owning team in the request body, so there is no existing
resource to run ``require_resource_access`` against (T-04-05 trust boundary).
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.writer import audit_write
from app.auth.dependencies import Principal
from app.jobs.enqueue import enqueue_job
from app.models import Job, TeamMembership

__all__ = ["list_isos", "enqueue_iso_download"]

#: The only URL schemes PVE's ``download-url`` should ever be handed. Anything
#: else (``file:``, ``ftp:``, ``gopher:`` ...) is an SSRF / local-file vector.
_ALLOWED_URL_SCHEMES = {"http", "https"}


# ---------------------------------------------------------------------------
# Team-membership guard (T-04-05 trust boundary)
# ---------------------------------------------------------------------------


async def _require_team_membership(
    db: AsyncSession, *, user_id: int, team_id: int
) -> None:
    """Raise 403 unless ``user_id`` is a member of ``team_id``.

    An ISO download names the owning team in the request body — there is no
    existing resource to resolve. Same don't-leak-existence 403 whether the
    team does not exist OR the principal is not a member.
    """
    row = (
        await db.execute(
            select(TeamMembership.team_id).where(
                TeamMembership.user_id == user_id,
                TeamMembership.team_id == team_id,
            )
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team",
        )


# ---------------------------------------------------------------------------
# ISO library read
# ---------------------------------------------------------------------------


async def list_isos(
    db: AsyncSession,
    registry: Any,
    *,
    principal: Principal,
    cluster_id: int,
    team_id: int,
    node: str,
) -> list[dict]:
    """Return the content-filtered ISO list for a node (VM-08, Pitfall 16).

    Resolves the team's privsep connector and enumerates the ISO volumes
    present across the node's ``content=iso``-capable storages. Storages
    without ISO capability are excluded by ``connector.list_iso_content``.
    """
    await _require_team_membership(
        db, user_id=principal.user.id, team_id=team_id
    )
    try:
        connector = await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id, db=db
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team on this cluster",
        ) from exc
    return await connector.list_iso_content(node=node)


# ---------------------------------------------------------------------------
# ISO / cloud-image URL download (202 job)
# ---------------------------------------------------------------------------


async def enqueue_iso_download(
    db: AsyncSession,
    arq_pool: Any,
    *,
    principal: Principal,
    cluster_id: int,
    team_id: int,
    node: str,
    storage: str,
    url: str,
    content: str,
    filename: str,
    registry: Any,
    source_ip: str | None,
) -> Job:
    """Enqueue a ``storage.download`` job — returns the pending ``Job``.

    SSRF mitigation (T-04-05-01 / V12): the URL scheme is validated to be
    ``http`` / ``https`` only — any other scheme is rejected 422 BEFORE the
    job is enqueued. PVE's ``download-url`` endpoint then runs the fetch on
    the PVE node (Pitfall 7); the GUI never resolves the URL itself.

    D-17: ISO downloads are NOT admin-gated — any authenticated, team-scoped
    user may trigger one. The cross-tenant membership guard is the only
    access check (T-04-05-03 accepted threat).
    """
    actor_user_id = principal.user.id

    await _require_team_membership(
        db, user_id=actor_user_id, team_id=team_id
    )

    # SSRF mitigation — reject any non-http(s) URL scheme before enqueueing.
    parsed = urlparse(url)
    if parsed.scheme.lower() not in _ALLOWED_URL_SCHEMES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "The download URL must be an http(s) URL. "
                f"Scheme '{parsed.scheme}' is not allowed."
            ),
        )

    # Confirm the team has a privsep token on this cluster — a download lands
    # on the team's storage as the team token; a cross-cluster mismatch 403s.
    try:
        await registry.get_for_team(
            cluster_id=cluster_id, team_id=team_id, db=db
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to that team on this cluster",
        ) from exc

    payload = {
        "node": node,
        "storage": storage,
        "content": content,
        "url": url,
        "filename": filename,
    }
    job = await enqueue_job(
        db, arq_pool,
        kind="storage.download",
        cluster_id=cluster_id,
        team_id=team_id,
        actor_user_id=actor_user_id,
        payload=payload,
    )
    job_id = job.id

    await audit_write(
        db,
        actor_user_id=actor_user_id,
        team_id=team_id,
        cluster_id=cluster_id,
        action="storage.download",
        target_type="storage",
        target_id=storage,
        result="pending",
        source_ip=source_ip,
        payload_after={
            "job_id": job_id, "storage": storage, "content": content,
            "filename": filename, "url": url,
        },
    )
    await db.commit()
    return job
