# Spike 2 — Embedded noVNC Console

**Phase:** 04-provisioning-networking-console
**Plan:** 04-03
**Spike type:** ROADMAP-mandated implementation-gating spike (spike 2 of 3)
**Date:** 2026-05-16
**Gates:** CON-01, CON-02, CON-03 — the embedded console (Console tab) implemented by **plan 04-08** (console backend proxy) and **plan 04-13** (console frontend tab).
**Resolves:** Research Assumptions **A4** (Caddy WS upgrade) and **A8** (vncticket lifetime); Open Question **4** (console WebSocket through Caddy).

---

## Summary / verdict block

| Verdict | Value |
|---------|-------|
| `VNCPROXY MINT` | `POST /nodes/{node}/qemu/{vmid}/vncproxy` (and `.../lxc/{vmid}/vncproxy`) — response fields: `ticket`, `port`, `user`, `cert`, `upid` (`password` optional, deprecated) |
| `ENCODING` | vncticket encoded **exactly once** at the relay endpoint, in `console/proxy.py`, when the upstream `vncwebsocket` URL is built (`urllib.parse.quote(ticket, safe="")`) — the ticket is raw JSON on every other hop |
| `RELAY` | upstream WS via the `websockets` library — **new dependency: no** (`websockets==16.0` already installed in the venv via `uvicorn[standard]`; promote it to an explicit `pyproject.toml` entry) |
| `CADDY` | **handle block required** — a dedicated `handle /api/v1/ws/console*` block with `reverse_proxy 127.0.0.1:8000 { flush_interval -1 }` to disable response buffering for the latency-sensitive VNC stream (plus the existing `X-Real-IP`/`Host` headers) |
| `SELF-SIGNED CERT` | the relay's upstream WS leg reuses the per-cluster `verify_ssl` posture already stored on the `clusters` row (the connector's existing TLS setting); fingerprint pinning is the Phase-1-carryover intended hardening path |
| `TICKET LIFETIME` | `~30-40s` — **measured live**: valid at t+30s, expired (HTTP 401) by t+45s on PVE 9.1.2 — mint on click only (CON-02) |

**Live evidence base:** all claims below are backed by either (a) a probe run against the real managed cluster (PVE **9.1.2**, host `192.168.20.240`, node `pz1`, 44 guests) using the decrypted cluster admin token, (b) the Proxmox API viewer (`pve.proxmox.com/pve-docs/api-viewer/apidoc.js`), or (c) the two forum threads cited in `04-RESEARCH.md` Sources. No claim in this document is marked `[ASSUMED]` — the live cluster was reachable for every gating measurement.

---

## 1. `vncproxy` mint shape

**Verdict line:** `VNCPROXY MINT: POST /nodes/{node}/qemu/{vmid}/vncproxy (lxc: /nodes/{node}/lxc/{vmid}/vncproxy) — response fields: ticket, port, user, cert, upid (password optional/deprecated)`

The console ticket is minted with a single `POST`:

- **QEMU:** `POST /nodes/{node}/qemu/{vmid}/vncproxy`
- **LXC:** `POST /nodes/{node}/lxc/{vmid}/vncproxy`

Both are `protected: 1` and require permission **`VM.Console`** on `/vms/{vmid}` `[API viewer — "permissions.check": ["perm","/vms/{vmid}",["VM.Console"]]]`. The per-tenant privsep token must therefore carry `VM.Console` — the project already grants `PVEVMAdmin` to tenant tokens (STATE.md decision "grant PVEVMAdmin not PVEVMUser"), and `PVEVMAdmin` includes `VM.Console`, so no ACL change is needed.

**Request parameter — `websocket`:** an optional boolean. The GUI passes `websocket=1`.
- QEMU API-viewer text: *"Prepare for websocket upgrade (only required when using serial terminal, otherwise upgrade is always possible)."*
- LXC API-viewer text: *"use websocket instead of standard VNC."*
The probe minted both qemu and lxc tickets with `websocket=1` successfully; passing it unconditionally is correct and harmless. The deprecated `generate-password` param is **not** sent (API viewer: *"Deprecated, do not use. Password is generated when required."*).

**Response fields (live probe, both qemu vmid=101 and lxc vmid=100 on PVE 9.1.2):**

```
response keys: ['cert', 'port', 'ticket', 'upid', 'user']
  user   = 'root@pam!proxmox-gui'
  port   = '5900'
  ticket = 'PVEVNC:6A08C225::x3ILfuHYzdq+4UaxPrN6hi2qHclJ+crariwyqQ5W7Q8...(361 chars)'
  upid   = 'UPID:proxmox:000B6456:07DD6FE5:6A08C225:vncproxy:100:root@pam!proxmox-gui:'
  cert   = '-----BEGIN CERTIFICATE-----\nMIIFzTCC...(2074 chars)'
```

The API viewer declares `returns.properties`: `cert` (string), `port` (integer), `ticket` (string), `upid` (string), `user` (string), `password` (string, optional). The live response did **not** include `password` (consistent with "generated when required" — pure-VNC websocket upgrade does not need it).

**Fields the GUI needs to build the `vncwebsocket` URL:** only **`ticket`** and **`port`**. `user`, `cert`, and `upid` are informational — the relay does not need them (the relay authenticates to PVE with the API **token**, not with `user`/`cert`; see §5). `port` is returned as a string (`'5900'`) and falls in the `5900-5999` range the `vncwebsocket` `port` param requires.

---

## 2. The `vncwebsocket` URL + single-encoding rule (Pitfall 2 — the load-bearing gotcha)

**Verdict line:** `ENCODING: vncticket encoded exactly once at the relay endpoint (console/proxy.py), when the upstream vncwebsocket URL is built`

**`vncwebsocket` endpoint shape** (API viewer — confirmed **GET**, the WebSocket upgrade rides on a GET request):

- QEMU: `GET /nodes/{node}/qemu/{vmid}/vncwebsocket?port={port}&vncticket={ticket}`
- LXC: `GET /nodes/{node}/lxc/{vmid}/vncwebsocket?port={port}&vncticket={ticket}`

API-viewer parameter contract: `port` is `<integer> (5900-5999)`, `vncticket` is `<string>` with **`maxLength: 512`** and description *"Ticket from previous call to vncproxy."* Permission: `VM.Console` on `/vms/{vmid}` **plus** *"You also need to pass a valid ticket (vncticket)"*. Returns `{port: string}`.

The full upstream URL the relay opens (the only leg that holds the ticket):

```
wss://{pve-host}:8006/api2/json/nodes/{node}/{qemu|lxc}/{vmid}/vncwebsocket?port={port}&vncticket={enc-ticket}
```

Note the `/api2/json` path prefix — confirmed by forum thread 1, which shows a working noVNC config with `path: api2/json/nodes/syd-pvetest/qemu/103/vncwebsocket?port=5900&vncticket=...`. proxmoxer's `_store["base_url"]` already carries `https://{host}:{port}/api2/json`.

**The single-encoding rule (Pitfall 2):** the raw `ticket` value contains characters that MUST be percent-encoded for a query string. The live probe confirmed exactly which:

```
ticket special chars needing percent-encoding: ['+', '/', ':', '=']
```

(`PVEVNC:6A08C225::x3ILfuHYzdq+4Uax...` — colon delimiters, base64 body with `+` `/` `=`.)

**Evidence the encoding happens exactly once** — forum thread 1 (`novnc-over-api...129091`) shows a *working* noVNC websocket URL:

```
vncticket=PVEVNC%3A648F1097%3A%3ALF3XL%2FdXR%2FDhfXJMCPSduSCYkKEQn6m4l...%2B...%3D%3D
```

`%3A` = `:`, `%2F` = `/`, `%2B` = `+`, `%3D` = `=` — a **single** layer of encoding. Double-encoding would produce `%253A` and PVE rejects it as an invalid ticket with `401` and no useful error (Pitfall 2; PITFALLS.md §Pitfall 3 — *"the #1 cause of 'invalid PVEVNC ticket'"*).

**Where the single encoding happens in the GUI's relay chain:**

```
PVE vncproxy POST  ──►  console/routes.py        ──►  browser (iframe / noVNC client)
   returns RAW ticket    returns RAW ticket            never sees the Proxmox ticket
   (JSON string)         as JSON {ticket, port}        — it gets the GUI relay URL only
                                                              │
   console/proxy.py  ◄───────────────────────────────────────┘
   builds upstream URL: urllib.parse.quote(ticket, safe="")  ←── THE ONE encode hop
   opens wss://pve-host:8006/.../vncwebsocket?port=..&vncticket=<enc>
```

- The mint route (`console/routes.py`) returns the **raw** ticket as a JSON string — JSON serialization is not URL-encoding, so this hop does not encode.
- The browser/iframe never receives the Proxmox ticket at all (CON-03 — see §3); it only gets the GUI's own relay URL. So the browser cannot double-encode it.
- `console/proxy.py` performs the **single** `urllib.parse.quote(ticket, safe="")` when it assembles the upstream `vncwebsocket` URL. `safe=""` ensures `/` is also encoded (Python's `quote` leaves `/` alone by default — that would be a silent bug).
- Caddy proxies `wss://browser → GUI relay` (a GUI-origin path with **no** Proxmox ticket in it), so Caddy never touches or re-encodes the `vncticket`. The ticket only exists on the relay→PVE leg, which Caddy is not on.

**Conclusion:** there is exactly one encode hop and it is inside `console/proxy.py`. No other hop encodes. CON-02's "URL-encode exactly once" rule is satisfied by construction because the ticket only ever becomes a URL query parameter in that one place.

---

## 3. The reverse-proxied WebSocket relay design (CON-03 — no in-repo analog)

**Verdict line:** `RELAY: upstream WS via the websockets library — new dependency: no (websockets==16.0 already in the venv via uvicorn[standard]; promote to an explicit pyproject.toml dependency)`

CON-03 forbids handing the browser a `wss://pve-host:8006/...` URL. Instead the GUI runs its own FastAPI WebSocket endpoint on the GUI's origin; the browser iframe's noVNC client connects to *that*, and the GUI relays bytes to/from Proxmox.

### Upstream WebSocket library

The backend already depends on `httpx==0.28.1`, but **`httpx` does not do WebSocket** — the live probe confirmed `hasattr(httpx.Client, "connect_ws") == False` (WS-over-httpx is the separate `httpx-ws` package, which is **not** installed).

The relay's upstream leg (GUI → `wss://pve-host:8006`) uses the **`websockets`** library. The live probe confirmed **`websockets==16.0` is already installed** in the production venv — it ships as part of `uvicorn[standard]` (already a direct dependency: `uvicorn[standard]==0.46.0`). uvicorn uses it for serving WS; the relay reuses the same installed package as a client.

**No new package is installed.** The one change 04-08 should make: add an explicit `websockets` line to `backend/pyproject.toml` so the relay's `import websockets` is a contractual dependency, not an accident of uvicorn's extras resolution. This is a pin, not an install — it matches the Phase-4 research statement "Phase 4 introduces no new backend libraries."

> Rejected alternatives: `aiohttp` (a second HTTP stack alongside httpx — unnecessary weight); `httpx-ws` (a genuine *new* package when `websockets` is already present).

### Relay endpoint design

`console/proxy.py` — a FastAPI `@router.websocket(...)` endpoint mounted under `/api/v1/ws/console/...`, structurally a sibling of `jobs/ws.py`:

```
@router.websocket("/ws/console/clusters/{cluster_id}/{kind}/{vmid}")
async def console_ws(websocket, cluster_id, kind, vmid, db=Depends(get_db)):
    # 1. AUTH BEFORE accept() — reuse jobs/ws.py _resolve_ws_user verbatim:
    #    decode the access_token cookie -> User; cookie-only, NO PAT.
    #    on failure: await websocket.close(code=1008); return  (T-04-03-02)
    # 2. OWNERSHIP CHECK — resolve the resource for the caller's team
    #    (Phase-2 resolve_resource pattern); cross-tenant -> close(1008). (T-04-03-03)
    # 3. MINT a fresh vncproxy ticket here (server-side, just-in-time) OR
    #    accept a one-shot mint-token from console/routes.py — see note below.
    # 4. await websocket.accept()
    # 5. open the upstream WS:
    #      async with websockets.connect(upstream_url, ssl=ssl_ctx) as up:
    #          await asyncio.gather(pump(browser->up), pump(up->browser))
```

**The bidirectional relay loop** — two concurrent tasks, cancelled together when either side closes:

```
async def _pump(src, dst, is_binary):
    try:
        while True:
            msg = await src.receive()         # bytes or text
            await dst.send(msg)
    except (WebSocketDisconnect, ConnectionClosed):
        pass
# run both directions; first to finish cancels the other:
done, pending = await asyncio.wait(
    {asyncio.create_task(_pump(browser, upstream, ...)),
     asyncio.create_task(_pump(upstream, browser, ...))},
    return_when=asyncio.FIRST_COMPLETED)
for t in pending: t.cancel()
```

noVNC's RFB protocol is **binary** over the WebSocket; the relay must forward binary frames as binary (`websocket.receive_bytes()` / `.send_bytes()` on the FastAPI side, binary frames on the `websockets` side). It must not coerce to text.

**Mint timing note (CON-02):** there are two viable shapes; 04-08 picks one:
- **(a)** the relay endpoint mints the ticket itself, immediately before opening the upstream WS — the ticket is freshest possible (only the relay→PVE round-trip of latency).
- **(b)** `console/routes.py` mints and returns a short-lived one-shot reference the relay redeems.
Shape **(a)** is recommended — it minimises the gap between mint and use, which directly fights the ~30-40s expiry (§6), and keeps the ticket entirely server-side. `console/routes.py`'s mint endpoint still exists for the frontend's "Open console" click to (i) do the ownership check early and return a friendly 403, and (ii) hand the frontend the GUI relay URL to point the iframe at.

**Failure surfacing — closed upstream / expired ticket:** when PVE closes the upstream WS (ticket expired mid-session, guest stopped, network drop), the `websockets` client raises `ConnectionClosed`; the `_pump` task ends, the sibling task is cancelled, and the relay closes the **browser** WS with a non-1000 close code. The frontend (04-13) treats any non-clean console close as "session ended" and shows the `bg-warning/10` strip with the **Reconnect** button (UI-SPEC §"noVNC Console tab" — *"if the session drops, a bg-warning/10 strip appears with the Reconnect button"*). A mint-time failure (e.g. `vncproxy` POST returns 401/500) surfaces as the UI-SPEC string *"Couldn't start a console session. Try again."* If the upstream `vncproxy`/`vncwebsocket` is rejected because the ticket already expired, the relay simply closes — Reconnect re-mints (§6).

---

## 4. Caddy WebSocket headers + buffering (Pitfall 3, A4, Open Question 4)

**Verdict line:** `CADDY: handle block required — a dedicated handle for the console WS path with reverse_proxy { flush_interval -1 } to disable response buffering`

The current `deploy/caddy/Caddyfile.template` has two `handle` blocks: `/api/*` → FastAPI `127.0.0.1:8000`, and `/*` → SvelteKit `127.0.0.1:3000`. The Phase-3 jobs WebSocket `/api/v1/ws/jobs` already works through the existing `/api/*` block — Caddy's `reverse_proxy` auto-performs the HTTP-upgrade handshake and transitions to a bidirectional tunnel (Caddy docs: *"The proxy also supports WebSocket connections, performing the HTTP upgrade request then transitioning the connection to a bidirectional tunnel."*). So **basic WS upgrade needs no change** — A4 is confirmed: the upgrade itself is fine.

**Why a dedicated block is still needed:** the noVNC stream is latency-sensitive (interactive framebuffer + keyboard/mouse). Caddy's `reverse_proxy` buffers responses by default for "wire efficiency"; for an interactive VNC tunnel that buffering adds jitter / stalls (Pitfall 3 — *"Console connects then freezes; partial framebuffer; works on localhost but not through Caddy"*). The forum's nginx reverse-proxy thread (`...130476`) confirms the equivalent need on nginx: `proxy_buffering off` plus long `proxy_read_timeout`/`proxy_send_timeout` (3600s). Caddy's equivalent of `proxy_buffering off` is **`flush_interval -1`** (a directive in `reverse_proxy`'s streaming group, alongside `stream_timeout`).

**The directive block 04-08 must add** to `Caddyfile.template`, **placed before the generic `handle /api/*` block** (Caddy matches `handle` blocks in order; the more specific path must come first):

```caddy
	# noVNC console WebSocket — latency-sensitive interactive stream.
	# flush_interval -1 disables Caddy response buffering (the nginx
	# `proxy_buffering off` equivalent) so the VNC framebuffer does not
	# stall behind the proxy buffer. Pitfall 3 / Open Question 4.
	handle /api/v1/ws/console* {
		reverse_proxy 127.0.0.1:8000 {
			header_up Host {host}
			header_up X-Real-IP {remote_host}
			flush_interval -1
		}
	}
```

Notes for 04-08:
- The console WS path (`/api/v1/ws/console*`) is a design choice this spike pins; 04-08's `console/proxy.py` route must mount there so the `handle` glob matches.
- `flush_interval -1` is the only behavioural delta vs. the existing `/api/*` block; the `Host`/`X-Real-IP` headers are copied verbatim from the existing block.
- Caddy does **not** need explicit `Upgrade`/`Connection` `header_up` directives — it auto-handles the upgrade. (That nginx requirement does not translate to Caddy.)
- No `stream_timeout` is set → the tunnel lives as long as the browser keeps it; the ~30-40s ticket bounds only the *initial* upstream handshake, not the established session (once `vncwebsocket` accepts, the VNC session persists).
- `X-Frame-Options: SAMEORIGIN` already in the Caddyfile is compatible — the noVNC iframe is same-origin (UI-SPEC).

---

## 5. Self-signed-cert handling

**Verdict line:** `SELF-SIGNED CERT: the relay's upstream WS leg reuses the per-cluster verify_ssl posture stored on the clusters row; fingerprint pinning is the intended hardening path`

PVE hosts ship a self-signed certificate by default — confirmed by the live probe: the managed cluster `192.168.20.240:8006` is registered with **`verify_ssl=False`**, and the `vncproxy` response even returns the host's `cert` PEM (2074 chars) precisely so a client *could* pin it.

The codebase already carries a per-cluster TLS posture: `connector.py` builds `ProxmoxAPI(..., verify_ssl=verify_ssl)` from the `clusters.verify_ssl` column, and there is a `clusters.tls_fingerprint` column with a Phase-1 guard (`connector.py` ~line 91: *"if tls_fingerprint and not verify_ssl: ..."*).

**The console relay's upstream WS leg (`websockets.connect(upstream_url, ssl=...)`) reuses that same per-cluster setting** — it must not invent its own TLS policy:

- `clusters.verify_ssl == True` → pass a normal verifying `ssl.SSLContext` (or `ssl=True`).
- `clusters.verify_ssl == False` → pass an `ssl.SSLContext` with `check_hostname=False` and `verify_mode=CERT_NONE` (the `websockets` equivalent of proxmoxer's `verify_ssl=False`). This is the realistic default for home-lab PVE (Pitfall A9 / the LAN-default install posture).

**Fingerprint pinning** is the intended hardening path (the Phase-1 carryover): when `clusters.tls_fingerprint` is set, the relay should verify the upstream cert's SHA-256 fingerprint against it rather than trusting the chain — exactly the posture the `connector.py` guard anticipates and exactly what the `cert` field in the `vncproxy` response enables. 04-08 should keep the relay's TLS decision in **one helper** that reads `(verify_ssl, tls_fingerprint)` off the cluster row, so the connector and the console relay share a single TLS-posture source of truth. Full fingerprint-pinning enforcement can be a tracked follow-up if 04-08 scopes it out, but the `verify_ssl` reuse is mandatory in 04-08.

**Security note (T-04-03-01):** because the relay holds the upstream TLS leg, the browser never connects to `:8006` and never sees the self-signed cert — so the operator does not have to click through a second cert warning for the console, and the Proxmox host identity is never exposed to the browser.

---

## 6. Ticket lifetime (A8) + reconnect

**Verdict line:** `TICKET LIFETIME: ~30-40s — mint on click only`

**Measured live** against PVE 9.1.2 — the probe minted a `vncproxy` ticket and then probed the `vncwebsocket` endpoint with that ticket at intervals:

```
  t+ 0s vncwebsocket GET -> HTTP 200      (ticket valid)
  t+15s vncwebsocket GET -> HTTP 200      (ticket valid)
  t+30s vncwebsocket GET -> HTTP 200      (ticket valid)
  t+45s vncwebsocket GET -> HTTP 401      (ticket EXPIRED)
  t+60s vncwebsocket GET -> HTTP 401      (ticket EXPIRED)
```

Identical result for both the lxc (vmid 100) and qemu (vmid 101) tickets. **The vncticket is valid for somewhere in (30s, 45s] and expired by t+45s** — this confirms the research's "~10-40s" range and Pitfall 3's "~30-40s" citation with a hard live measurement. Resolves **Assumption A8**.

**Mint-on-click rule (CON-02, Pitfall 3 / Anti-Pattern):** because the ticket dies in ~30-40s, it MUST be minted **only when the user clicks "Open console"** — never on page load or tab render. With a 40s budget, a ticket minted on page load is dead before a typical user reads the page and clicks. UI-SPEC §"noVNC Console tab" pins this: *"The iframe is NOT rendered on page load... the vncticket is minted server-side only when the user clicks 'Open console'."* The relay should also mint as late as possible — shape (a) in §3, minting inside the relay endpoint right before `websockets.connect`, leaves only the relay→PVE round-trip between mint and use.

**Reconnect flow (CON-02):** the Console tab carries a **Reconnect** button (`RefreshCw` icon, UI-SPEC). Reconnect:
1. Re-calls the `console/routes.py` mint endpoint (a fresh ownership check + a fresh `vncproxy` ticket).
2. Tears down the old iframe / WS and rebuilds the `<iframe>` `src` (or reopens the relay WS), pointing at a fresh GUI relay URL.

The frontend (04-13) detects a dropped console (non-clean WS close — see §3) and shows the `bg-warning/10` "Console session ended." strip with the Reconnect button; a mint failure shows "Couldn't start a console session. Try again." Mint-on-click + an always-available Reconnect button means **any** ticket lifetime is safe — even if a future PVE shortens it, the UX degrades to "click Reconnect", never to a hard failure. The vncticket is **never cached, never persisted, never logged** (PITFALLS.md §Pitfall 3 point 4; T-04-03-04 — a leaked ticket self-expires in ~40s).

---

## 7. Backend contract for plan 04-08

This is the concrete contract 04-08 (console backend proxy) and 04-13 (console frontend tab) implement against.

### `connector.vncproxy(node, vmid, *, is_lxc)` — new connector method

A `_call_with_breaker` POST, following the Pattern-1 `fn = (...lxc... if is_lxc else ...qemu...)` shape used by every Phase-2/3 connector method:

```python
async def vncproxy(self, *, node: str, vmid: int, is_lxc: bool) -> dict:
    """POST /nodes/{node}/{lxc|qemu}/{vmid}/vncproxy — mint a console ticket.

    Returns the raw PVE response: {ticket, port, user, cert, upid}.
    The caller needs only `ticket` and `port`. websocket=1 is always passed.
    """
    base = self._client.nodes(node)
    ep = (base.lxc(vmid) if is_lxc else base.qemu(vmid)).vncproxy
    return await self._call_with_breaker(ep.post, websocket=1)
```

Unlike the create/power methods this returns a `dict`, not a UPID — `vncproxy` is a synchronous mint, not a long task, so it does **not** go through the job queue (CLAUDE.md constraint 1 is about *mutating* long PVE calls; minting a console ticket is a fast read-like operation and the route returns the data directly, not a 202).

### `console/routes.py` — the mint endpoint

```
POST /api/v1/clusters/{cluster_id}/{kind}/{vmid}/console/vncproxy
  kind ∈ {qemu, lxc}  (or the project's existing inventory resource-kind shape)
  - auth: the standard Phase-1 cookie/PAT principal dependency
  - resolve the resource for the caller's team (Phase-2 resolve_resource);
    cross-tenant or not-found -> 403  (T-04-03-03, CON-01 "any VM/LXC the user owns")
  - call connector.vncproxy(node, vmid, is_lxc=...)
  - RESPONSE: { console_ws_url: "/api/v1/ws/console/clusters/{id}/{kind}/{vmid}",
                ... }  -- the GUI relay URL, NOT the Proxmox ticket/host.
```

The mint endpoint exists so the "Open console" click gets an early ownership check (friendly 403) and the GUI relay URL for the iframe. Whether it also returns the ticket, or the relay re-mints (§3 shape a — recommended), is 04-08's call; either way the **browser never receives the Proxmox `ticket` or the `pve-host:8006` URL** (CON-03, T-04-03-01).

### `console/proxy.py` — the reverse-proxied WebSocket relay

```
@router.websocket("/ws/console/clusters/{cluster_id}/{kind}/{vmid}")
  1. auth BEFORE accept() — reuse jobs/ws.py `_resolve_ws_user` verbatim:
     access_token cookie -> User; cookie-only, NO PAT; fail -> close(1008).  (T-04-03-02)
  2. ownership check — resolve_resource for the caller's team;
     cross-tenant -> close(1008).  (T-04-03-03)
  3. mint a fresh vncproxy ticket (recommended: here, just-in-time — §3 shape a).
  4. await websocket.accept()
  5. build upstream URL with urllib.parse.quote(ticket, safe="") — the ONE encode hop (§2).
  6. ssl ctx from the cluster row's (verify_ssl, tls_fingerprint) — §5.
  7. async with websockets.connect(upstream_url, ssl=ssl_ctx) as up:
        relay binary frames bidirectionally — two _pump tasks, FIRST_COMPLETED,
        cancel the sibling, close the browser WS on upstream close.  (§3)
```

Library: **`websockets`** (already in the venv via `uvicorn[standard]`; add an explicit `pyproject.toml` pin). No new install.

### iframe `src` URL shape (frontend, plan 04-13)

The Console tab's `<iframe>` `src` points at the **GUI's own origin** — never at Proxmox:

```
<iframe title="Console for {name}"
        src="/console/embed?ws=/api/v1/ws/console/clusters/{id}/{kind}/{vmid}&...">
```

The iframe loads a GUI-served noVNC client page (the noVNC RFB client is served by the GUI, configured to open the *GUI relay* WS path, not `wss://pve-host:8006`). UI-SPEC forbids `@novnc/novnc` as a *bundled npm dependency*; the noVNC client itself is served as a static asset / by Proxmox-inside-the-iframe per the UI-SPEC's "plain iframe" contract — 04-13 finalises whether the iframe loads a GUI-hosted noVNC page or PVE's own noVNC client pointed at the GUI relay. **The load-bearing invariant this spike pins: the iframe's WebSocket target is a GUI-origin path, and the Proxmox `vncticket` + `:8006` host never reach the browser.** The iframe is rendered only after the "Open console" click (CON-02), carries a `title` attribute, and is not auto-focused on mount (UI-SPEC accessibility).

### Caddyfile delta (required — §4)

Add a `handle /api/v1/ws/console*` block with `reverse_proxy 127.0.0.1:8000 { flush_interval -1 }`, placed **before** the generic `handle /api/*` block. This ships with 04-08. Exact block in §4.

---

## Requirement traceability

| Requirement | How this spike resolves it |
|-------------|-----------------------------|
| **CON-01** — embedded noVNC console for any VM/LXC the user owns | §1 `vncproxy` mint for both qemu+lxc; §7 mint route + relay both do a team-scoped ownership check (cross-tenant → 403/close). |
| **CON-02** — vncticket minted on click, refreshed before expiry | §6 measured ~30-40s lifetime → mint-on-click only + Reconnect button re-mints; §2 single-encoding rule. |
| **CON-03** — console via the GUI's reverse-proxied WebSocket | §3 `console/proxy.py` relay design; §4 Caddy `flush_interval -1` block; the browser never sees `pve-host:8006` or the ticket. |
| **Pitfall 2** — vncticket double-encoding silently fails | §2 — exactly one `urllib.parse.quote(ticket, safe="")` hop, in `console/proxy.py`; every other hop carries the raw ticket as JSON. |
| **Pitfall 3** — vncticket ~30s expiry; reverse-proxy WS headers | §6 live-measured lifetime; §4 Caddy buffering directive. |
| **Assumption A4** — Caddy handles the noVNC WS upgrade | Confirmed — basic WS upgrade is automatic (the existing `/ws/jobs` proves it); only `flush_interval -1` buffering tuning is added. |
| **Assumption A8** — vncticket lifetime ~10-40s | Confirmed by live measurement: valid at t+30s, expired by t+45s. |
| **Open Question 4** — console WS through Caddy | Resolved — §4: a dedicated `handle` block with `flush_interval -1` is required and is specified. |

## Threat-model coverage (from 04-03-PLAN `<threat_model>`)

| Threat ID | Covered in |
|-----------|------------|
| T-04-03-01 — vncticket / Proxmox host exposure | §2, §3, §5, §7 — the relay holds the ticket + the `:8006` host; the browser only ever sees a GUI-origin relay URL. |
| T-04-03-02 — console WS handshake spoofing | §3, §7 — auth-before-`accept()`, cookie-only (no PAT), `close(1008)` on failure, reusing `jobs/ws.py._resolve_ws_user`. |
| T-04-03-03 — cross-tenant console access | §1, §7 — both the mint route and the relay endpoint resolve resource ownership for the caller's team before proceeding (cross-tenant → 403/close); `VM.Console` ACL is already covered by the tenant token's `PVEVMAdmin`. |
| T-04-03-04 — replayed/stale vncticket | §6 — mint-on-click + measured ~30-40s lifetime; the ticket is never cached/persisted/logged; a leaked ticket self-expires fast. |

---

## Evidence appendix

**Live probe** (`/tmp/probe_vncproxy.py`, run as the deployed backend's venv against the real cluster via the decrypted cluster admin token — the introspection pattern from `/tmp/introspect_pve.py`):

- Cluster: `192.168.20.240:8006`, `verify_ssl=False`, **PVE 9.1.2** (`repoid 9d436f37a0ac4172`, release 9.1), node `pz1`, 44 guests (34 running).
- `POST .../lxc/100/vncproxy` and `POST .../qemu/101/vncproxy` both returned `{cert, port, ticket, upid, user}`; `port='5900'`; `ticket` begins `PVEVNC:`, 361 chars, special chars `{+ / : =}`.
- `vncwebsocket` GET probe with the minted ticket: HTTP 200 at t+0/15/30s, HTTP 401 at t+45/60s → ticket lifetime ∈ (30s, 45s].
- `httpx.Client` has no `connect_ws` → httpx cannot do WS; `websockets==16.0` present in the venv; `uvicorn==0.46.0` (`[standard]` extra is the source of `websockets`).

**Proxmox API viewer** (`pve.proxmox.com/pve-docs/api-viewer/apidoc.js`):
- `/nodes/{node}/qemu/{vmid}/vncproxy` + `/nodes/{node}/lxc/{vmid}/vncproxy` — `POST`, `protected:1`, perm `VM.Console` on `/vms/{vmid}`, `returns`: `cert, port, ticket, upid, user` (+ optional deprecated `password`). `websocket` is an optional boolean request param.
- `/nodes/{node}/qemu/{vmid}/vncwebsocket` + `.../lxc/.../vncwebsocket` — `GET`, params `port` `(5900-5999)` and `vncticket` `(<string>, maxLength 512)`, perm `VM.Console` + a valid ticket, `returns {port: string}`.

**Forum threads** (`04-RESEARCH.md` Sources, Secondary):
- *noVNC over API* (`...129091`) — shows a working `vncwebsocket` URL with `vncticket=PVEVNC%3A...%2F...%2B...%3D%3D` (single-encoded) and the `api2/json/nodes/.../vncwebsocket?port=&vncticket=` path shape.
- *Nginx reverse proxy noVNC* (`...130476`) — confirms a reverse proxy fronting noVNC needs `proxy_http_version 1.1`, `Upgrade $http_upgrade`, `Connection "Upgrade"`, `proxy_buffering off`, long `proxy_read_timeout`/`proxy_send_timeout` — the basis for the Caddy `flush_interval -1` directive in §4.

**Caddy docs** (`caddyserver.com/docs/caddyfile/directives/reverse_proxy`) — `reverse_proxy` auto-handles the WebSocket upgrade and transitions to a bidirectional tunnel; `flush_interval` is the streaming directive that controls response-buffer flushing (`-1` = flush immediately, the `proxy_buffering off` equivalent).
