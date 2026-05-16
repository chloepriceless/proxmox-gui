// LXC wizard behaviour tests — Plan 04-11.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (same constraint as every Phase 1-4 component test, which are all
// logic-only — see tests/wizard-draft.test.ts, tests/empty-state.test.ts).
//
// We therefore test the *logic* the LXC wizard carries, exercising the real
// code in `lxc-wizard.ts`:
//   Task 1 — the community-scripts catalog browser + the LXC-04 script-detail
//     disclosure panel: the curated/full split, the search + category filter,
//     the LXC-04 attribution block, and the D-07 option-parse fallback.
//   Task 2 — the plain-LXC wizard steps: the path-conditional step list, the
//     LXC-07 toggle defaults, `validateLxcStep`, `buildLxcRequest` /
//     `buildCommunityScriptRequest`, and the 409-inline-error mapping.
//
// The rendered Svelte props/markup are exercised end-to-end by
// `pnpm exec svelte-check` (the typed-props contract) — see the plan verify.

import { describe, expect, it } from 'vitest';
import {
  lxcStepsForPath,
  curatedEntries,
  catalogCategories,
  filterCatalog,
  scriptAttribution,
  parseScriptOptions,
  validateLxcStep,
  lxcStepValid,
  buildLxcRequest,
  buildCommunityScriptRequest,
  mapLxcCreateError,
  LXC_RESOURCE_DEFAULTS,
  LXC_FEATURE_FLAGS
} from '$lib/components/wizard/lxc-wizard';
import type { CatalogEntry } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Catalog fixtures
// ---------------------------------------------------------------------------

function entry(over: Partial<CatalogEntry>): CatalogEntry {
  return {
    slug: 'jellyfin',
    name: 'Jellyfin',
    description: 'Free software media system.',
    categories: ['Media'],
    type: 'lxc',
    featured: true,
    privileged: false,
    source_url: 'https://github.com/community-scripts/ProxmoxVE/blob/main/ct/jellyfin.sh',
    install_methods: [],
    interface_port: 8096,
    default_credentials: null,
    notes: [],
    commit_sha: 'a1b2c3d4e5f6',
    last_reviewed: '2026-05-01',
    ...over
  };
}

const CATALOG: CatalogEntry[] = [
  entry({ slug: 'jellyfin', name: 'Jellyfin', categories: ['Media'], featured: true }),
  entry({
    slug: 'pihole',
    name: 'Pi-hole',
    description: 'Network-wide ad blocking.',
    categories: ['Network'],
    featured: true
  }),
  entry({
    slug: 'grafana',
    name: 'Grafana',
    description: 'Observability and dashboards.',
    categories: ['Monitoring'],
    featured: false
  }),
  entry({
    slug: 'postgres',
    name: 'PostgreSQL',
    description: 'A relational database.',
    categories: ['Database'],
    featured: false
  })
];

// ===========================================================================
// Task 1 — the catalog browser
// ===========================================================================

describe('Task 1 — catalog browser: curated view', () => {
  it('the curated view shows only the featured entries (LXC-01)', () => {
    const curated = curatedEntries(CATALOG);
    expect(curated.map((e) => e.slug).sort()).toEqual(['jellyfin', 'pihole']);
  });

  it('every curated entry is marked featured', () => {
    expect(curatedEntries(CATALOG).every((e) => e.featured)).toBe(true);
  });
});

describe('Task 1 — catalog browser: full-catalog search + category filter', () => {
  it('typing a name substring filters the full catalog', () => {
    const hit = filterCatalog(CATALOG, { q: 'graf' });
    expect(hit.map((e) => e.slug)).toEqual(['grafana']);
  });

  it('search is case-insensitive and also matches the description', () => {
    const hit = filterCatalog(CATALOG, { q: 'AD BLOCKING' });
    expect(hit.map((e) => e.slug)).toEqual(['pihole']);
  });

  it('selecting a category badge narrows to that category', () => {
    const hit = filterCatalog(CATALOG, { category: 'Database' });
    expect(hit.map((e) => e.slug)).toEqual(['postgres']);
  });

  it('the category filter is case-insensitive', () => {
    const hit = filterCatalog(CATALOG, { category: 'media' });
    expect(hit.map((e) => e.slug)).toEqual(['jellyfin']);
  });

  it('search + category compose (both must match)', () => {
    expect(filterCatalog(CATALOG, { q: 'jelly', category: 'Network' })).toEqual([]);
    expect(
      filterCatalog(CATALOG, { q: 'jelly', category: 'Media' }).map((e) => e.slug)
    ).toEqual(['jellyfin']);
  });

  it('an empty filter set returns the catalog unchanged', () => {
    expect(filterCatalog(CATALOG, {})).toHaveLength(CATALOG.length);
  });

  it('a no-search-match yields an empty list (the EmptyState trigger)', () => {
    expect(filterCatalog(CATALOG, { q: 'no-such-script-xyz' })).toEqual([]);
  });

  it('catalogCategories returns the unique sorted category labels', () => {
    expect(catalogCategories(CATALOG)).toEqual([
      'Database',
      'Media',
      'Monitoring',
      'Network'
    ]);
  });
});

// ===========================================================================
// Task 1 — the LXC-04 script-detail disclosure panel
// ===========================================================================

describe('Task 1 — ScriptDetailPanel: LXC-04 mandatory pre-deploy disclosure', () => {
  it('exposes the source URL, commit hash, and last-reviewed date', () => {
    const a = scriptAttribution(entry({}));
    expect(a.sourceUrl).toContain('github.com/community-scripts');
    expect(a.commitSha).toBe('a1b2c3d4e5f6');
    expect(a.lastReviewed).toBe('2026-05-01');
  });

  it('all three LXC-04 fields are non-empty for a real catalog entry', () => {
    const a = scriptAttribution(CATALOG[0]);
    expect(a.sourceUrl).not.toBe('');
    expect(a.commitSha).not.toBe('');
    expect(a.lastReviewed).not.toBe('');
  });
});

describe('Task 1 — ScriptDetailPanel: D-07 configurable-option parsing', () => {
  it('renders option fields when the metadata carries an options bag', () => {
    const parsed = parseScriptOptions(
      entry({
        install_methods: [{ type: 'default', options: { db_name: 'app', port: 5432 } }]
      })
    );
    expect(parsed.parsed).toBe(true);
    expect(parsed.fields.map((f) => f.key).sort()).toEqual(['db_name', 'port']);
    const dbName = parsed.fields.find((f) => f.key === 'db_name');
    expect(dbName?.label).toBe('Db Name');
    expect(dbName?.defaultValue).toBe('app');
  });

  it('also reads the `config` and `params` option-bag keys', () => {
    expect(
      parseScriptOptions(entry({ install_methods: [{ config: { tz: 'UTC' } }] })).parsed
    ).toBe(true);
    expect(
      parseScriptOptions(entry({ install_methods: [{ params: { mode: 'fast' } }] })).parsed
    ).toBe(true);
  });

  it('falls back to a defaults-only deploy when no options can be read (D-07)', () => {
    const parsed = parseScriptOptions(entry({ install_methods: [] }));
    expect(parsed.parsed).toBe(false);
    expect(parsed.fields).toEqual([]);
  });

  it('a metadata bag with only non-scalar values does not produce fields', () => {
    const parsed = parseScriptOptions(
      entry({ install_methods: [{ options: { nested: { a: 1 }, list: [1, 2] } }] })
    );
    expect(parsed.parsed).toBe(false);
  });

  it('a duplicated option key across install methods is surfaced once', () => {
    const parsed = parseScriptOptions(
      entry({
        install_methods: [{ options: { port: 80 } }, { config: { port: 443 } }]
      })
    );
    expect(parsed.fields.filter((f) => f.key === 'port')).toHaveLength(1);
  });
});

// ===========================================================================
// Task 2 — the plain-LXC wizard steps
// ===========================================================================

describe('Task 2 — LXC step model', () => {
  it('the plain-LXC path is Path → Source → Resources → Network → Review', () => {
    expect(lxcStepsForPath('plain-lxc')).toEqual([
      'path',
      'source',
      'resources',
      'network',
      'review'
    ]);
  });

  it('the community-script path has the same five steps', () => {
    expect(lxcStepsForPath('community-script')).toEqual([
      'path',
      'source',
      'resources',
      'network',
      'review'
    ]);
  });

  it('NEITHER LXC path includes a Cloud-Init step (UI-SPEC step model)', () => {
    expect(lxcStepsForPath('plain-lxc')).not.toContain('cloud-init');
    expect(lxcStepsForPath('community-script')).not.toContain('cloud-init');
  });

  it('a non-LXC path throws (the helper is LXC-only)', () => {
    expect(() => lxcStepsForPath('cloud-image')).toThrow();
  });
});

describe('Task 2 — LXC-07 toggle defaults', () => {
  it('unprivileged defaults ON, nesting defaults OFF', () => {
    expect(LXC_RESOURCE_DEFAULTS.unprivileged).toBe(true);
    expect(LXC_RESOURCE_DEFAULTS.nesting).toBe(false);
  });

  it('no features are pre-checked by default', () => {
    expect(LXC_RESOURCE_DEFAULTS.features).toEqual([]);
  });

  it('the features checkbox group offers keyctl + fuse', () => {
    expect([...LXC_FEATURE_FLAGS]).toEqual(['keyctl', 'fuse']);
  });
});

describe('Task 2 — validateLxcStep', () => {
  it('the plain-LXC Source step requires an ostemplate', () => {
    expect(validateLxcStep('source', 'plain-lxc', {})).toHaveProperty('ostemplate');
    expect(
      validateLxcStep('source', 'plain-lxc', { ostemplate: 'local:vztmpl/ubuntu.tar.zst' })
    ).toEqual({});
  });

  it('the community-script Source step requires a script_slug', () => {
    expect(validateLxcStep('source', 'community-script', {})).toHaveProperty(
      'script_slug'
    );
    expect(
      validateLxcStep('source', 'community-script', { script_slug: 'jellyfin' })
    ).toEqual({});
  });

  it('the Resources step requires node, storage, hostname, and positive sizing', () => {
    const errs = validateLxcStep('resources', 'plain-lxc', {});
    expect(errs).toHaveProperty('node');
    expect(errs).toHaveProperty('storage');
    expect(errs).toHaveProperty('hostname');
    expect(errs).toHaveProperty('cpu_cores');
    expect(errs).toHaveProperty('memory_mb');
    expect(errs).toHaveProperty('disk_gb');
  });

  it('a fully-filled Resources step is valid', () => {
    const valid = lxcStepValid('resources', 'plain-lxc', {
      node: 'pve1',
      storage: 'local-lvm',
      hostname: 'web01',
      cpu_cores: 2,
      memory_mb: 1024,
      disk_gb: 16
    });
    expect(valid).toBe(true);
  });

  it('rejects a zero / non-integer CPU value', () => {
    const errs = validateLxcStep('resources', 'plain-lxc', {
      node: 'pve1',
      storage: 'local-lvm',
      hostname: 'web01',
      cpu_cores: 0,
      memory_mb: 1024,
      disk_gb: 16
    });
    expect(errs).toHaveProperty('cpu_cores');
  });
});

describe('Task 2 — buildLxcRequest', () => {
  it('translates the form bag into a CreateLxcRequest', () => {
    const body = buildLxcRequest(
      {
        node: 'pve1',
        storage: 'local-lvm',
        ostemplate: 'local:vztmpl/ubuntu-24.04.tar.zst',
        hostname: 'web01',
        cpu_cores: 2,
        memory_mb: 2048,
        disk_gb: 20,
        unprivileged: true,
        nesting: true,
        features: ['keyctl']
      },
      7
    );
    expect(body.team_id).toBe(7);
    expect(body.node).toBe('pve1');
    expect(body.ostemplate).toBe('local:vztmpl/ubuntu-24.04.tar.zst');
    expect(body.cpu_cores).toBe(2);
    expect(body.memory_mb).toBe(2048);
    expect(body.disk_gb).toBe(20);
    expect(body.unprivileged).toBe(true);
    expect(body.nesting).toBe(true);
    expect(body.features).toEqual(['keyctl']);
  });

  it('applies the LXC-07 toggle defaults when the form omits them', () => {
    const body = buildLxcRequest(
      {
        node: 'pve1',
        storage: 'local-lvm',
        ostemplate: 'local:vztmpl/ubuntu.tar.zst',
        hostname: 'web01',
        cpu_cores: 1,
        memory_mb: 512,
        disk_gb: 8
      },
      3
    );
    expect(body.unprivileged).toBe(true);
    expect(body.nesting).toBe(false);
    expect(body.features).toEqual([]);
  });
});

describe('Task 2 — buildCommunityScriptRequest', () => {
  it('translates the form bag into a CommunityScriptRequest (no ostemplate)', () => {
    const body = buildCommunityScriptRequest(
      {
        node: 'pve1',
        storage: 'local-lvm',
        script_slug: 'jellyfin',
        hostname: 'jelly01',
        cpu_cores: 2,
        memory_mb: 2048,
        disk_gb: 16,
        script_options: { db_name: 'media', port: 8096 }
      },
      9
    );
    expect(body.team_id).toBe(9);
    expect(body.script_slug).toBe('jellyfin');
    expect(body).not.toHaveProperty('ostemplate');
    expect(body.script_options).toEqual({ db_name: 'media', port: '8096' });
  });

  it('a defaults-only deploy carries an empty script_options map', () => {
    const body = buildCommunityScriptRequest(
      {
        node: 'pve1',
        storage: 'local-lvm',
        script_slug: 'pihole',
        hostname: 'ph01',
        cpu_cores: 1,
        memory_mb: 512,
        disk_gb: 8
      },
      1
    );
    expect(body.script_options).toEqual({});
  });
});

describe('Task 2 — mapLxcCreateError (the 409 inline-error case)', () => {
  it('maps a 409 to an over-quota message (the wizard stays put)', () => {
    const msg = mapLxcCreateError({ status: 409, detail: 'memory limit reached' });
    expect(msg.toLowerCase()).toContain('quota');
    expect(msg).toContain('memory limit reached');
  });

  it('maps a 403 to a permission message', () => {
    expect(mapLxcCreateError({ status: 403 }).toLowerCase()).toContain('permission');
  });

  it('maps a 422 to a check-the-fields message', () => {
    expect(mapLxcCreateError({ status: 422 }).toLowerCase()).toContain('fields');
  });

  it('falls back to a generic message for an unknown failure', () => {
    expect(mapLxcCreateError(new Error('network down')).toLowerCase()).toContain(
      'try again'
    );
  });
});
