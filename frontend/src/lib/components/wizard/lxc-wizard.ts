// lxc-wizard — the pure, framework-free logic for the two LXC wizard paths
// (Plan 04-11).
//
// This module holds the data + pure functions the LXC wizard step components
// (`CatalogBrowser`, `ScriptDetailPanel`, `LxcTemplateStep`,
// `LxcResourcesStep`) and the `/create` route share — extracted from the
// `.svelte` files so the logic is unit-testable in the `node` vitest env (the
// same discipline as Plan 04-10's `wizard-model.ts` and Phase 3's
// `snapshot-tree.ts`). The rendered Svelte props/markup are exercised
// end-to-end by `pnpm exec svelte-check`.
//
// References:
//   - 04-UI-SPEC §"Community-scripts catalog browser" + §"Script-detail panel"
//   - 04-UI-SPEC §"Resources step contract" + §"Step model"
//   - D-04 post-submit landing / D-06 curated shortlist / D-07 parsed options
//   - LXC-01/02/04/05/06/07

import type {
  CatalogEntry,
  CommunityScriptRequest,
  CreateLxcRequest,
  NetworkConfigInput
} from '$lib/api/types';
import type { WizardPath, WizardStepId } from './wizard-model';

// ---------------------------------------------------------------------------
// LXC step model
// ---------------------------------------------------------------------------

/**
 * The path-conditional LXC step list (UI-SPEC §"Step model" table). Both LXC
 * paths are `Path → Source → Resources → Network → Review` — the Cloud-Init
 * step is absent (it is VM-only, D-13). The "Source" step is the
 * `LxcTemplateStep` for the plain-LXC path and the `CatalogBrowser` /
 * `ScriptDetailPanel` for the community-script path.
 *
 * This mirrors `stepsForPath` from `wizard-model.ts` for the two LXC paths and
 * exists so the LXC step components can assert their own step list without
 * importing the whole shell model.
 */
export function lxcStepsForPath(path: WizardPath): WizardStepId[] {
  if (path !== 'plain-lxc' && path !== 'community-script') {
    throw new Error(`lxcStepsForPath: ${path} is not an LXC path`);
  }
  return ['path', 'source', 'resources', 'network', 'review'];
}

// ---------------------------------------------------------------------------
// Catalog browsing — curated / full views, search + category filtering
// ---------------------------------------------------------------------------

/** The two catalog browser views (UI-SPEC §"Community-scripts catalog browser"). */
export type CatalogView = 'curated' | 'full';

/**
 * The curated view (LXC-01, D-06) shows only the `featured` entries. The
 * backend already applies the admin curated-override, so the client simply
 * renders whatever the `view=curated` response returns — but when the client
 * holds the FULL catalog (e.g. it cached `view=full`) this narrows it down.
 */
export function curatedEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.filter((e) => e.featured);
}

/**
 * The unique, sorted set of category labels across a catalog (LXC-02 — the
 * `badge`-style category filter chips).
 */
export function catalogCategories(entries: CatalogEntry[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    for (const c of e.categories) seen.add(c);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Client-side full-catalog filter (LXC-02). `q` is a case-insensitive
 * substring match on the script name + description; `category` narrows to a
 * single category (matched case-insensitively against the entry's
 * `categories`). Either filter may be empty/undefined — an empty filter set
 * returns the catalog unchanged.
 *
 * The backend `GET /catalog?q=&category=` does the same filtering; this is the
 * local mirror so the browser can filter an already-fetched catalog without a
 * round-trip and so the predicate is unit-testable.
 */
export function filterCatalog(
  entries: CatalogEntry[],
  args: { q?: string; category?: string }
): CatalogEntry[] {
  const q = (args.q ?? '').trim().toLowerCase();
  const category = (args.category ?? '').trim().toLowerCase();
  return entries.filter((e) => {
    if (q) {
      const haystack = `${e.name} ${e.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (category) {
      if (!e.categories.some((c) => c.toLowerCase() === category)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// LXC-04 attribution + D-07 configurable-option parsing
// ---------------------------------------------------------------------------

/**
 * The LXC-04 mandatory pre-deploy disclosure block — the script source link,
 * the commit hash, and the last-reviewed date, all from the active catalog
 * pin. Rendered by `ScriptDetailPanel` BEFORE the user can advance.
 */
export interface ScriptAttribution {
  /** Upstream GitHub source file URL. */
  sourceUrl: string;
  /** The pinned commit SHA the catalog snapshot was taken at. */
  commitSha: string;
  /** The last-reviewed date (ISO `YYYY-MM-DD` from the catalog pin). */
  lastReviewed: string;
}

/**
 * Build the LXC-04 attribution block from a catalog entry. The
 * `CatalogEntryResponse.attribution` envelope may override these; this is the
 * entry-level fallback so the panel always has the three required fields.
 */
export function scriptAttribution(entry: CatalogEntry): ScriptAttribution {
  return {
    sourceUrl: entry.source_url,
    commitSha: entry.commit_sha,
    lastReviewed: entry.last_reviewed
  };
}

/**
 * One D-07 configurable-option form field parsed from a script's catalog
 * metadata. `key` is the `script_options` map key the value flows into.
 */
export interface ScriptOptionField {
  /** The `script_options` map key. */
  key: string;
  /** Human-readable field label. */
  label: string;
  /** A default value, if the metadata supplied one. */
  defaultValue: string;
}

/**
 * The result of parsing a script's metadata for D-07 configurable options.
 *
 * `parsed` is `false` when the catalog entry carries no machine-readable
 * option metadata — the panel then shows the `bg-warning/10` "options couldn't
 * be read — defaults-only" notice and the deploy falls back to the script's
 * own defaults (an empty `script_options`).
 */
export interface ScriptOptionsParse {
  /** Whether any configurable options could be read from the metadata. */
  parsed: boolean;
  /** The parsed option fields (empty when `parsed` is false). */
  fields: ScriptOptionField[];
}

/**
 * Parse a catalog entry's `install_methods` metadata for D-07 configurable
 * options.
 *
 * The community-scripts metadata exposes per-install-method tunables as a
 * `resources`-style object on each install method. We surface any string /
 * number-valued keys under an install method's `config` / `options` /
 * `params` object as editable fields. When no install method carries such an
 * object the parse fails gracefully (`parsed: false`) and the deploy is
 * defaults-only — the script still runs with its own built-in defaults.
 */
export function parseScriptOptions(entry: CatalogEntry): ScriptOptionsParse {
  const fields: ScriptOptionField[] = [];
  const seen = new Set<string>();

  for (const method of entry.install_methods ?? []) {
    if (!method || typeof method !== 'object') continue;
    // The option bag may live under any of these conventional keys.
    for (const bagKey of ['options', 'config', 'params'] as const) {
      const bag = (method as Record<string, unknown>)[bagKey];
      if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue;
      for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
        if (seen.has(key)) continue;
        // Only flat scalar tunables become form fields.
        if (typeof value !== 'string' && typeof value !== 'number') continue;
        seen.add(key);
        fields.push({
          key,
          label: humanizeKey(key),
          defaultValue: String(value)
        });
      }
    }
  }

  return { parsed: fields.length > 0, fields };
}

/** Turn a snake_case / kebab-case option key into a Title Case label. */
function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// LXC-07 toggle defaults
// ---------------------------------------------------------------------------

/** The two LXC `features` flags exposed as a checkbox group (LXC-07). */
export const LXC_FEATURE_FLAGS = ['keyctl', 'fuse'] as const;
export type LxcFeatureFlag = (typeof LXC_FEATURE_FLAGS)[number];

/**
 * The LXC-07 toggle defaults (UI-SPEC §"Resources step contract"):
 * unprivileged containers default **on**, nesting defaults **off**, and no
 * features are pre-checked.
 */
export const LXC_RESOURCE_DEFAULTS = {
  unprivileged: true,
  nesting: false,
  features: [] as LxcFeatureFlag[]
} as const;

// ---------------------------------------------------------------------------
// Step validation
// ---------------------------------------------------------------------------

/** The wizard form bag, loosely typed (the shell's `WizardFormData`). */
export type LxcFormData = Record<string, unknown>;

/** A per-field error map — `field → message`. Empty means the step is valid. */
export type LxcFieldErrors = Record<string, string>;

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Validate one LXC wizard step's fields (the `setup/+page.svelte` `validateX`
 * pattern). Returns a `field → message` map; an empty map means the step may
 * advance. The `path` selects the source-step rules (a template for the
 * plain-LXC path vs. a script slug for the community-script path).
 */
export function validateLxcStep(
  step: WizardStepId,
  path: WizardPath,
  formData: LxcFormData
): LxcFieldErrors {
  const errors: LxcFieldErrors = {};

  if (step === 'source') {
    if (path === 'plain-lxc') {
      if (!asString(formData.ostemplate)) {
        errors.ostemplate = 'Pick a container template to continue.';
      }
    } else {
      if (!asString(formData.script_slug)) {
        errors.script_slug = 'Choose a community script to continue.';
      }
    }
    return errors;
  }

  if (step === 'resources') {
    if (!asString(formData.node)) errors.node = 'Pick a target node.';
    if (!asString(formData.storage)) errors.storage = 'Pick a storage.';
    if (!asString(formData.hostname)) {
      errors.hostname = 'Enter a hostname.';
    }
    if (asPositiveInt(formData.cpu_cores) === null) {
      errors.cpu_cores = 'CPU cores must be a positive whole number.';
    }
    if (asPositiveInt(formData.memory_mb) === null) {
      errors.memory_mb = 'Memory must be a positive whole number.';
    }
    if (asPositiveInt(formData.disk_gb) === null) {
      errors.disk_gb = 'Disk size must be a positive whole number.';
    }
    return errors;
  }

  // `path`, `network`, and `review` are gated by their own components / the
  // shell — no LXC-specific field rule here.
  return errors;
}

/** Whether a validated step has zero field errors. */
export function lxcStepValid(
  step: WizardStepId,
  path: WizardPath,
  formData: LxcFormData
): boolean {
  return Object.keys(validateLxcStep(step, path, formData)).length === 0;
}

// ---------------------------------------------------------------------------
// Request builders — wizard form bag → API payload
// ---------------------------------------------------------------------------

/** Pull the optional NIC config off the form bag, or `null` when unset. */
function readNetwork(formData: LxcFormData): NetworkConfigInput | null {
  const net = formData.network;
  if (net && typeof net === 'object') return net as NetworkConfigInput;
  return null;
}

/** Read the LXC `features` array off the form bag (LXC-07). */
function readFeatures(formData: LxcFormData): string[] {
  const f = formData.features;
  if (Array.isArray(f)) return f.filter((x): x is string => typeof x === 'string');
  return [];
}

/**
 * Translate the wizard `formData` bag into a `CreateLxcRequest` body for the
 * plain-LXC path (LXC-05/06/07). The caller supplies `team_id` (the wizard's
 * resolved owning team). `unprivileged` defaults **on**, `nesting` **off** —
 * the LXC-07 toggle defaults — when the form has not set them.
 */
export function buildLxcRequest(
  formData: LxcFormData,
  teamId: number
): CreateLxcRequest {
  return {
    team_id: teamId,
    node: asString(formData.node),
    storage: asString(formData.storage),
    ostemplate: asString(formData.ostemplate),
    hostname: asString(formData.hostname),
    cpu_cores: asPositiveInt(formData.cpu_cores) ?? 1,
    memory_mb: asPositiveInt(formData.memory_mb) ?? 512,
    disk_gb: asPositiveInt(formData.disk_gb) ?? 8,
    network: readNetwork(formData),
    unprivileged:
      typeof formData.unprivileged === 'boolean'
        ? formData.unprivileged
        : LXC_RESOURCE_DEFAULTS.unprivileged,
    nesting:
      typeof formData.nesting === 'boolean'
        ? formData.nesting
        : LXC_RESOURCE_DEFAULTS.nesting,
    features: readFeatures(formData),
    ssh_public_keys: asString(formData.ssh_public_keys) || null,
    password: asString(formData.password) || null,
    start_after_create:
      typeof formData.start_after_create === 'boolean'
        ? formData.start_after_create
        : true
  };
}

/**
 * Translate the wizard `formData` bag into a `CommunityScriptRequest` body for
 * the community-script path (LXC-03/04). `ostemplate` is resolved server-side
 * from the catalog entry, so it is NOT part of the body. `script_options`
 * carries the D-07 parsed-option values (an empty map for a defaults-only
 * deploy).
 */
export function buildCommunityScriptRequest(
  formData: LxcFormData,
  teamId: number
): CommunityScriptRequest {
  const rawOptions = formData.script_options;
  const script_options: Record<string, string> = {};
  if (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) {
    for (const [k, v] of Object.entries(rawOptions as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') {
        script_options[k] = String(v);
      }
    }
  }
  return {
    team_id: teamId,
    node: asString(formData.node),
    storage: asString(formData.storage),
    script_slug: asString(formData.script_slug),
    hostname: asString(formData.hostname),
    cpu_cores: asPositiveInt(formData.cpu_cores) ?? 1,
    memory_mb: asPositiveInt(formData.memory_mb) ?? 512,
    disk_gb: asPositiveInt(formData.disk_gb) ?? 8,
    network: readNetwork(formData),
    unprivileged:
      typeof formData.unprivileged === 'boolean'
        ? formData.unprivileged
        : LXC_RESOURCE_DEFAULTS.unprivileged,
    ssh_public_keys: asString(formData.ssh_public_keys) || null,
    script_options
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a create-call failure to an inline, human message (the
 * `setup/+page.svelte` `mapXError` pattern). A 409 is the quota-admission
 * rejection (Plan 04-04) — surfaced inline, the wizard does NOT navigate away.
 *
 * `err` is kept `unknown` so callers can pass a caught `ApiError` (which
 * carries `status` + `detail`) or any thrown value.
 */
export function mapLxcCreateError(err: unknown): string {
  const e = err as { status?: number; detail?: string; message?: string };
  const detail = (e?.detail ?? '').toLowerCase();
  if (e?.status === 409) {
    return detail
      ? `This would exceed your team's quota: ${e.detail}`
      : "This would exceed your team's quota. Reduce the size and try again.";
  }
  if (e?.status === 403) {
    return "You don't have permission to provision into this team or cluster.";
  }
  if (e?.status === 422) {
    return 'Please check the wizard fields and try again.';
  }
  if (e?.status === 404) {
    return 'The selected template, script, or cluster is no longer available.';
  }
  return "Couldn't start the create job. Try again.";
}
