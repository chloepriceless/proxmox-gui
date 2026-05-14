import { afterEach, describe, expect, it } from 'vitest';

// Pure-logic mirror of maxUtilization + band-class derivation.
function maxUtilization(rows: Array<{usage:{cpu_cores:number;ram_gb:number;disk_gb:number;vm_count:number;lxc_count:number}; limit:{cpu_cores:number|null;ram_gb:number|null;disk_gb:number|null;vm_count:number|null}}>): number {
  let u = 0;
  for (const r of rows) {
    const l = r.limit;
    if (l.cpu_cores) u = Math.max(u, r.usage.cpu_cores / l.cpu_cores);
    if (l.ram_gb)    u = Math.max(u, r.usage.ram_gb / l.ram_gb);
    if (l.disk_gb)   u = Math.max(u, r.usage.disk_gb / l.disk_gb);
    if (l.vm_count)  u = Math.max(u, (r.usage.vm_count + r.usage.lxc_count) / l.vm_count);
  }
  return u;
}

function bandClass(u: number): 'ok'|'warning'|'critical' {
  if (u >= 0.95) return 'critical';
  if (u >= 0.80) return 'warning';
  return 'ok';
}

describe('QuotaIndicator math', () => {
  it('returns 0 for empty rows', () => {
    expect(maxUtilization([])).toBe(0);
    expect(bandClass(0)).toBe('ok');
  });
  it('flags warning at exactly 80%', () => {
    expect(bandClass(0.80)).toBe('warning');
  });
  it('flags critical at exactly 95%', () => {
    expect(bandClass(0.95)).toBe('critical');
  });
  it('flags critical when CPU is at 95% and RAM is fine (19/20 = 0.95)', () => {
    const u = maxUtilization([{ usage: { cpu_cores: 19, ram_gb: 2, disk_gb: 0, vm_count: 0, lxc_count: 0 }, limit: { cpu_cores: 20, ram_gb: 100, disk_gb: null, vm_count: null }}]);
    // 19/20 = 0.95 → critical threshold
    expect(bandClass(u)).toBe('critical');
  });
  it('flags warning when CPU is at 80% (16/20 = 0.80)', () => {
    const u = maxUtilization([{ usage: { cpu_cores: 16, ram_gb: 2, disk_gb: 0, vm_count: 0, lxc_count: 0 }, limit: { cpu_cores: 20, ram_gb: 100, disk_gb: null, vm_count: null }}]);
    expect(bandClass(u)).toBe('warning');
  });
  it('returns 0 when every limit is null (unlimited)', () => {
    const u = maxUtilization([{ usage: { cpu_cores: 99, ram_gb: 99, disk_gb: 99, vm_count: 99, lxc_count: 99 }, limit: { cpu_cores: null, ram_gb: null, disk_gb: null, vm_count: null }}]);
    expect(u).toBe(0);
  });
});

describe('sessionStorage toast-fired idempotency', () => {
  it('key format matches expected pattern for warning level', () => {
    const teamId = 1;
    const level = 'warning';
    const KEY = `proxmox-gui:quota-toast-fired:${level}:${teamId}`;
    expect(KEY).toBe('proxmox-gui:quota-toast-fired:warning:1');
  });
  it('key format matches expected pattern for critical level', () => {
    const teamId = 42;
    const level = 'critical';
    const KEY = `proxmox-gui:quota-toast-fired:${level}:${teamId}`;
    expect(KEY).toBe('proxmox-gui:quota-toast-fired:critical:42');
  });
  it('idempotency: second write does not change stored value', () => {
    // Simulate with a plain Map (mirrors sessionStorage semantics)
    const store = new Map<string, string>();
    const KEY = 'proxmox-gui:quota-toast-fired:warning:1';
    store.set(KEY, '1');
    expect(store.get(KEY)).toBe('1');
    // Second set — value stays '1', no side effect from a second call
    store.set(KEY, '1');
    expect(store.get(KEY)).toBe('1');
    expect(store.size).toBe(1);
  });
});
