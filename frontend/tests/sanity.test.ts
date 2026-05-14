// Sanity test — confirms the test runner wires the $lib alias correctly and
// the `cn` helper composes Tailwind classes as advertised. Plan 01-03 ships
// this as the only test; feature-level tests land in Plans 01-08+.

import { describe, expect, it } from 'vitest';
import { cn } from '../src/lib/utils';

describe('cn', () => {
  it('joins string args with spaces', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('honours conditional object syntax', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar');
  });

  it('dedupes Tailwind conflicts (tailwind-merge)', () => {
    // p-2 should win over p-1 — tailwind-merge resolves the conflict.
    expect(cn('p-1', 'p-2')).toBe('p-2');
  });
});
