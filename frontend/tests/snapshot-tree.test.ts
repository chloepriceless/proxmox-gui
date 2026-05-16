// Unit tests for the hand-rolled snapshot-tree builder (Plan 03-06, D-05).
//
// The tree-building logic is extracted into a pure module so it is testable in
// the `node` vitest environment without mounting the Svelte component (the
// same constraint api-client.test.ts / jobs-store.test.ts document).

import { describe, expect, it } from 'vitest';
import {
  buildSnapshotTree,
  childrenOf,
  flattenSnapshotOrder,
  currentSnapshotName,
} from '../src/lib/components/lifecycle/snapshot-tree';
import type { SnapshotItem } from '../src/lib/api/types';

/** Helper — a minimal SnapshotItem. */
function snap(
  name: string,
  parent: string | null,
  extra: Partial<SnapshotItem> = {}
): SnapshotItem {
  return {
    name,
    parent,
    snaptime: null,
    description: null,
    vmstate: null,
    ...extra,
  };
}

describe('buildSnapshotTree — hierarchy from parent pointers', () => {
  it('builds a single-root linear chain with increasing depth', () => {
    const list = [
      snap('clean-install', null),
      snap('before-upgrade', 'clean-install'),
      snap('prod-state', 'before-upgrade'),
    ];
    const tree = buildSnapshotTree(list);

    expect(tree).toHaveLength(1);
    expect(tree[0].snapshot.name).toBe('clean-install');
    expect(tree[0].depth).toBe(0);

    const child = tree[0].children[0];
    expect(child.snapshot.name).toBe('before-upgrade');
    expect(child.depth).toBe(1);

    const grandchild = child.children[0];
    expect(grandchild.snapshot.name).toBe('prod-state');
    expect(grandchild.depth).toBe(2);
    expect(grandchild.children).toHaveLength(0);
  });

  it('builds a branching tree — one parent with two children', () => {
    const list = [
      snap('base', null),
      snap('test-branch', 'base'),
      snap('prod-state', 'base'),
    ];
    const tree = buildSnapshotTree(list);

    expect(tree).toHaveLength(1);
    expect(tree[0].snapshot.name).toBe('base');
    expect(tree[0].children.map((c) => c.snapshot.name)).toEqual([
      'test-branch',
      'prod-state',
    ]);
    expect(tree[0].children.every((c) => c.depth === 1)).toBe(true);
  });

  it('treats a snapshot with an absent parent as a root (partial data)', () => {
    const list = [
      snap('orphan', 'gone-snapshot'), // parent not in the list
      snap('real-root', null),
    ];
    const tree = buildSnapshotTree(list);
    expect(tree.map((n) => n.snapshot.name).sort()).toEqual([
      'orphan',
      'real-root',
    ]);
  });

  it('handles multiple independent roots', () => {
    const list = [snap('a', null), snap('b', null), snap('a-child', 'a')];
    const tree = buildSnapshotTree(list);
    expect(tree).toHaveLength(2);
    const a = tree.find((n) => n.snapshot.name === 'a');
    expect(a?.children).toHaveLength(1);
  });

  it('returns an empty array for an empty list', () => {
    expect(buildSnapshotTree([])).toEqual([]);
  });
});

describe('childrenOf', () => {
  it('returns direct children of a parent name', () => {
    const list = [
      snap('base', null),
      snap('c1', 'base'),
      snap('c2', 'base'),
      snap('grandchild', 'c1'),
    ];
    expect(childrenOf(list, 'base').map((s) => s.name)).toEqual(['c1', 'c2']);
    expect(childrenOf(list, 'c1').map((s) => s.name)).toEqual(['grandchild']);
    expect(childrenOf(list, null).map((s) => s.name)).toEqual(['base']);
  });
});

describe('flattenSnapshotOrder — pre-order navigation order', () => {
  it('flattens a branching tree depth-first, pre-order', () => {
    const list = [
      snap('base', null),
      snap('test-branch', 'base'),
      snap('prod-state', 'base'),
      snap('test-leaf', 'test-branch'),
    ];
    expect(flattenSnapshotOrder(list)).toEqual([
      'base',
      'test-branch',
      'test-leaf',
      'prod-state',
    ]);
  });
});

describe('currentSnapshotName — the "current" marker', () => {
  it('detects the synthetic "current" snapshot', () => {
    const list = [snap('base', null), snap('current', 'base')];
    expect(currentSnapshotName(list)).toBe('current');
  });

  it('returns null when there is no "current" node', () => {
    expect(currentSnapshotName([snap('base', null)])).toBeNull();
    expect(currentSnapshotName([])).toBeNull();
  });

  it('the current marker still appears as a node in the built tree', () => {
    const list = [snap('base', null), snap('current', 'base')];
    const tree = buildSnapshotTree(list);
    expect(tree[0].children[0].snapshot.name).toBe('current');
    expect(currentSnapshotName(list)).toBe('current');
  });
});
