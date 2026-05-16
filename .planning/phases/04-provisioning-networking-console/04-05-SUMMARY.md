---
phase: 04-provisioning-networking-console
plan: 05
subsystem: iso-library-cloudinit
tags: [iso, cloud-image, cloud-init, provisioning, ssrf, job-queue]
dependency_graph:
  requires:
    - "app.jobs.provisioning_functions.run_download + connector.download_url (Plan 04-04)"
    - "app.jobs.enqueue.enqueue_job (Plan 03-01)"
    - "app.clusters.connector.node_storages / storage_content content-filter shape (Phase 3)"
    - "app.lifecycle.schemas.JobAcceptedResponse (Phase 3)"
    - "app.ssh_keys.service.parse_ssh_pubkey (Phase 1)"
  provides:
    - "GET /api/v1/clusters/{id}/iso — content-filtered ISO library (VM-08)"
    - "GET /api/v1/clusters/{id}/iso/cloud-images — curated cloud-image list (D-15)"
    - "POST /api/v1/clusters/{id}/iso/download — 202 storage.download job (D-17, open)"
    - "POST /api/v1/clusters/{id}/provisioning/cloudinit/preview — render + verdict"
    - "connector.storages_for_content / list_iso_content — content-filtered storage reads"
    - "app.provisioning.cloudinit — render_cloudinit_preview + validate_cloudinit_form"
  affects:
    - "backend/app/clusters/connector.py (shared — two new ISO-read methods, append-only)"
    - "backend/app/main.py (shared — iso router mounted, append-only)"
    - "backend/app/provisioning/routes.py (shared — cloudinit/preview route, append-only)"
tech_stack:
  added: []
  patterns:
    - "ISO-read connector methods copy the node_storages/storage_content content-filter shape; pure reads do not clear the resource cache"
    - "storages_for_content filters app-side on the content token list — belt-and-braces over PVE's server-side ?content= filter"
    - "enqueue_iso_download mirrors enqueue_clone ordering: membership guard → URL-scheme guard → connector resolve → enqueue → audit → commit"
    - "cloudinit.py is a pure transform module (audit/csv.py analog): no DB, no PVE call; the validator RETURNS a verdict, never raises (quota-admission verdict shape)"
key_files:
  created:
    - backend/app/iso/__init__.py
    - backend/app/iso/cloud_images.py
    - backend/app/iso/service.py
    - backend/app/iso/routes.py
    - backend/app/provisioning/cloudinit.py
    - backend/tests/test_iso.py
    - backend/tests/test_cloudinit.py
  modified:
    - backend/app/clusters/connector.py
    - backend/app/main.py
    - backend/app/provisioning/routes.py
decisions:
  - "storages_for_content filters app-side on each storage's content token list rather than trusting PVE's ?content= server-side filter — a belt-and-braces guard against PVE versions/back-ends that return the unfiltered list"
  - "list_iso_content derives each ISO's filename from the volid tail (the segment after the last '/') — PVE's content listing carries volid but no separate filename field"
  - "the Cloud-Init form models ip_mode='none' as an explicit no-network choice — the validator hard-rejects it for a cloud-init-booting source kind (Pitfall 6), giving a precise ipconfig0 field error instead of a silent offline boot"
  - "cloudinit.py imports parse_ssh_pubkey lazily inside _ssh_key_parses — keeps the pure-transform module free of any package-level import cycle and lets the test_module_is_a_pure_transform grep stay honest"
metrics:
  duration: ~10 min
  completed: 2026-05-16
  tasks: 2
  files: 10
  tests: 415 pass (28 new)
---

# Phase 4 Plan 05: ISO Library & Cloud-Init Module Summary

The two non-spike-gated provisioning sub-systems 04-04 left for later: a
content-type-filtered ISO / cloud-image library backend with a 202
URL-download (PVE fetches the bytes — the GUI never proxies them), and the
pure-transform Cloud-Init module that renders an effective `#cloud-config`
preview and validates the editor form with a block-hard / warn-soft verdict.

## What Shipped

**Task 1 — the ISO / cloud-image library backend.** Two new `PVEConnector`
reads — `storages_for_content` (content-type-filtered storage list, Pitfall
16) and `list_iso_content` (the ISO volumes present across the node's
iso-capable storages) — both copying the Phase-3 `node_storages` /
`storage_content` content-filter shape and, as pure reads, leaving the
resource cache untouched. `app/iso/cloud_images.py` vendors a curated catalog
of seven official cloud images (Ubuntu 24.04/22.04, Debian 12/11, Rocky 9,
AlmaLinux 9, Fedora 40), each with its upstream download URL (D-15).
`app/iso/service.py` ships `list_isos` (a team-scoped read) and
`enqueue_iso_download` — the latter validates the URL scheme is `http`/`https`
only (SSRF — T-04-05-01), then enqueues the Plan-04-04 `storage.download` job
(it does not re-create it). `app/iso/routes.py` exposes `GET /iso`,
`GET /iso/cloud-images` and `POST /iso/download` — the download is **not**
admin-gated (D-17) and carries `csrf_protect`. `main.py` mounts the router.

**Task 2 — the Cloud-Init render + validation module.**
`app/provisioning/cloudinit.py` is a pure stateless transform module (the
`audit/csv.py` discipline — no DB, no PVE call). `render_cloudinit_preview`
returns a list of `YamlLine(text, injected)` — user-set fields
(`ciuser`/`cipassword`/`sshkeys`/the `ipconfig0`-derived NIC) are
`injected=False`, the PVE defaults the user did not set (`chpasswd: expire`,
`lock_passwd`, package handling) are `injected=True` so the frontend dims and
badges them (D-10). `validate_cloudinit_form` returns a `CloudInitVerdict`
with `hard_errors` + `soft_warnings` and **never raises** (the quota-admission
verdict shape). Hard errors: missing `cipassword` (D-11), an invalid `ciuser`,
an unparseable SSH key (reusing the Phase-1 `parse_ssh_pubkey`), a malformed
static IP/gateway, and a cloud-init-booting source kind that resolves to no
`ipconfig0` (Pitfall 6). Soft warning: DNS on a DHCP NIC (Pitfall 14). A
`POST /provisioning/cloudinit/preview` route wraps both functions so the
Plan-04-13 editor gets the rendered lines and the verdict in one round-trip.

## Must-Haves Verification

- A user can list ISOs present across `content=iso`-capable storages,
  content-type filtered — `test_get_iso_library_lists_isos` +
  `test_connector_storages_for_content_filters_by_content`.
- A user can trigger an ISO / cloud-image URL-download that runs as a 202 job
  — `test_iso_download_returns_202_with_job` (kind `storage.download`).
- The backend renders an effective `#cloud-config` preview marking
  PVE-injected lines — `test_render_pve_injected_lines_are_marked` +
  `test_render_first_line_is_cloud_config_header`.
- The backend validates cloud-init form fields with a block-hard / warn-soft
  split before submit — `test_validate_returns_verdict_with_both_lists`,
  `test_validate_dns_on_dhcp_is_soft_warning_not_hard_error`,
  `test_validate_cloud_image_missing_ipconfig0_is_hard_error`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `storages_for_content` over-trusted PVE's server-side filter**
- **Found during:** Task 1
- **Issue:** The first cut handed `?content=iso` to PVE and returned the
  response verbatim. The `FakeProxmox` test double (and, by RESEARCH Pitfall
  16, some real PVE back-ends) returns the *unfiltered* storage list — the
  method then reported `images`-only storages as iso-capable, which would let
  the wizard offer a storage that rejects the ISO on PVE.
- **Fix:** `storages_for_content` now ALSO filters app-side on each storage's
  `content` token list — a belt-and-braces guard. The PVE `?content=` query
  is kept as the server-side fast path.
- **Files modified:** `backend/app/clusters/connector.py`
- **Commit:** bf28946

**2. [Rule 3 - Blocking] `test_module_is_a_pure_transform` substring check too crude**
- **Found during:** Task 2
- **Issue:** The RED-phase test asserted the literal substring `connector`
  and `cloud-init` were absent from the module source to prove "no PVE
  connector import / no cloud-init CLI". Both words are legitimate domain
  vocabulary in the module's docstrings/comments — the check failed on prose,
  not on a real dependency.
- **Fix:** Tightened the test to assert the real intent — no
  `clusters.connector` / `from app.clusters` import, no `subprocess` /
  `os.system` shell-out, no `import cloudinit` / `from cloudinit` library
  import. The module's prose is unchanged in meaning; one docstring sentence
  was reworded from "no PVE connector" to "makes no Proxmox API call".
- **Files modified:** `backend/tests/test_cloudinit.py`,
  `backend/app/provisioning/cloudinit.py`
- **Commit:** 4b21f1f

Both fixes are correctness corrections — no scope change. The first hardens a
real Pitfall-16 gap; the second fixes a test that did not test its stated
intent.

## Threat Model Compliance

- T-04-05-01 (ISO URL-download SSRF) — `enqueue_iso_download` rejects any
  non-`http(s)` URL scheme 422 BEFORE enqueueing
  (`test_iso_download_rejects_non_http_url`); the actual fetch runs on the PVE
  node via `download-url` (Pitfall 7) — the GUI never resolves the URL.
- T-04-05-02 (cloud-init pre-seeding) — the form-driven editor restricts the
  field surface; `validate_cloudinit_form` hard-rejects malformed SSH keys and
  invalid `ciuser`; `cipassword` is required (D-11).
- T-04-05-03 (ISO download admin-gating — accepted) — `POST /iso/download` has
  no `require_admin`; D-17 deliberately opens it to any authenticated
  team-scoped user. The cross-tenant membership guard 403s a non-member
  (`test_iso_download_cross_tenant_returns_403`); the download is audited.
- T-04-05-04 (malformed cloud-init breaks the guest) — the validator hard-
  rejects a missing `ipconfig0` (Pitfall 6) and surfaces the DHCP-DNS mismatch
  as a soft warning (Pitfall 14) — the user is informed, never silently
  bricked.

No new threat surface beyond the plan's `<threat_model>` was introduced.

## Notes for Later Phase-4 Plans

- The Plan-04-13 Cloud-Init editor consumes
  `POST /provisioning/cloudinit/preview` — it returns `{lines, verdict}` in
  one call (live YAML pane + block-hard/warn-soft verdict).
- The VM-creation wizard (Plan 04-09/10) reads `GET /iso` for the blank-ISO
  picker and `GET /iso/cloud-images` for the cloud-image picker; the curated
  list's `id` is what the wizard sends to `POST /iso/download`.
- `storages_for_content` is also the content-type filter for the wizard's
  storage dropdowns (`iso` / `images` / `vztmpl`).

## Self-Check: PASSED

All seven created files exist on disk; all four task commits (0b16289,
bf28946, d77e9c2, 4b21f1f) are in `git log`. 415 backend tests pass (28 new),
ruff clean on `app/iso` and `app/provisioning/cloudinit.py`.
