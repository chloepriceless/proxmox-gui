// Fetch wrapper — single entry point for every browser → API call.
//
// Responsibilities:
//   - Prefix /api/v1 to relative paths so call-sites stay focused on the
//     resource (e.g. apiFetch('/me') → /api/v1/me).
//   - Inject the X-CSRF-Token header from the JS-readable cookie on
//     state-changing requests (D-13 double-submit pattern). GET / HEAD /
//     OPTIONS skip the header to stay cache-friendly.
//   - Auto-serialise JSON bodies when the caller passes a plain object.
//   - Forward same-origin cookies (httpOnly session cookies + the
//     JS-readable CSRF cookie ride along automatically with same-origin).
//
// What it does NOT do:
//   - Throw on non-2xx (callers can branch on status); `apiJson` wraps that.
//   - Cache (use @tanstack/svelte-query for that).

import { readCsrfCookie } from './csrf';

const API_PREFIX = '/api/v1';
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/api')) return path;
  if (!path.startsWith('/')) return `${API_PREFIX}/${path}`;
  return `${API_PREFIX}${path}`;
}

type FetchBody = RequestInit['body'] | Record<string, unknown> | unknown[];

export interface ApiInit extends Omit<RequestInit, 'body'> {
  body?: FetchBody;
  /**
   * Optional fetch override. SSR loaders MUST pass `event.fetch` so cookies
   * and the SvelteKit URL relativisation come along (Pitfall A7). Browser
   * callers omit this and the global fetch is used.
   *
   * Underscore-prefixed because it is NOT a standard `fetch` init field —
   * the wrapper consumes it and discards before forwarding.
   */
  _fetch?: typeof fetch;
}

/**
 * Low-level fetch — returns the raw Response so callers can inspect status,
 * stream the body, etc. Does NOT throw on non-2xx.
 */
export async function apiFetch(path: string, init: ApiInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  let body: BodyInit | null | undefined = undefined;
  if (init.body !== undefined && init.body !== null) {
    if (
      typeof init.body === 'string' ||
      init.body instanceof FormData ||
      init.body instanceof Blob ||
      init.body instanceof ArrayBuffer ||
      init.body instanceof URLSearchParams ||
      (typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream)
    ) {
      body = init.body as BodyInit;
    } else {
      body = JSON.stringify(init.body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
  }

  if (STATE_CHANGING.has(method)) {
    const token = readCsrfCookie();
    if (token && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', token);
    }
  }

  // Strip the underscore-prefixed _fetch helper before forwarding to the real
  // fetch — it is NOT part of RequestInit and Node would log a warning if we
  // passed it through.
  const fetchImpl = init._fetch ?? fetch;
  const forwarded: ApiInit = { ...init };
  delete forwarded._fetch;

  return fetchImpl(buildUrl(path), {
    ...forwarded,
    method,
    headers,
    body,
    credentials: init.credentials ?? 'same-origin'
  });
}

/**
 * JSON-typed wrapper — throws ApiError on non-2xx, returns parsed body on
 * success. Use when the endpoint returns JSON and you want a clean happy
 * path.
 */
export async function apiJson<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  let parsed: unknown = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? String((parsed as { detail: unknown }).detail)
        : `Request failed: ${res.status}`;
    // AUTH-06 (Plan 05-06): when the server reports a server-side idle expiry
    // (401 session_idle_expired from /auth/refresh), broadcast it so the root
    // layout surfaces the in-place re-auth modal. UX glue only — still throws.
    if (res.status === 401 && message === 'session_idle_expired' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session_idle_expired'));
    }
    throw new ApiError(res.status, message, parsed);
  }
  return parsed as T;
}
