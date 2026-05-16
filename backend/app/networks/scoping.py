"""Per-team SDN/bridge network-scoping CRUD — NET-02 (Phase 4, Plan 04-07).

An EXACT analog of ``app.quotas.service``'s per-team scoping CRUD: a new
per-team table (:class:`app.models.network_scope.NetworkScope`), admin-only
writes. An admin grants a team access to one SDN VNet (or a legacy bridge)
by inserting a ``network_scope`` row; the SDN-aware picker
(``networks/service.py``) then filters the cluster's SDN VNets down to the
team's grants (D-19 — un-granted VNets are hidden, legacy bridges stay
default-visible).

One row per (team, cluster, network_kind, network_id) — enforced by the
``uq_network_scope_team_cluster_network`` composite UNIQUE index. The upsert
here is idempotent against that index: it diffs the desired grant set against
the rows already present, INSERTing only the new pairs and DELETEing only the
revoked ones, so re-writing an identical grant set never raises an
IntegrityError.

``network_kind`` is ``"sdn-vnet"`` for an SDN VNet and ``"bridge"`` for a
legacy Linux/OVS bridge — the two values the :class:`NetworkScope` model
documents.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NetworkScope

# The two ``network_kind`` discriminator values (see the NetworkScope model).
_KIND_SDN_VNET = "sdn-vnet"
_KIND_BRIDGE = "bridge"


async def get_team_network_scope(
    db: AsyncSession, *, team_id: int, cluster_id: int,
) -> dict[str, list[str]]:
    """Return the team's current network grants for ``cluster_id``.

    The result is grouped by ``network_kind``::

        {"sdn_vnets": [<vnet name>...], "bridges": [<bridge name>...]}

    An un-scoped team returns ``{"sdn_vnets": [], "bridges": []}`` — D-19:
    that is NOT an error and does NOT hide legacy bridges; the picker
    (Task 2) still surfaces every legacy bridge by default. It only means no
    SDN VNet has been granted yet.
    """
    rows = (await db.execute(
        select(NetworkScope).where(
            NetworkScope.team_id == team_id,
            NetworkScope.cluster_id == cluster_id,
        )
    )).scalars().all()
    sdn_vnets = sorted(
        r.network_id for r in rows if r.network_kind == _KIND_SDN_VNET
    )
    bridges = sorted(
        r.network_id for r in rows if r.network_kind == _KIND_BRIDGE
    )
    return {"sdn_vnets": sdn_vnets, "bridges": bridges}


async def set_team_network_scope(
    db: AsyncSession,
    *,
    team_id: int,
    cluster_id: int,
    sdn_vnets: list[str],
    bridges: list[str],
) -> None:
    """Upsert the team's network grants for ``cluster_id``.

    The desired grant set is ``sdn_vnets`` (kind ``"sdn-vnet"``) +
    ``bridges`` (kind ``"bridge"``). This:

    - INSERTs any (kind, network_id) pair in the desired set that is not
      already a row, and
    - DELETEs any existing ``network_scope`` row for (team_id, cluster_id)
      whose (kind, network_id) is no longer in the desired set.

    The diff makes the write idempotent against the composite UNIQUE index —
    re-writing an identical grant set is a no-op and never raises an
    IntegrityError. Writes are keyed by ``cluster_id`` so a grant on one
    cluster never leaks into another (T-04-07-03).

    The caller owns nothing past this — the function commits.
    """
    desired: set[tuple[str, str]] = {
        (_KIND_SDN_VNET, v) for v in dict.fromkeys(sdn_vnets)
    } | {
        (_KIND_BRIDGE, b) for b in dict.fromkeys(bridges)
    }

    existing_rows = (await db.execute(
        select(NetworkScope).where(
            NetworkScope.team_id == team_id,
            NetworkScope.cluster_id == cluster_id,
        )
    )).scalars().all()
    existing: dict[tuple[str, str], NetworkScope] = {
        (r.network_kind, r.network_id): r for r in existing_rows
    }

    # Delete the revoked grants.
    for key, row in existing.items():
        if key not in desired:
            await db.delete(row)

    # Insert the newly-granted pairs (skip any already present — idempotent).
    for kind, network_id in desired:
        if (kind, network_id) not in existing:
            db.add(NetworkScope(
                team_id=team_id,
                cluster_id=cluster_id,
                network_kind=kind,
                network_id=network_id,
            ))

    await db.commit()
