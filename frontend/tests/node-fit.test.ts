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

// ---------------------------------------------------------------------------
// Live-data path (Plan 04-16 — VM-10)
//
// Before 04-16 the create wizard built `clusterNodes` with `freeCpu: null /
// freeRamMb: null`, so `computeNodeFit` could only ever return fit-unknown.
// 04-16 wires `GET /clusters/{id}/nodes/resources` into the wizard so each
// node carries REAL free figures. These tests prove the two ends of that path:
// real figures fire the "won't fit" verdict, and the degraded `null` path (the
// resources fetch failed) still keeps every node pickable.
// ---------------------------------------------------------------------------

/**
 * Map a `NodeResourceApi`-shaped row (the backend `NodeResourceItem` JSON the
 * `getNodeResources` API call returns) into the wizard's `NodeResource` shape.
 * This mirrors exactly what the `create/+page.svelte` `clusterNodes` `$effect`
 * does after the resources fetch resolves.
 */
function fromApiRow(row: {
  node: string;
  free_cpu: number;
  free_ram_mb: number;
}): NodeResource {
  return { node: row.node, freeCpu: row.free_cpu, freeRamMb: row.free_ram_mb };
}

describe('node-fit with live node-resources data (VM-10)', () => {
  it('fires a "won\'t fit" verdict for a node whose live free RAM is below the request', () => {
    // The backend route returned real figures: node-1 has 2 GB free.
    const apiRows = [
      { node: 'node-1', free_cpu: 8, free_ram_mb: 2 * GB, status: 'online' }
    ];
    const clusterNodes = apiRows.map(fromApiRow);
    const fits = computeNodeFit({ requestedCpu: 2, requestedRamMb: 4 * GB }, clusterNodes);
    expect(fits[0].fits).toBe(false);
    expect(fits[0].reason).toBe('node-1 — 2 GB free, needs 4 GB');
  });

  it('marks every node blocked when an over-large request exceeds all live free RAM', () => {
    const apiRows = [
      { node: 'node-1', free_cpu: 8, free_ram_mb: 4 * GB, status: 'online' },
      { node: 'node-2', free_cpu: 16, free_ram_mb: 8 * GB, status: 'online' }
    ];
    const clusterNodes = apiRows.map(fromApiRow);
    // Request 16 GB — neither node has it.
    const fits = computeNodeFit({ requestedCpu: 2, requestedRamMb: 16 * GB }, clusterNodes);
    expect(allBlocked(fits)).toBe(true);
  });

  it('keeps the verdict fit-unknown when the resources fetch failed (null free figures)', () => {
    // Degraded path: `getNodeResources` rejected, so the `$effect` fell back to
    // inventory node names with `null` free figures. node-fit must stay
    // advisory — every node pickable, no "won't fit".
    const degradedNodes: NodeResource[] = [
      { node: 'node-1', freeCpu: null, freeRamMb: null },
      { node: 'node-2', freeCpu: null, freeRamMb: null }
    ];
    const fits = computeNodeFit({ requestedCpu: 4, requestedRamMb: 16 * GB }, degradedNodes);
    expect(fits.every((f) => f.fits)).toBe(true);
    expect(fits.every((f) => f.reason === null)).toBe(true);
    expect(allBlocked(fits)).toBe(false);
  });

  it('a node missing from the resources response keeps null free figures (fit-unknown)', () => {
    // The wizard merges inventory node names with the resources rows: a node
    // present in inventory but absent from the resources response keeps
    // `freeCpu: null / freeRamMb: null`. node-with-figures is judged; the
    // figure-less node stays pickable.
    const merged: NodeResource[] = [
      { node: 'node-1', freeCpu: 8, freeRamMb: 2 * GB }, // had a resources row
      { node: 'node-2', freeCpu: null, freeRamMb: null } // inventory-only
    ];
    const fits = computeNodeFit({ requestedCpu: 2, requestedRamMb: 4 * GB }, merged);
    expect(fits[0].fits).toBe(false);
    expect(fits[1].fits).toBe(true);
  });
});
