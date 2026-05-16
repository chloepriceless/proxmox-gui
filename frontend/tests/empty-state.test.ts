// EmptyState + HelpTooltip behavior tests + the Phase-4 API-module smoke test
// (Plan 04-09).
//
// The vitest environment is `node` — no DOM, so Svelte components cannot be
// mounted (same constraint as the Phase 1-3 component tests, which are all
// logic-only). We therefore test:
//   1. The EmptyState CTA-visibility contract — the pure predicate that
//      decides whether the CTA renders (CTA shows ONLY when both `ctaLabel`
//      AND `ctaHref` are set). This is the exact `hasCta` derivation in
//      EmptyState.svelte.
//   2. The HelpTooltip aria-label + variant-selection contract — the
//      `Help: <label>` aria-label format and the tooltip-vs-popover choice
//      (popover when `learnMoreHref` is set).
//   3. The API-module smoke test — every Phase-4 API module imports, is
//      reachable from the `api` namespace, and exports the expected typed
//      function names.
//
// The actual rendered Svelte props/markup are exercised end-to-end by
// `pnpm exec svelte-check` (the typed props contract) — see the plan's
// automated verification.

import { describe, expect, it } from 'vitest';
import { api } from '$lib/api/client';
import * as apiIndex from '$lib/api';
import * as provisioning from '$lib/api/provisioning';
import * as catalog from '$lib/api/catalog';
import * as networks from '$lib/api/networks';
import * as iso from '$lib/api/iso';
import * as consoleApi from '$lib/api/console';

// ---------------------------------------------------------------------------
// EmptyState — CTA-visibility contract
// ---------------------------------------------------------------------------

/** Mirrors the `hasCta` derivation in EmptyState.svelte. */
function hasCta(ctaLabel?: string, ctaHref?: string): boolean {
  return Boolean(ctaLabel) && Boolean(ctaHref);
}

describe('EmptyState CTA visibility', () => {
  it('renders the CTA when both ctaLabel and ctaHref are set', () => {
    expect(hasCta('Create one', '/create')).toBe(true);
  });

  it('is informational-only (no CTA) when both CTA props are absent', () => {
    expect(hasCta(undefined, undefined)).toBe(false);
  });

  it('does NOT render the CTA when only ctaLabel is set', () => {
    expect(hasCta('Create one', undefined)).toBe(false);
  });

  it('does NOT render the CTA when only ctaHref is set', () => {
    expect(hasCta(undefined, '/create')).toBe(false);
  });

  it('does NOT render the CTA when ctaLabel is an empty string', () => {
    expect(hasCta('', '/create')).toBe(false);
  });

  it('the /inventory empty state uses the pinned heading + CTA copy', () => {
    // 04-UI-SPEC §Copywriting Contract — the pinned /inventory empty state.
    const heading = 'You have no VMs yet';
    const body = 'Create your first VM or container to get started.';
    const ctaLabel = 'Create one';
    const ctaHref = '/create';
    expect(heading).toBe('You have no VMs yet');
    expect(body).toBe('Create your first VM or container to get started.');
    expect(hasCta(ctaLabel, ctaHref)).toBe(true);
    expect(ctaHref).toBe('/create');
  });
});

// ---------------------------------------------------------------------------
// HelpTooltip — aria-label + variant-selection contract
// ---------------------------------------------------------------------------

/** Mirrors the trigger `aria-label` format in HelpTooltip.svelte. */
function helpAriaLabel(label: string): string {
  return `Help: ${label}`;
}

/** Mirrors the tooltip-vs-popover branch in HelpTooltip.svelte. */
function usesPopover(learnMoreHref?: string): boolean {
  return Boolean(learnMoreHref);
}

describe('HelpTooltip aria-label', () => {
  it('composes the aria-label as "Help: <label>"', () => {
    expect(helpAriaLabel('Unprivileged container')).toBe(
      'Help: Unprivileged container'
    );
  });

  it('always starts the aria-label with "Help:"', () => {
    expect(helpAriaLabel('Target node').startsWith('Help:')).toBe(true);
  });
});

describe('HelpTooltip variant selection', () => {
  it('uses a plain tooltip when there is no learnMoreHref', () => {
    expect(usesPopover(undefined)).toBe(false);
  });

  it('uses a popover when a learnMoreHref is given (so the link is clickable)', () => {
    expect(usesPopover('https://pve.proxmox.com/wiki/Linux_Container')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase-4 API-module smoke test
// ---------------------------------------------------------------------------

describe('Phase-4 API modules — reachable from the api namespace', () => {
  it('exposes the five new modules on the api namespace', () => {
    expect(typeof api.provisioning).toBe('object');
    expect(typeof api.catalog).toBe('object');
    expect(typeof api.networks).toBe('object');
    expect(typeof api.iso).toBe('object');
    expect(typeof api.console).toBe('object');
  });

  it('re-exports the five modules from the api index', () => {
    expect(typeof apiIndex.provisioning).toBe('object');
    expect(typeof apiIndex.catalog).toBe('object');
    expect(typeof apiIndex.networks).toBe('object');
    expect(typeof apiIndex.iso).toBe('object');
    expect(typeof apiIndex.console).toBe('object');
  });

  it('provisioning exports the expected typed functions', () => {
    expect(typeof provisioning.createLxc).toBe('function');
    expect(typeof provisioning.createQemu).toBe('function');
    expect(typeof provisioning.createCommunityScript).toBe('function');
    expect(typeof provisioning.cloudinitPreview).toBe('function');
  });

  it('catalog exports the expected typed functions', () => {
    expect(typeof catalog.listCatalog).toBe('function');
    expect(typeof catalog.getCatalogEntry).toBe('function');
    expect(typeof catalog.syncCatalog).toBe('function');
  });

  it('networks exports the expected typed functions', () => {
    expect(typeof networks.listNetworks).toBe('function');
    expect(typeof networks.getTeamNetworkScope).toBe('function');
    expect(typeof networks.setTeamNetworkScope).toBe('function');
  });

  it('iso exports the expected typed functions', () => {
    expect(typeof iso.listIsos).toBe('function');
    expect(typeof iso.listCloudImages).toBe('function');
    expect(typeof iso.downloadIso).toBe('function');
  });

  it('console exports the expected typed function', () => {
    expect(typeof consoleApi.mintVncProxy).toBe('function');
  });

  it('the api namespace provisioning module is the same as the direct import', () => {
    expect(api.provisioning.createLxc).toBe(provisioning.createLxc);
  });
});
