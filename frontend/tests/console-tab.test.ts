// Console-tab + provisioning-banner behaviour tests — Plan 04-14 Task 2.
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (same constraint as every Phase 1-4 component test, which are all
// logic-only — see tests/lxc-wizard.test.ts, tests/empty-state.test.ts).
//
// We therefore test the *logic* the ConsoleTab + the provisioning banner
// carry, exercising the real code in `console-tab.ts` + `provisioning-banner.ts`:
//   Console — the state machine (no iframe on mount — CON-02), the relay-URL
//     safety check (no Proxmox-host :8006 URL — CON-03), the placeholder copy.
//   Provisioning banner — the create-job match + the running/failed/dismissed
//     state derivation, the pinned copy, the friendly-error fallback.
//
// The rendered Svelte props/markup are exercised end-to-end by
// `pnpm exec svelte-check` (the typed-props contract) — see the plan verify.

import { describe, expect, it } from 'vitest';
import {
  consoleEmbedSrc,
  consoleIframeSrc,
  iframeVisible,
  isSafeRelayUrl,
  placeholderBody,
  type ConsoleState
} from '$lib/components/console/console-tab';
import {
  bannerState,
  findCreateJob,
  provisioningFailureText,
  provisioningRunningText
} from '$lib/components/inventory/provisioning-banner';
import type { Job } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Console — the iframe is NOT rendered until "Open console" (CON-02)
// ---------------------------------------------------------------------------

describe('ConsoleTab state machine', () => {
  it('does NOT render the iframe in the placeholder state — never mint on load', () => {
    expect(iframeVisible('placeholder')).toBe(false);
  });

  it('does NOT render the iframe while connecting (the mint is still in flight)', () => {
    expect(iframeVisible('connecting')).toBe(false);
  });

  it('does NOT render the iframe in the error state', () => {
    expect(iframeVisible('error')).toBe(false);
  });

  it('renders the iframe ONLY once the session is live', () => {
    expect(iframeVisible('live')).toBe(true);
  });

  it('does not render the iframe once the session is disconnected', () => {
    expect(iframeVisible('disconnected')).toBe(false);
  });

  it('the placeholder state is the on-mount default (asserts no iframe on mount)', () => {
    const onMount: ConsoleState = 'placeholder';
    expect(iframeVisible(onMount)).toBe(false);
  });

  it('uses the pinned placeholder body copy', () => {
    expect(placeholderBody('web-01')).toBe(
      'Open a live console session to web-01. The session opens in this panel.'
    );
  });
});

// ---------------------------------------------------------------------------
// Console — the relay URL must never be a Proxmox-host URL (CON-03)
// ---------------------------------------------------------------------------

describe('ConsoleTab relay-URL safety (CON-03)', () => {
  it('accepts the GUI-origin reverse-proxied relay path', () => {
    expect(isSafeRelayUrl('/api/v1/ws/console/1/vm/101')).toBe(true);
  });

  it('rejects a Proxmox-host URL carrying the :8006 PVE web port', () => {
    expect(isSafeRelayUrl('wss://pve-host:8006/api2/json/nodes/n/qemu/101/vncwebsocket')).toBe(
      false
    );
  });

  it('rejects a raw PVE vncwebsocket URL even without an explicit port', () => {
    expect(isSafeRelayUrl('wss://pve-host/api2/json/nodes/n/qemu/101/vncwebsocket')).toBe(false);
  });

  it('rejects an empty relay URL', () => {
    expect(isSafeRelayUrl('')).toBe(false);
  });

  it('consoleIframeSrc throws rather than ever pointing the iframe at :8006', () => {
    expect(() => consoleIframeSrc('wss://pve-host:8006/.../vncwebsocket')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Console — the iframe loads the GUI-origin /console/embed HTML route, never a
// raw WebSocket path and never a Proxmox-host URL (Plan 04-15, CON-01/CON-03)
// ---------------------------------------------------------------------------

describe('ConsoleTab embed-src composition (Plan 04-15)', () => {
  it('consoleEmbedSrc composes the /console/embed?ws=<encoded> URL from a relay path', () => {
    expect(consoleEmbedSrc('/api/v1/ws/console/clusters/1/qemu/101')).toBe(
      '/console/embed?ws=%2Fapi%2Fv1%2Fws%2Fconsole%2Fclusters%2F1%2Fqemu%2F101'
    );
  });

  it('consoleEmbedSrc URL-encodes the relay path exactly once as the ws query value', () => {
    const src = consoleEmbedSrc('/api/v1/ws/console/2/lxc/200');
    expect(src.startsWith('/console/embed?ws=')).toBe(true);
    // single-encoding — the encoded path must not contain a double-encoded %25.
    expect(src).not.toContain('%25');
    expect(src.slice('/console/embed?ws='.length)).toBe(
      encodeURIComponent('/api/v1/ws/console/2/lxc/200')
    );
  });

  it('consoleEmbedSrc throws on a :8006 Proxmox-host URL (CON-03 guard preserved)', () => {
    expect(() => consoleEmbedSrc('wss://pve-host:8006/.../vncwebsocket')).toThrow();
  });

  it('consoleEmbedSrc throws on a raw vncwebsocket Proxmox URL', () => {
    expect(() =>
      consoleEmbedSrc('wss://pve-host/api2/json/nodes/n/qemu/101/vncwebsocket')
    ).toThrow();
  });

  it('consoleIframeSrc accepts a /console/embed?ws= URL and returns it unchanged', () => {
    const url = '/console/embed?ws=%2Fapi%2Fv1%2Fws%2Fconsole%2Fclusters%2F1%2Fqemu%2F101';
    expect(consoleIframeSrc(url)).toBe(url);
  });

  it('consoleIframeSrc rejects a bare /api/v1/ws/console/... WebSocket path', () => {
    expect(() => consoleIframeSrc('/api/v1/ws/console/clusters/1/qemu/101')).toThrow();
  });

  it('consoleIframeSrc rejects any :8006 URL even with the embed prefix', () => {
    expect(() =>
      consoleIframeSrc('/console/embed?ws=wss://pve-host:8006/x')
    ).toThrow();
  });

  it('the composed iframe src round-trips through consoleIframeSrc', () => {
    const composed = consoleEmbedSrc('/api/v1/ws/console/clusters/3/lxc/300');
    expect(consoleIframeSrc(composed)).toBe(composed);
    expect(composed).not.toContain(':8006');
  });
});

// ---------------------------------------------------------------------------
// Provisioning banner — create-job match + state derivation
// ---------------------------------------------------------------------------

function job(over: Partial<Job>): Job {
  return {
    id: 1,
    kind: 'vm.create',
    state: 'running',
    cluster_id: 1,
    team_id: 1,
    upid: null,
    upid_node: null,
    error: null,
    friendly_error: null,
    batch_id: null,
    created_at: '2026-05-16T10:00:00Z',
    started_at: null,
    finished_at: null,
    ...over
  };
}

describe('provisioning banner — create-job match', () => {
  it('finds the create job for the cluster', () => {
    const jobs = [
      job({ id: 1, kind: 'vm.power', cluster_id: 1 }),
      job({ id: 2, kind: 'lxc.create', cluster_id: 1 })
    ];
    expect(findCreateJob(jobs, 1)?.id).toBe(2);
  });

  it('ignores create jobs on other clusters', () => {
    const jobs = [job({ id: 5, kind: 'vm.create', cluster_id: 9 })];
    expect(findCreateJob(jobs, 1)).toBeNull();
  });

  it('picks the newest create job when several exist', () => {
    const jobs = [
      job({ id: 1, kind: 'vm.create', cluster_id: 1, created_at: '2026-05-16T08:00:00Z' }),
      job({ id: 2, kind: 'vm.create', cluster_id: 1, created_at: '2026-05-16T12:00:00Z' })
    ];
    expect(findCreateJob(jobs, 1)?.id).toBe(2);
  });

  it('returns null when there is no create job', () => {
    expect(findCreateJob([job({ kind: 'vm.power' })], 1)).toBeNull();
  });
});

describe('provisioning banner — state derivation', () => {
  it('is "running" while the create job is in flight', () => {
    expect(bannerState(job({ state: 'running' }))).toBe('running');
    expect(bannerState(job({ state: 'pending' }))).toBe('running');
    expect(bannerState(job({ state: 'claimed' }))).toBe('running');
  });

  it('is "failed" when the create job failed', () => {
    expect(bannerState(job({ state: 'failed' }))).toBe('failed');
  });

  it('self-dismisses ("none") on success', () => {
    expect(bannerState(job({ state: 'succeeded' }))).toBe('none');
  });

  it('is "none" when there is no create job', () => {
    expect(bannerState(null)).toBe('none');
  });

  it('uses the pinned running-banner copy', () => {
    expect(provisioningRunningText('db-02')).toBe(
      'Provisioning db-02… This page updates automatically.'
    );
  });

  it('surfaces the friendly PVE error on failure', () => {
    expect(provisioningFailureText(job({ state: 'failed', friendly_error: 'Out of disk space.' }))).toBe(
      'Out of disk space.'
    );
  });

  it('falls back to a generic message when no friendly error is set', () => {
    expect(provisioningFailureText(job({ state: 'failed' }))).toBe('Provisioning failed.');
  });
});
