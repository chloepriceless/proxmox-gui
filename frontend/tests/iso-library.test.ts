// ISO library browser behaviour tests — Plan 04-13, Task 2.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (the same constraint every Phase 1-4 component test documents — see
// tests/vm-wizard.test.ts, tests/cloudinit-editor.test.ts). We therefore test
// the *logic* the ISO browser carries, exercising the real code in
// `iso-library.ts`:
//   - the command-search filter over the on-storage ISO list,
//   - the curated-image + free-URL `IsoDownloadRequest` builders (VM-08, D-16),
//   - the filename-from-URL derivation,
//   - the empty-state predicate (the no-on-storage-ISOs `EmptyState`),
//   - the light client-side URL-shape check.
//
// The rendered Svelte markup (the on-storage table, the `command` search box,
// the curated list, the free-URL input, the `EmptyState`) is exercised
// end-to-end by `pnpm exec svelte-check` (the typed-props contract) — see the
// plan's automated verification.
//
// A static assertion guards D-17: `IsoLibrary.svelte` carries NO admin gate —
// ISO URL-download is open to any authenticated user.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  filterIsos,
  filenameFromUrl,
  looksLikeHttpUrl,
  buildIsoUrlDownload,
  buildCloudImageDownload,
  isIsoLibraryEmpty,
} from '$lib/components/wizard/iso-library';
import type { CloudImage, IsoItem } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function iso(over: Partial<IsoItem>): IsoItem {
  return {
    volid: 'local:iso/debian-12.iso',
    filename: 'debian-12.iso',
    size: 660_000_000,
    storage: 'local',
    format: 'iso',
    ...over,
  };
}

function cloudImage(over: Partial<CloudImage> = {}): CloudImage {
  return {
    id: 'ubuntu-24.04',
    name: 'Ubuntu 24.04 LTS',
    os_family: 'ubuntu',
    version: '24.04',
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server.img',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// filterIsos — the command-search filter
// ---------------------------------------------------------------------------

describe('filterIsos — the on-storage ISO command search', () => {
  const isos = [
    iso({ volid: 'local:iso/debian-12.iso', filename: 'debian-12.iso', storage: 'local' }),
    iso({ volid: 'nas:iso/ubuntu-24.iso', filename: 'ubuntu-24.04.iso', storage: 'nas' }),
    iso({ volid: 'local:iso/rocky-9.iso', filename: 'rocky-9.iso', storage: 'local' }),
  ];

  it('returns the full list for an empty / whitespace query', () => {
    expect(filterIsos(isos, '')).toHaveLength(3);
    expect(filterIsos(isos, '   ')).toHaveLength(3);
  });

  it('filters by filename, case-insensitively', () => {
    const hit = filterIsos(isos, 'UBUNTU');
    expect(hit).toHaveLength(1);
    expect(hit[0].filename).toBe('ubuntu-24.04.iso');
  });

  it('filters by storage name', () => {
    const hit = filterIsos(isos, 'nas');
    expect(hit.map((i) => i.filename)).toEqual(['ubuntu-24.04.iso']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterIsos(isos, 'windows')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filenameFromUrl
// ---------------------------------------------------------------------------

describe('filenameFromUrl', () => {
  it('takes the last path segment', () => {
    expect(filenameFromUrl('https://example.com/iso/debian-12.iso')).toBe('debian-12.iso');
  });

  it('strips a query string / fragment', () => {
    expect(filenameFromUrl('https://x.com/a/ubuntu.img?token=abc#frag')).toBe('ubuntu.img');
  });

  it('falls back to download.iso for a tail-less URL', () => {
    expect(filenameFromUrl('https://example.com/')).toBe('download.iso');
    expect(filenameFromUrl('')).toBe('download.iso');
  });
});

// ---------------------------------------------------------------------------
// looksLikeHttpUrl — the light client-side shape check
// ---------------------------------------------------------------------------

describe('looksLikeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(looksLikeHttpUrl('http://example.com/a.iso')).toBe(true);
    expect(looksLikeHttpUrl('https://example.com/a.iso')).toBe(true);
  });

  it('rejects a non-http(s) scheme (the backend is the real SSRF guard)', () => {
    expect(looksLikeHttpUrl('ftp://example.com/a.iso')).toBe(false);
    expect(looksLikeHttpUrl('file:///etc/passwd')).toBe(false);
    expect(looksLikeHttpUrl('not a url')).toBe(false);
    expect(looksLikeHttpUrl('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildIsoUrlDownload — the free-URL download body (D-16)
// ---------------------------------------------------------------------------

describe('buildIsoUrlDownload', () => {
  it('builds an iso-content download request from a free URL', () => {
    const req = buildIsoUrlDownload({
      teamId: 7,
      node: 'pve1',
      storage: 'local',
      url: 'https://example.com/iso/freebsd-14.iso',
    });
    expect(req).toEqual({
      team_id: 7,
      node: 'pve1',
      storage: 'local',
      url: 'https://example.com/iso/freebsd-14.iso',
      content: 'iso',
      filename: 'freebsd-14.iso',
    });
  });

  it('honours an explicit filename override', () => {
    const req = buildIsoUrlDownload({
      teamId: 1,
      node: 'pve1',
      storage: 'local',
      url: 'https://example.com/dl?id=9',
      filename: 'custom.iso',
    });
    expect(req.filename).toBe('custom.iso');
  });

  it('trims the URL', () => {
    const req = buildIsoUrlDownload({
      teamId: 1,
      node: 'pve1',
      storage: 'local',
      url: '  https://example.com/a.iso  ',
    });
    expect(req.url).toBe('https://example.com/a.iso');
  });
});

// ---------------------------------------------------------------------------
// buildCloudImageDownload — the curated cloud-image download body (D-15)
// ---------------------------------------------------------------------------

describe('buildCloudImageDownload', () => {
  it('builds an import-content download request from a curated image', () => {
    const req = buildCloudImageDownload({
      teamId: 3,
      node: 'pve2',
      storage: 'images',
      image: cloudImage(),
    });
    expect(req.team_id).toBe(3);
    expect(req.node).toBe('pve2');
    expect(req.storage).toBe('images');
    expect(req.url).toBe(
      'https://cloud-images.ubuntu.com/noble/current/noble-server.img'
    );
    expect(req.content).toBe('import');
    expect(req.filename).toBe('noble-server.img');
  });
});

// ---------------------------------------------------------------------------
// isIsoLibraryEmpty — the no-on-storage-ISOs EmptyState predicate
// ---------------------------------------------------------------------------

describe('isIsoLibraryEmpty', () => {
  it('is true when there are no ISOs on storage', () => {
    expect(isIsoLibraryEmpty([])).toBe(true);
  });

  it('is false when at least one ISO is present', () => {
    expect(isIsoLibraryEmpty([iso({})])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D-17 — IsoLibrary carries no admin gate (ISO download open to any user)
// ---------------------------------------------------------------------------

describe('IsoLibrary — no admin gate (D-17)', () => {
  it('IsoLibrary.svelte contains no require_admin / isAdmin gate', () => {
    const path = fileURLToPath(
      new URL('../src/lib/components/wizard/IsoLibrary.svelte', import.meta.url)
    );
    const src = readFileSync(path, 'utf8');
    expect(src).not.toMatch(/\b(require_admin|isAdmin|is_admin)\b/);
  });

  it('IsoLibrary.svelte calls the iso API for listing + download', () => {
    const path = fileURLToPath(
      new URL('../src/lib/components/wizard/IsoLibrary.svelte', import.meta.url)
    );
    const src = readFileSync(path, 'utf8');
    // The codebase style chains the call across a line break
    // (`api.iso\n  .listIsos(...)` — see api/iso.ts, VmSourceStep.svelte), so
    // the assertion tolerates whitespace between `iso` and the method.
    expect(src).toMatch(/iso\s*\.\s*listIsos/);
    expect(src).toMatch(/iso\s*\.\s*downloadIso/);
  });
});
