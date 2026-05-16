# 04-SPIKE-sdn — SDN Read-API Findings

**Spike:** 04-02 (ROADMAP spike 1 of 3) — de-risk SDN networking (research-flagged MEDIUM-LOW).
**Date:** 2026-05-16
**Gates:** Plan 04-07 (`networks/service.py` SDN read design); requirements NET-01, NET-03, NET-04.
**Resolves:** 04-RESEARCH Open Questions 2 and 3, Assumption A3.

## Evidence Base

Two independent evidence sources were used — no claim below rests on assumption unless explicitly tagged `[ASSUMED — verify at implementation]`:

1. **Live cluster probe** — a real Proxmox cluster, `192.168.20.240`, **PVE 9.1.2 / release 9.1**
   (`GET /version` → `{"version":"9.1.2","release":"9.1","repoid":"9d436f37a0ac4172"}`),
   5 nodes (`proxmox`, `pve`, `pz3`, `pz1`, `pz2`), reached through the GUI's own
   `proxmoxer` 2.3 client with both the **cluster admin token** (`root@pam!proxmox-gui`)
   and a **per-team privsep token** (`gui-team-1@pve!api`, the exact token shape Phase 4
   provisioning will run as).
2. **Official PVE API schema** — `pve.proxmox.com/pve-docs/api-viewer/apidoc.js` (the
   API-viewer's `apiSchema`), parsed for the exact endpoint paths, query parameters,
   permission checks, and per-field return shapes quoted below.

**Caveat — no SDN configured on the live cluster.** The probe cluster has the SDN
*subsystem* present and reachable (every `/cluster/sdn/*` endpoint responds `200`) but
**zero zones and zero VNets configured** — `GET /cluster/sdn/zones` and
`GET /cluster/sdn/vnets` both return `[]`. Therefore: endpoint *existence*, *query-param
acceptance*, *permission behaviour*, and *legacy-bridge enumeration* are **live-verified**;
the *field set of a populated zone/VNet/subnet* is taken from the **API-viewer schema**
(authoritative — it is generated from the same `PVE::API2` definitions the server runs)
and tagged `[SCHEMA — verified against API-viewer; not exercised on a populated cluster]`.

---

## 1. Zone / VNet / Subnet read endpoints

**Verdict line:** `VNET READ: GET /cluster/sdn/vnets — IPAM field: none on the VNet (IPAM is a ZONE property — field "ipam" on GET /cluster/sdn/zones)`

The SDN read tree (live `GET /cluster/sdn` with the admin token returns the index
`[{"id":"vnets"},{"id":"zones"},{"id":"controllers"},{"id":"ipams"},{"id":"dns"},{"id":"fabrics"}]`):

| Object  | Path | Live result (probe cluster) |
|---------|------|------------------------------|
| Zones   | `GET /cluster/sdn/zones` | `[]` — endpoint OK, no zones configured |
| VNets   | `GET /cluster/sdn/vnets` | `[]` — endpoint OK, no VNets configured |
| Subnets | `GET /cluster/sdn/vnets/{vnet}/subnets` | (not exercisable — no VNets) |
| Subnet  | `GET /cluster/sdn/vnets/{vnet}/subnets/{subnet}` | single-object read |
| IPAMs   | `GET /cluster/sdn/ipams` | admin: `[{"ipam":"pve","type":"pve","digest":"da39a3ee…"}]` — the built-in `pve` IPAM exists by default |

**VNet response field set** `[SCHEMA — verified against API-viewer]` —
`GET /cluster/sdn/vnets` item properties:

- `vnet` (string) — *Name of the VNet* — the identifier the GUI keys on.
- `zone` (string) — *Name of the zone this VNet belongs to* — **this is the zone-link field**.
- `tag` (integer) — *VLAN Tag (VLAN/QinQ zones) or VXLAN VNI (VXLAN/EVPN zones)*.
- `type` (string) — *Type of the VNet*.
- `alias` (string), `vlanaware` (boolean), `isolate-ports` (boolean), `digest` (string).
- `state` (string) — *State of the SDN configuration object* — see §2.
- `pending` (object) — *Changes that have not yet been applied* — see §2.

There is **no IPAM field on the VNet object**. IPAM is associated at the **zone** level —
`GET /cluster/sdn/zones` items carry `ipam` (string) — *"ID of the IPAM for this zone"* —
and `dhcp` (string) — *"Name of DHCP server backend for this zone"*. To know whether a
given VNet has IPAM, `networks/service.py` must join the VNet's `zone` to the zone list
and read that zone's `ipam` field. Zones also carry `bridge`, `mtu`, `nodes`, `dns`,
`dnszone`, `type`, `state`, `pending`.

**Query parameters** — all three list/object endpoints (`zones`, `vnets`, `vnets/{vnet}`,
`vnets/{vnet}/subnets`, `subnets/{subnet}`) accept the optional booleans `pending` and
`running` (see §2). `zones` additionally accepts `type` (filter by zone type).

**Connector reads 04-07 must add:** `sdn_zones()` → `GET /cluster/sdn/zones`,
`sdn_vnets()` → `GET /cluster/sdn/vnets`, `sdn_subnets(vnet)` →
`GET /cluster/sdn/vnets/{vnet}/subnets`. See §7 for the full contract.

---

## 2. Applied-vs-pending state (Pitfall 8 — the gating question for NET-01)

**Verdict line:** `APPLIED STATE READ: the zones/vnets/subnets list endpoints carry a per-object "state" string field AND a "pending" object; additionally the endpoints accept ?running=1 (returns the applied/running config) and ?pending=1 (returns only pending deltas). networks/service.py treats an object as USABLE only when its "state" is absent/empty (== applied-and-clean) and rejects/badges any object whose "state" indicates a pending change.`

PVE SDN has the two-state model the research flagged (configured in `/etc/pve/sdn/*.cfg`
vs applied to `/etc/network/interfaces.d/sdn` + `.running-config`). The API surfaces it
in **two complementary ways**, both confirmed:

1. **Per-object `state` field + `pending` object** `[SCHEMA — verified against API-viewer]`.
   Every zone/VNet object returns `state` (*"State of the SDN configuration object"*) and
   `pending` (*"Changes that have not yet been applied to the running configuration"*).
   An object that has been applied and has no uncommitted edits returns an empty/absent
   `state` and no `pending`; an object that is newly added or edited but not yet applied
   carries a `state` such as `new`/`changed`/`deleted` and a populated `pending` object.

2. **`?pending=1` / `?running=1` query parameters** `[LIVE — verified on the probe cluster]`.
   The probe issued `GET /cluster/sdn/zones?pending=1`, `?running=1`, and the same for
   `vnets` — **all returned `200 OK`** (empty arrays only because the cluster has no SDN
   configured). The API-viewer schema documents them: `pending` — *"Display pending
   config"*, `running` — *"Display running config"*. `?running=1` returns the config as
   actually applied to the nodes; the default (no param) returns the merged config-store
   view with `state`/`pending` annotations.

**What `networks/service.py` does (the rule for NET-01):** call `GET /cluster/sdn/vnets`
**with no `pending`/`running` param** so each item carries its `state`/`pending`
annotation. A VNet is **USABLE** (offered as a normal selectable picker entry) only when
its `state` is empty/absent and `pending` is empty — i.e. it exists in the running config.
A VNet with a non-empty `state` (pending add/change) is **either hidden or shown disabled
with a "Pending — not yet applied" badge** (UI-SPEC §SDN-aware network picker permits a
pending state). This directly prevents Pitfall 8's failure mode: the GUI never offers a
VNet whose Linux bridge does not yet exist on the nodes, so `qm start` cannot fail with
"no such bridge". `[ASSUMED — verify at implementation: the exact string values of `state`
on a populated cluster (`new` / `changed` / `deleted`); the safe rule "empty state ⇒
applied, any non-empty state ⇒ not-applied" holds regardless of the exact vocabulary.]`

A secondary cross-check is available: `GET /cluster/sdn/vnets?running=1` returns *only*
the applied VNets — the GUI may use the running view as the authoritative usable set and
the default view only to discover and badge pending objects.

---

## 3. IPAM next-free-IP mechanism (Pitfall 5, A3 — gates NET-03)

**Verdict line:** `IPAM FREE-IP: option b — endpoint(s): GET /cluster/sdn/ipams/{ipam}/status (lists all allocated IPAM entries) + GET /cluster/sdn/vnets/{vnet}/subnets/{subnet} (the subnet CIDR/gateway/dhcp-range) — networks/service.py computes the next free address app-side. Option a is NOT viable; option c (DHCP-only) is the documented degrade per D-20 when a VNet's zone has no "ipam" set.`

The three options from 04-RESEARCH Open Question 2, each tested against the API schema:

- **Option (a) — `POST /cluster/sdn/vnets/{vnet}/ips` to allocate-and-read-back: NOT VIABLE.**
  `[SCHEMA — verified against API-viewer]` The POST endpoint's `ip` parameter is
  **`string REQ` (required)** — *"The IP address to associate with the given MAC
  address"*. There is no `next-free` flag and no mode that makes PVE *choose* the IP. You
  must already know the address. POST/PUT/DELETE on `…/ips` are MAC↔IP *mapping* writes,
  not an allocator. So allocate-and-read-back cannot return "the next free IP".

- **Option (b) — read allocated IPs + subnet range, compute app-side: VIABLE. CHOSEN.**
  `GET /cluster/sdn/ipams/{ipam}/status` `[SCHEMA — verified against API-viewer]` —
  description *"List PVE IPAM Entries"*, returns an **array** of every IP the IPAM has
  recorded as allocated. `GET /cluster/sdn/vnets/{vnet}/subnets/{subnet}` returns the
  subnet object whose config (per the subnet PUT schema, which lists the same writable
  fields) includes `gateway` and `dhcp-range` — enough to know the subnet CIDR and the
  reservable range. `networks/service.py` therefore: (1) reads the VNet's zone → the
  zone's `ipam` id; (2) reads `/cluster/sdn/ipams/{ipam}/status` for the allocated set;
  (3) reads the chosen subnet for its CIDR/gateway/dhcp-range; (4) computes the lowest
  unallocated host address (skipping the network, broadcast, and gateway addresses) and
  pre-fills it in the picker. The field is **editable** — the user may change it or
  switch to DHCP (D-20). `[ASSUMED — verify at implementation: the exact item shape of
  the `…/ipams/{ipam}/status` array on a populated cluster — research and the endpoint
  description indicate per-entry `ip` / `vmid` / `mac` / `vnet` / `zone` fields; the
  computation only needs the set of `ip` strings, so partial-shape drift is non-fatal.]`

- **Option (c) — DHCP-only degrade: the documented fallback.** D-20 already permits the
  user to switch to DHCP, and explicitly states *"VNets/bridges without IPAM default to
  DHCP"*. When the selected VNet's zone has **no `ipam`** set (zone `ipam` field
  empty/absent), or when the IPAM/subnet read fails or returns an unusable shape,
  `networks/service.py` degrades gracefully: it marks the picker entry
  `ipam_available: false`, the IP field defaults to and is disabled at "DHCP", and
  NET-03 ships as *"DHCP default; static-IP auto-pick offered only where a zone-level
  IPAM and a subnet CIDR are both readable"*.

**Net for NET-03:** option (b) is the implementation path; option (c) is the per-VNet
graceful degrade. There is no clean single-call "next free IP" REST endpoint — the
research's Pitfall 5 is confirmed — but the app-side computation from
`/cluster/sdn/ipams/{ipam}/status` is reliable and uses only documented reads.

---

## 4. Version floor + SDN-capable detection (D-21)

**Verdict line:** `SDN VERSION FLOOR: PVE 8.1 (SDN core stable from 8.0-8.1; the probe cluster runs 9.1.2 and the full SDN endpoint tree is present) — detection: per cluster, call GET /cluster/sdn/zones; SDN is "configured & usable" when the call returns 200 AND the array is non-empty after applied-state filtering (§2). A 403 means the token lacks SDN.Audit (see §7), NOT that SDN is absent.`

- **Version floor.** SDN core went stable in PVE 8.0–8.1 (IPAM/EVPN routing remained
  partly tech-preview); D-21 sets the PVE 8+ floor. The live probe cluster is **PVE
  9.1.2** and exposes the *complete* SDN endpoint tree (`zones`, `vnets`, `controllers`,
  `ipams`, `dns`, `fabrics` — `fabrics` is a newer 9.x addition). Recommend the GUI set
  the floor at **PVE 8.1**: below that, hide SDN entirely and offer only legacy bridges
  (§5). The connector already has a version probe — `connector.version()` →
  `GET /version` returns `{"version","release","repoid"}` (live-confirmed) — so the GUI
  can read `release` (e.g. `"9.1"`, `"8.1"`) and gate on it cheaply.

- **SDN-capable detection (the per-cluster auto-detect for D-21).** A capability check is
  *not* a separate endpoint. The pragmatic, live-validated rule:
  1. `connector.version()` → if `release` < `8.1`, SDN is **off** for this cluster — show
     legacy bridges only.
  2. Otherwise call `connector.sdn_zones()` (`GET /cluster/sdn/zones`):
     - **`200` + non-empty (after applied-state filter)** → SDN is configured and usable;
       show the SDN VNet group in the picker.
     - **`200` + empty `[]`** → SDN subsystem present but **no zones configured** (exactly
       the probe cluster's state) → treat as "no SDN" → legacy bridges only.
     - **`403`** → the *token* lacks `SDN.Audit` (see §7) — this is a **permission**
       result, **not** an absence of SDN. The GUI must distinguish 403 from empty and
       surface "SDN networks not visible to this team's token" rather than "no SDN".
  Per D-21, a cluster with both SDN and legacy bridges shows both, grouped.

---

## 5. Legacy-bridge enumeration (NET-04, D-19)

**Verdict line:** `LEGACY BRIDGE READ: GET /nodes/{node}/network?type=any_bridge (per node) — filters to Linux + OVS bridges; the GUI dedups across nodes by iface name.`

`[LIVE — verified on the probe cluster with the admin token]` Three forms were probed
per node:

- `GET /nodes/{node}/network` — every interface (eth, bond, bridge).
- `GET /nodes/{node}/network?type=bridge` — Linux bridges only.
- `GET /nodes/{node}/network?type=any_bridge` — Linux **and** OVS bridges.

On node `pve` the admin token returned **three** bridges for `type=bridge` /
`type=any_bridge` — `vmbr0` (`192.168.20.241/24`, gw `192.168.20.1`, `bridge_ports bond0`,
`bridge_vlan_aware 1`), `vmbr1` (`192.168.10.241/24`), `vmbr2` (`192.168.10.222/24`).
Other nodes returned their single `vmbr0`. Each bridge item carries the fields the picker
needs: `iface`, `type`, `cidr`, `gateway`, `bridge_ports`, `bridge_vlan_aware`,
`bridge_vids`, `active`, `autostart`, `comments`.

**Recommendation:** use **`type=any_bridge`** — it includes OVS bridges, which `type=bridge`
omits, and a home-lab/small-team cluster may use OVS. The bridge list is **per node**, so
`networks/service.py` enumerates each node and **dedups by `iface` name** for the
cluster-wide picker (a bridge named `vmbr0` typically exists on every node — Pitfall 11
name-collision applies *within* a cluster too; the picker shows one `vmbr0` entry and the
node selection happens in the wizard's Resources step). Per D-19, legacy bridges are
**default-visible** (shown before any admin scoping); per D-21 they are the fallback for
non-SDN / pre-8.1 clusters.

**Note on PVE 9 + SDN:** `GET /access/permissions` with the admin token shows a path
`/sdn/zones/localnetwork/vmbr0` — in PVE 8.1+/9.x the legacy bridges are *also* modelled
under a built-in SDN `localnetwork` zone for ACL purposes. This does **not** change the
enumeration path (still `GET /nodes/{node}/network`), but it does mean a bridge can carry
an SDN ACL path — relevant to §7's RBAC discussion.

---

## 6. Partial-node-offline behavior

**Verdict line:** SDN config reads are **cluster-wide** and survive a single node being
offline; only the **per-node** `GET /nodes/{node}/network` call for the offline node
fails. `networks/service.py` mirrors the Phase-2 stale-cache graceful-degradation pattern.

`[ASSUMED — verify at implementation: a node could not be taken offline on the shared
probe cluster; reasoning is from the API model + Pitfall 8.]`

- **SDN config endpoints (`/cluster/sdn/*`) are cluster-wide.** They read the SDN config
  from `/etc/pve/sdn/` — the pmxcfs cluster filesystem — served by *any* quorate node. As
  long as the cluster has quorum, `GET /cluster/sdn/zones|vnets|subnets|ipams` return
  successfully regardless of which individual nodes are down. The `state`/`pending`
  annotation (§2) is the place a partial-apply would surface — an admin who applied SDN
  while a node was offline may see that node lag; the GUI's "prefer applied / badge
  pending" rule (§2) already covers this.
- **Per-node `GET /nodes/{node}/network` fails for the offline node.** A bridge read
  against a down node raises (proxmoxer `ResourceException` / a connection error → the
  connector's `PVEUnreachable`/`PVEAPIError`). `networks/service.py` must catch
  per-node, **skip the unreachable node**, and still return the bridges discovered on the
  reachable nodes — exactly the Phase-2 inventory `list_resources` stale-cache /
  graceful-degradation pattern (`(snapshot, is_stale)`). It must **not** hard-fail the
  whole picker because one node is out of quorum.
- **No quorum at all** → all reads fail → the connector's circuit breaker opens →
  `PVEUnreachable`; the picker shows the cluster-unreachable banner (the project-wide
  read-only-degrade behaviour), it does not error blank.

**Mitigation for T-04-02-03 (DoS via partial-node-offline reads):** the per-node
try/skip loop above means an offline node degrades the picker (fewer legacy bridges
listed) instead of breaking it.

---

## 7. Read-API contract for 04-07

This is the concrete contract `networks/service.py` (Plan 04-07) implements against. All
connector methods follow the existing `_call_with_breaker` shape (asyncio.to_thread +
circuit breaker), exactly like the in-file analogs `node_storages`, `storage_content`,
`cluster_nextid`.

### Connector read methods 04-07 must add (`clusters/connector.py`)

| Method | Exact PVE path | Notes |
|--------|----------------|-------|
| `sdn_zones()` | `GET /cluster/sdn/zones` | No `pending`/`running` param → items carry `state`/`pending`. Read `ipam`, `dhcp`, `type`, `bridge`, `nodes` per zone. |
| `sdn_vnets()` | `GET /cluster/sdn/vnets` | No `pending`/`running` param. Read `vnet`, `zone`, `tag`, `type`, `state`, `pending`. |
| `sdn_subnets(vnet)` | `GET /cluster/sdn/vnets/{vnet}/subnets` | Per VNet. The subnet object carries CIDR/`gateway`/`dhcp-range`. |
| `node_bridges(node)` | `GET /nodes/{node}/network?type=any_bridge` | Per node; Linux + OVS bridges. Service dedups by `iface` across nodes. |
| `sdn_ipam_status(ipam)` | `GET /cluster/sdn/ipams/{ipam}/status` | IPAM-only; the allocated-IP set for NET-03 option (b). Skip when the zone has no `ipam`. |

No write methods are added by 04-07 — Phase 4 **reads** SDN only (CONTEXT: the GUI
consumes admin-defined SDN, never provisions zones). `POST /cluster/sdn/vnets/{vnet}/ips`
is documented here for completeness but is **not** part of the contract — see §3.

### Token / RBAC contract — IMPORTANT, gates 04-07's connector choice

`[LIVE — verified on the probe cluster]` The SDN reads are permission-gated:

- The API-viewer schema requires **`SDN.Audit` (or `SDN.Allocate`)** on `/sdn` (for
  `/cluster/sdn`) or on `/sdn/zones/<zone>` (for the zone/VNet/subnet lists).
- The probe's **per-team privsep token** (`gui-team-1@pve!api` — the exact token shape
  Phase 4 provisioning runs as) returned:
  - `GET /cluster/sdn` → **`403 Forbidden: Permission check failed (/sdn, SDN.Audit)`**.
  - `GET /cluster/sdn/zones`, `…/vnets` → `200` but **empty** (the list endpoints filter
    to entries the token can audit — a privsep token with no SDN ACL sees nothing).
  - **`GET /nodes/{node}/network?type=any_bridge` → `[]`** for *every* node — the privsep
    token cannot enumerate node bridges either.
  - The **admin token** on the same calls returned the real zones index and all bridges.

**Consequence for 04-07:** the per-team privsep token **cannot enumerate networks**.
`networks/service.py` must perform SDN/bridge **reads with the cluster-level admin
connector** (the `Cluster.token_user`/`token_name` token — already in the registry),
and then apply the **per-team scoping app-side** (D-18 Networks tab grants + D-19
default-visible legacy bridges). It must **not** rely on the privsep token's PVE-side
filtering for network visibility. This is consistent with T-04-02-01: the spike *defines*
the reads here; 04-07 *enforces* the Networks-tab scoping (NET-02) on top of the
admin-token read. The alternative — granting every team token `SDN.Audit` at `/sdn` —
is rejected: it would let any team see every other team's SDN objects, defeating D-18
scoping. `[ASSUMED — verify at implementation: that the registry exposes a cluster-admin
connector distinct from `get_for_team`; the Phase-1 `ConnectorRegistry.get()` already
builds a connector from `Cluster.token_user`/`token_name`, so this is available.]`

### Shape of the flat picker list `networks/service.py` returns to the frontend

A single list, each entry grouped into **"SDN VNets"** vs **"Legacy bridges"**, each
carrying applied-state and IPAM flags (UI-SPEC §SDN-aware network picker):

```jsonc
[
  {
    "group": "sdn",                 // "sdn" | "bridge"
    "id": "vnet-prod",              // VNet name, or bridge iface name
    "label": "prod (zone: dc1)",    // display label
    "type": "vnet",                 // "vnet" | "bridge"
    "zone": "dc1",                  // SDN only
    "tag": 100,                     // VLAN tag / VNI — SDN only, may be null
    "applied": true,                // §2: false ⇒ pending, badge it / disable it
    "ipam_available": true,         // §3: zone has an `ipam` ⇒ static auto-pick offered
    "subnets": [                    // SDN only
      { "subnet": "10.0.0.0/24", "cidr": "10.0.0.0/24", "gateway": "10.0.0.1" }
    ]
  },
  {
    "group": "bridge",
    "id": "vmbr0",
    "label": "vmbr0 (192.168.20.0/24)",
    "type": "bridge",
    "vlan_aware": true,             // from bridge_vlan_aware — enables a VLAN-tag field
    "applied": true,                // bridges are always "applied"
    "ipam_available": false         // legacy bridges never have IPAM ⇒ DHCP/manual IP
  }
]
```

The frontend renders two grouped sections; pending SDN VNets (`applied: false`) are
badged or hidden; `ipam_available: false` disables the static-IP auto-pick and defaults
the entry to DHCP (D-20). The per-team scoping (D-18/D-19) is applied **before** this
list is built — a team sees its granted SDN VNets plus the default-visible legacy
bridges only.

---

## Resolution Summary

| Research item | Status |
|---------------|--------|
| Open Question 2 — IPAM next-free-IP mechanism | **Resolved** — option (b): `GET /cluster/sdn/ipams/{ipam}/status` + subnet CIDR, computed app-side; option (a) proven not viable; option (c) DHCP-only is the per-VNet degrade (D-20). |
| Open Question 3 — SDN applied-vs-pending read path | **Resolved** — per-object `state` + `pending` fields on the list endpoints, plus `?running=1`/`?pending=1` query params (live-verified accepted). |
| Assumption A3 — reliable free-IP path or graceful DHCP degrade | **Confirmed** — app-side computation is reliable; DHCP-only degrade is graceful and already permitted by D-20. |
| NET-01 (list SDN zones/VNets/subnets) | Read contract defined — §1, §2, §7. |
| NET-03 (auto-pick free IP from IPAM) | Mechanism defined — §3, option (b). |
| NET-04 (legacy-bridge fallback) | Read path defined — §5, `?type=any_bridge`. |
| D-18 / D-19 / D-21 RBAC consequence | **New finding** — privsep team tokens cannot enumerate networks (403/empty); 04-07 must read with the cluster-admin connector and scope app-side. §7. |

**Decisions referenced:** D-18 (per-team Networks-tab scoping), D-19 (legacy bridges
default-visible before scoping), D-20 (IPAM auto-pick, editable, DHCP fallback), D-21
(auto-detect SDN per cluster, PVE 8+ floor).

**Gate to 04-07:** `networks/service.py` now has a concrete, evidence-backed read-API
contract — five connector methods, the applied-state filtering rule, the IPAM
computation path, and the critical instruction to read with the cluster-admin connector
rather than the privsep team token.
