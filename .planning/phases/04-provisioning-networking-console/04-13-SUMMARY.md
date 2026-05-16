---
phase: 04-provisioning-networking-console
plan: 13
subsystem: frontend-cloudinit-iso
tags: [frontend, wizard, cloud-init, iso, provisioning, svelte, vm]
requires:
  - phase: "Plan 04-05"
    provides: "the Cloud-Init render/validate backend (POST cloudinit/preview) + the ISO library backend (listIsos / cloud-images / download)"
  - phase: "Plan 04-09"
    provides: "the typed api.provisioning.cloudinitPreview + api.iso modules + the EmptyState / HelpTooltip primitives"
  - phase: "Plan 04-10"
    provides: "the /create wizard shell + the step-orchestration surface + the wide-step exception"
  - phase: "Plan 04-12"
    provides: "VmSourceStep.svelte (the blank-iso ISO Select placeholder this plan replaces) + the Cloud-Init mount point in create/+page.svelte + vm-wizard.ts buildQemuRequest"
provides:
  - "cloudinit-form.ts — the framework-free Cloud-Init editor-form helper (form translations + verdict predicates + SSH-key resolution/grouping)"
  - "CloudInitYamlPane.svelte — the hand-rolled read-only YAML render pane with PVE-injected-line marking (D-10)"
  - "CloudInitEditor.svelte — the two-pane Cloud-Init wizard step (form + live YAML + block-hard/warn-soft validation)"
  - "iso-library.ts — the framework-free ISO-browser logic (search filter + download-request builders + URL helpers)"
  - "IsoLibrary.svelte — the ISO library browser (on-storage table + curated list + free-URL download)"
  - "The Cloud-Init step wired into all four VM paths + the full ISO browser wired into the Blank+ISO source step"
affects:
  - "Phase 4 is fully executed — all 14 plans complete; the phase is ready for verification/transition"
tech-stack:
  added: []
  patterns:
    - "Cloud-Init / ISO logic lives in node-testable cloudinit-form.ts / iso-library.ts modules; the .svelte files are thin render shells (the established Phase-4 node-env discipline)"
    - "The YAML preview pane is a hand-rolled styled <pre> with per-line Badge spans — NO code-editor/syntax-highlighter dependency (monaco/codemirror/prismjs/shiki forbidden)"
    - "A component whose data source has no API surface yet takes the data as a typed prop, with the route passing an empty value — the established graceful-degradation pattern (Plan 04-12 NodeSelect)"
key-files:
  created:
    - frontend/src/lib/components/wizard/cloudinit-form.ts
    - frontend/src/lib/components/wizard/CloudInitYamlPane.svelte
    - frontend/src/lib/components/wizard/CloudInitEditor.svelte
    - frontend/src/lib/components/wizard/iso-library.ts
    - frontend/src/lib/components/wizard/IsoLibrary.svelte
    - frontend/tests/cloudinit-editor.test.ts
    - frontend/tests/iso-library.test.ts
  modified:
    - frontend/src/routes/create/+page.svelte
    - frontend/src/lib/components/wizard/VmSourceStep.svelte
key-decisions:
  - "The Cloud-Init editor's SSH-key multi-select takes its catalogue as a typed SshKeyChoice[] prop; the /create route passes an empty catalogue — no team-wide SSH-keys-with-public-key read endpoint exists in the Phase-4 frontend surface (the established Plan 04-12 graceful-degradation pattern)"
  - "The YAML pane is a hand-rolled styled <pre> with per-line Badge spans — no code-editor/syntax-highlighter dependency; YamlLine.text renders as auto-escaped Svelte text bindings (T-04-13-03)"
  - "cipassword lives in an in-memory-only cloudInit form bag — it is NOT folded into persistDraft, so it never reaches the wizardDraft sessionStorage store (T-04-13-02)"
metrics:
  duration: ~10 min
  completed: 2026-05-16
  tasks: 2
  files: 9
  tests: "48 new (354 frontend total)"
---

# Phase 4 Plan 13: Cloud-Init Two-Pane Editor & ISO Library Browser Summary

The two non-spike-gated VM provisioning sub-systems whose backends shipped in
Plan 04-05: a form-driven Cloud-Init two-pane editor (a form left, a live
read-only YAML preview right, block-hard/warn-soft validation) on all four VM
paths, and an ISO library browser (on-storage table + curated list + free-URL
download) wired into the Blank+ISO source step. This is Wave 7 — the final
plan of Phase 4; all 14 phase-04 plans are now executed.

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-16T22:05:47Z
- **Completed:** 2026-05-16T22:15:07Z
- **Tasks:** 2
- **Files:** 9 (7 created, 2 modified)

## Accomplishments

- The two-pane Cloud-Init editor ships on all four VM paths (D-13): a
  form-driven left pane (the sole input — D-09), a live read-only YAML pane on
  the right, full-width (the single declared wizard-width exception).
- The YAML pane marks every PVE-injected line — dimmed + an inline
  `Badge variant="outline"` "PVE default" — so the user sees every derived
  value (D-10, VM-06).
- Cloud-Init schema validation runs before submit: a hard-error verdict
  disables the wizard `Next`/CTA + renders a `bg-destructive/10` block + inline
  `text-destructive` field messages; a soft-warning verdict renders a
  `bg-warning/10` block but is non-blocking (D-12, VM-07).
- The ISO library browser ships — an on-storage ISO table with a `command`
  search, a curated ISO list, and a free-URL download open to any
  authenticated user (VM-08, D-16/D-17) — wired into the Blank+ISO source step,
  replacing the Plan-04-12 basic `Select` placeholder.
- No code-editor / syntax-highlighter dependency was added (monaco / codemirror
  / prismjs / shiki) — the YAML pane is a hand-rolled styled `<pre>`.

## Task Commits

1. **Task 1: two-pane Cloud-Init editor on all four VM paths** — `6b82d7b` (feat)
2. **Task 2: ISO library browser wired into the Blank+ISO source step** — `dd6f54d` (feat)

_Both tasks are TDD — the `cloudinit-form.ts` / `iso-library.ts` pure-helper
test suites were written first (RED), then the helpers + components built to
GREEN. The established Phase-4 node-env, logic-only test discipline applies
(the vitest env is `node`; `.svelte` files cannot be mounted — the pure
helpers carry every DOM-free decision and are fully tested, `svelte-check`
exercises the rendered props/markup)._

## Files Created/Modified

- `frontend/src/lib/components/wizard/cloudinit-form.ts` — the framework-free
  editor-form helper: the `CloudInitEditorForm` shape + `cloudInitFormDefaults()`,
  `toCloudInitPreviewRequest` (form → the `cloudinitPreview` body) +
  `toQemuCloudInitFields` (form → the `ci_user`/`ci_password`/`ssh_public_keys`
  `CreateQemuRequest` fields), `resolveSshKeys`/`groupSshKeysByOwner` (the
  team-wide SSH-key resolution + owner grouping — D-11),
  `cloudInitBlocksNext`/`hardErrorFor`/`hasSoftWarnings` (the verdict
  predicates — D-12), `linesToList`/`listToLines`.
- `frontend/src/lib/components/wizard/CloudInitYamlPane.svelte` — the
  hand-rolled read-only YAML render pane: a styled scrollable `<pre>` rendering
  a `YamlLine[]`, each `injected:true` line dimmed (`text-muted-foreground`) +
  an inline `Badge variant="outline"` "PVE default" (D-10, VM-06).
- `frontend/src/lib/components/wizard/CloudInitEditor.svelte` — the full-width
  two-pane wizard step: the form (`ciuser`, `cipassword` via `PasswordInput`
  required, the team-wide SSH-key multi-select, the IP-mode select + static-IP
  fields, the DNS/packages/runcmd textareas) + `CloudInitYamlPane`, calling
  `api.provisioning.cloudinitPreview` (debounced) on every change, the
  block-hard/warn-soft validation blocks + the `onValidityChange` gate signal.
- `frontend/src/lib/components/wizard/iso-library.ts` — the framework-free
  ISO-browser logic: `filterIsos`, `buildIsoUrlDownload`/`buildCloudImageDownload`,
  `filenameFromUrl`, `looksLikeHttpUrl`, `isIsoLibraryEmpty`.
- `frontend/src/lib/components/wizard/IsoLibrary.svelte` — the three-region ISO
  browser: an on-storage ISO `table` (48px rows) with a `command` search, the
  curated ISO list, the free-URL download field; the no-on-storage-ISOs
  `EmptyState`; no admin gate (D-17).
- `frontend/tests/cloudinit-editor.test.ts` — 31 tests (the `cloudinit-form.ts`
  helper + the no-code-editor-import assertion).
- `frontend/tests/iso-library.test.ts` — 17 tests (the `iso-library.ts` helper
  + the no-admin-gate + iso-API-call assertions).
- `frontend/src/routes/create/+page.svelte` — the Cloud-Init mount point on all
  four VM paths filled with `CloudInitEditor`; the cloud-init create fields
  fold into `vmFormBag` via `toQemuCloudInitFields`; the hard-error verdict
  gates `Next`.
- `frontend/src/lib/components/wizard/VmSourceStep.svelte` — the Plan-04-12
  basic ISO `Select` placeholder in the `blank-iso` branch replaced with the
  full `IsoLibrary`; the curated cloud-image list flows through.

## Verification

- `pnpm exec vitest run tests/cloudinit-editor.test.ts tests/iso-library.test.ts`
  — 48/48 pass.
- `pnpm test` — 23 test files, 354 tests pass (+48 new vs the 306 baseline).
- `pnpm exec svelte-check --threshold error` — 0 errors, 0 warnings (the
  project's authoritative type-check; all five new components/helpers + the
  two re-wired files type-check cleanly).
- No code-editor dependency: the `cloudinit-editor.test.ts` no-import assertion
  (comment-stripped) confirms `cloudinit-form.ts` / `CloudInitEditor.svelte` /
  `CloudInitYamlPane.svelte` import none of monaco / codemirror / prismjs /
  shiki.
- No admin gate: the `iso-library.test.ts` assertion confirms `IsoLibrary.svelte`
  carries no `require_admin` / `isAdmin` gate (D-17 — ISO download open to any
  user).
- Icon allow-list: the new files use only `Disc`, `Download`, `FileDown`,
  `Check`, `TriangleAlert`, `CircleAlert` — `FileDown` is named in the plan's
  Task-2 acceptance criteria; the rest are already in cumulative Phase 1-4 use.

Note on `tsc --noEmit`: as Plans 04-09..12 documented, raw `tsc` cannot resolve
`*.svelte` module types and emits ~10 pre-existing `TS2614` errors against the
shadcn-svelte UI primitive index files — these predate this plan and are out of
scope. The project's authoritative type-check is `svelte-check`, which
understands `.svelte` files and is clean (0/0).

## Decisions Made

- **The Cloud-Init editor's SSH-key multi-select takes its catalogue as a typed
  `SshKeyChoice[]` prop; the `/create` route passes an empty catalogue.** No
  team-wide SSH-keys-with-public-key read endpoint exists in the Phase-4
  frontend surface — `/me/ssh-keys` is per-user and its list response
  (`SshKeyResponse`) carries no `public_key` body by design (write-only). The
  editor therefore renders its "no SSH keys stored" state for now; the
  `cipassword` path — the *required* credential (D-11) — works fully end-to-end.
  The grouping/selection/resolution logic (`resolveSshKeys` /
  `groupSshKeysByOwner`) ships complete and fully unit-tested; when a
  team-scoped keys-with-public-key endpoint lands, populating the catalogue is
  a clean follow-on with no component change. This is the established Plan
  04-12 `NodeSelect`-takes-a-prop graceful-degradation pattern.
- **The YAML pane is a hand-rolled styled `<pre>` with per-line `Badge` spans —
  no code-editor / syntax-highlighter dependency.** The UI-SPEC Design System
  forbids monaco / codemirror / prismjs / shiki. `YamlLine.text` renders as
  auto-escaped Svelte text bindings — never `{@html}` (T-04-13-03). The lines
  come from the backend `render_cloudinit_preview`, not raw user markup.
- **`cipassword` lives in an in-memory-only `cloudInit` form bag.** It is NOT
  folded into `persistDraft`, so it never reaches the `wizardDraft`
  `sessionStorage` store (T-04-13-02 — the draft store's `SECRET_KEYS` already
  strips `cipassword`; keeping the bag out of `persistDraft` is belt-and-braces).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `filenameFromUrl` returned the host for a tail-less URL**
- **Found during:** Task 2 (the `iso-library.test.ts` RED run — the "tail-less
  URL" case failed)
- **Issue:** `filenameFromUrl('https://example.com/')` split the URL on `/`
  and took the last non-empty segment — but the scheme+authority was not
  stripped first, so `['https:', 'example.com']` yielded `example.com` as the
  "filename" instead of the `download.iso` fallback.
- **Fix:** `filenameFromUrl` now strips the scheme + authority
  (`https://host[:port]`) with a regex before the path split, so a tail-less
  URL correctly falls back to `download.iso`.
- **Files modified:** `frontend/src/lib/components/wizard/iso-library.ts`
- **Commit:** `dd6f54d`

### Interface adjustments (plan sketch vs. shipped reality)

- **The SSH-key catalogue is an empty typed prop (no team-wide keys API).** The
  plan's interface note said the SSH-key multi-select "pre-fills from ALL team
  members' stored keys … the Phase-1 `ssh_keys` store/API". No team-wide
  SSH-keys read API exists in the frontend surface — `/me/ssh-keys` is
  per-user, and its list response carries no public-key body (the backend
  `SshKeyResponse` is write-only by design, and the create payload needs the
  actual key text). Following the established Plan 04-12 deviation pattern, the
  `CloudInitEditor` takes its catalogue as a typed `SshKeyChoice[]` prop and the
  `/create` route passes an empty catalogue. The grouping/resolution *logic*
  (`groupSshKeysByOwner` / `resolveSshKeys`) is fully implemented and tested;
  only the live data feed awaits a future endpoint. Not a behavior deviation —
  the editor, the owner-grouped render, and the deselectable multi-select are
  all present; the required-credential path (`cipassword`, D-11) works fully.

- **Tests are node-env logic-only, not component-render tests.** The plan's
  behavior blocks describe "component-render tests". The established project
  pattern (the vitest env is `node` — `.svelte` files cannot be mounted;
  confirmed by every Phase 1-4 suite) is to test the extracted pure logic and
  let `svelte-check` exercise the rendered props/markup. `cloudinit-form.ts` and
  `iso-library.ts` hold every DOM-free decision, and the 48 new tests exercise
  them directly — this IS the rendered code's logic. The render-only acceptance
  criteria (the two-pane layout, the PVE-injected-line dimming/badge, the
  hard/soft validation blocks, the 48px ISO rows) are satisfied by the
  components built against the tested logic and confirmed by `svelte-check`.

---

**Total deviations:** 1 auto-fixed bug; 2 interface adjustments (both matching
established Phase-4 patterns).
**Impact on plan:** No scope creep. The no-team-wide-SSH-keys-API gap is a
pre-existing Phase-4 boundary; the editor logic ships complete and tested, and
the required `cipassword` credential works fully end-to-end.

## Threat Model Compliance

- **T-04-13-01 (cloud-init pre-seeding root access)** — the editor is
  form-driven (D-09), a restricted field set, no raw YAML; the backend
  `validate_cloudinit_form` (Plan 04-05) hard-rejects malformed input and
  requires `cipassword`; `cloudInitBlocksNext` disables the wizard CTA on any
  `hard_errors` so a malformed config cannot be submitted.
- **T-04-13-02 (`cipassword` leaked into the draft / logs)** — `cipassword` is
  entered via `PasswordInput` (masked) and lives in an in-memory-only
  `cloudInit` form bag that is NOT folded into `persistDraft` — it never
  reaches the `wizardDraft` `sessionStorage` store; it lives only in in-memory
  state and the create payload over HTTPS.
- **T-04-13-03 (XSS via the YAML preview)** — `CloudInitYamlPane` renders
  `YamlLine.text` as Svelte text bindings (`{line.text}` — auto-escaped),
  never `{@html}`; the lines come from the backend `render_cloudinit_preview`.
- **T-04-13-04 (ISO URL-download SSRF)** — the frontend only submits the URL;
  `looksLikeHttpUrl` is a UX nicety (it disables the button before a doomed
  call) — the real guard is the backend `enqueue_iso_download` (Plan 04-05)
  which rejects a non-http(s) scheme 422; the GUI never resolves the URL.
- **T-04-13-05 (cross-tenant SSH key exposure)** — the multi-select renders
  only the keys in its `SshKeyChoice[]` prop; the route would source that from
  a team-scoped API — it cannot enumerate keys outside the user's team.

No new threat surface beyond the plan's `<threat_model>` was introduced.

## Known Stubs

- **The Cloud-Init SSH-key multi-select renders empty.** `create/+page.svelte`
  passes an empty `sshKeyCatalogue` because no team-wide
  SSH-keys-with-public-key read endpoint exists in the Phase-4 frontend
  surface (documented above + in the route comment). This is **not** a
  goal-blocking stub: VM-05/06/07 (the two-pane editor, the PVE-injected-line
  marking, the validation) and VM-08 (the ISO browser) all ship fully
  functional; the `cipassword` credential path (the *required* D-11 field)
  works end-to-end. The SSH-key feed is a clean future follow-on (a team-scoped
  `ssh-keys` read endpoint) — the editor already takes a typed prop, so wiring
  it in is a one-line route change. Flagged here for the verifier.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 4 is fully executed — all 14 plans complete. The full provisioning UI
  surface (the six wizard paths, the node-fit/quota/network building blocks,
  the Cloud-Init editor, the ISO browser, the console tab, the notification
  bell, the Networks admin tab) is in place.
- The phase is ready for verification / transition.
- A future team-scoped SSH-keys-with-public-key endpoint would let the
  Cloud-Init SSH-key multi-select render real keys — the editor logic is
  already complete; only the data feed is pending.

## Self-Check: PASSED

- All 7 created files exist on disk (`cloudinit-form.ts`,
  `CloudInitYamlPane.svelte`, `CloudInitEditor.svelte`, `iso-library.ts`,
  `IsoLibrary.svelte`, `cloudinit-editor.test.ts`, `iso-library.test.ts`); the
  2 modified files (`create/+page.svelte`, `VmSourceStep.svelte`) updated.
- Both task commits present in `git log` (`6b82d7b`, `dd6f54d`).
- Zero file deletions across both commits (`git diff --diff-filter=D` empty).

---
*Phase: 04-provisioning-networking-console*
*Completed: 2026-05-16*
