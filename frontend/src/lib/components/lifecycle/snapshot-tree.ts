// Pure tree-building logic for the hand-rolled SnapshotTree (D-05).
//
// Extracted from SnapshotTree.svelte so the parent-pointer → hierarchy
// transform is unit-testable in the `node` vitest environment (no DOM /
// component mounting available — same constraint api-client.test.ts documents).
//
// NO tree-view npm dependency — this is ~40 lines of plain TS that the
// recursive Svelte component renders.

import type { SnapshotItem } from '$lib/api/types';

/** One node of the built snapshot hierarchy. */
export interface SnapshotTreeNode {
  snapshot: SnapshotItem;
  /** 0 for a root, +1 per level. Drives the 24px indent. */
  depth: number;
  /** Recursively-built children, in list order. */
  children: SnapshotTreeNode[];
}

/**
 * Returns the direct children of `parentName` (null = roots). A snapshot is
 * treated as a root when its `parent` is null OR when its declared parent name
 * is absent from the list — defensive against partial / out-of-order data.
 */
export function childrenOf(
  snapshots: SnapshotItem[],
  parentName: string | null
): SnapshotItem[] {
  const names = new Set(snapshots.map((s) => s.name));
  return snapshots.filter((s) => {
    const effectiveParent = s.parent && names.has(s.parent) ? s.parent : null;
    return effectiveParent === parentName;
  });
}

/**
 * Builds the recursive snapshot hierarchy from the flat parent-pointer list.
 * Roots come first; each node carries its depth and children.
 */
export function buildSnapshotTree(snapshots: SnapshotItem[]): SnapshotTreeNode[] {
  function build(parentName: string | null, depth: number): SnapshotTreeNode[] {
    return childrenOf(snapshots, parentName).map((snapshot) => ({
      snapshot,
      depth,
      children: build(snapshot.name, depth + 1),
    }));
  }
  return build(null, 0);
}

/**
 * Pre-order flattening of the tree — the roving-tabindex / arrow-key
 * navigation order.
 */
export function flattenSnapshotOrder(snapshots: SnapshotItem[]): string[] {
  const out: string[] = [];
  function walk(parentName: string | null): void {
    for (const node of childrenOf(snapshots, parentName)) {
      out.push(node.name);
      walk(node.name);
    }
  }
  walk(null);
  return out;
}

/**
 * The PVE live VM appears as a synthetic snapshot literally named "current".
 * Returns "current" when that marker is present in the list, else null.
 */
export function currentSnapshotName(snapshots: SnapshotItem[]): string | null {
  return snapshots.some((s) => s.name === 'current') ? 'current' : null;
}
