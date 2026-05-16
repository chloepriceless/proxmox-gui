# Phase 3: Job Queue & Lifecycle - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers two interlocking things:

1. **The job-queue infrastructure** — an `arq` worker (embedded Redis), durable
   UPID polling, an orphan reaper on boot, `202 Accepted` + job-id on every
   mutating endpoint, and a WebSocket-streamed Tasks drawer for live progress.
2. **Every lifecycle operation on _existing_ VMs/LXCs** — power (start / stop /
   reboot / shutdown / delete, bulk), snapshots (create / restore / delete +
   tree), backups (manual + scheduled, vzdump or PBS, retention, restore),
   resize (CPU / RAM / disk-grow), clone (linked / full) + convert-to-template,
   and migrate (live / offline) — each surfacing human-readable errors.

Success-criteria anchors (from ROADMAP.md):
1. Power actions incl. destructive Delete (typed-name confirm) + Force-Stop
   (OK/Cancel) + bulk Start/Stop/Reboot (bulk Delete excluded).
2. Snapshots (create/restore/delete + tree), backups (manual + scheduled,
   vzdump/PBS, retention), restore from backup.
3. Resize CPU/RAM (reboot-required warnings), grow disk online (shrink
   blocked + explained), clone (linked/full to any node), convert to template,
   migrate (live/offline, visible bwlimit).
4. Every mutation → 202 + job id; Tasks drawer shows live WebSocket progress;
   failed tasks expose stderr + one-click retry where safe; app restart
   mid-task does not lose the operation (orphan reaper re-attaches on boot).
5. Failed PVE operations show human-readable explanations, not raw
   "operation failed".

**What this phase does NOT deliver:**
- VM/LXC **creation** / provisioning wizards, Cloud-Init editor — Phase 4
- noVNC console (the Console tab stays disabled) — Phase 4
- SDN / networking pickers — Phase 4
- In-app notification bell (UI-07) — Phase 4
- Idle timeout, audit retention/rotation, self-update, mobile audit — Phase 5

</domain>

<decisions>
## Implementation Decisions

### Tasks Drawer & Live Progress

- **D-01:** **Tasks drawer scope = team-wide.** The drawer shows all jobs across
  every team the user belongs to, with no per-user filter toggle. Teams share
  resources, so a teammate's action on a shared VM must be visible. (Admins
  remain scoped to their own team memberships — the "admin = team-scoped vs.
  all-resources overview" question from the Phase 2 02-07 SUMMARY is still open
  and is NOT resolved here.)
- **D-02:** **Drawer auto-open = long jobs only.** The drawer auto-opens for
  clone / migrate / backup / restore. Fast power actions (start / stop / reboot
  / shutdown) leave it collapsed with a live count badge on the Tasks icon; the
  enqueue toast confirms those.
- **D-03:** **Completion notification = toast on every finish.** Both success
  and failure raise a toast via the existing sonner Toaster. (UI-07 bell is
  Phase 4 — Phase 3 relies on toasts + the drawer.)
- **D-04:** **Progress display = status + elapsed.** Spinner, task-type label,
  elapsed timer, the UPID. No attempt to parse a percentage from the PVE task
  log (Pitfall 13 — log formats are unstable across PVE versions). For backup
  jobs, surface structured `INFO:` lines from the task log when present.

### Snapshots & Backups

- **D-05:** **Snapshot display = tree view.** The Snapshots tab renders the
  snapshot hierarchy as an indented tree with branch visualization and a
  "current" marker — matching Proxmox's own snapshot panel. Fills the disabled
  Snapshots tab placeholder from Phase 2 (D-18).
- **D-06:** **Backup surfaces = both per-VM and global.** Each VM/LXC detail
  page gets a **Backups tab** (that resource's backup files, "Backup now", its
  schedule). A dedicated global **`/backups` page** gives a cross-VM overview
  of scheduled backup jobs and retention.
- **D-07:** **Restore-from-backup = ask each time.** The restore dialog lets the
  user choose **in-place overwrite** vs. **restore into a new VMID**; the dialog
  defaults to in-place. In-place restore is a data-loss op → typed-name confirm
  (see D-10). Restore-as-new allocates a new VMID and counts against quota.
- **D-08:** **Backup target = admin-preset per cluster.** An admin designates
  the backup-capable storage per cluster (a new admin config surface — see
  Integration Points). The user does **not** pick the storage; the user only
  chooses **retention**. Retention granularity for v1 = simple "keep last N"
  (PVE full prune keep-daily/weekly/monthly is deferred — see Deferred Ideas).

### Action Controls & Confirmations

- **D-09:** **Action button placement = detail toolbar + list menu.** The
  VM/LXC detail page carries a full lifecycle action toolbar; inventory list
  rows carry a compact "⋯" menu for quick power actions.
- **D-10:** **Destructive confirmation = typed-name for every data-loss op.**
  Delete, restore-snapshot, and in-place restore-from-backup all require
  typed-name confirmation (reuse `ConfirmByNameDialog` from Plan 01-08).
  Force-Stop uses OK/Cancel (ROADMAP-locked). Reboot and graceful Shutdown use
  a lighter OK/Cancel dialog.
- **D-11:** **Bulk actions = one job per VM, grouped.** Bulk Start/Stop/Reboot
  from the inventory list fan out into one `Job` row per VM; the Tasks drawer
  groups them under a batch header ("Bulk reboot ×5"). A single confirm dialog
  covers the whole batch. Bulk Delete remains excluded (ROADMAP-locked).
- **D-12:** **Resize & migrate forms = simple + Advanced disclosure.** Resize
  shows core CPU/RAM/disk fields with inline reboot-required warnings (driven
  by hotplug state); disk-grow is online-only, shrink is blocked with an
  explanatory message. Migrate shows target-node + a one-line summary; the
  bwlimit control and explicit live/offline selection live behind an "Advanced"
  disclosure. bwlimit stays visible (success-criteria requirement) — it is in
  Advanced, not hidden.

### Errors & Retry

- **D-13:** **Error mapping = curated table + raw fallback.** A maintained map
  of common PVE error patterns → friendly text + suggested fix (canonical
  example: "VM is locked — unlock from detail page"). Unrecognized errors fall
  back to the raw PVE message — errors are never swallowed (Pitfall 24).
- **D-14:** **Technical detail = expandable "Show details".** The friendly
  message shows first; a collapsible "Show technical details" reveals raw
  stderr + UPID + task log. The `Job` row always retains the full detail.
- **D-15:** **Redaction = none.** All users see the full raw technical detail
  in "Show details" — no admin/non-admin redaction. Keeps self-service friction
  low for a small-team home-lab tool; node/storage names are already visible in
  inventory. This is a conscious deviation from Pitfall 24's redaction advice,
  accepted for this audience.
- **D-16:** **Retry = idempotent ops only.** A one-click retry button appears
  only on safely-repeatable failed jobs (start, stop, reboot, shutdown,
  snapshot-delete, resize, backup), keyed off `jobs.idempotency_key`.
  Non-idempotent ops (clone, migrate, delete, restore) show no retry button —
  the user re-issues from the form.

### Claude's Discretion

- **In-app "Unlock" affordance for locked VMs** — D-13's curated map includes a
  locked-VM entry. Whether the GUI can offer a working Unlock button depends on
  privsep-token permissions (`skiplock` is root-only — Pitfall 17; plain
  unlock may or may not be reachable by the per-tenant token). Researcher
  confirms; if not reachable, the message guides the user to unlock in Proxmox.
- **Clone wizard** — VMID auto-allocated via `/cluster/nextid` with app-level
  reservation (Pitfall 1) and user-overridable; clone name; linked vs. full;
  target node/storage.
- **Snapshot options** — include-RAM-state toggle, snapshot name/description.
- **WebSocket reconnection / backfill** for the Tasks drawer after a dropped
  connection.
- **arq concurrency + UPID poll cadence** — tight cadence for the first ~10s,
  exponential backoff, cap ~30s (ARCHITECTURE.md / Pitfalls performance table).
- **Orphan-reaper admin surface** for `needs_review` jobs.
- **Embedded Redis provisioning** in the LXC (4th systemd unit vs. bundled).

### Folded Todos

None — the todos directory is empty (`todo.match-phase 3` returned 0 matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 scope & success criteria
- `.planning/ROADMAP.md` §"Phase 3: Job Queue & Lifecycle" — goal, 5 success
  criteria, locked technical notes (arq + embedded Redis, first-status
  authoritative, persist-UPID-before-call, migration snippet pre-flight,
  `skiplock` not exposed)
- `.planning/REQUIREMENTS.md` — LIFE-01..14, API-04, UI-06 (the 16 requirements
  this phase ships)
- `CLAUDE.md` — Proxmox-specific constraints (every mutation → 202 + worker
  poll; persist UPID before polling), tech-stack lock, GSD workflow rules

### Architecture & the job-queue pattern
- `.planning/research/ARCHITECTURE.md` §"Pattern 2: Job Queue + UPID Polling"
  and §"Pattern 3: Orphan Reaper" — the central job lifecycle, 202 + worker
  poll, boot-time reattach
- `.planning/research/STACK.md` — arq + embedded Redis rationale, proxmoxer
  2.3.x
- `.planning/research/SUMMARY.md` — cross-cutting research; power actions as the
  first op that exercises the full pipeline

### Pitfalls (Phase 3-relevant)
- `.planning/research/PITFALLS.md` §Pitfall 1 — VMID race (clone allocates a new
  VMID → app-level reservation/lock)
- §Pitfall 2 — UPID polling race (treat the first status response as
  authoritative)
- §Pitfall 12 — task state lost on restart (persist UPID before the PVE call;
  orphan reaper resumes on boot)
- §Pitfall 13 — vzdump output parsing fragility (use `exitstatus`, not log
  scraping → D-04)
- §Pitfall 17 — `skiplock` is root-only (not exposed in UI; locked VM gets a
  clean curated error → D-13)
- §Pitfall 18 — cluster quorum loss makes writes inconsistent (pre-flight
  quorum check before enqueueing a write)
- §Pitfall 20 — migration breaks node-local snippet references (migration
  pre-flight refuses; the hook lives in Phase 3 even though snippets are
  written in Phase 4)
- §Pitfall 23 / §Pitfall 25 — stale UI after action / destructive one-click
  (optimistic update + fast poll; typed-name confirm → D-10)
- §Pitfall 24 — "operation failed" with no detail (curated map + raw fallback
  → D-13/D-14; redaction explicitly declined in D-15)

### Prior-phase locked decisions (carry forward — do NOT re-decide)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01/D-03 per-tenant
  privilege-separated PVE tokens (runtime lifecycle calls execute as the team
  token, never the bootstrap admin token); D-17 three systemd units, worker
  unit ships disabled
- `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md` —
  D-18 VM detail tab layout (`Overview | Activity | Console | Snapshots`),
  D-20 power actions are audited, D-13/D-15 PVE-as-source-of-truth,
  circuit-breaker + 30s stale-cache connector pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/models/job.py` — the `jobs` table schema is **already shipped**
  (Plan 01-02): `idempotency_key` (unique), `upid`, `upid_node`, and the
  `pending → claimed → running → succeeded/failed/orphaned/needs_review` state
  machine. Phase 3 adds the worker + HTTP enqueue path, not the schema.
- `backend/app/clusters/connector.py` + `registry.py` — `PVEConnector` wraps
  proxmoxer with `asyncio.to_thread`, a `pybreaker` circuit breaker, and a 30s
  resource cache. Phase 3 extends it with mutating lifecycle calls and
  `/nodes/{node}/tasks/{upid}/status` polling.
- `backend/app/proxmox/client.py` — thin proxmox-client placeholder.
- `backend/app/audit/` — FLUSH-not-COMMIT audit writer; every lifecycle
  mutation writes an audit row (Phase 2 D-20).
- `frontend/src/lib/components/ConfirmByNameDialog.svelte` — typed-name confirm
  (Plan 01-08) → Delete, restore-snapshot, in-place restore (D-10).
- `frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte` — VM detail page
  with a disabled Snapshots tab placeholder; Phase 3 fills Snapshots, adds the
  Backups tab, and mounts the action toolbar.
- sonner Toaster (mounted in AppShell) — job-completion toasts (D-03).
- `team_cluster_tokens` per-tenant PVE tokens — lifecycle calls execute as the
  team token; Proxmox enforces ACLs natively.

### Established Patterns
- URL shape `/api/v1/clusters/{cluster_id}/...` — lifecycle endpoints follow
  (`/vms/{vmid}/power`, `/snapshots`, `/backup`, …).
- Every mutating endpoint enqueues a `Job`, returns `202 Accepted` + job id,
  and never blocks the request on a UPID poll (CLAUDE.md constraint).
- Service-layer commits before raising `HTTPException` (Plan 01-05).
- Defense-in-depth auth gates: layout + page + service.
- Hand-written, explicitly-named Alembic migrations.
- `asyncio.to_thread` for all proxmoxer I/O (Pitfall A3).

### Integration Points
- **Backend new modules:** `backend/app/jobs/` (arq worker, enqueue helper,
  UPID poll loop, orphan reaper) and `backend/app/lifecycle/` (power / snapshot
  / backup / resize / clone / migrate routes + services). A WebSocket endpoint
  feeds the Tasks drawer live stream.
- **Migration:** the `jobs` table exists; a batch-id column (for D-11 grouping)
  or new indices may be needed — planner decides.
- **Worker systemd unit:** `deploy/systemd/proxmox-gui-worker.service` is a
  `sleep infinity` placeholder; Phase 3 wires `arq app.worker.WorkerSettings`
  and enables the unit. Embedded Redis must be provisioned in the LXC
  (bootstrap.sh + a Redis systemd unit, or bundled — researcher/planner decides).
- **New admin config:** per-cluster backup-storage designation (D-08) — likely
  on the `/admin/clusters/{id}` page.
- **Frontend new:** Tasks drawer component + WebSocket client; global
  `/backups` page; Snapshots tab; Backups tab; action toolbar; bulk-select bar;
  resize / migrate / clone dialogs; error-detail component. New API modules
  `api/jobs.ts`, `api/lifecycle.ts`.

</code_context>

<specifics>
## Specific Ideas

- "VM is locked — unlock from detail page" is the canonical example of a good
  UI-06 error message (from the ROADMAP success criteria) — it sets the
  friendly-error tone target for the curated map (D-13).
- Power actions are intentionally built **first** — they exercise the full
  enqueue → worker → UPID-poll → WebSocket pipeline end-to-end before the more
  complex ops (clone, migrate, backup) are layered on (research SUMMARY.md).
- The Tasks drawer is Hetzner-style: a persistent, accessible activity feed —
  consistent with the Phase 2 Hetzner-style quota indicator.
- "Crash-safe" is a first-class promise: an app restart mid-task must neither
  lose nor duplicate the operation — the orphan reaper re-attaches on boot
  (success criterion 4). Verify with a kill-and-restart test during a clone.

</specifics>

<deferred>
## Deferred Ideas

- **Full PVE prune retention** (keep-daily/weekly/monthly/yearly) — v1 ships
  simple "keep last N"; full prune is a later enhancement.
- **Admin "all-resources" overview** vs. team-scoped admin — open design
  question carried from the Phase 2 02-07 SUMMARY. D-01's team-wide Tasks
  drawer inherits the same scoping; not resolved here.
- **UI-07 in-app notification bell** — Phase 4.
- **noVNC console (Console tab)** — Phase 4.
- **Audit log retention / rotation** (Pitfall 21, AUDIT-06) — Phase 5.
- **Quota reconciliation / drift detection sweep** (Pitfall 6 follow-up) — not
  Phase 3 scope; quota admission control already landed in Phase 2.
- **Pitfall-8 personal-team-token bootstrap gap** (personal teams created
  after a cluster is registered get no token) — Phase 1 / Plan 01-06 follow-up,
  tracked in HANDOFF.md.

### Reviewed Todos (not folded)

None — the todos directory is empty.

</deferred>

---

*Phase: 03-job-queue-lifecycle*
*Context gathered: 2026-05-16*
