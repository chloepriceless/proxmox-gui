// node-fit behaviour tests — Plan 04-12, Task 1.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (same constraint as every Phase 1-4 component test). We therefore
// test the *logic* the node-fit selector carries, exercising the real code in
// `node-fit.ts` — the pure helper `NodeSelect.svelte` renders.
//
// `computeNodeFit` returns, per node, `{fits, reason}`; `allBlocked` is the
// all-nodes-unfit signal that disables the Resources step's `Next` button.

import { describe, expect, it } from 'vitest';
import {
  computeNodeFit,
  allBlocked,
  type NodeResource
} from '$lib/components/wizard/node-fit';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A node with `freeRamMb` GB of RAM and `freeCpu` cores free. */
function node(name: string, freeCpu: number | null, freeRamMb: number | null): NodeResource {
  return { node: name, freeCpu, freeRamMb };
}

const GB = 1024;

// ---------------------------------------------------------------------------
// computeNodeFit
// ---------------------------------------------------------------------------

describe('computeNodeFit', () => {
  it('flags a node with less free RAM than requested as not fitting, with a reason', () => {
    const fits = computeNodeFit(
      { requestedCpu: 2, requestedRamMb: 4 * GB },
      [node('node-1', 8, 2 * GB)]
    );
    expect(fits).toHaveLength(1);
    expect(fits[0].fits).toBe(false);
    expect(fits[0].reason).toBe('node-1 — 2 GB free, needs 4 GB');
  });

  it('flags a node with less free CPU than requested as not fitting', () => {
    const fits = computeNodeFit(
      { requestedCpu: 8, requestedRamMb: 1 * GB },
      [node('node-2', 4, 16 * GB)]
    );
    expect(fits[0].fits).toBe(false);
    expect(fits[0].reason).toBe('node-2 — 4 vCPU free, needs 8');
  });

  it('marks a node that has room as fitting with a null reason', () => {
    const fits = computeNodeFit(
      { requestedCpu: 2, requestedRamMb: 4 * GB },
      [node('node-3', 8, 16 * GB)]
    );
    expect(fits[0].fits).toBe(true);
    expect(fits[0].reason).toBeNull();
  });

  it('reports the RAM shortfall first when both CPU and RAM are short', () => {
    const fits = computeNodeFit(
      { requestedCpu: 8, requestedRamMb: 8 * GB },
      [node('node-4', 2, 2 * GB)]
    );
    expect(fits[0].fits).toBe(false);
    expect(fits[0].reason).toContain('GB free');
  });

  it('keeps a node with an unknown (null) free figure pickable — fit is advisory', () => {
    const fits = computeNodeFit(
      { requestedCpu: 4, requestedRamMb: 8 * GB },
      [node('node-5', null, null)]
    );
    expect(fits[0].fits).toBe(true);
    expect(fits[0].reason).toBeNull();
  });

  it('re-evaluates fit when the requested CPU/RAM changes', () => {
    const nodes = [node('node-6', 4, 4 * GB)];
    // 2 vCPU / 2 GB fits a 4-core / 4 GB node.
    expect(computeNodeFit({ requestedCpu: 2, requestedRamMb: 2 * GB }, nodes)[0].fits).toBe(
      true
    );
    // Bumping the request past the free RAM flips the verdict.
    expect(computeNodeFit({ requestedCpu: 2, requestedRamMb: 8 * GB }, nodes)[0].fits).toBe(
      false
    );
  });

  it('renders a fractional GB figure with one decimal place', () => {
    const fits = computeNodeFit(
      { requestedCpu: 1, requestedRamMb: 4 * GB },
      [node('node-7', 8, 1536)] // 1.5 GB free
    );
    expect(fits[0].reason).toBe('node-7 — 1.5 GB free, needs 4 GB');
  });

  it('returns one verdict per node, in input order', () => {
    const fits = computeNodeFit({ requestedCpu: 2, requestedRamMb: 2 * GB }, [
      node('a', 8, 8 * GB),
      node('b', 1, 1 * GB),
      node('c', 8, 8 * GB)
    ]);
    expect(fits.map((f) => f.node)).toEqual(['a', 'b', 'c']);
    expect(fits.map((f) => f.fits)).toEqual([true, false, true]);
  });
});

// ---------------------------------------------------------------------------
// allBlocked
// ---------------------------------------------------------------------------

describe('allBlocked', () => {
  it('is true when every node fails fit', () => {
    const fits = computeNodeFit({ requestedCpu: 2, requestedRamMb: 16 * GB }, [
      node('a', 8, 2 * GB),
      node('b', 8, 4 * GB)
    ]);
    expect(allBlocked(fits)).toBe(true);
  });

  it('is false when at least one node fits', () => {
    const fits = computeNodeFit({ requestedCpu: 2, requestedRamMb: 4 * GB }, [
      node('a', 8, 2 * GB),
      node('b', 8, 16 * GB)
    ]);
    expect(allBlocked(fits)).toBe(false);
  });

  it('is false for an empty node list — no data is not the same as all-blocked', () => {
    expect(allBlocked([])).toBe(false);
  });
});
