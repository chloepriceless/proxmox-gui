// Cloud-Init editor — the framework-free form helper (Plan 04-13).
//
// The two-pane Cloud-Init editor (`CloudInitEditor.svelte`) is a thin render
// shell; all DOM-free logic lives here so it is unit-testable in the `node`
// vitest environment (the established Plan 04-10/11/12 discipline — the
// `.svelte` files cannot be mounted in `node`, so the tested code IS the
// rendered code).
//
// This module:
//   - models the `CloudInitForm` shape the editor owns,
//   - ships `cloudInitFormDefaults()` — the empty-form factory,
//   - translates the editor form into the `CloudInitForm` request body the
//     backend `cloudinit/preview` route consumes,
//   - translates the editor form into the cloud-init request *fields*
//     (`ci_user` / `ci_password` / `ssh_public_keys`) that `vm-wizard.ts`'s
//     `buildQemuRequest` carries into the `createQemu` payload,
//   - exposes pure verdict predicates (the CTA-gating + the offending-field
//     lookup) the editor renders.
//
// It does NOT re-implement the validator — the `CloudInitVerdict` always
// comes from the backend `cloudinitPreview` call (D-09: the editor is the
// sole input, the backend is the sole authority on the verdict).
//
// NO code-editor / syntax-highlighter import (monaco / codemirror / prismjs /
// shiki) — the UI-SPEC Design System forbids them and the checker validates
// their absence.

import type {
  CloudInitForm,
  CloudInitVerdict,
  CreateQemuRequest,
} from '$lib/api/types';
import type { VmSourceKind } from './vm-wizard';

/** One owned SSH key in the team-wide multi-select (D-11). */
export interface SshKeyChoice {
  /** The key id (the multi-select value). */
  id: number;
  /** A human label — the key name. */
  name: string;
  /** The owning user's username — the multi-select groups/labels by owner. */
  owner: string;
  /** The SSH public-key text — what gets written into the create payload. */
  publicKey: string;
}

/**
 * The Cloud-Init editor form — the left pane's value bag. It is a superset of
 * the wire `CloudInitForm`: it additionally holds the *selected SSH key ids*
 * (the multi-select state) which are resolved to public-key text only when the
 * request is built. `cipassword` lives here in-memory ONLY — it is never
 * persisted to the wizardDraft `sessionStorage` store (T-04-13-02).
 */
export interface CloudInitEditorForm {
  /** The first-boot user (`ciuser`). */
  ciuser: string;
  /** The first-boot password (`cipassword`) — required, D-11. In-memory only. */
  cipassword: string;
  /** The selected SSH-key ids — resolved to public-key text on build. */
  sshKeyIds: number[];
  /** `auto` / `dhcp` / `static` / `none`. */
  ipMode: string;
  /** `static` mode — the CIDR address. */
  ipAddress: string;
  /** `static` mode — the gateway. */
  gateway: string;
  /** DNS servers (one per line in the UI, an array here). */
  nameservers: string[];
  /** Extra packages to install on first boot. */
  packages: string[];
  /** Extra first-boot commands. */
  runcmd: string[];
}

/** The four IP modes the editor's network select offers. */
export const CLOUD_INIT_IP_MODES = ['auto', 'dhcp', 'static', 'none'] as const;

/** A fresh, empty Cloud-Init editor form. */
export function cloudInitFormDefaults(): CloudInitEditorForm {
  return {
    ciuser: '',
    cipassword: '',
    sshKeyIds: [],
    ipMode: 'dhcp',
    ipAddress: '',
    gateway: '',
    nameservers: [],
    packages: [],
    runcmd: [],
  };
}

/**
 * Resolve the editor's selected SSH-key ids to their public-key text, in the
 * order the keys appear in the supplied catalogue. Unknown ids (a key removed
 * mid-wizard) are silently dropped — the catalogue is the source of truth.
 */
export function resolveSshKeys(
  selectedIds: number[],
  catalogue: SshKeyChoice[]
): string[] {
  const byId = new Map(catalogue.map((k) => [k.id, k]));
  const out: string[] = [];
  for (const id of selectedIds) {
    const key = byId.get(id);
    if (key && key.publicKey.trim()) out.push(key.publicKey.trim());
  }
  return out;
}

/**
 * Group an SSH-key catalogue by owning user — the multi-select renders one
 * labelled group per owner (D-11 — keys are pre-filled from ALL team members,
 * grouped/labelled by owner). Groups are sorted by owner; keys within a group
 * keep their catalogue order.
 */
export function groupSshKeysByOwner(
  catalogue: SshKeyChoice[]
): { owner: string; keys: SshKeyChoice[] }[] {
  const groups = new Map<string, SshKeyChoice[]>();
  for (const key of catalogue) {
    const bucket = groups.get(key.owner);
    if (bucket) bucket.push(key);
    else groups.set(key.owner, [key]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([owner, keys]) => ({ owner, keys }));
}

/**
 * Translate the editor form into the `CloudInitForm` request body the backend
 * `cloudinit/preview` route consumes. The selected SSH-key ids are resolved to
 * public-key text via the supplied catalogue; the active VM `source_kind`
 * drives the backend's Pitfall-6 ipconfig0 hard-error.
 */
export function toCloudInitPreviewRequest(
  form: CloudInitEditorForm,
  catalogue: SshKeyChoice[],
  sourceKind: VmSourceKind
): CloudInitForm {
  return {
    ciuser: form.ciuser.trim() || null,
    cipassword: form.cipassword || null,
    sshkeys: resolveSshKeys(form.sshKeyIds, catalogue),
    ip_mode: form.ipMode,
    ip_address: form.ipAddress.trim() || null,
    gateway: form.gateway.trim() || null,
    nameservers: form.nameservers.map((n) => n.trim()).filter(Boolean),
    packages: form.packages.map((p) => p.trim()).filter(Boolean),
    runcmd: form.runcmd.map((c) => c.trim()).filter(Boolean),
    source_kind: sourceKind,
  };
}

/**
 * The cloud-init *create-payload fields* the editor contributes to a
 * `CreateQemuRequest`. `vm-wizard.ts`'s `buildQemuRequest` reads `ci_user` /
 * `ci_password` / `ssh_public_keys` off the wizard `formData` bag — this
 * produces exactly those keys. `ssh_public_keys` is the newline-joined
 * public-key text (the wire shape `CreateQemuRequest.ssh_public_keys`).
 */
export function toQemuCloudInitFields(
  form: CloudInitEditorForm,
  catalogue: SshKeyChoice[]
): Pick<CreateQemuRequest, 'ci_user' | 'ci_password' | 'ssh_public_keys'> {
  const keys = resolveSshKeys(form.sshKeyIds, catalogue);
  return {
    ci_user: form.ciuser.trim() || null,
    ci_password: form.cipassword || null,
    ssh_public_keys: keys.length ? keys.join('\n') : null,
  };
}

/**
 * True when the verdict must DISABLE the wizard `Next`/CTA — any hard error
 * blocks (D-12, VM-07). A null verdict (the preview not yet returned) does NOT
 * block — the editor stays permissive until the first round-trip lands.
 */
export function cloudInitBlocksNext(verdict: CloudInitVerdict | null): boolean {
  return verdict !== null && verdict.hard_errors.length > 0;
}

/**
 * The inline hard-error message for one form field, or `null` when that field
 * is clean. The editor renders this as a `text-destructive` line under the
 * field (each `CloudInitFieldError` names its offending `field`).
 */
export function hardErrorFor(
  verdict: CloudInitVerdict | null,
  field: string
): string | null {
  if (verdict === null) return null;
  const hit = verdict.hard_errors.find((e) => e.field === field);
  return hit ? hit.message : null;
}

/** True when the verdict carries non-blocking soft warnings to surface (D-12). */
export function hasSoftWarnings(verdict: CloudInitVerdict | null): boolean {
  return verdict !== null && verdict.soft_warnings.length > 0;
}

/**
 * Parse a multi-line textarea value into a trimmed, blank-free string list —
 * the editor's `nameservers` / `packages` / `runcmd` fields are one-per-line
 * textareas.
 */
export function linesToList(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Render a string list back into a one-per-line textarea value. */
export function listToLines(list: string[]): string {
  return list.join('\n');
}
