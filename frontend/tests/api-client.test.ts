// API client smoke tests — exercise the typed wrapper without a real backend.
//
// We cannot mount Svelte components without a DOM environment (jsdom isn't a
// dep yet), so the e2e/component coverage here lives at the API layer where
// vanilla TS plus a fetch stub is sufficient.

import { describe, expect, it, vi, afterEach } from 'vitest';
import { api, ApiError } from '../src/lib/api/client';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('api.auth.login', () => {
  it('POSTs to /api/v1/auth/login with username + password', async () => {
    const seen: { url: string; init: RequestInit } = { url: '', init: {} };
    globalThis.fetch = vi.fn(async (url, init) => {
      seen.url = String(url);
      seen.init = init ?? {};
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    await api.auth.login({ username: 'alice', password: 'hunter12hunter12' });

    expect(seen.url).toBe('/api/v1/auth/login');
    expect(seen.init.method).toBe('POST');
    const body = JSON.parse(String(seen.init.body));
    expect(body).toEqual({ username: 'alice', password: 'hunter12hunter12' });
  });

  it('throws ApiError with status 401 on wrong credentials', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    let caught: unknown = null;
    try {
      await api.auth.login({ username: 'alice', password: 'wrong' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(401);
  });

  it('throws ApiError with status 429 when rate-limited', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Too many requests', { status: 429 });
    }) as typeof fetch;

    let caught: unknown = null;
    try {
      await api.auth.login({ username: 'alice', password: 'pw' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(429);
  });
});

describe('api.me.get', () => {
  it('returns the user on 200', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: 1,
          username: 'alice',
          email: 'a@example.com',
          is_admin: true,
          is_active: true,
          created_at: '2026-05-14T00:00:00Z',
          teams: []
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const me = await api.me.get();
    expect(me).not.toBeNull();
    expect(me!.username).toBe('alice');
    expect(me!.is_admin).toBe(true);
  });

  it('returns null on 401', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('Unauthorized', { status: 401 })
    ) as typeof fetch;
    const me = await api.me.get();
    expect(me).toBeNull();
  });

  it('returns null on 403', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('Forbidden', { status: 403 })
    ) as typeof fetch;
    const me = await api.me.get();
    expect(me).toBeNull();
  });
});

describe('api.setup.status', () => {
  it('returns the predicate flags on 200', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ no_admin_yet: true, cluster_count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;
    const status = await api.setup.status();
    expect(status).toEqual({ no_admin_yet: true, cluster_count: 0 });
  });

  it('returns null when the API is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const status = await api.setup.status();
    expect(status).toBeNull();
  });
});

describe('api.setup.createAdmin', () => {
  it('POSTs the body and returns the created admin payload', async () => {
    const seen: { url: string; init: RequestInit } = { url: '', init: {} };
    globalThis.fetch = vi.fn(async (url, init) => {
      seen.url = String(url);
      seen.init = init ?? {};
      return new Response(
        JSON.stringify({ user_id: 1, personal_team_id: 1, username: 'alice' }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const result = await api.setup.createAdmin({
      username: 'alice',
      email: 'a@example.com',
      password: 'hunter12hunter12'
    });
    expect(seen.url).toBe('/api/v1/setup/admin');
    expect(result.username).toBe('alice');
    expect(result.user_id).toBe(1);
  });

  it('throws ApiError on 409 (initial setup already completed)', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ detail: 'Initial setup already completed' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    ) as typeof fetch;
    let caught: unknown = null;
    try {
      await api.setup.createAdmin({ username: 'a', email: 'a@example.com', password: 'pw' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
  });
});
