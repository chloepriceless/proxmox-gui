// node-fit — the pure, framework-free node-fit logic for the wizard Resources
// step (Plan 04-12).
//
// Given the requested CPU/RAM sizing and the live per-node free resources, this
// module computes per-node fit + a human reason string for every node that
// cannot host the request (D-24, VM-10). It is extracted from the `.svelte`
// files so the logic is unit-testable in the `node` vitest env — the same
// discipline as Plan 04-10's `wizard-model.ts` and Plan 04-11's `lxc-wizard.ts`.
//
// `NodeSelect.svelte` renders the result: an unfit node is a disabled
// (un-pickable) option carrying its reason; when EVERY node is unfit the step
// surfaces a `bg-warning/10` notice and blocks `Next`.
//
// References:
//   - 04-UI-SPEC §"Node-fit selector" (the disabled-node-with-reason contract)
//   - 04-CONTEXT.md D-24 (node-fit blocks unfit nodes)
//   - backend connector.node_resources — the live `/cluster/resources?type=node`
//     read this consumes (maxcpu/cpu/maxmem/mem).

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * One node's live free-resource figures — the wizard's node-fit input.
 *
 * Mirrors the figures the backend `connector.node_resources()` read exposes
 * (`/cluster/resources?type=node` — `maxcpu`/`cpu`/`maxmem`/`mem`), reduced to
 * the free CPU cores + free RAM the wizard needs. A node with no usable figure
 * (the read failed / the field is missing) should be passed with `freeCpu` /
 * `freeRamMb` `null` — `computeNodeFit` then treats it as fit-unknown and keeps
 * it pickable (node-fit is advisory; PVE rejects an impossible placement).
 */
export interface NodeResource {
  /** The Proxmox node name (the `node` value the create body carries). */
  node: string;
  /** Free CPU cores on the node, or `null` when the figure is unavailable. */
  freeCpu: number | null;
  /** Free RAM in MB on the node, or `null` when the figure is unavailable. */
  freeRamMb: number | null;
}

/** The requested sizing the node must accommodate. */
export interface NodeFitRequest {
  /** Requested CPU cores. */
  requestedCpu: number;
  /** Requested RAM in MB. */
  requestedRamMb: number;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** The per-node fit verdict — one entry per input node. */
export interface NodeFit {
  /** The node these figures belong to. */
  node: string;
  /** Whether the node can host the requested size. */
  fits: boolean;
  /**
   * The human reason a node does not fit — `null` when it fits (or when fit is
   * unknown and the node is kept pickable). Rendered inline on the disabled
   * option (Label 13/500 muted): e.g. "node-1 — 2 GB free, needs 4 GB".
   */
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render an MB figure as a compact GB string ("4 GB", "1.5 GB"). */
function gb(mb: number): string {
  const value = mb / 1024;
  // Whole GB shows no decimal; a fractional value keeps one place.
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// computeNodeFit
// ---------------------------------------------------------------------------

/**
 * Compute per-node fit for a requested size against the live free-resource
 * figures.
 *
 * A node fails fit when its free RAM **or** its free CPU is below the request.
 * The RAM shortfall is reported first (memory is the usual binding constraint
 * and the most legible reason); a CPU-only shortfall reports the CPU figure.
 *
 * A node whose free figure is `null` (the read failed / the field is missing)
 * is treated as fit-unknown — `fits: true`, `reason: null` — so the wizard
 * never hard-blocks on a missing read; the backend's row-locked admission and
 * PVE itself remain the real gate (node-fit is advisory — T-04-12-02).
 */
export function computeNodeFit(
  request: NodeFitRequest,
  nodes: NodeResource[]
): NodeFit[] {
  return nodes.map((n) => {
    // A missing RAM figure → fit-unknown; keep the node pickable.
    if (n.freeRamMb !== null && n.freeRamMb < request.requestedRamMb) {
      return {
        node: n.node,
        fits: false,
        reason: `${n.node} — ${gb(n.freeRamMb)} free, needs ${gb(
          request.requestedRamMb
        )}`
      };
    }
    if (n.freeCpu !== null && n.freeCpu < request.requestedCpu) {
      return {
        node: n.node,
        fits: false,
        reason: `${n.node} — ${n.freeCpu} vCPU free, needs ${request.requestedCpu}`
      };
    }
    return { node: n.node, fits: true, reason: null };
  });
}

/**
 * Whether EVERY node fails fit — the all-blocked signal. When true the
 * Resources step shows the `bg-warning/10` notice and disables `Next`.
 *
 * An empty node list is NOT "all blocked" — there is simply nothing to fit
 * against yet (the free-text node fallback handles the no-data case); only a
 * non-empty list where no node fits returns `true`.
 */
export function allBlocked(fits: NodeFit[]): boolean {
  return fits.length > 0 && fits.every((f) => !f.fits);
}
