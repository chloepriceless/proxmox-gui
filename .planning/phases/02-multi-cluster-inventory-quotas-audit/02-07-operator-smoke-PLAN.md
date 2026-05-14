---
phase: 02-multi-cluster-inventory-quotas-audit
plan: 07
type: execute
wave: 4
depends_on: [05, 06]
files_modified: []
autonomous: false
requirements:
  - INV-01
  - INV-02
  - INV-03
  - INV-04
  - INV-05
  - INV-06
  - INV-07
  - INV-08
  - TENT-01
  - TENT-02
  - TENT-03
  - TENT-04
  - TENT-05
  - TENT-06
  - CLUST-02
  - CLUST-03
  - CLUST-04
  - AUDIT-01
  - AUDIT-02
  - AUDIT-03
  - AUDIT-04
  - AUDIT-05
  - API-05
user_setup: []

must_haves:
  truths:
    - "Phase 2 end-to-end works against a real PVE 8.x cluster: list, detail with RRD, tags add/remove, notes edit, quotas display + admin edit + lower-anyway, audit CSV export with BOM, cluster-unreachable degradation."
    - "Operator manually exercises every UI surface defined in UI-SPEC §Surface Inventory."
    - "Plan 02-03 Assumption A2 (PVE config.put for tags/description returns synchronously, no UPID) is empirically confirmed against the test cluster."
    - "Plan 02-01 Pitfall 8 (personal-team-token availability after Phase 1 auto-bootstrap) is empirically confirmed."
  artifacts: []
  key_links: []
---

<objective>
Operator smoke-test of the full Phase 2 stack against a real PVE 8.x cluster. This checkpoint validates that the read-layer + RBAC + audit + quota surfaces behave correctly end-to-end — not just in mocked unit tests.

Purpose: every Phase 1 plan closed with an operator smoke checkpoint (Plan 01-10). Phase 2 has substantially more surface area (cross-tenant safety, breaker behavior, audit volume) — the operator smoke is the only place these compose. Specifically validates the two unmocked assumptions: A2 (PVE config.put has no UPID for tags/description) and A1+Pitfall 8 (personal-team-tokens exist after Phase 1).
</objective>

<execution_context>
@/mnt/claude-config/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-CONTEXT.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-UI-SPEC.md
@.planning/phases/02-multi-cluster-inventory-quotas-audit/02-RESEARCH.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Boot Phase 2 stack and verify install + first-page render</name>
  <what-built>
    Plans 02-01..02-06 shipped: extended PVEConnector with cache + breaker + per-team-token resolution + health probe; Alembic migration 0003_phase2; audit writer + reader + CSV stream + routes; inventory backend (list/detail/RRD + tag/notes); quotas backend (CRUD + admission + /me/quotas + /quotas/preview); frontend inventory list + detail + activity; audit page + CsvExportButton; QuotaIndicator + QuotaTab; sidebar Resources nav.
  </what-built>
  <how-to-verify>
    1. From the repo root: `cd backend && uv sync && uv run alembic upgrade head` — should end at revision 0003_phase2 without errors.
    2. `cd backend && uv run pytest -x` — full suite must pass (Phase 1 + Plans 02-01..02-04 backend tests).
    3. `cd frontend && pnpm install && pnpm run check && pnpm run build` — must complete without errors.
    4. Boot the stack: `cd backend && uv run uvicorn app.main:app --reload --port 8000` (in one terminal) and `cd frontend && pnpm run dev` (in another).
    5. Open http://localhost:5173 (or the dev URL); log in with the admin account from Phase 1.
    6. Confirm: Sidebar shows "Resources" section with "Inventory" + "Audit log" links above "Account". Topbar shows the ClusterContextPicker (defaults to "All clusters") and the QuotaIndicator block (`CPU --/--·RAM --/--` or seeded values).
    7. Expected backend log shows: `health probe started for cluster N` for every registered cluster.
  </how-to-verify>
  <resume-signal>Type "approved" — or describe what failed and at which step.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify inventory list, filter chips, cluster picker, detail page with RRD sparklines, tags + notes round-trip</name>
  <what-built>
    /inventory list (flat-when-1-cluster vs Accordion-Sections), FilterChips URL state, ClusterContextPicker localStorage persistence, VM/LXC detail tabbed page with Specs+Network+Metrics+Tags+Notes cards.
  </what-built>
  <how-to-verify>
    1. Navigate /inventory. With 1 cluster registered (Phase 1): list is flat (no Accordion header). Register a SECOND cluster via /admin/clusters (Phase 1 surface) — verify /inventory automatically switches to Accordion-grouped Sections.
    2. Apply filters by typing into the search box ("search:" chip appears); clicking a TagPill in a row adds a "tag:" chip; the URL updates with `?q=…&tag=…`. Hit browser back — filters revert. Hit forward — filters return. Confirm shareable URL: open in a new tab, same filtered view loads.
    3. Sort dropdown: change to "Name A→Z" — list re-orders; refresh the page — list resets to "Status (default)" (D-05: NOT persisted).
    4. ClusterContextPicker: select "Cluster-B" — Inventory page automatically gets `?cluster=2` chip; localStorage `proxmox-gui:cluster-context` shows the cluster id (DevTools → Application → Local Storage).
    5. Click a running VM row → /inventory/{cluster}/{vmid} loads.
    6. Detail page: Overview tab shows Specs card (vCPU, RAM, Disk) + Network card (net0/net1 from PVE config) + Metrics card with 4 sparklines (CPU/RAM/Disk I/O/Network — non-empty for a running VM, "No data" for a stopped one) + Tags card + Notes card.
    7. Tags: click "+ Add tag", type "smoketest", press Enter — TagPill appears IMMEDIATELY (optimistic), then list invalidates and the tag persists. Verify in PVE WebUI that the VM's `tags` property now includes "smoketest". Remove the tag by clicking its × — assert it disappears and PVE no longer has it.
    8. Notes: click "+ Add notes" → textarea opens; type `# Hello\nThis is **markdown**.\n\n- list\n- works.` → click "Save notes" → render-mode shows rendered HTML. Verify in PVE WebUI that the VM's `description` matches the raw markdown source.
    9. **Critical XSS check:** edit notes again, paste `<script>alert(1)</script><iframe src="x"></iframe>` → Save → assert no alert fires AND the rendered output has neither `<script>` nor `<iframe>` tags (DevTools → Elements).
    10. Tabs: switch to "Activity" tab — AuditTable loads with the locked cluster_id+vmid filters; FilterChips at the top of the activity table show locked Lock icons (no remove button). Click "View in global audit log →" — navigates to /audit with same filters as removable chips.
    11. Hover the Snapshots tab — tooltip "Snapshots ship in Phase 3"; same for Console.
  </how-to-verify>
  <resume-signal>Type "approved" — or list which steps failed with the exact symptom.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify audit log page, filters, CSV export with BOM + injection-safety; degraded-cluster behavior</name>
  <what-built>
    /audit page; AuditTable with row-expand diff; CsvExportButton with disabled-when-too-large; cluster-unreachable banner + stale rows.
  </what-built>
  <how-to-verify>
    1. Navigate /audit. As admin, see all entries from Plans 02-03..02-06 actions (vm.tag.update, vm.notes.update, etc.). As a non-admin (log out, log in as a non-admin team member): see only own + (with Show team actions toggled on) team rows.
    2. Filter by Action="vm.tag.update" via the Action dropdown → only tag mutations remain; FilterChip "action: vm.tag.update" appears; URL has `?action=vm.tag.update`.
    3. Filter by Date range → "Last 24 hours"; from + to fields populate; rows narrow.
    4. Click a row → row expands inline with two Cards "Before" and "After" showing JSON.stringify diff. For a vm.tag.update entry, Before shows `{ "tags": [...] }` and After the updated list.
    5. **CSV export:** click "Export filtered (N rows)" — a file `audit-YYYY-MM-DD.csv` downloads. Open in Excel — umlauts (if any) render correctly (BOM did its job). Open in a hex editor (`xxd export.csv | head -1`) — first 3 bytes are `ef bb bf`.
    6. **CSV injection check:** in the database (or via writing a /api/v1/clusters/{id}/vms/{vmid}/notes call), insert an audit row whose `target_id` or `error` field starts with `=cmd|/c calc"`. Re-export the CSV — open the file — the cell should be `'=cmd|/c calc"` (leading single quote). Excel must NOT prompt to enable formulas / external content.
    7. **50000-row cap:** if there's a way to seed > 50000 rows (or temporarily monkey-patch HARD_EXPORT_LIMIT to a low number like 10), confirm: when row count exceeds the cap, the Export button is disabled and the tooltip says "Refine your filter — exports are capped at 50000 rows.".
    8. **Cluster-unreachable:** in a new terminal, `iptables -A OUTPUT -p tcp --dport 8006 -j DROP` (or stop the PVE node, or block on Proxmox firewall). Wait ~45 seconds (3 failures × 15s probe interval). Refresh /inventory — the affected cluster Section shows a red "Cluster X unreachable" Alert banner; rows show `Stale` badge; the ClusterStatusPill shows "stale" state. Other clusters still work.
    9. **Recovery:** un-block; within 30-45 seconds, refresh /inventory — the banner clears, rows lose Stale badge, ClusterStatusPill returns to "ok".
  </how-to-verify>
  <resume-signal>Type "approved" — or describe the audit/CSV/degradation symptom.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Verify QuotaIndicator + QuotaTab admin flow including D-12 lower-anyway dialog</name>
  <what-built>
    Topbar QuotaIndicator with Sheet drawer; /admin/teams/{id} Quotas tab with per-cluster grid + aggregate footer + lower-anyway dialog.
  </what-built>
  <how-to-verify>
    1. As admin, navigate /admin/teams/{some_shared_team_id} (NOT a personal team — D-11). Click the "Quotas" tab.
    2. Set per-cluster limits: e.g. Cluster-A cpu=16 ram_gb=64 disk_gb=500 vm_count=20; Cluster-B cpu=8 ram_gb=32 disk_gb=250 vm_count=10. Click "Save changes" → toast "Quotas updated." appears.
    3. Verify aggregate footer reads `24 vCPU · 96 GB · 750 GB · 30 VMs` (sum across clusters).
    4. Verify audit-log entry was written: GET /audit, filter action="quota.update" → 2 rows (one per cluster) with payload_before showing previous nulls + payload_after showing the new limits.
    5. Log out, log in as a non-admin member of that team. Topbar QuotaIndicator now shows the live aggregate `CPU 0/24 · RAM 0/96GB` (assuming no VMs yet). Click the indicator → Sheet drawer opens (right side, 400/480px); per-cluster Progress bars show 0% utilization.
    6. Provision (or seed) some VMs in the team's pool on Cluster-A to push CPU usage to ~13/16 (≈81%). Refresh /inventory or wait 30s. The QuotaIndicator turns **yellow**; a `toast.warning("Approaching quota: 80% on team …")` fires ONCE per browser session. Verify `sessionStorage["proxmox-gui:quota-toast-fired:warning:{team_id}"]` is set.
    7. Push usage to ~15/16 (≈94%) — block stays yellow (still <95%). Push to 16/16 (100%) — block turns **red**; `toast.error("Quota critical: 95% on team …. Creates will be blocked.")` fires once.
    8. **Lower-anyway flow (D-12):** as admin, return to /admin/teams/{id}#quotas. Lower Cluster-A cpu from 16 to 4 (below current usage of 16). Click "Save changes" → Dialog opens "Lower quota limit on {team_name}?" with body "Current usage 16 vCPU exceeds the new limit 4 vCPU. Saving will leave the team over-quota until usage drops. New creates will be blocked." → click "Cancel" → Dialog closes, no save. Click Save again, then "Lower limit anyway" → request succeeds; toast "Quotas updated."; verify in /audit a quota.update row was written with payload_after.cpu_cores=4.
    9. **Preview endpoint sanity check:** open a browser DevTools console on /inventory; run:
       ```js
       const resp = await fetch('/api/v1/quotas/preview', {
         method: 'POST',
         credentials: 'include',
         headers: {'Content-Type':'application/json','X-CSRF-Token': document.cookie.match(/csrf_token=([^;]+)/)[1]},
         body: JSON.stringify({team_id: <team_id>, cluster_id: <cluster_id>, requested_cpu: 10, requested_ram_bytes: 0, requested_disk_bytes: 0, requested_count: 1})
       });
       await resp.json();
       ```
       Expected: `{ would_exceed: true, dimensions: [{name:"cpu", current:16, requested:10, limit:4, headroom:0, would_exceed:true}, ...] }`.
    10. Clear sessionStorage keys via DevTools to confirm the toast fires again on the next session.
  </how-to-verify>
  <resume-signal>Type "approved" — or describe which quota flow failed.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Verify cross-tenant isolation, PAT auth equivalence, and Assumption-A2 confirmation</name>
  <what-built>
    require_resource_access RBAC + PAT/cookie auth equivalence + commit-confirmation that PVE config.put returns synchronously.
  </what-built>
  <how-to-verify>
    1. Create two non-admin users in different teams (TeamA, TeamB) via /admin/users. Provision (or seed) a VM in each team's pool.
    2. Log in as TeamA's user. /inventory shows ONLY TeamA's VMs. Direct URL `/inventory/{cluster_id}/{teamB_vmid}` → 404 page (not "you don't have access" — 02-03 must NOT leak existence).
    3. Direct API call `GET /api/v1/clusters/{cluster_id}/vms/{teamB_vmid}` with TeamA's cookie → 403 with body `{"detail": "No access to that resource"}`.
    4. Mint a PAT for TeamA's user (Phase 1 /profile/tokens). Repeat the API call with `Authorization: Bearer pat_…` (no cookie) — same 403. Now call `GET /api/v1/clusters/{cluster_id}/vms/{teamA_vmid}` with the PAT — 200 with VMDetail. Confirms API-05.
    5. **Assumption A2 confirmation (CRITICAL):** Time the PVE tag write: from DevTools Network tab, perform a tag add → backend logs / response time should be < 2s; PVE returns no UPID in the response. Confirm in PVE WebUI's "Tasks" panel that NO new UPID was created for the tag change. If A2 is wrong, document with the actual response body — this becomes a Plan 03 dependency.
    6. **Pitfall 8 verification:** create a new user via /admin/users (NO shared team membership — only auto-personal). Log in as them. /inventory should show 0 VMs (no shared team) but the page must NOT error. /me/quotas should return `{teams: [{team_id: <personal_id>, …}]}` — i.e., personal team has a team_cluster_tokens row on every cluster. If /inventory throws 500 OR /me/quotas omits the personal team, document it: this is a Plan 01-06 follow-up.
    7. Logout, login as admin. Ensure admin's /inventory shows BOTH TeamA + TeamB sections (admin has membership in both via Phase 1's admin-onboarding or via admin's own teams).
  </how-to-verify>
  <resume-signal>Type "approved" — or document the assumption(s) that failed (A2, Pitfall 8) for follow-up planning.</resume-signal>
</task>

</tasks>

<verification>
- Five checkpoints completed by the operator with "approved" or documented blockers.
- A2 (PVE config.put sync return) + Pitfall 8 (personal-team-token availability) confirmed or blocker-tracked.
- The full UI-SPEC §"Required loading/empty/error states" matrix exercised at least once.
</verification>

<success_criteria>
- Operator confirms every checkpoint or documents the specific failure that needs a gap-closure plan.
- Phase 2 RESEARCH.md Assumptions A1, A2, A5, A9 either confirmed or escalated.
- The product can be used by a non-admin team-member end-to-end against a real PVE 8.x cluster: log in → see VMs → tag/notes round-trip → quota visibility → cluster-down degrades cleanly.
</success_criteria>

<output>
After completion, create `.planning/phases/02-multi-cluster-inventory-quotas-audit/02-07-operator-smoke-SUMMARY.md`:
- Each of the 5 checkpoints with operator's pass/fail + any notes
- Assumption A2 confirmation (sync vs UPID for tags/description) — explicit "confirmed" or "needs Plan 03 rework"
- Pitfall 8 confirmation (personal-team-tokens exist) — explicit confirmation or "needs Plan 01-06 follow-up"
- Any new bugs surfaced for Plan 02-08+ gap-closure or for Phase 3+ backlog
- Recommendations for Phase 5 carryover (e.g. rate-limit /inventory/* per-Principal; storage/SDN refs not yet namespaced if discovered)
</output>
