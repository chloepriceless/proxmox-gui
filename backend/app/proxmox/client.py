"""Proxmox thin-client placeholder.

Phase 1 establishes the module shape; Plan 06 (clusters-tenant-bootstrap) and
Phase 3 (job-queue + lifecycle) implement the real connector against this
namespace. We ship a placeholder class so dependents can import without
crashing — they should not *instantiate* it yet.
"""

from __future__ import annotations


class PVEThinClient:
    """Placeholder for the per-cluster Proxmox API client.

    Plan 06 implements the real :class:`PVEConnector` against this shape:
    ``asyncio.to_thread``-wrapped ``proxmoxer.ProxmoxAPI`` calls with circuit
    breaker + health probe. Pitfall A3 (proxmoxer 2.3 has no async backend)
    means every call MUST go through :func:`asyncio.to_thread`.
    """

    def __init__(self, *args: object, **kwargs: object) -> None:
        raise NotImplementedError(
            "PVEThinClient is a Phase 1 placeholder. Plan 06 implements PVEConnector."
        )
