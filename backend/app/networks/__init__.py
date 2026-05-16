"""Networks subsystem — SDN-aware network picker + per-team network scoping.

Phase 4 Plan 04-07. The read-API contract is pinned by spike 04-02
(``04-SPIKE-sdn.md``): SDN zone/VNet/subnet reads run against the
cluster-admin connector (a per-team privsep token cannot enumerate SDN —
``GET /cluster/sdn`` returns ``403 SDN.Audit`` and ``GET /nodes/{node}/network``
returns ``[]`` for that token), and per-team visibility scoping is applied
APP-SIDE on top of the admin-token read.
"""
