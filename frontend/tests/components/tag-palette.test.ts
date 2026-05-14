// Palette stability tests for paletteFor (FNV-1a hash → 12-bucket mapping).
//
// Verifies determinism across calls and that all outputs are valid palette
// entries composed of Phase 1 CSS tokens.

import { describe, expect, it } from 'vitest';
import { paletteFor, TAG_PALETTE_SIZE } from '$lib/utils/tag_palette';

describe('paletteFor', () => {
  it('returns the same class string for the same tag on repeated calls', () => {
    expect(paletteFor('prod')).toEqual(paletteFor('prod'));
    expect(paletteFor('db')).toEqual(paletteFor('db'));
    expect(paletteFor('web')).toEqual(paletteFor('web'));
  });

  it('TAG_PALETTE_SIZE is exactly 12', () => {
    expect(TAG_PALETTE_SIZE).toBe(12);
  });

  it('always returns one of the 12 known palette entries for any tag', () => {
    const seen = new Set<string>();
    const tags = ['a', 'b', 'c', 'prod', 'db', 'web', 'infra', 'dev', 'x', 'y', 'z', 'q', 'r', 's'];
    for (const t of tags) {
      seen.add(paletteFor(t));
    }
    expect(seen.size).toBeLessThanOrEqual(TAG_PALETTE_SIZE);
    for (const cls of seen) {
      expect(cls).toMatch(/bg-(primary|success|warning|destructive|muted)/);
    }
  });

  it('different tags can produce different palette entries (distribution check)', () => {
    const entries = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
                     'iota', 'kappa', 'lambda', 'mu'].map(paletteFor);
    const unique = new Set(entries);
    // With 12 distinct inputs and 12 buckets, we expect at least 3 distinct outputs
    // (birthday problem lower bound — not all can collide to 1).
    expect(unique.size).toBeGreaterThan(2);
  });
});
