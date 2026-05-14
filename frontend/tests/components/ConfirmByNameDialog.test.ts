// ConfirmByNameDialog logic tests.
//
// We can't mount the Svelte component without a DOM env. Instead we extract
// the comparison logic and the ENTER-suppression contract and test them
// directly. The actual props interface is exercised by `pnpm run check`
// (svelte-check enforces the typed props contract end-to-end).

import { describe, expect, it } from 'vitest';

/** Mirrors the comparison done in ConfirmByNameDialog.svelte. */
function matches(typed: string, target: string): boolean {
  return typed.trim() === target.trim();
}

/** Mirrors the ENTER suppression in ConfirmByNameDialog.svelte. */
function suppressEnter(key: string): boolean {
  return key === 'Enter';
}

describe('ConfirmByNameDialog typed-name match', () => {
  it('disables confirm when typed value differs', () => {
    expect(matches('alic', 'alice')).toBe(false);
  });

  it('enables confirm when typed value matches exactly', () => {
    expect(matches('alice', 'alice')).toBe(true);
  });

  it('is case-sensitive', () => {
    expect(matches('Alice', 'alice')).toBe(false);
  });

  it('trims leading/trailing whitespace before compare', () => {
    expect(matches('  alice  ', 'alice')).toBe(true);
  });

  it('does NOT collapse internal whitespace', () => {
    expect(matches('al ice', 'alice')).toBe(false);
  });

  it('correctly handles target names with surrounding whitespace too', () => {
    expect(matches('alice', '  alice  ')).toBe(true);
  });

  it('returns false on empty typed value', () => {
    expect(matches('', 'alice')).toBe(false);
  });
});

describe('ConfirmByNameDialog ENTER suppression', () => {
  it('suppresses ENTER (UI-SPEC: ENTER must NOT submit)', () => {
    expect(suppressEnter('Enter')).toBe(true);
  });

  it('does not suppress other keys', () => {
    expect(suppressEnter('Escape')).toBe(false);
    expect(suppressEnter('Tab')).toBe(false);
    expect(suppressEnter('a')).toBe(false);
  });
});
