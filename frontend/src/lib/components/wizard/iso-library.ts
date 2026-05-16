// ISO library browser — the framework-free logic helper (Plan 04-13, Task 2).
//
// `IsoLibrary.svelte` is a thin render shell; all DOM-free logic lives here so
// it is unit-testable in the `node` vitest environment (the established Plan
// 04-10/11/12 discipline — the `.svelte` files cannot be mounted in `node`, so
// the tested code IS the rendered code).
//
// This module:
//   - filters the on-storage ISO list by the command-search query,
//   - builds the `IsoDownloadRequest` body for a curated-image or a free-URL
//     download (VM-08, D-16),
//   - derives the filename a download should land under,
//   - exposes a light client-side URL-shape check (a UX nicety — the backend
//     `enqueue_iso_download` is the SSRF enforcement point, T-04-13-04).

import type { CloudImage, IsoDownloadRequest, IsoItem } from '$lib/api/types';

/**
 * Filter the on-storage ISO list by a free-text query — matched
 * case-insensitively against the filename and the storage. An empty query
 * returns the list unchanged. This is the exact predicate the `command`
 * search box in `IsoLibrary.svelte` applies.
 */
export function filterIsos(isos: IsoItem[], query: string): IsoItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return isos;
  return isos.filter(
    (iso) =>
      iso.filename.toLowerCase().includes(q) ||
      iso.storage.toLowerCase().includes(q)
  );
}

/**
 * Derive the filename a download should land under, from a download URL. The
 * last non-empty path segment is used; a URL with no usable tail (just a
 * scheme + host) falls back to `download.iso`. The scheme + host and any
 * query string / fragment are stripped first.
 */
export function filenameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'download.iso';
  // Strip the query / fragment.
  const noQuery = trimmed.split(/[?#]/)[0];
  // Strip the scheme + authority (`https://host[:port]`) so a tail-less URL
  // like `https://example.com/` does not yield the host as the "filename".
  const afterHost = noQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  const segments = afterHost.split('/').filter(Boolean);
  const tail = segments[segments.length - 1] ?? '';
  return tail || 'download.iso';
}

/**
 * A light client-side check that a string looks like an http(s) URL. This is a
 * UX nicety only — it lets the editor disable the "Download ISO" button before
 * a doomed round-trip. The REAL SSRF guard is the backend `enqueue_iso_download`
 * (Plan 04-05) which rejects a non-http(s) scheme 422 (T-04-13-04 — the
 * frontend gate is not the trust boundary).
 */
export function looksLikeHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}

/**
 * Build the `IsoDownloadRequest` body for a FREE-URL ISO download (D-16).
 * `content` is `iso` — a free-URL download is always an installation ISO.
 */
export function buildIsoUrlDownload(args: {
  teamId: number;
  node: string;
  storage: string;
  url: string;
  filename?: string;
}): IsoDownloadRequest {
  return {
    team_id: args.teamId,
    node: args.node,
    storage: args.storage,
    url: args.url.trim(),
    content: 'iso',
    filename: args.filename?.trim() || filenameFromUrl(args.url),
  };
}

/**
 * Build the `IsoDownloadRequest` body for a CURATED cloud-image download
 * (D-15) — picking a curated image triggers a download if it is absent. The
 * `content` is `import` (the PVE cloud-image content type — see the Plan-04-05
 * `IsoDownloadRequest` contract).
 */
export function buildCloudImageDownload(args: {
  teamId: number;
  node: string;
  storage: string;
  image: CloudImage;
}): IsoDownloadRequest {
  return {
    team_id: args.teamId,
    node: args.node,
    storage: args.storage,
    url: args.image.url,
    content: 'import',
    filename: filenameFromUrl(args.image.url),
  };
}

/** True when there are no ISOs on storage — drives the `EmptyState` render. */
export function isIsoLibraryEmpty(isos: IsoItem[]): boolean {
  return isos.length === 0;
}
