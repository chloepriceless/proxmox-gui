// wizardDraft — the sessionStorage-backed `/create` wizard draft store
// (Plan 04-10).
//
// `.svelte.ts` rune-store convention (mirrors stores/jobs.svelte.ts): a class
// holding `$state` fields, exported as a singleton (`wizardDraft`) the route
// consumes, with the class itself exported for unit tests that need an
// isolated instance.
//
// Contract (04-UI-SPEC §"Form-state persistence"):
//   - The wizard holds its state — the chosen `path`, the current `step`, and
//     a per-step `formData` bag — in a `sessionStorage`-backed store keyed by
//     a draft id, so an accidental mid-wizard refresh restores progress.
//   - `clear()` removes the draft (called on wizard complete OR discard).
//   - No server-side draft persistence in v1.
//
// Security (T-04-10-02 — "no secrets persisted to sessionStorage"):
//   - `cipassword` (the Cloud-Init password) is EXPLICITLY excluded from the
//     serialised draft. It may live in the in-memory `formData` bag for the
//     live form, but it is stripped before every write and is never
//     rehydrated. The constant `SECRET_KEYS` is the single excluded-keys list.
//
// Tampering (T-04-10-03 — accepted): a corrupt or forged `sessionStorage`
//   blob falls back to a fresh empty draft; an unknown `path` value is
//   ignored. A tampered draft only pre-fills fields the user can see + edit;
//   every value is re-validated client-side and re-authorised server-side.

import { KNOWN_PATHS, type WizardPath } from '$lib/components/wizard/wizard-model';

/** The sessionStorage key the single active draft is stored under. */
const DRAFT_KEY = 'proxmox-gui:wizard-draft';

/**
 * Form-bag keys that must NEVER be serialised to sessionStorage (T-04-10-02).
 * `cipassword` is the Cloud-Init first-boot password.
 */
const SECRET_KEYS: ReadonlySet<string> = new Set(['cipassword', 'ci_password', 'password']);

/**
 * The minimal `Storage` surface the store needs. The browser's
 * `sessionStorage` satisfies this; tests inject an in-memory double (the
 * `node` vitest env has no `sessionStorage`).
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A loosely-typed per-step form bag — the sibling step plans fill it in. */
export type WizardFormData = Record<string, unknown>;

/** The shape persisted to / read from storage. */
interface PersistedDraft {
  path: WizardPath | null;
  step: number;
  formData: WizardFormData;
}

export type { WizardPath };

/**
 * Resolve the storage backend at construction time. In a browser this is
 * `sessionStorage`; in the `node` test env (or SSR) there is none, so the
 * store runs against an internal in-memory map and simply never persists.
 */
function resolveStorage(): StorageLike {
  if (typeof sessionStorage !== 'undefined') return sessionStorage;
  // SSR / test fallback — an isolated in-memory map. Tests normally inject
  // their own; this keeps construction safe when nothing is injected.
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
}

/** Strip the secret keys from a form bag before it is serialised. */
function stripSecrets(formData: WizardFormData): WizardFormData {
  const safe: WizardFormData = {};
  for (const [k, v] of Object.entries(formData)) {
    if (!SECRET_KEYS.has(k)) safe[k] = v;
  }
  return safe;
}

export class WizardDraftStore {
  /** The chosen provisioning path, or `null` until Step 1 picks one. */
  path = $state<WizardPath | null>(null);
  /** The 1-based current step index within the path's step model. */
  step = $state<number>(1);
  /**
   * The per-step form bag the sibling step plans (04-11/12/13) fill in. The
   * live bag MAY hold a secret (`cipassword`) for the form; the serialised
   * draft never does.
   */
  formData = $state<WizardFormData>({});

  #storage: StorageLike;

  constructor(opts?: { storage?: StorageLike }) {
    this.#storage = opts?.storage ?? resolveStorage();
    this.#rehydrate();
  }

  // -- mutations -----------------------------------------------------------

  /** Step 1 chose a path — persist it. */
  selectPath(path: WizardPath): void {
    this.path = path;
    this.#persist();
  }

  /** Move to a step index — persist it (a reload restores the step). */
  goToStep(step: number): void {
    this.step = step;
    this.#persist();
  }

  /**
   * Merge a partial bag into `formData` (the sibling step plans call this as
   * the user fills each step). Persisted with secrets stripped.
   */
  patchFormData(patch: WizardFormData): void {
    this.formData = { ...this.formData, ...patch };
    this.#persist();
  }

  /**
   * Discard the draft — clears the in-memory state AND removes the
   * sessionStorage blob. Called on wizard complete or discard.
   */
  clear(): void {
    this.path = null;
    this.step = 1;
    this.formData = {};
    try {
      this.#storage.removeItem(DRAFT_KEY);
    } catch {
      // A storage write failure (private-mode quota, etc.) is non-fatal —
      // the in-memory state is already reset.
    }
  }

  // -- persistence ---------------------------------------------------------

  /** Serialise the current draft (secrets stripped) to storage. */
  #persist(): void {
    const draft: PersistedDraft = {
      path: this.path,
      step: this.step,
      formData: stripSecrets(this.formData)
    };
    try {
      this.#storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Non-fatal — the wizard still works without persistence (T-04-10-03
      // accepts a degraded no-restore experience over a hard failure).
    }
  }

  /**
   * Rehydrate from storage on construction. A corrupt blob, an unknown path,
   * or an out-of-range step all fall back to a fresh empty draft
   * (T-04-10-03). Secret keys are never restored even if a tampered blob
   * carries them.
   */
  #rehydrate(): void {
    let raw: string | null;
    try {
      raw = this.#storage.getItem(DRAFT_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // corrupt JSON — empty draft
    }
    if (!parsed || typeof parsed !== 'object') return;

    const draft = parsed as Partial<PersistedDraft>;

    // Path: only accept `null` or one of the six known paths. A `path` value
    // that is neither marks the whole draft as forged/corrupt — discard it
    // entirely rather than rehydrating a partially-trusted step/formData
    // (T-04-10-03).
    const pathOk =
      draft.path === null ||
      draft.path === undefined ||
      (typeof draft.path === 'string' && KNOWN_PATHS.has(draft.path));
    if (!pathOk) return;
    if (typeof draft.path === 'string') this.path = draft.path as WizardPath;

    // Step: a positive integer only.
    if (typeof draft.step === 'number' && Number.isInteger(draft.step) && draft.step >= 1) {
      this.step = draft.step;
    }

    // Form bag: accept a plain object, strip any persisted secret keys.
    if (draft.formData && typeof draft.formData === 'object') {
      this.formData = stripSecrets(draft.formData as WizardFormData);
    }
  }
}

/** The singleton draft store the `/create` route consumes. */
export const wizardDraft = new WizardDraftStore();
