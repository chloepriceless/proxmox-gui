// Backups frontend smoke tests — Plan 03-07.
//
// The vitest environment is `node` (no DOM), so component mounting is not
// available — coverage lives at the API layer where a fetch stub is
// sufficient (the same constraint `api-client.test.ts` documents). These
// tests pin the backup / restore / schedule / backup-storage API contracts
// the Backups tab + /backups page + admin cluster page consume.

import { describe, expect, it, vi, afterEach } from 'vitest';
import { api, ApiError } from '../src/lib/api/client';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

/** Install a fetch stub that records the request and returns `body`. */
function stubFetch(
  body: unknown,
  status = 200
): { url: string; init: RequestInit } {
  const seen: { url: string; init: RequestInit } = { url: '', init: {} };
  globalThis.fetch = vi.fn(async (url, init) => {
    seen.url = String(url);
    seen.init = init ?? {};
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return seen;
}

describe('api.lifecycle.backupNow', () => {
  it('POSTs to the VM backup endpoint and returns the 202 body', async () => {
    const seen = stubFetch({ job_id: 7, state: 'pending', kind: 'vm.backup' }, 202);
    const res = await api.lifecycle.backupNow({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
    });
    expect(seen.url).toBe('/api/v1/clusters/1/vms/100/backup');
    expect(seen.init.method).toBe('POST');
    expect(res.job_id).toBe(7);
    expect(res.kind).toBe('vm.backup');
  });

  it('routes an LXC backup through the lxcs segment', async () => {
    const seen = stubFetch({ job_id: 8, state: 'pending', kind: 'vm.backup' }, 202);
    await api.lifecycle.backupNow({ clusterId: 2, vmid: 205, type: 'lxc' });
    expect(seen.url).toBe('/api/v1/clusters/2/lxcs/205/backup');
  });

  it('throws ApiError 409 when no backup storage is configured (D-08)', async () => {
    stubFetch({ detail: 'No backup storage is configured' }, 409);
    let caught: unknown = null;
    try {
      await api.lifecycle.backupNow({ clusterId: 1, vmid: 100, type: 'vm' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
  });
});

describe('api.lifecycle.listBackups', () => {
  it('GETs the VM backup file list', async () => {
    const seen = stubFetch({
      backups: [
        {
          volid: 'local:backup/vzdump-qemu-100-2026_05_14.vma.zst',
          filename: 'vzdump-qemu-100-2026_05_14.vma.zst',
          size: 3_400_000_000,
          ctime: 1_747_000_000,
          format: 'vma.zst',
        },
      ],
    });
    const res = await api.lifecycle.listBackups({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
    });
    expect(seen.url).toBe('/api/v1/clusters/1/vms/100/backups');
    expect(seen.init.method).toBe('GET');
    expect(res.backups).toHaveLength(1);
    expect(res.backups[0].filename).toBe('vzdump-qemu-100-2026_05_14.vma.zst');
  });
});

describe('api.lifecycle.restore', () => {
  it('POSTs an in-place restore with the archive + mode', async () => {
    const seen = stubFetch({ job_id: 9, state: 'pending', kind: 'vm.restore' }, 202);
    await api.lifecycle.restore({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
      archive: 'local:backup/vzdump-qemu-100.vma.zst',
      mode: 'in_place',
    });
    expect(seen.url).toBe('/api/v1/clusters/1/vms/100/restore');
    const sent = JSON.parse(String(seen.init.body));
    expect(sent.mode).toBe('in_place');
    expect(sent.archive).toBe('local:backup/vzdump-qemu-100.vma.zst');
    // In-place must NOT carry restore-as-new fields.
    expect(sent.new_vmid).toBeUndefined();
    expect(sent.new_name).toBeUndefined();
  });

  it('POSTs a restore-as-new with new_vmid + new_name', async () => {
    const seen = stubFetch({ job_id: 10, state: 'pending', kind: 'vm.restore' }, 202);
    await api.lifecycle.restore({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
      archive: 'local:backup/vzdump-qemu-100.vma.zst',
      mode: 'new',
      new_vmid: 110,
      new_name: 'vm-100-restore',
    });
    const sent = JSON.parse(String(seen.init.body));
    expect(sent.mode).toBe('new');
    expect(sent.new_vmid).toBe(110);
    expect(sent.new_name).toBe('vm-100-restore');
  });
});

describe('api.lifecycle.getSchedule / saveSchedule', () => {
  it('GETs the backup schedule and tolerates a null (no schedule)', async () => {
    const seen = stubFetch(null);
    const res = await api.lifecycle.getSchedule({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
    });
    expect(seen.url).toBe('/api/v1/clusters/1/vms/100/backup-schedule');
    expect(res).toBeNull();
  });

  it('PUTs the schedule frequency + keep_last', async () => {
    const seen = stubFetch({
      id: 1,
      cluster_id: 1,
      vmid: 100,
      is_lxc: false,
      node: 'node-01',
      enabled: true,
      frequency: 'weekly',
      keep_last: 4,
      last_run_at: null,
      last_run_state: null,
    });
    const res = await api.lifecycle.saveSchedule({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
      enabled: true,
      frequency: 'weekly',
      keep_last: 4,
    });
    expect(seen.url).toBe('/api/v1/clusters/1/vms/100/backup-schedule');
    expect(seen.init.method).toBe('PUT');
    const sent = JSON.parse(String(seen.init.body));
    expect(sent).toEqual({ enabled: true, frequency: 'weekly', keep_last: 4 });
    expect(res.frequency).toBe('weekly');
    expect(res.keep_last).toBe(4);
  });
});

describe('api.lifecycle.deleteBackupFile', () => {
  it('DELETEs the volid-scoped backup-file endpoint', async () => {
    const seen = stubFetch(
      { job_id: 11, state: 'pending', kind: 'vm.backup.delete' },
      202
    );
    await api.lifecycle.deleteBackupFile({
      clusterId: 1,
      vmid: 100,
      type: 'vm',
      volid: 'local:backup/vzdump-qemu-100.vma.zst',
    });
    expect(seen.url).toBe(
      '/api/v1/clusters/1/vms/100/backups/' +
        encodeURIComponent('local:backup/vzdump-qemu-100.vma.zst')
    );
    expect(seen.init.method).toBe('DELETE');
  });
});

describe('api.lifecycle.listScheduledBackups', () => {
  it('GETs the global team-scoped /backups/schedules list', async () => {
    const seen = stubFetch([
      {
        id: 1,
        cluster_id: 1,
        vmid: 100,
        is_lxc: false,
        node: 'node-01',
        enabled: true,
        frequency: 'daily',
        keep_last: 7,
        last_run_at: '2026-05-15T14:00:00Z',
        last_run_state: 'ok',
      },
    ]);
    const rows = await api.lifecycle.listScheduledBackups();
    expect(seen.url).toBe('/api/v1/backups/schedules');
    expect(seen.init.method).toBe('GET');
    expect(rows).toHaveLength(1);
    expect(rows[0].vmid).toBe(100);
    expect(rows[0].last_run_state).toBe('ok');
  });
});

describe('api.clusters.listBackupStorages', () => {
  it('GETs the cluster backup-capable storage list (D-08 admin picker)', async () => {
    const seen = stubFetch([
      { storage: 'backups', type: 'dir' },
      { storage: 'pbs01', type: 'pbs' },
    ]);
    const rows = await api.clusters.listBackupStorages(3);
    expect(seen.url).toBe('/api/v1/clusters/3/backup-storages');
    expect(seen.init.method).toBe('GET');
    expect(rows.map((r) => r.storage)).toEqual(['backups', 'pbs01']);
  });
});
