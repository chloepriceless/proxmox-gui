// Wizard-shell behaviour tests — Plan 04-10.
//
// The vitest environment is `node` — no DOM, no `sessionStorage`, and Svelte
// components cannot be mounted (same constraint as every Phase 1-3 component
// test, which are all logic-only — see tests/components/ConfirmByNameDialog).
//
// We therefore test the *logic* the shell carries, exercising the real code:
//   1. The `wizardDraft` store — its persist/rehydrate/clear cycle, run
//      against an injected in-memory `StorageLike` (the store accepts an
//      injectable storage so it is testable without a browser; in production
//      it binds `sessionStorage`). This IS the real WizardDraftStore class.
//   2. The path-conditional step-model — `stepsForPath`, the pure function
//      `routes/create/+page.svelte` uses to decide which steps a path shows
//      (LXC paths skip the Cloud-Init step per the UI-SPEC step-model table).
//   3. The Step-1 Next-gate predicate — `canAdvanceFromPathStep`.
//   4. The PathPicker contract — the six pinned cards (icons + titles +
//      descriptions) from the Copywriting Contract.
//   5. The D-04 post-submit routing helper — `inventoryPathForJob`.
//
// The rendered Svelte props/markup are exercised end-to-end by
// `pnpm exec svelte-check` (the typed-props contract) — see the plan verify.

import { describe, expect, it } from 'vitest';
import {
  WizardDraftStore,
  type StorageLike,
  type WizardPath
} from '$lib/stores/wizardDraft.svelte';
import {
  PATH_CARDS,
  stepsForPath,
  canAdvanceFromPathStep,
  inventoryPathForJob,
  shouldPromptDiscard,
  WIZARD_STEP_LABEL
} from '$lib/components/wizard/wizard-model';
import { load as createLoad } from '../src/routes/create/+page.server';

// ---------------------------------------------------------------------------
// A tiny in-memory Storage double — mirrors the `Storage` interface surface
// the store needs (getItem / setItem / removeItem).
// ---------------------------------------------------------------------------

function memoryStorage(): StorageLike & { _map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    _map: map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k)
  };
}

// ---------------------------------------------------------------------------
// wizardDraft store — persist / rehydrate / clear
// ---------------------------------------------------------------------------

describe('WizardDraftStore — sessionStorage persistence', () => {
  it('starts empty when storage has no draft', () => {
    const store = new WizardDraftStore({ storage: memoryStorage() });
    expect(store.path).toBe(null);
    expect(store.step).toBe(1);
    expect(store.formData).toEqual({});
  });

  it('persists the chosen path to storage on selectPath', () => {
    const storage = memoryStorage();
    const store = new WizardDraftStore({ storage });
    store.selectPath('plain-lxc');
    expect(store.path).toBe('plain-lxc');
    // Something was written under the draft key.
    expect(storage._map.size).toBeGreaterThan(0);
  });

  it('persists the step on goToStep', () => {
    const storage = memoryStorage();
    const store = new WizardDraftStore({ storage });
    store.selectPath('cloud-image');
    store.goToStep(3);
    expect(store.step).toBe(3);
  });

  it('rehydrates path + step from storage in a fresh instance (a mid-wizard reload)', () => {
    const storage = memoryStorage();
    const first = new WizardDraftStore({ storage });
    first.selectPath('community-script');
    first.goToStep(2);
    first.patchFormData({ hostname: 'jellyfin' });

    // A page reload constructs a NEW store against the SAME storage.
    const reloaded = new WizardDraftStore({ storage });
    expect(reloaded.path).toBe('community-script');
    expect(reloaded.step).toBe(2);
    expect(reloaded.formData.hostname).toBe('jellyfin');
  });

  it('clear() removes the draft from storage and resets state', () => {
    const storage = memoryStorage();
    const store = new WizardDraftStore({ storage });
    store.selectPath('blank-iso');
    store.goToStep(2);
    store.clear();
    expect(store.path).toBe(null);
    expect(store.step).toBe(1);
    expect(store.formData).toEqual({});
    expect(storage._map.size).toBe(0);
    // A fresh instance after clear() also starts empty.
    expect(new WizardDraftStore({ storage }).path).toBe(null);
  });

  it('does NOT persist a cipassword (secrets stay out of sessionStorage — T-04-10-02)', () => {
    const storage = memoryStorage();
    const store = new WizardDraftStore({ storage });
    store.selectPath('cloud-image');
    store.patchFormData({ ci_user: 'ubuntu', cipassword: 'hunter2', name: 'web-01' });
    // The in-memory bag may carry it for the live form, but the SERIALISED
    // draft must never contain the secret.
    const serialised = JSON.stringify([...storage._map.values()]);
    expect(serialised).not.toContain('hunter2');
    // Non-secret fields ARE persisted.
    expect(serialised).toContain('web-01');
  });

  it('a rehydrated store never carries a cipassword even if one was set pre-reload', () => {
    const storage = memoryStorage();
    const first = new WizardDraftStore({ storage });
    first.selectPath('cloud-image');
    first.patchFormData({ cipassword: 'hunter2', ci_user: 'ubuntu' });
    const reloaded = new WizardDraftStore({ storage });
    expect(reloaded.formData.cipassword).toBeUndefined();
    expect(reloaded.formData.ci_user).toBe('ubuntu');
  });

  it('tolerates a corrupt / tampered draft blob — falls back to an empty draft (T-04-10-03)', () => {
    const storage = memoryStorage();
    // Seed garbage under whatever key the store uses.
    storage.setItem('proxmox-gui:wizard-draft', '{not-valid-json');
    const store = new WizardDraftStore({ storage });
    expect(store.path).toBe(null);
    expect(store.step).toBe(1);
  });

  it('ignores a draft whose path value is not one of the six known paths', () => {
    const storage = memoryStorage();
    storage.setItem(
      'proxmox-gui:wizard-draft',
      JSON.stringify({ path: 'evil-path', step: 9, formData: {} })
    );
    const store = new WizardDraftStore({ storage });
    expect(store.path).toBe(null);
    expect(store.step).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Path-conditional step model (UI-SPEC §Create wizard step-model table)
// ---------------------------------------------------------------------------

describe('stepsForPath — path-conditional step model', () => {
  it('LXC paths OMIT the Cloud-Init step', () => {
    for (const p of ['plain-lxc', 'community-script'] as WizardPath[]) {
      expect(stepsForPath(p)).not.toContain('cloud-init');
    }
  });

  it('all four VM paths INCLUDE the Cloud-Init step', () => {
    for (const p of [
      'cloud-image',
      'template-clone',
      'blank-iso',
      'vm-clone'
    ] as WizardPath[]) {
      expect(stepsForPath(p)).toContain('cloud-init');
    }
  });

  it('every path starts at the Path step and ends at the Review step', () => {
    for (const p of PATH_CARDS.map((c) => c.path)) {
      const steps = stepsForPath(p);
      expect(steps[0]).toBe('path');
      expect(steps[steps.length - 1]).toBe('review');
    }
  });

  it('the Plain LXC path is exactly Path → Source → Resources → Network → Review', () => {
    expect(stepsForPath('plain-lxc')).toEqual([
      'path',
      'source',
      'resources',
      'network',
      'review'
    ]);
  });

  it('the Cloud-Init image path is exactly Path → Source → Resources → Network → Cloud-Init → Review', () => {
    expect(stepsForPath('cloud-image')).toEqual([
      'path',
      'source',
      'resources',
      'network',
      'cloud-init',
      'review'
    ]);
  });

  it('when no path is chosen the model is just the Path step', () => {
    expect(stepsForPath(null)).toEqual(['path']);
  });

  it('every step id has a human label', () => {
    for (const p of PATH_CARDS.map((c) => c.path)) {
      for (const s of stepsForPath(p)) {
        expect(WIZARD_STEP_LABEL[s]).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Step-1 Next gate
// ---------------------------------------------------------------------------

describe('canAdvanceFromPathStep — Step-1 Next gate', () => {
  it('Next is disabled until a path is chosen', () => {
    expect(canAdvanceFromPathStep(null)).toBe(false);
  });

  it('Next is enabled once any path card is selected', () => {
    expect(canAdvanceFromPathStep('plain-lxc')).toBe(true);
    expect(canAdvanceFromPathStep('vm-clone')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PathPicker — the six pinned cards (Copywriting Contract)
// ---------------------------------------------------------------------------

describe('PathPicker — the six provisioning-path cards', () => {
  it('defines exactly six cards', () => {
    expect(PATH_CARDS).toHaveLength(6);
  });

  it('the six paths are the pinned identifiers', () => {
    expect(PATH_CARDS.map((c) => c.path)).toEqual([
      'plain-lxc',
      'community-script',
      'cloud-image',
      'template-clone',
      'blank-iso',
      'vm-clone'
    ]);
  });

  it('every card carries the pinned Copywriting-Contract title', () => {
    const titles = Object.fromEntries(PATH_CARDS.map((c) => [c.path, c.title]));
    expect(titles['plain-lxc']).toBe('Plain LXC');
    expect(titles['community-script']).toBe('Community Script');
    expect(titles['cloud-image']).toBe('Cloud-Init image');
    expect(titles['template-clone']).toBe('Clone a template');
    expect(titles['blank-iso']).toBe('Blank VM + ISO');
    expect(titles['vm-clone']).toBe('Clone a VM');
  });

  it('every card carries a one-line description', () => {
    for (const c of PATH_CARDS) {
      expect(c.description.length).toBeGreaterThan(10);
    }
  });

  it('every card names an icon from the allowed set (Copywriting Contract)', () => {
    // The six pinned icons: Container, Rocket, Disc, Boxes, Image, Copy.
    const allowed = new Set(['Container', 'Rocket', 'Disc', 'Boxes', 'Image', 'Copy']);
    for (const c of PATH_CARDS) {
      expect(allowed.has(c.iconName)).toBe(true);
    }
  });

  it('each card maps to its correct provisioning kind (LXC vs VM)', () => {
    const kind = Object.fromEntries(PATH_CARDS.map((c) => [c.path, c.kind]));
    expect(kind['plain-lxc']).toBe('lxc');
    expect(kind['community-script']).toBe('lxc');
    expect(kind['cloud-image']).toBe('vm');
    expect(kind['template-clone']).toBe('vm');
    expect(kind['blank-iso']).toBe('vm');
    expect(kind['vm-clone']).toBe('vm');
  });
});

// ---------------------------------------------------------------------------
// D-04 post-submit routing helper
// ---------------------------------------------------------------------------

describe('inventoryPathForJob — D-04 post-submit landing', () => {
  it('routes to /inventory/{cluster}/{vmid} using the reserved vmid off the 202 body', () => {
    expect(inventoryPathForJob(7, { job_id: 1, state: 'pending', kind: 'lxc.create', vmid: 142 })).toBe(
      '/inventory/7/142'
    );
  });

  it('uses the response vmid, not the job id', () => {
    const path = inventoryPathForJob(2, {
      job_id: 999,
      state: 'pending',
      kind: 'vm.create.qemu',
      vmid: 300
    });
    expect(path).toBe('/inventory/2/300');
    expect(path).not.toContain('999');
  });
});

// ---------------------------------------------------------------------------
// Discard prompt — closing the wizard mid-progress
// ---------------------------------------------------------------------------

describe('shouldPromptDiscard — the close-wizard discard gate', () => {
  it('does NOT prompt when nothing has been chosen (Step 1, no path)', () => {
    expect(shouldPromptDiscard(null, 1)).toBe(false);
  });

  it('prompts once a path card has been chosen', () => {
    expect(shouldPromptDiscard('plain-lxc', 1)).toBe(true);
  });

  it('prompts once the user has moved past Step 1', () => {
    expect(shouldPromptDiscard('cloud-image', 3)).toBe(true);
  });

  it('prompts whenever there is progress to lose', () => {
    // Any non-null path OR any step > 1 means there is a draft to discard.
    expect(shouldPromptDiscard(null, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /create SSR loader — auth gate (T-04-10-01)
// ---------------------------------------------------------------------------

/** Build the minimal event the `create/+page.server.ts` loader reads. */
function loaderEvent(opts: {
  user: { id: number } | null;
  pathname?: string;
}): Parameters<typeof createLoad>[0] {
  return {
    locals: { user: opts.user },
    url: new URL(`http://localhost${opts.pathname ?? '/create'}`),
    fetch: (async () => new Response('[]')) as unknown as typeof fetch
  } as unknown as Parameters<typeof createLoad>[0];
}

describe('/create SSR loader — auth gate', () => {
  it('redirects an unauthenticated user to /login (303) with ?next preserved', async () => {
    let thrown: unknown;
    try {
      await createLoad(loaderEvent({ user: null }));
    } catch (e) {
      thrown = e;
    }
    // SvelteKit `redirect()` throws a `{ status, location }` Redirect object.
    expect(thrown).toBeTruthy();
    const redir = thrown as { status?: number; location?: string };
    expect(redir.status).toBe(303);
    expect(redir.location).toContain('/login');
    expect(redir.location).toContain('next=');
    expect(decodeURIComponent(redir.location ?? '')).toContain('/create');
  });

  it('does NOT redirect an authenticated user — returns the wizard data', async () => {
    const result = await createLoad(loaderEvent({ user: { id: 1 } }));
    expect(result).toBeTruthy();
    expect((result as { user: unknown }).user).toEqual({ id: 1 });
    // The cluster list is an array (the fake fetch returns `[]`).
    expect(Array.isArray((result as { clusters: unknown }).clusters)).toBe(true);
    expect((result as { loadError: boolean }).loadError).toBe(false);
  });
});
