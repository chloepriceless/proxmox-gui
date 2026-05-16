---
phase: 04-provisioning-networking-console
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 95
files_reviewed_list:
  - backend/alembic/versions/0006_phase4.py
  - backend/app/catalog/__init__.py
  - backend/app/catalog/routes.py
  - backend/app/catalog/service.py
  - backend/app/catalog/snapshot.json
  - backend/app/clusters/connector.py
  - backend/app/console/__init__.py
  - backend/app/console/proxy.py
  - backend/app/console/routes.py
  - backend/app/console/schemas.py
  - backend/app/iso/__init__.py
  - backend/app/iso/cloud_images.py
  - backend/app/iso/routes.py
  - backend/app/iso/service.py
  - backend/app/jobs/provisioning_functions.py
  - backend/app/jobs/worker.py
  - backend/app/main.py
  - backend/app/models/__init__.py
  - backend/app/models/catalog_pin.py
  - backend/app/models/network_scope.py
  - backend/app/models/notification_seen.py
  - backend/app/networks/__init__.py
  - backend/app/networks/routes.py
  - backend/app/networks/schemas.py
  - backend/app/networks/scoping.py
  - backend/app/networks/service.py
  - backend/app/notifications/__init__.py
  - backend/app/notifications/routes.py
  - backend/app/notifications/service.py
  - backend/app/provisioning/__init__.py
  - backend/app/provisioning/cloudinit.py
  - backend/app/provisioning/routes.py
  - backend/app/provisioning/schemas.py
  - backend/app/provisioning/service.py
  - backend/pyproject.toml
  - backend/tests/conftest.py
  - backend/tests/test_catalog.py
  - backend/tests/test_cloudinit.py
  - backend/tests/test_console.py
  - backend/tests/test_iso.py
  - backend/tests/test_migrations.py
  - backend/tests/test_models_metadata.py
  - backend/tests/test_networks.py
  - backend/tests/test_notifications.py
  - backend/tests/test_provisioning.py
  - backend/tests/test_schema_invariants.py
  - deploy/caddy/Caddyfile.template
  - frontend/src/lib/api/catalog.ts
  - frontend/src/lib/api/client.ts
  - frontend/src/lib/api/console.ts
  - frontend/src/lib/api/index.ts
  - frontend/src/lib/api/iso.ts
  - frontend/src/lib/api/networks.ts
  - frontend/src/lib/api/notifications.ts
  - frontend/src/lib/api/provisioning.ts
  - frontend/src/lib/api/types.ts
  - frontend/src/lib/components/console/ConsoleTab.svelte
  - frontend/src/lib/components/console/console-tab.ts
  - frontend/src/lib/components/inventory/provisioning-banner.ts
  - frontend/src/lib/components/layout/Topbar.svelte
  - frontend/src/lib/components/networks/NetworksTab.svelte
  - frontend/src/lib/components/networks/networks-tab.ts
  - frontend/src/lib/components/notifications/NotificationBell.svelte
  - frontend/src/lib/components/notifications/notification-feed.ts
  - frontend/src/lib/components/shared/EmptyState.svelte
  - frontend/src/lib/components/shared/HelpTooltip.svelte
  - frontend/src/lib/components/ui/radio-group/index.ts
  - frontend/src/lib/components/ui/radio-group/radio-group-item.svelte
  - frontend/src/lib/components/ui/radio-group/radio-group.svelte
  - frontend/src/lib/components/wizard/CatalogBrowser.svelte
  - frontend/src/lib/components/wizard/CloudInitEditor.svelte
  - frontend/src/lib/components/wizard/CloudInitYamlPane.svelte
  - frontend/src/lib/components/wizard/IsoLibrary.svelte
  - frontend/src/lib/components/wizard/LxcResourcesStep.svelte
  - frontend/src/lib/components/wizard/LxcTemplateStep.svelte
  - frontend/src/lib/components/wizard/NetworkPicker.svelte
  - frontend/src/lib/components/wizard/NodeSelect.svelte
  - frontend/src/lib/components/wizard/PathPicker.svelte
  - frontend/src/lib/components/wizard/QuotaDeltaLine.svelte
  - frontend/src/lib/components/wizard/ReviewStep.svelte
  - frontend/src/lib/components/wizard/ScriptDetailPanel.svelte
  - frontend/src/lib/components/wizard/VmResourcesStep.svelte
  - frontend/src/lib/components/wizard/VmSourceStep.svelte
  - frontend/src/lib/components/wizard/WizardChrome.svelte
  - frontend/src/lib/components/wizard/cloudinit-form.ts
  - frontend/src/lib/components/wizard/iso-library.ts
  - frontend/src/lib/components/wizard/lxc-wizard.ts
  - frontend/src/lib/components/wizard/node-fit.ts
  - frontend/src/lib/components/wizard/vm-wizard.ts
  - frontend/src/lib/components/wizard/wizard-model.ts
  - frontend/src/lib/stores/wizardDraft.svelte.ts
  - frontend/src/routes/admin/+page.server.ts
  - frontend/src/routes/admin/+page.svelte
  - frontend/src/routes/admin/teams/[id]/+page.svelte
  - frontend/src/routes/create/+page.server.ts
  - frontend/src/routes/create/+page.svelte
  - frontend/src/routes/inventory/+page.svelte
  - frontend/src/routes/inventory/[cluster]/[vmid]/+page.svelte
findings:
  critical: 0
  warning: 7
  info: 9
  total: 16
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 95
**Status:** issues_found

## Summary

Phase 4 ships the provisioning wizard, SDN-aware networking, ISO/cloud-image
library, community-scripts catalog, embedded-noVNC console relay, and the
notification bell. The code is consistently well-structured, heavily
documented against the spike and pitfall references, and the Proxmox-specific
constraints from `CLAUDE.md` are largely respected:

- Every mutating route enqueues a job and returns 202 (constraint #1).
- UPIDs are persisted before polling via the shared `_run_polled_job` /
  `dispatch_and_poll` path (constraint #2).
- The console relay mints its own `vncproxy` ticket just-in-time and
  URL-encodes the `vncticket` exactly once with `quote(ticket, safe="")`
  (constraints #3/#4 — verified by `test_relay_encodes_vncticket_exactly_once`).
- Provisioning resolves a per-team privsep connector and carries `pool=` into
  every PVE create (constraint #7).
- The community-script install stage is fetched at a pinned commit SHA and run
  inside the created LXC via `pct exec` (constraint #8).
- SDN reads correctly use the cluster-admin connector with app-side per-team
  scoping (spike 04-02 §7).
- The ISO download SSRF guard rejects non-http(s) schemes before enqueueing.

No critical (security-critical / data-loss / crash) issues were found. The
findings below are warnings (logic gaps and a supply-chain hardening gap that
could cause real failures) and info-level improvements. The most notable
warnings are: a supply-chain weakness in how the community-script install URL
is built, a missing `sandbox` attribute on the console iframe, a race window
in the catalog snapshot cache, and a deprecated `datetime.utcnow()` usage that
will break on Python 3.12+ tz-aware comparisons.

## Warnings

### WR-01: Community-script install command interpolates `commit_sha` straight into a container `bash -c` string

**File:** `backend/app/jobs/provisioning_functions.py:145-160`
**Issue:** `_build_install_command` builds
`yes y | bash -c "$(curl -fsSL {script_url})"` where `script_url` embeds both
`slug` and `commit_sha` by f-string interpolation, then wraps it in
`["bash", "-c", remote]`. The node-side `shlex.quote` in `_ssh_pct_exec`
(connector.py:1081) protects the *node* shell, but the `remote` string is
itself a shell command that runs inside the container's bash. `commit_sha`
comes from `entry.commit_sha`, which is the active `catalog_pin.commit_sha` —
operator-controlled and at sync time is whatever the GitHub API returns as the
default-branch HEAD. `slug` is validated against the catalog entry set so it
is safe, but `commit_sha` is not validated to be a 40-char hex SHA anywhere.
A pin row carrying a crafted value (e.g. `main/../../evil`) would be
interpolated into the URL and the in-container `bash -c`. This is the exact
supply-chain surface CLAUDE.md constraint #8 ("Pin to commit hashes") is meant
to close.
**Fix:** Validate `commit_sha` is a 40-char lowercase hex string before it is
ever used to build a URL or a command. Reject it at `sync_catalog` time and
defensively re-check in `_build_install_command`:
```python
import re
_SHA_RE = re.compile(r"^[0-9a-f]{40}$")

def _build_install_command(*, slug: str, commit_sha: str) -> list[str]:
    if not _SHA_RE.match(commit_sha):
        raise ValueError(f"refusing unpinned/invalid commit_sha: {commit_sha!r}")
    script_url = f"{_SCRIPTS_REPO_RAW}/{commit_sha}/install/{slug}-install.sh"
    ...
```
Also validate in `sync_catalog` (`backend/app/catalog/service.py:286`) right
after `new_sha = commit_payload["sha"]`.

### WR-02: Console iframe has no `sandbox` attribute and no per-frame CSP

**File:** `frontend/src/lib/components/console/ConsoleTab.svelte:156-163`
**Issue:** The `<iframe>` is rendered with `src={iframeSrc}` and no `sandbox`
attribute. The relay endpoint (`/api/v1/ws/console/...`) is a WebSocket route,
so pointing an `<iframe src>` at it directly will not actually load a noVNC
client — a WebSocket URL is not an HTML document. Either the iframe is
expected to load an HTML page that is not present in the reviewed files (a
gap), or the relay path is wrong for an iframe `src`. Separately, even once a
real noVNC client page exists, an embedded console iframe should carry a
restrictive `sandbox` (e.g. `allow-scripts allow-same-origin`) so a
compromised console payload cannot navigate the top frame or trigger
downloads. The Caddyfile only sets `X-Frame-Options: SAMEORIGIN` globally and
explicitly defers CSP `frame-ancestors` to Phase 5.
**Fix:** Confirm what document the iframe loads — if `relay_url` is meant to be
consumed by a noVNC client component the iframe `src` should point at that
client page, not the raw WebSocket relay path. Add a `sandbox` attribute once
the target is an HTML document:
```svelte
<iframe
  src={iframeSrc}
  sandbox="allow-scripts allow-same-origin"
  title={`Console — ${name}`}
  ...
></iframe>
```

### WR-03: `datetime.utcnow()` is deprecated and produces naive datetimes

**File:** `backend/app/catalog/service.py:296,302`
**Issue:** `sync_catalog` writes `synced_at=datetime.utcnow()`. `utcnow()` is
deprecated in Python 3.12 and returns a naive datetime. The notification
service (`notifications/service.py:38-49`) had to add `_as_aware` precisely
because naive DB timestamps crash tz-aware comparisons — the catalog pin path
re-introduces the same hazard. `load_catalog` reads `pin.synced_at` back and
calls `.isoformat()` on it (service.py:158-160); a naive value yields an
ISO string with no offset, which `last_reviewed` then surfaces inconsistently
versus the snapshot floor's `synced_at` (which the snapshot.json stores with a
`Z` suffix).
**Fix:** Use the timezone-aware now consistent with the rest of the codebase:
```python
from datetime import UTC, datetime
...
pin.synced_at = datetime.now(UTC)
```

### WR-04: Catalog snapshot in-process cache has a read-modify race and is never invalidated

**File:** `backend/app/catalog/service.py:65-66,132-137`
**Issue:** `_SNAPSHOT_CACHE` is a module-global lazily filled by `_load_snapshot`
with no lock. Under concurrent first-request load two coroutines can both see
`None` and both call `_SNAPSHOT_PATH.read_text()` + `json.loads`. The data is
identical so there is no corruption, but it is wasted I/O and the comment
claims the cache is the single parse. The connector's `ResourceCache`
deliberately uses an `asyncio.Lock` for exactly this thundering-herd case;
the snapshot cache should follow the same discipline. Lower severity than a
data bug, but flagged because the pattern is inconsistent with the project's
own established convention.
**Fix:** The snapshot is static per release, so the simplest fix is to parse it
eagerly at import time (module-level constant) rather than lazily, removing the
race entirely:
```python
_SNAPSHOT_CACHE: dict = json.loads(_SNAPSHOT_PATH.read_text())

def _load_snapshot() -> dict:
    return _SNAPSHOT_CACHE
```

### WR-05: Network picker silently picks the first team when a user belongs to multiple teams on a cluster

**File:** `backend/app/networks/routes.py:94-99`
**Issue:** `get_networks` does `team_id = tokens[0].team_id` with the comment
"pick the first team". A user can be a member of more than one team, and more
than one of those teams can have a `team_cluster_token` on the same cluster.
The order of `tokens` is whatever `_team_tokens_for_cluster` returns (no
explicit `ORDER BY` visible), so which team's SDN grants the picker shows is
non-deterministic. A user provisioning into team B can be shown team A's
granted VNets, then the create POST (which names `team_id` explicitly in the
body) enforces the real team — producing a confusing picker/create mismatch.
**Fix:** The picker should be parameterised by the team the wizard is
provisioning into. Accept a `team_id` query param on `GET .../networks` and
validate the principal is a member of it (mirroring
`provisioning.service._require_team_membership`), instead of guessing
`tokens[0]`. Until then, at minimum sort `tokens` deterministically and
document the limitation.

### WR-06: `_resolve_ostemplate` builds a template volid that may not exist on storage

**File:** `backend/app/provisioning/service.py:371-386`
**Issue:** `_resolve_ostemplate` synthesises
`{storage}:vztmpl/{os_name}-{version}-{suffix}_amd64.tar.zst` from the catalog
entry's `os`/`version` with a hardcoded `_amd64` arch and a
`standard`/`default` suffix heuristic. It does not verify the template is
actually present on the chosen storage. If the operator has not pre-downloaded
that exact template the `lxc.community-script` job's stage-1 `create_lxc` will
fail at PVE with an opaque "volume does not exist" error, after the VMID has
already been reserved and an audit `pending` row written. The plain-LXC path
avoids this because the user picks an `ostemplate` from a real list; the
community-script path fabricates it.
**Fix:** Preflight the template — list `content=vztmpl` volumes on the chosen
storage (the connector already has `storages_for_content` / a content listing
path) and reject with a clear 422 ("the required container template
`<name>` is not available on storage `<storage>` — download it first") before
reserving the VMID. At minimum, surface a curated friendly error if stage 1
fails on a missing-template condition.

### WR-07: ISO download `filename` and `storage` are not validated for path traversal before reaching PVE

**File:** `backend/app/iso/service.py:108-169`, `backend/app/iso/routes.py:88-95`
**Issue:** `enqueue_iso_download` validates the URL *scheme* (good — SSRF
guard) but passes `filename` and `storage` straight into the
`storage.download` job payload, which the worker hands to
`connector.download_url` → `POST .../storage/{storage}/download-url`. The
`IsoDownloadRequest` schema bounds only length (`max_length=256`/`128`); a
`filename` like `../../etc/something` or one containing slashes is accepted.
PVE's `download-url` endpoint generally rejects bad filenames, so this is a
defense-in-depth gap rather than a confirmed traversal, but the GUI is the
trust boundary here (a team-scoped, non-admin-gated endpoint per D-17) and
should not rely on PVE's input validation alone.
**Fix:** Reject a `filename` containing `/`, `\`, or `..`, and constrain it to
a safe character set before enqueueing:
```python
import re
_SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
...
if not _SAFE_FILENAME_RE.match(filename):
    raise HTTPException(422, detail="Invalid download filename.")
```
Apply the same validation in the `iso-library.ts` `filenameFromUrl` helper
output as a UX nicety (the backend remains the trust boundary).

## Info

### IN-01: Naive `datetime` in `0006_phase4.py` server defaults vs. application writes

**File:** `backend/alembic/versions/0006_phase4.py:54-58,86-90,107-111`
**Issue:** The three new tables use `server_default=sa.text("CURRENT_TIMESTAMP")`
which SQLite stores naive. Combined with WR-03 the application then sometimes
writes naive `utcnow()` and sometimes tz-aware `datetime.now(UTC)`. This is a
consistency smell across the schema. Not a bug on its own (the
`notification_seen` reader already normalises via `_as_aware`).
**Fix:** Pick one convention project-wide; the codebase already trends toward
`_as_aware`-style normalisation on read, so document that DB datetimes are
naive-UTC by contract.

### IN-02: `_resolve_team_pool` raises bare `RuntimeError` for an operator-reachable state

**File:** `backend/app/provisioning/service.py:107-112`
**Issue:** When no `team_cluster_tokens` row exists the function raises a plain
`RuntimeError`. The docstring asserts the connector resolution above would have
failed first, which is true today, but a `RuntimeError` bubbling out of a
request handler becomes a generic 500 with a stack trace rather than a curated
message. Low risk because the path is currently unreachable.
**Fix:** Raise `HTTPException(500, ...)` with a curated detail, or assert the
invariant explicitly so the intent is clear.

### IN-03: `import json as _json` inside a function body

**File:** `backend/app/provisioning/service.py:303`
**Issue:** `enqueue_create_qemu` does `import json as _json` mid-function then
`int(_json.loads(clone_job.payload)["newid"])`. The module already imports
nothing for json at top level; an inline aliased import is a minor style
inconsistency (the rest of the file imports at module scope).
**Fix:** Move `import json` to the module header and drop the `_json` alias.

### IN-04: `CloudInitForm` (a dataclass) and `CloudInitPreviewRequest` (Pydantic) duplicate the same field set

**File:** `backend/app/provisioning/cloudinit.py:56-77`, `backend/app/provisioning/routes.py:175-188`
**Issue:** The cloud-init form fields are declared twice — once as a
`@dataclass` in the pure module and once as a Pydantic model in the route —
and `cloudinit_preview` hand-copies all ten fields between them
(routes.py:244-255). A new field must be added in three places. Acceptable
given the deliberate "pure module, no Pydantic dependency" design, but worth a
note.
**Fix:** Consider a single shared field list / helper, or accept the
duplication explicitly with a comment cross-referencing both definitions.

### IN-05: `render_cloudinit_preview` injects raw user values into YAML lines without escaping

**File:** `backend/app/provisioning/cloudinit.py:188-226`
**Issue:** The preview renderer builds YAML lines with f-strings
(`f"  - name: {form.ciuser}"`, `f"  - {pkg}"`, `f"  - {cmd}"`). This is a
*display-only* preview (the docstring is explicit it makes no PVE call), and
`ciuser` is regex-validated, but `packages` / `runcmd` / `nameservers` are
free text rendered verbatim. A value containing a newline or YAML
metacharacters would render a misleading preview pane. Not a security issue
(the preview is never fed back to PVE — the actual create uses discrete config
keys) but the rendered YAML can misrepresent what will run.
**Fix:** Either YAML-quote interpolated scalar values, or add a one-line
comment clarifying the preview is best-effort cosmetic and the authoritative
config is the discrete `to_pve_config` output.

### IN-06: Console mint route returns `ticket` + `port` the browser never uses

**File:** `backend/app/console/routes.py:44-59`, `backend/app/console/schemas.py:23-35`
**Issue:** `VncProxyResponse` carries `ticket` (the raw `PVEVNC:...` value) and
`port` even though the relay (`console/proxy.py`) mints its OWN fresh ticket
per connection and the browser only ever uses `relay_url`. Sending the raw PVE
ticket to the browser at all — even though it expires in ~30-40s and is
unused — is a small unnecessary exposure that slightly contradicts the
module's own "the browser never holds a Proxmox ticket" design statement.
`test_console.py` even asserts the body *contains* the ticket.
**Fix:** Consider dropping `ticket`/`port` from the response (or returning them
only behind a debug flag). If they are kept for "completeness" as the docstring
says, document why the browser receiving an unused live PVE ticket is
acceptable.

### IN-07: `_build_install_env` carries an unused `_GUI_ROOTFS` env var into the container

**File:** `backend/app/jobs/provisioning_functions.py:173-199`
**Issue:** The function reads `rootfs` from the config and exports it as
`_GUI_ROOTFS` purely so "a future maintainer sees it is intentionally not part
of the env block" (the comment). Exporting a deliberately-unused variable into
the install stage's environment is dead state shipped to the container.
**Fix:** Drop the `rootfs` read and the `_GUI_ROOTFS` key entirely; a code
comment conveys intent without polluting the container env.

### IN-08: `findCreateJob` matches by cluster only — wrong banner on a busy cluster

**File:** `frontend/src/lib/components/inventory/provisioning-banner.ts:33-41`
**Issue:** The provisioning banner picks "the newest create job for the
cluster" because notification/job rows carry no vmid. On a cluster where
several creates run concurrently, the detail page of VM A can show the banner
state of VM B's create job. The docstring acknowledges this. Cosmetic, but it
can show a misleading "Provisioning failed" banner on a VM that succeeded.
**Fix:** Thread the reserved `vmid` (already returned in
`ProvisioningJobAcceptedResponse`) through to the job row, or scope the match
by `target_id` once jobs carry it, so the banner is per-resource.

### IN-09: `console_relay` broad `except Exception` swallows all upstream/relay failures into one log line

**File:** `backend/app/console/proxy.py:188-205,236-249`
**Issue:** Three separate `except Exception` blocks (ownership resolve, ticket
mint, upstream connect/relay) all collapse to a 1008 close or a debug/info log.
The `noqa: BLE001` comments acknowledge this is intentional, and for a
WebSocket relay closing on any failure is reasonable, but a genuine
programming error (e.g. an `AttributeError` in `resolve_resource`) is
indistinguishable from an expected cross-tenant rejection in the logs.
**Fix:** Narrow the ownership-resolve catch to the expected `HTTPException` /
PVE exception types and let unexpected exceptions log at `error` level so a
real bug is not masked as a routine policy close.

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
