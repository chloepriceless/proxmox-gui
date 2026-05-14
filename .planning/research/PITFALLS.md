# Pitfalls Research

**Domain:** Self-service Proxmox VE GUI (multi-tenant, multi-cluster, lifecycle management)
**Researched:** 2026-05-14
**Confidence:** HIGH (most pitfalls confirmed by official Proxmox docs + forum reports + library issue trackers)

> Scope: pitfalls specific to building a Hetzner-Cloud-style self-service portal on top of the Proxmox VE API. Generic web-app pitfalls (SQL injection, XSS) are intentionally out of scope.

---

## Critical Pitfalls

### Pitfall 1: VMID race condition with `/cluster/nextid`

**What goes wrong:**
Two users (or two background workers) call `/cluster/nextid` within a short window and both get the same VMID. One create succeeds, the other fails with "VM already exists" — or worse, both succeed on different nodes if they pick different target nodes and the second create races the cluster filesystem replication.

**Why it happens:**
The legacy `/cluster/nextid` endpoint is read-only and does not reserve the ID. Newer Proxmox versions added a temporary 60-second reservation, but it is only triggered when callers pass the returned ID back as a hint, and many libraries do not do this. Self-service portals are exactly the workload that triggers this — multiple users clicking "Create" within seconds.

**How to avoid:**
1. Always wrap "get next ID, create VM" in an application-level lock keyed by cluster ID (or use Postgres `SELECT ... FOR UPDATE` on a counter row).
2. On `create` API error matching "already exists", retry with the next ID — bounded to 5 retries.
3. Maintain an internal "reserved VMID" set in the app DB, valid for 60s, so concurrent provision wizards see a different next ID. Reconcile against Proxmox after the create succeeds or times out.
4. Allow admins to set a per-cluster VMID range (e.g. `1000–9999`) so the GUI does not collide with manually-created VMs.

**Warning signs:**
- "VMID already exists" errors during bursty load tests
- Two VMs appearing with adjacent VMIDs but only one row in your app DB
- Terraform/Packer-style scripts pointing at your API failing during parallel runs

**Phase to address:**
Phase that introduces VM/LXC provisioning (likely Phase 3 — first provisioning loop). Reservation logic is cheap to add at the start, expensive to retrofit.

---

### Pitfall 2: UPID polling started after task already finished

**What goes wrong:**
You POST to `/nodes/{node}/qemu` and get a UPID. Before you start polling `/nodes/{node}/tasks/{upid}/status`, the task already finished (very common for `start`, `stop`, `set`, `snapshot`-delete, fast clone-from-template). Your first poll returns `status=stopped, exitstatus=OK`, which is correct — but naïve code that only acts on a state *transition* never fires the "completed" callback. Worse: code that treats the absence of an active task as "task never existed" will surface a phantom error to the user.

**Why it happens:**
Proxmox returns the UPID immediately and starts work in a background `pvedaemon`/`pvestatd` worker. There is no "queued" intermediate state visible to the API; tasks go directly from "running" to "stopped". Many Proxmox client libraries (especially hand-rolled ones) wait `N` seconds then poll, missing the entire lifecycle.

**How to avoid:**
1. Treat the first status response as authoritative, not transitional. If `status=stopped`, inspect `exitstatus` and finish.
2. Use the `/nodes/{node}/tasks/{upid}/status` endpoint (which works after completion for the task-log retention window) rather than `/nodes/{node}/tasks/active` (which drops completed tasks).
3. Persist the UPID and `exitstatus` in your DB the moment you receive them — never rely solely on polling state.
4. After the task-log retention window (default ~ a few hundred tasks per node), the UPID becomes unfetchable. Capture exitstatus early and stop polling.
5. UPID parsing: UPIDs have a strict format (`UPID:<node>:<pid_hex>:<starttime_hex>:<startepoch_hex>:<type>:<id>:<user>:`). Validate with a regex; do not split blindly on `:` because the trailing user may contain `@`.

**Warning signs:**
- UI stuck on "Provisioning…" but the VM appears in Proxmox immediately
- Task-status fetches returning 404 right after a successful operation
- Tests that pass at 100ms latency but fail at 5ms latency (the faster the cluster, the more often you lose the race)

**Phase to address:**
Phase that adds the Proxmox API client / first async operation. Build a generic `wait_for_task(upid)` primitive immediately.

---

### Pitfall 3: noVNC `vncticket` expires in ~30 seconds

**What goes wrong:**
You generate a `vncticket` via `POST /nodes/{node}/qemu/{vmid}/vncproxy`, embed the iframe, the user clicks "Open Console" → page loads, the WebSocket upgrade is attempted, and Proxmox returns `401 invalid PVEVNC ticket` because the ticket expired between page render and user click. The Proxmox forum explicitly documents this lifetime as short (frequently cited as ~30–40 seconds).

**Why it happens:**
The vncticket is intentionally short-lived because it is a single-use credential carried in a URL parameter. The naïve flow ("generate on page load, render iframe with the URL") is fragile if the user is slow.

**How to avoid:**
1. Defer ticket generation until the user actually clicks "Open Console", not on page render.
2. The backend endpoint that returns `{vncticket, port, websocket_url}` should be called from the frontend just-in-time; the iframe should be created from the response, not pre-rendered.
3. Build a "Reconnect" button that re-fetches a fresh ticket on demand. Detect WebSocket close with the 401 reason and offer reconnect automatically.
4. On the proxy path, **never cache** the vncticket. Treat the call as cacheless write.
5. Remember: the `PVEAuthCookie` (regular user ticket) and the `vncticket` are different. Both must reach the WebSocket: PVEAuthCookie via cookie, vncticket via query parameter (URL-encoded). Mixing them up is the #1 cause of "invalid PVEVNC ticket".
6. For multi-cluster: ensure your reverse proxy forwards cookies scoped to the right cluster host; otherwise PVEAuthCookie collisions silently break consoles.

**Warning signs:**
- "Invalid PVEVNC ticket" errors with no consistent reproducer (depends on user click latency)
- Console works when devtools is open (slower JS = faster click) but fails when closed
- Mobile users have higher failure rate (slower TLS handshake)

**Phase to address:**
Phase that introduces the embedded console. Almost always a separate phase from "create VM" — flag for dedicated research and load-testing.

---

### Pitfall 4: Cloud-init snippet storage requirements not enforced

**What goes wrong:**
User submits a custom cloud-init `user-data` snippet via your UI. The backend writes the file and calls `qm set <vmid> --cicustom user=local:snippets/userdata.yaml`. The VM starts on a node where `local` does not have the `snippets` content type enabled, or the file does not exist on that node, or the file is in a subdirectory. The VM either:
- Refuses to start with a vague "could not activate storage" message, OR
- Boots without the cloud-init configuration (so the user has no SSH access and the VM appears bricked).

**Why it happens:**
Proxmox snippets have several hard rules that are not surfaced by the API:
1. The storage backend must have `snippets` in its `content` list (must be added explicitly per storage).
2. The snippet must exist on every node the VM may run/migrate on — directory storage is per-node, not shared, unless backed by NFS/CephFS.
3. Snippets cannot live in subdirectories (`snippets/foo/bar.yaml` fails).
4. Custom user-data **overwrites** Proxmox's auto-generated config — meaning if you forget to set `hostname` in your snippet, the VM has no hostname.

**How to avoid:**
1. On startup, validate that each managed cluster has at least one storage with `content=snippets` enabled. Surface a clear error if not.
2. Prefer a shared storage (NFS, CephFS) for snippets when the cluster has more than one node. The GUI should detect "this is a cluster but snippets storage is node-local" and warn.
3. Write snippets directly to the storage root (no subdirs). Use the VMID + UUID as the filename to avoid collisions.
4. When generating cloud-init from the custom snippets editor, merge with a baseline that always sets `hostname`, `chpasswd: expire: false` (or similar policies), and SSH keys.
5. Treat `cicustom=user=...` and the GUI's `ciuser/cipassword/sshkeys` fields as mutually exclusive — pick one mode in the UI and explain the tradeoff. Do not let users mix them.
6. After `qm set --cicustom`, **regenerate the cloud-init drive** explicitly (`qm cloudinit update <vmid>`). Proxmox does not watch the snippets directory and will not auto-regenerate.

**Warning signs:**
- VMs boot but cloud-init "did nothing"
- Migration fails with "snippet not found on target node"
- The `cicustom` parameter accepted by the API but the resulting drive contains old data

**Phase to address:**
Phase that adds custom cloud-init (likely a sub-phase of VM provisioning). Add a "cluster health check" that includes snippet-storage validation in Phase 2 or 3.

---

### Pitfall 5: Multi-tenant ACL leaks (the user can see VMs they shouldn't)

**What goes wrong:**
Your "List VMs" endpoint calls `GET /cluster/resources?type=vm` using the GUI's service account (which has `Datastore.Audit` cluster-wide) and filters in application code. A bug in the filter (or a missed code path on a websocket update, or a debug log line) leaks VMIDs/IPs/names of VMs in other tenants. Even without a bug: side channels like the cluster task log (visible at `/cluster/tasks`) leak the existence of other tenants' VMs through UPIDs.

**Why it happens:**
The simplest implementation is "single super-user, filter in app". This makes the GUI's process the *only* security boundary; every endpoint must remember to filter. Proxmox's own ACL model is rich enough to enforce visibility at the API layer (via pools + `PVEVMUser` role + privilege-separated tokens) but most developers skip this because it's more work.

**How to avoid:**
1. Map each app-tenant to a Proxmox **pool** (`/pool/tenant-foo`). Every VM the GUI creates for a tenant gets added to that pool at creation time (`qm set <vmid> --pool tenant-foo`).
2. Either:
   - **Per-user Proxmox token:** Create a Proxmox user + privilege-separated API token per tenant. The GUI calls Proxmox *as that tenant* for list/read operations. Proxmox enforces ACLs natively. — preferred for v1+.
   - **Single super-token + always-filter:** Wrap every list call with mandatory filter middleware. Write a static analysis test that grep-checks for raw Proxmox list calls outside the middleware. Brittle, but possible.
3. Remember `NoAccess` overrides everything on the same path. If you use NoAccess for negative ACLs, audit carefully — a NoAccess at `/vms/100` blocks even VM.Audit from inherited roles.
4. Never expose `/cluster/tasks` or `/cluster/log` directly to non-admin users — those leak across tenants. Provide a filtered task-feed at the app layer.
5. Audit log entries should include the tenant ID, not just the Proxmox user — otherwise tenant A's admin sees tenant B's user actions.
6. Real-time updates (websocket/SSE) must re-check authorization on every push, not just on subscribe.

**Warning signs:**
- "List VMs" endpoint that returns the same payload regardless of who calls it
- Any code path that builds a Proxmox URL with a VMID coming from the request without an "is the caller allowed to see this VMID" check
- Admin actions don't show a tenant column in the audit log

**Phase to address:**
Multi-tenancy must be designed into the data model from Phase 1. Adding it later is a near-rewrite. Make pool mapping and per-tenant tokens part of the tenancy phase (Phase 2 in most plausible roadmaps).

---

### Pitfall 6: Quota enforcement TOCTOU (time-of-check, time-of-use)

**What goes wrong:**
User has a quota of 16 GB RAM, currently uses 12 GB. They open two browser tabs and submit two create-VM forms simultaneously, each requesting 8 GB. Both pass the quota check (`12+8 ≤ 16`), both VMs get created, the user is now at 28/16 GB.

**Why it happens:**
The naïve flow is: `read current usage → check quota → call Proxmox create`. Without locking, two concurrent flows interleave and both pass the check.

**How to avoid:**
1. Wrap the quota check + creation in a **single DB transaction** that locks the tenant row (`SELECT ... FOR UPDATE`), inserts a "pending VM" row consuming the quota, *then* calls Proxmox. On Proxmox failure, roll back the pending row.
2. Quota calculations should be based on the **app DB's view of pending + active VMs**, not just `cluster/resources`. Otherwise a freshly-created VM that has not yet reported usage doesn't count.
3. Periodic reconciliation: sweep against Proxmox to detect drift (e.g. VMs deleted out-of-band, or created via Proxmox UI by an admin). Surface drift in an admin alert; do not silently auto-correct quotas.
4. Quota must cover: CPUs, RAM, primary disk, *and* total disk across snapshots/backups. Storage usage is the easy-to-forget one.
5. Provide a "reserved" vs "in-use" breakdown in the UI so users understand why their quota is consumed by a stopped VM.

**Warning signs:**
- Users reporting that quota "doesn't work" when they spam-click create
- Total consumption in your DB doesn't match `pvesh get /cluster/resources` totals
- Quota overshoots only on the second create of a session

**Phase to address:**
Same phase as multi-tenancy / quotas. Build the locked-transaction pattern as a primitive before the first quota check exists.

---

### Pitfall 7: Cluster vs node API endpoint mismatch

**What goes wrong:**
You call `GET /cluster/nextid` to allocate a VMID, then `POST /cluster/qemu/{vmid}` — except `/cluster/qemu` doesn't exist. Or you call `GET /nodes/pve1/cluster/resources` — same problem. Worse: you call `GET /nodes/pve3/qemu/{vmid}/status/current` for a VM that lives on `pve5`. Proxmox proxies the call to `pve5` via SSH transparently — but **if `pve3` is down or unreachable, the call fails** even though the VM is fine on `pve5`.

**Why it happens:**
Proxmox has three endpoint families and developers conflate them:
- `/cluster/*` — true cluster-wide endpoints (resources, nextid, tasks, ha, sdn, acl)
- `/nodes/{node}/*` — node-scoped (must hit the node that holds the resource for some operations; transparently SSH-proxied for others)
- `/access/*` and `/pools/*` — datacenter-wide

Bonus problem: `pveproxy` on every node will forward to the right node, but only if the destination node is up. So picking a "bad" entry node turns transient node downtime into total API outage for users whose VMs live elsewhere.

**How to avoid:**
1. Maintain a known-good list of cluster nodes per managed cluster. Health-check them periodically. Pick a random *healthy* node as the API entry point for each request.
2. Always call the node that hosts the resource for write operations on VMs/LXCs. Track VM → node mapping in your DB (refresh on migration events).
3. Build a small router: `GET /cluster/...` → any healthy node; `GET|POST|PUT|DELETE /nodes/X/...` → node X, fallback to another healthy node only for read-only `/cluster/resources`-like calls.
4. Document for each Proxmox call whether it is cluster-scoped or node-scoped. Encode this in the client library; do not let endpoint paths be assembled by ad-hoc string concatenation.
5. Cache the cluster topology with a short TTL (e.g. 30s) so a node going down does not cause every in-flight request to discover the failure independently.

**Warning signs:**
- API calls work in dev (single node) and fail in production (cluster)
- Intermittent 500s after a node maintenance window
- Migration breaks subsequent operations on the VM

**Phase to address:**
First phase that touches the Proxmox API. Build the routing primitive before any feature work.

---

### Pitfall 8: SDN API maturity — `pending` state and reload semantics

**What goes wrong:**
You create a VNet via `POST /cluster/sdn/vnets`. The call returns success. You immediately try to attach a VM NIC to that VNet — fails, "bridge does not exist". Or: you create the VNet, attach the NIC, the VM starts, but networking does not work because the SDN configuration is in `pending` state and was never applied.

**Why it happens:**
The Proxmox SDN model has two parallel configurations — the "configured" state (in `/etc/pve/sdn/`) and the "applied" state (in `/etc/network/interfaces.d/`). Changes must be explicitly applied via `POST /cluster/sdn` (reload). Until applied, objects show `status: pending`. Additionally, some SDN endpoints were promoted out of "tech preview" only in PVE 8 and behavior across 7.x → 8.x → 9.x is inconsistent. The community forum reports `local sdn network configuration is too old, please reload` errors after seemingly-successful SDN edits.

**How to avoid:**
1. After any SDN write, **always call `POST /cluster/sdn`** (the reload endpoint). Treat the write + reload as a single atomic operation in your app.
2. Wait for `status: applied` (poll the zones/vnets endpoint with status filter) before considering the change complete. The cluster reload is async — your UI should reflect "pending" honestly.
3. Restrict SDN to PVE ≥ 8.x in v1. Surface a clear "SDN requires Proxmox 8.0+" message if the cluster is older.
4. Cache the list of zones/vnets and their applied state. Refresh on a reasonable interval (e.g. every 30s) — do not assume your last write succeeded everywhere.
5. SDN apply is **cluster-wide**: if even one node is out of quorum, the apply will not complete on that node. Detect and surface this rather than silently leaving the SDN in pending forever.
6. Validate that the user-selected VNet actually exists on the target node before attempting to start the VM there. The cluster config may exist; the per-node applied config may not.

**Warning signs:**
- VMs starting on the "wrong" network despite the GUI showing the correct one
- SDN edits work in single-node dev, fail in cluster
- `qm start` fails with "no such bridge" errors

**Phase to address:**
SDN integration phase. SDN warrants its own deep research before implementation — flag it.

---

### Pitfall 9: API ticket 2h expiry breaks long sessions / long tasks

**What goes wrong:**
A user starts a backup job that takes 3 hours. The GUI's API ticket expires after 2 hours. The next API call (any call — even a status check) returns 401, the GUI shows "session expired", and the user thinks the backup failed. Or: a Veeam-style integration uses the GUI's API and stops mid-restore.

**Why it happens:**
PVE auth tickets have a 2-hour lifetime, signed by a cluster-wide key that rotates daily. There is no extension mechanism; the only renewal is "pass the old ticket as the password to `POST /access/ticket`" before it expires.

**How to avoid:**
1. **Backend service should always use API tokens, not tickets.** API tokens do not expire (unless given an explicit expiration). Tickets are for *interactive user logins* only.
2. For the GUI's user-facing session, run a refresh timer that re-authenticates at the 90-minute mark. Detect 401 on any call and refresh + retry once.
3. Persist the UPID and the user-association in your DB. Status checks for long-running tasks should be done by the backend service (with a token) on the user's behalf — not from the user's browser session.
4. For multi-cluster: each cluster has its own ticket lifetime; do not share refresh logic across cluster connections.
5. Test by setting your dev clock forward two hours mid-session.

**Warning signs:**
- Users report having to log in repeatedly during long operations
- Background tasks that "disappear" from the UI after a couple of hours
- 401 errors clustered at predictable intervals

**Phase to address:**
Auth phase + first long-running operation phase. The architectural decision (tokens for backend, tickets only for interactive) must be made early.

---

### Pitfall 10: Helper-script trust model — running arbitrary upstream code as root

**What goes wrong:**
The GUI invokes a community-scripts helper to provision an LXC ("install Nextcloud", "install Home Assistant", etc.). The script pulls bash from `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/...` and pipes to `bash` as root on the Proxmox host. Three months later the upstream changes (or is compromised), and every new install runs different code. Your GUI is now a vector for an upstream supply-chain attack with hypervisor-root reach.

**Why it happens:**
The community-scripts canonical install pattern is `bash -c "$(wget -qO - <url>)"` — fast, frictionless, untrusted by design. The original maintainer (`tteck`) has died and the project transferred to a community organization; key maintainers have since resigned over governance concerns. The "always-latest" default is convenient but unauditable.

**How to avoid:**
1. **Pin to commit hashes.** Mirror or fork the community-scripts repo, pin to specific commits you have reviewed, and serve scripts from your own host. Update on a deliberate cadence, not on every install.
2. Sandbox the execution: every helper-script invocation should run inside the freshly-created LXC, never on the Proxmox host directly. Wrap the helper invocation with `pct exec <id> ...` after the basic LXC is up.
3. The "create empty LXC" step (using `pct create`) should use only your own code paths against the Proxmox API. Only the in-container "install Nextcloud" stage should use upstream scripts.
4. Surface in the UI: "This will run upstream code from `community-scripts/ProxmoxVE@<commit>`. Last reviewed: 2026-XX-XX. [View diff since last review]"
5. Default to **non-interactive** mode for scripts (`-y`, env vars). Many community scripts have interactive `whiptail` prompts; running them through your API requires either patched non-interactive forks or `expect`-style scripting.
6. Capture all script output (stdout+stderr) to your audit log. If a script fails mid-install, the user must be able to see what happened.
7. Tag every script's metadata with an `attribution` field. The community-scripts license requires attribution.

**Warning signs:**
- Scripts that "just stopped working" after an upstream change
- Provisioning succeeds but the resulting container behaves unexpectedly
- Cannot reproduce a customer's install because the script changed between runs

**Phase to address:**
Community-scripts integration phase. The pinning + sandboxing decisions must be made before the first script is shipped — retrofitting "we accidentally ran latest for 6 months" is a security incident, not a refactor.

---

### Pitfall 11: Storage with same name across clusters has different backends

**What goes wrong:**
Your app has a per-cluster registry of "available storages". Both `cluster-a` and `cluster-b` have a storage called `nas-backup`, so your UI shows it as a single option. The user picks `nas-backup` for a backup destination, and the backup either writes to the wrong NFS share or fails because the share is mounted differently on each cluster.

**Why it happens:**
Proxmox storage IDs are cluster-local. Two clusters can independently have storage IDs that collide. The GUI treating storage as a globally-unique name is a category error.

**How to avoid:**
1. Always namespace storage references in your app DB by cluster ID: `{cluster_id, storage_id}` is the composite key.
2. Resolve `storage_id` only inside a cluster context. Never let the UI submit just `storage_id` without `cluster_id`.
3. Display storage in the UI as `cluster-a:nas-backup` (or with a cluster label/badge) — never bare names when cross-cluster operations are possible.
4. When migrating between clusters (if you support that), explicitly map source-storage → target-storage in the UI. Do not assume same name = same storage.
5. Detect and warn on "same-named-different-backend" mismatches when an admin adds a new cluster.

**Warning signs:**
- Users confused why backup-x landed on the wrong storage
- Migrations that succeed metadata but fail on storage availability

**Phase to address:**
Multi-cluster phase. Same lesson applies to node names, SDN zone names, and pool names — anything cluster-scoped.

---

### Pitfall 12: Long-running task state lost on GUI restart

**What goes wrong:**
A user starts a `clone-template` operation that takes 8 minutes. After 2 minutes, you redeploy the GUI (helper-script auto-update, container restart, whatever). The in-memory polling loop dies. The UI shows the operation as failed/missing; the user retries; now there are two clones running.

**Why it happens:**
Many implementations poll UPIDs in-memory (a goroutine, a background task) without persisting state. Restart loses everything.

**How to avoid:**
1. Every async operation must be persisted to the DB **before** the API call is made — including the UPID once received and the user/tenant who initiated it.
2. On startup, the GUI scans for `status=pending` operations and resumes polling. UPID lookups remain valid as long as Proxmox's task history hasn't expired them.
3. Idempotency keys: each user-initiated operation should have a UUID. If the user retries the same operation within a short window, detect and return the in-progress operation instead of starting a new one.
4. For operations that complete while the GUI is down: poll once on startup, reconcile, then mark the DB row.
5. UI should never show an operation as "failed" just because polling stopped — only when Proxmox explicitly reports failure or the user manually cancels.

**Warning signs:**
- Duplicate clones / VMs after a deploy
- "Operation pending forever" with no clear failure
- The audit log shows the same action twice in quick succession from the same user

**Phase to address:**
First phase that introduces async operations. The "persist UPID, resume on restart" primitive must be a foundational utility.

---

## Moderate Pitfalls

### Pitfall 13: vzdump output parsing for status

vzdump task logs are line-oriented free-form text. Successful runs include `INFO: Backup job finished successfully` near the end, but the format has changed across PVE versions. Relying on string matching breaks on upgrade.

**Prevention:** Use the task `exitstatus` field (OK / non-OK) from `/nodes/{node}/tasks/{upid}/status`, not log scraping. For richer info (size, duration), parse only the structured lines (`INFO: <key>: <value>`) and tolerate missing keys.

**Phase:** Backup feature phase.

---

### Pitfall 14: Cloud-init DNS not applied for DHCP networks

If the network is DHCP, Proxmox's cloud-init does not push DNS settings — DHCP is expected to provide them. Users who set DNS in the cloud-init editor but use DHCP get confused when the DNS is ignored. Additionally, recent distros (Debian 13 / Ubuntu 24.04) have moved to systemd-resolved or new cloud-init renderers that differ from what Proxmox generates.

**Prevention:** In the cloud-init UI, grey out the DNS field with an explanatory tooltip when DHCP is selected. Validate the target distro version against known cloud-init compatibility — store a compatibility matrix.

**Phase:** Cloud-init editor phase.

---

### Pitfall 15: API token TFA bypass

Two-factor authentication (TFA) is enforced at *login* (ticket creation), not on API token use. A privilege-separated token can be used without TFA even when the underlying user requires TFA for the web UI. If your GUI accepts API tokens for authentication, you must enforce TFA at your own auth layer — the upstream check is not there.

**Prevention:** Decide whether your GUI accepts token-based authentication at all. If yes, document that token use bypasses TFA, and require periodic token rotation. Most self-service UIs should only accept username/password + TFA.

**Phase:** Auth phase.

---

### Pitfall 16: Storage content-type mismatch

Storages with `content=images,rootdir` cannot store ISOs, snippets, or backups. The Proxmox UI surfaces this implicitly; your GUI must too. Common mistake: offering a storage in the "ISO upload" dropdown that doesn't support `iso` content type, which the API will reject only at upload time.

**Prevention:** Filter every storage dropdown by required content type. The filter must use the *target node's view* of the storage (a storage can be enabled on some nodes and not others).

**Phase:** Provisioning UI phase.

---

### Pitfall 17: `skiplock` is root-only

The `skiplock` parameter on `DELETE /nodes/{node}/qemu/{vmid}` (and similar) ignores VM locks but is **only valid for the root@pam user**. Privilege-separated tokens cannot use it — even if the underlying user is root. If your GUI uses tokens (which it should), surface a clean "VM is locked, please unlock first" error rather than silently retrying with skiplock.

**Prevention:** Detect 403-with-skiplock-message responses and present a UI to manually unlock (which sets `--lock=` to empty, also via the underlying user not the token in some cases).

**Phase:** Lifecycle/delete phase.

---

### Pitfall 18: Cluster quorum loss makes writes inconsistent

When a Proxmox cluster loses quorum, the cluster filesystem (`pmxcfs`) goes read-only on minority nodes. API write attempts will fail with "cluster not ready - no quorum?". External automation that retries blindly will create inconsistent state once quorum returns.

**Prevention:** Pre-flight every write with a quorum check (`GET /cluster/status` — look at `quorate: 1`). If quorum is lost, switch the affected cluster into the read-only banner mode (per Constraints in PROJECT.md). Block writes at the API layer, not just the UI.

**Phase:** Multi-cluster resilience phase.

---

### Pitfall 19: Unprivileged LXC for the GUI itself

The deployment target is a single LXC. Some operations the GUI may want to do — bind-mounting shared snippets, accessing the host's `/etc/pve` for diagnostics, mounting NFS for an embedded backup — may not work in an unprivileged container without `lxc.apparmor.profile: unconfined`, FUSE keyctl, or nesting. Worse: privileged containers expose the LXC's root to the host as host-root.

**Prevention:** Default to unprivileged + nesting + keyctl. Document required features clearly in the helper-script install. **Do not require privileged LXC** in v1 — if a feature needs it, make it opt-in with a documented risk. The GUI should communicate with Proxmox over the API exclusively, not via host paths — this keeps it unprivileged-clean.

**Phase:** Deployment/packaging phase.

---

### Pitfall 20: Migration breaks snippet references

A VM with `cicustom=user=local:snippets/foo.yaml` migrates to a different node. `local` storage is per-node, so the snippet does not exist on the target. The VM starts without its cloud-init, or refuses to start.

**Prevention:** When a snippet is set, refuse to allow migration unless the snippet's storage is shared (NFS/CephFS). Alternatively: pre-copy snippets to the target node before migration. Surface the constraint in the UI ("This VM uses a snippet on node-local storage; migration will fail").

**Phase:** Migration phase.

---

## Minor Pitfalls

### Pitfall 21: Audit log unbounded growth

Audit logs grow forever if you never rotate. At enterprise volume this is a non-issue; in a home-lab LXC with a small disk, 1M rows of "user X started VM Y" eventually fills the disk.

**Prevention:** Built-in retention policy (e.g. 90 days), with an export option for compliance.

**Phase:** Audit/admin phase.

---

### Pitfall 22: Backup of the GUI's own state forgotten

The GUI manages backups of *managed VMs* but its own DB (tenants, audit log, settings) is not backed up. After a host crash, users are back to bare metal and the operator has to re-onboard tenants.

**Prevention:** Self-backup endpoint that dumps the app DB to a configurable destination (S3, NFS, a managed Proxmox cluster's `backup` storage). Include in the helper-script install as a default scheduled job.

**Phase:** Operational hardening phase.

---

### Pitfall 23: Stale UI state after action

User clicks "Stop VM". API returns success. UI doesn't refresh because the polling interval is 30s. User clicks Stop again, gets "VM is already stopped" error, thinks the GUI is broken.

**Prevention:** After any action that produces a UPID, immediately optimistically update the UI to "operation in progress", then poll the UPID at a tight cadence (1s for first 10s, then back off) until completion, then refresh the resource.

**Phase:** UI/UX foundation.

---

### Pitfall 24: "operation failed" with no detail

Proxmox returns rich error messages; many GUIs swallow them and show "Operation failed". The Proxmox error from the API includes a `data` payload (sometimes), the HTTP body, and the task log if a UPID was issued.

**Prevention:** Always surface the upstream error message to the user (when the user is authorized to see it). For privileged details (paths on the host, internal IPs), redact in the user view but log in full to the audit log.

**Phase:** UI/UX foundation.

---

### Pitfall 25: Destructive actions one click away

"Delete VM" next to "Reboot" with no confirmation is a classic. Combined with users running multiple VMs with similar names, it's a recipe for permanent data loss.

**Prevention:** Destructive actions (delete, force-stop, restore-snapshot, revert-clone) require a typed confirmation of the VM name. Provide a 30-second "Undo" toast for soft-deletable actions (deleted VMs go to a 24h trash before purge).

**Phase:** UI/UX foundation.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth foundation | Ticket vs token confusion | Decide upfront: backend = token, user session = ticket |
| Multi-tenancy | Filter-in-app leaks | Use Proxmox pools + privilege-separated tokens for ACL enforcement |
| Quotas | TOCTOU overshoot | DB-level locking around quota check + create |
| First VM/LXC create | VMID race + UPID polling | Reserve VMID, persist UPID before issuing call |
| Cloud-init editor | Snippet storage requirements | Validate storage config at startup; pre-flight before save |
| Embedded console | vncticket short expiry | Generate on demand, not on page load |
| SDN integration | Pending state, reload semantics | Explicit reload after every write, poll for applied state |
| Backup/vzdump | Output parsing fragility | Use `exitstatus`, not log scraping |
| Migration | Snippet pinned to node-local storage | Refuse migration if snippet storage is not shared |
| Helper-scripts | Always-latest supply chain | Pin to reviewed commits; never run on host, only inside fresh LXC |
| Multi-cluster | Storage/VNet name collisions | Always namespace by cluster_id |
| Deployment LXC | Privilege required for some ops | Stay unprivileged + nesting; API-only host access |
| Long sessions | Ticket expiry mid-task | Token for backend tasks; refresh ticket on interactive session |
| Audit log | Tenant column missing | Make tenant_id non-null in audit schema from row 1 |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single super-user Proxmox token + filter-in-app for tenancy | Fast to build, simple API client | Every list endpoint is a potential leak; security audits become exhaustive | **Never** for a multi-tenant product. OK only for single-tenant home use, but must not ship to v1. |
| Always-latest helper-scripts | Newest features automatically | Unauditable supply chain; reproducibility loss | **Never** — pin from day one. |
| In-memory UPID polling without DB persistence | Less code | Restarts lose tasks; duplicate operations | Acceptable only for read-only status polling, never for state-changing operations |
| Single Proxmox API endpoint hard-coded (entry node) | Trivial config | Node maintenance becomes a GUI outage | Acceptable in dev, never in v1 |
| Cloud-init editor as free-text only | No schema needed | Users write broken YAML, blame the GUI | Acceptable if paired with a schema-validating "Advanced" toggle |
| Helper-script-style install with no upgrade story | Matches community-scripts UX | Can't ship security fixes | OK if `update` is in the same script (idempotent re-run) |
| Ticket-based auth for the backend service | Quick to bootstrap | 2h expiry breaks long jobs; rotation key day-cycle causes random failures | Never — backend should always use tokens |
| Polling instead of websocket/SSE for task updates | Simple | Doesn't scale beyond ~50 concurrent users, looks laggy | OK for v1 if poll interval is adaptive |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Proxmox API | Hard-code node hostname as API entry | Health-checked round-robin across cluster nodes |
| Proxmox API | Ignore `data: null` responses (treated as success) | Treat `null` data with a non-2xx HTTP status as failure; `null` with 2xx is a real "no result" |
| noVNC | Generate vncticket on page load | Generate on user click, with a "reconnect" button |
| noVNC | Forget to forward `Upgrade` / `Connection: upgrade` headers in reverse proxy | Required headers: `proxy_http_version 1.1`, `Upgrade $http_upgrade`, `Connection "upgrade"`, `proxy_buffering off` |
| Cloud-init | Edit snippet file but not regenerate cloud-init drive | Always call `qm cloudinit update <vmid>` after snippet changes |
| Cloud-init | Mix `cicustom=` and Proxmox-managed `ciuser`/`cipassword` | Pick one mode in the UI |
| community-scripts | Pipe upstream bash to root on the host | Run script *inside* the newly-created LXC, not on the Proxmox host |
| community-scripts | Assume non-interactive | Many scripts use `whiptail`; check for interactive prompts before integrating |
| SDN | Forget to call `/cluster/sdn` reload after a write | Always reload; poll for `applied` state |
| Proxmox Backup Server | Treat PBS as just another `backup` storage | PBS has its own API; integration is via Proxmox storage definition but error semantics differ from vzdump |
| Multi-cluster | Share API client / connection pool across clusters | One client per cluster; independent auth state, independent ticket lifetimes |
| Audit log | Log Proxmox-user, not tenant | Always include both: who-in-PVE acted, on behalf of which tenant |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `GET /cluster/resources` on every page render | Slow page loads, hammering Proxmox | Cache with 5–15s TTL; subscribe to a single backend poll loop, fan out to clients | ~10 concurrent users |
| Polling every UPID at 1Hz forever | Network/CPU spike during deploys | Exponential backoff after first 10s; cap at 30s | ~50 concurrent operations |
| Audit log without index on (tenant_id, created_at) | Slow audit page for admins | Index from day one; consider partitioning by month at 1M+ rows | ~100k audit rows |
| Full VM list re-fetch on every websocket event | UI freezes during cluster-wide events | Diff-based updates: subscribe to a single SSE stream with structured changes | ~500 VMs |
| ISO/template download via the GUI process | Memory spikes, OOM on large ISOs | Stream directly from storage to client via Proxmox's existing endpoints; do not buffer | ~4 GB ISOs |
| Per-cluster API ticket refresh as a synchronous step in every request | Latency floor of one ticket call per request | Background refresh; cached ticket | Always |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing the Proxmox root@pam credential in the app DB | Hypervisor takeover if app DB is exfiltrated | Use a privilege-separated API token; root@pam only during initial bootstrap, then revoke |
| Skipping ACL on individual VMs because pool-level was set | NoAccess overrides break inheritance silently | Test ACL changes with a non-admin test user before shipping |
| User-provided cloud-init that can pre-seed root SSH access | If the user is allowed to set any user-data, they can drop their key into root's authorized_keys via cloud-init; combined with VM-on-shared-storage this can reach data they shouldn't access | Sanitize / restrict cloud-init keys; enforce that VMs land on tenant-scoped storage |
| Forwarding upstream Proxmox error messages verbatim to non-admin users | Leaks node names, internal IPs, storage paths | Whitelist what gets surfaced; full detail goes to audit log only |
| Helper-script invocation without script-pinning | Supply chain attack reach: hypervisor root | Pin commit hashes; run scripts inside fresh LXC, not on host |
| `skiplock` exposed in the UI | Privilege escalation if the user can spoof root@pam | Never expose; offer "request unlock" → admin approves |
| Audit log writable by tenants | Tampering with evidence | Append-only schema; admins read, no one writes to existing rows |
| TFA enforced on web login but bypassed by API token | Compromised token = full account access without 2FA | Decide: either disallow tokens entirely or require token rotation + revocation UI |
| WebSocket auth-check only on connect | A long-lived connection can keep streaming after role change | Re-check authorization on every push event |
| CSRF token confusion (using API token + CSRF together) | False sense of security; tokens bypass CSRF | Document clearly: API tokens skip CSRF (by design); cookie sessions require CSRF |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Operation failed" with no detail | User has to ask an admin every time | Surface upstream error; redact only host-internal details |
| Destructive button next to safe action | Accidental deletion | Move destructive actions to a "Danger zone" section; require typed confirmation |
| No undo on delete | Permanent data loss for a misclick | 24h soft-delete trash for VMs |
| Stale state after action | User thinks the GUI is broken | Optimistic update + fast polling immediately after action |
| Loading spinner with no progress | User refreshes / cancels | Show the UPID, task type, and elapsed time; explain "this can take ~5 minutes for a clone" |
| Modal that disappears mid-action | User loses the form data they typed | Persist wizard state in URL or localStorage |
| Quota errors that don't explain *why* the quota is exceeded | User retries, gets the same error | "You're at 12/16 GB RAM. This VM needs 8 GB. Free 4 GB by stopping or resizing." |
| Cluster picker that shows clusters the user has no access to | Confusion | Filter the cluster picker by tenant access |
| Console iframe with no escape (fullscreen-only) | Lost user, can't navigate back | Keep the GUI chrome around the iframe; offer a "Pop out" button instead |
| No way to copy text into the noVNC console | Users type long URLs by hand | Document the noVNC clipboard limitations; consider a "send text" overlay for short inputs |

---

## "Looks Done But Isn't" Checklist

- [ ] **VM provisioning:** Often missing UPID-on-restart resume — verify a deploy mid-create completes after restart
- [ ] **Multi-tenancy:** Often missing tenant_id on websocket pushes — verify by impersonating another tenant and checking your event stream
- [ ] **Quotas:** Often missing snapshot/backup disk in the math — verify quota counts after taking 3 snapshots of a 10 GB VM
- [ ] **Cloud-init editor:** Often missing snippet regeneration after edit — verify by editing snippet, starting VM, confirming new config applied
- [ ] **noVNC console:** Often missing ticket renewal on slow click — verify with a 60-second pause between "Open Console" and clicking the console area
- [ ] **SDN VNet pick:** Often missing per-node-applied status — verify by picking a VNet that's pending on the target node
- [ ] **Helper-script integration:** Often missing pinning — verify by reviewing the git ref of every script in the catalog
- [ ] **Multi-cluster storage:** Often missing namespacing — verify by adding two clusters with a shared storage name and picking each
- [ ] **Audit log:** Often missing tenant column — verify by filtering audit log by tenant
- [ ] **Quota reconciliation:** Often missing drift detection — verify by deleting a VM via Proxmox UI directly and seeing if app quotas update
- [ ] **Backup of GUI state:** Often missing entirely — verify a config-restore flow exists end-to-end
- [ ] **Migration:** Often missing snippet pre-flight — verify by migrating a VM that has cloud-init snippet on `local`
- [ ] **API token revocation:** Often missing UI — verify there is an admin "revoke" button, not just creation
- [ ] **Read-only cluster banner:** Often missing — verify by stopping a cluster's network and checking the UI surfaces this clearly
- [ ] **Long-running task survives deploy:** Often missing — verify by deploying mid-clone and checking the operation completes

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| VMID collision created two VMs | MEDIUM | Identify duplicate via DB scan; preserve the user's intended VM, delete the other; restore quotas |
| Lost UPID after restart | LOW | Reconcile sweep on startup; check Proxmox task log; mark stale rows as `status=unknown` and prompt admin |
| Tenant data leak via list endpoint | HIGH | Audit logs to identify scope; rotate any exposed VMID-derived secrets; disclose per applicable policy |
| Quota overshoot | LOW | Allow the over-quota state; block new creates; offer a "right-size" guided flow |
| Cloud-init snippet missing on migrated node | LOW | Detect on VM start failure; copy snippet to target; restart |
| Stale vncticket | LOW | Auto-retry once with a fresh ticket; if still failing, prompt manual reconnect |
| SDN config stuck in pending | MEDIUM | Force reload; if node out of quorum, surface the underlying cluster issue |
| Helper-script supply-chain compromise | HIGH | Disable affected scripts; rollback to last known good commit; audit all LXCs created with affected scripts |
| GUI state DB loss | HIGH | Restore from the self-backup (if configured); re-import VM↔tenant mappings from Proxmox pools |
| API ticket revoked mid-session | LOW | Detect 401; re-auth; retry; if persists, log user out cleanly |
| Long-running task orphaned | LOW | Reconcile on startup; user can resume / cancel from a "Pending operations" admin page |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| VMID race | First provisioning phase | Concurrent create load test (10 users, simultaneous click) |
| UPID polling race | Foundational API client phase | Unit test for "task returns 'stopped' on first poll" |
| vncticket expiry | Console phase | Manual test: open console, wait 60s, click |
| Cloud-init snippet storage | Cloud-init editor phase | Pre-flight check on snippet save; integration test on cluster |
| Multi-tenant ACL leaks | Tenancy phase (Phase 2) | Cross-tenant access test in CI for every list endpoint |
| Quota TOCTOU | Quota phase | Two-tab race test in e2e suite |
| Cluster vs node endpoint | API client phase | Test with one cluster node down; verify operations still succeed |
| SDN pending state | SDN integration phase | Integration test: create VNet → attach → start VM, verify reload was called |
| Ticket 2h expiry | Auth phase | Backend uses tokens by policy; assert in CI no ticket-based call from a non-user-session code path |
| Helper-script trust | Community-scripts integration phase | Repo pinned to commit; every PR requires a "scripts reviewed up to commit X" stamp |
| Storage cross-cluster collision | Multi-cluster phase | Add two clusters with same storage names in test; verify selector shows cluster-scoped |
| Long-running task lost on restart | First async operation phase | Kill-and-restart integration test during clone |
| vzdump output parsing | Backup phase | Test against PVE 7.x, 8.x, 9.x sample task logs |
| DNS in DHCP cloud-init | Cloud-init editor phase | UI test: select DHCP, see DNS field greyed |
| TFA bypass via token | Auth phase | Policy decision documented in ADR; if tokens allowed, rotation UI exists |
| Storage content-type mismatch | Provisioning UI phase | Dropdown filter test for each content type |
| `skiplock` root-only | Lifecycle phase | "VM is locked" error path test |
| Cluster quorum read-only | Multi-cluster resilience phase | Simulate quorum loss; verify banner + write-block |
| Unprivileged LXC limits | Deployment phase | Install + smoke-test in unprivileged LXC with default features |
| Migration snippet pin | Migration phase | Migration pre-flight test with node-local snippet |
| Audit log growth | Admin phase | Retention job exists; test at 100k+ rows |
| GUI backup of own state | Operational hardening phase | End-to-end restore test from clean container |
| Stale UI after action | UI/UX foundation | Manual flow review; optimistic update pattern in shared component |
| "Operation failed" no detail | UI/UX foundation | Error toast component requires `details` prop |
| Destructive one-click | UI/UX foundation | Lint rule: destructive actions must use `<ConfirmedAction>` component |

---

## Sources

### Official Proxmox documentation
- [Proxmox VE API wiki](https://pve.proxmox.com/wiki/Proxmox_VE_API) — verified HIGH
- [Cloud-Init Support wiki](https://pve.proxmox.com/wiki/Cloud-Init_Support) — verified HIGH
- [Cloud-Init FAQ wiki](https://pve.proxmox.com/wiki/Cloud-Init_FAQ) — verified HIGH
- [User Management wiki (ACL/pools/tokens)](https://pve.proxmox.com/wiki/User_Management) — verified HIGH
- [Unprivileged LXC containers wiki](https://pve.proxmox.com/wiki/Unprivileged_LXC_containers) — verified HIGH
- [Cluster Manager wiki](https://pve.proxmox.com/wiki/Cluster_Manager) — verified HIGH
- [Storage configuration wiki](https://pve.proxmox.com/wiki/Storage) — verified HIGH
- [pveum(1) man page](https://pve.proxmox.com/pve-docs/pveum.1.html) — verified HIGH
- [API Tokens documentation](https://pve.proxmox.com/pve-docs/pveum-plain.html) — verified HIGH

### Community / forum (verified across multiple threads — MEDIUM confidence)
- [VMID race condition discussion](https://forum.proxmox.com/threads/is-there-an-atomic-way-to-get-the-next-free-vm_id-and-reserve-it.123984/)
- [Race conditions for mass VM creation](https://forum.proxmox.com/threads/race-conditions-for-mass-vm-creation.76839/)
- [pve-devel: VMID nextid reservation patch discussion](https://pve-devel.pve.proxmox.narkive.com/cZfHlDSj/fix-bug-889-and-allow-automatic-vmid-selection-on-create)
- [Catching task UPID](https://forum.proxmox.com/threads/catching-task-upid.28481/)
- [UPID parse failure](https://forum.proxmox.com/threads/proxmox-7-unable-to-parse-worker-upid.122748/)
- [Invalid PVEVNC ticket](https://forum.proxmox.com/threads/401permission-denied-invalid-pvevnc-ticket.110961/)
- [noVNC over API: cookies vs tickets](https://forum.proxmox.com/threads/novnc-over-api-pveauthcookie-pve-ticket-and-tunnel-auth-vnc-ticket-how.129091/)
- [Nginx reverse proxy noVNC + WebSocket headers](https://forum.proxmox.com/threads/nginx-reverse-proxy-proxmox-web-ui-cant-access-novnc-and-shell-consoles-2023.130476/)
- [Cloud-init snippet user data location](https://forum.proxmox.com/threads/cloud-init-snippet-user-data.76862/)
- [Cloud-init subdirectory limitation gist](https://gist.github.com/aw/ce460c2100163c38734a83e09ac0439a)
- [SDN apply pending](https://forum.proxmox.com/threads/sdn-apply-remains-pending.152551/)
- [SDN API availability across nodes](https://forum.proxmox.com/threads/api-problems-sdn-availability.153978/)
- [SDN nodes out of sync](https://forum.proxmox.com/threads/sdn-nodes-out-of-sync.111566/)
- [Permissions.Modify pool propagation regression in PVE 8](https://forum.proxmox.com/threads/privilege-permissions-modify-on-pool-will-not-propagade-to-contained-vms-anymore.151032/)
- [Multi-tenant configuration discussion](https://forum.proxmox.com/threads/multi-tenant.173244/)
- [Extend API token lifetime](https://forum.proxmox.com/threads/extend-api-token-lifetime.63320/)
- [Ticket renewal pattern](https://forum.proxmox.com/threads/api-how-to-get-new-ticket.19034/)
- [`skiplock` is root-only](https://forum.proxmox.com/threads/proxmox-ve-uses-token-based-authentication-not-support-option-skiplock-only-root-may-use.111633/)
- [Cluster quorum API behavior under split-brain](https://cr0x.net/en/proxmox-restore-quorum-safely/)
- [vzdump status via API](https://forum.proxmox.com/threads/api-for-backup-checking.102422/)
- [Cloud-init DNS not applied for DHCP](https://forum.proxmox.com/threads/ubuntu-cloud-init-setting-dns-not-working.111574/)
- [Proxmox 9 + Debian 13 cloud-init DNS regression](https://forum.proxmox.com/threads/proxmox-9-cloud-init-and-debian-13-trixie-fails-to-set-dns.170804/)

### Community scripts security
- [community-scripts/ProxmoxVE (current home)](https://github.com/community-scripts/ProxmoxVE) — verified HIGH
- [tteck/Proxmox (original, archived)](https://github.com/tteck/Proxmox) — verified HIGH
- [XDA: "I love Proxmox community scripts, but a single command executes 8 remote scripts as root"](https://www.xda-developers.com/love-proxmox-community-scripts-one-commands-scripts-root/) — MEDIUM
- [Proxmox forum: how safe are the Updatable PVE Helper-Scripts](https://forum.proxmox.com/threads/how-safe-are-the-updatable-pve-helper-scripts.174400/) — MEDIUM

### Library implementations (verified MEDIUM — useful for "how does it work in practice")
- [Proxmoxer task polling examples](https://proxmoxer.github.io/docs/2.0/examples/tasks/)
- [Proxmoxer authentication / ticket renewal](https://proxmoxer.github.io/docs/latest/authentication/)
- [go-proxmox task management](https://deepwiki.com/luthermonson/go-proxmox/9-task-management)
- [Telmate terraform-provider-proxmox VMID race issue #23](https://github.com/Telmate/terraform-provider-proxmox/issues/23)
- [hashicorp packer-plugin-proxmox VMID race issue #42](https://github.com/hashicorp/packer-plugin-proxmox/issues/42)

---
*Pitfalls research for: self-service Proxmox VE GUI*
*Researched: 2026-05-14*
