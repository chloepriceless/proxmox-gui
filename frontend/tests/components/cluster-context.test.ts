// @vitest-environment happy-dom
// localStorage round-trip tests for cluster_context utility.
//
// Runs in happy-dom so window.localStorage is available.
// Verifies SSR-safe defaults, numeric round-trips, and garbage-value fallback.

import { afterEach, describe, expect, it } from 'vitest';
import { ALL_CLUSTERS, getClusterContext, setClusterContext } from '$lib/utils/cluster_context';

describe('cluster_context localStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to ALL_CLUSTERS when key is absent', () => {
    expect(getClusterContext()).toBe(ALL_CLUSTERS);
  });

  it('round-trips a positive integer cluster id', () => {
    setClusterContext(42);
    expect(getClusterContext()).toBe(42);
  });

  it('round-trips another integer', () => {
    setClusterContext(1);
    expect(getClusterContext()).toBe(1);
  });

  it('stores ALL_CLUSTERS as the literal string "all"', () => {
    setClusterContext(ALL_CLUSTERS);
    expect(window.localStorage.getItem('proxmox-gui:cluster-context')).toBe('all');
  });

  it('falls back to ALL_CLUSTERS on non-numeric garbage', () => {
    window.localStorage.setItem('proxmox-gui:cluster-context', 'not-a-number');
    expect(getClusterContext()).toBe(ALL_CLUSTERS);
  });

  it('falls back to ALL_CLUSTERS on zero (not a valid cluster id)', () => {
    window.localStorage.setItem('proxmox-gui:cluster-context', '0');
    expect(getClusterContext()).toBe(ALL_CLUSTERS);
  });

  it('falls back to ALL_CLUSTERS on negative value', () => {
    window.localStorage.setItem('proxmox-gui:cluster-context', '-5');
    expect(getClusterContext()).toBe(ALL_CLUSTERS);
  });

  it('overwrites a previous selection', () => {
    setClusterContext(10);
    setClusterContext(20);
    expect(getClusterContext()).toBe(20);
  });
});
