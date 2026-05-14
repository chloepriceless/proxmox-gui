// Markdown renderer with XSS sanitization.
//
// Uses marked v18 (lightweight; no plugin overhead) + DOMPurify v3 with a
// strict allow-list. XSS coverage: <script>, <iframe>, on* handlers, and
// javascript: URLs are all stripped. Unit tests in
// frontend/tests/components/markdown.test.ts cover these cases (run with
// happy-dom environment so DOMPurify has a real DOM).
//
// T-02-05-01 mitigation: PVE description is user-controlled and rendered into
// DOM via @html. DOMPurify's ALLOWED_TAGS + ALLOWED_ATTR constraints ensure
// no executable content can reach the browser.
//
// DOMPurify import note: The default ESM export is the factory function itself.
// In a real browser `DOMPurify.sanitize` is available directly (the browser
// build pre-binds to window). In Node/test environments (happy-dom) we must
// call `DOMPurify(window)` to produce the bound instance.

import { marked } from 'marked';
import DOMPurifyFactory from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'code', 'pre',
  'blockquote',
  'a',
];

const ALLOWED_ATTR = ['href', 'title'];

type PurifyInstance = { sanitize(dirty: string, config?: object): string };

/**
 * Resolve a DOMPurify instance that works in both browser and test (happy-dom)
 * environments. Called lazily on first use and cached.
 *
 * - Browser: the default export already has `.sanitize` bound.
 * - Node + happy-dom: the default export is the factory — call it with window.
 * - Pure Node (SSR, no DOM): return an identity function (safe because the
 *   output of renderMarkdown is only ever inserted via {@html} in client-side
 *   Svelte, never during SSR).
 */
function resolvePurify(): PurifyInstance {
  const dp = DOMPurifyFactory as unknown as {
    sanitize?: (dirty: string, config?: object) => string;
    (win: Window): PurifyInstance;
  };

  // Already a bound singleton (real browser build).
  if (typeof dp.sanitize === 'function') {
    return dp as unknown as PurifyInstance;
  }

  // Factory — needs a window (happy-dom, jsdom, etc.).
  if (typeof window !== 'undefined') {
    return (dp as (win: Window) => PurifyInstance)(window);
  }

  // SSR / pure Node — no DOM, return identity passthrough.
  return { sanitize: (html: string) => html };
}

let _purify: PurifyInstance | null = null;
function getPurify(): PurifyInstance {
  if (!_purify) _purify = resolvePurify();
  return _purify;
}

/**
 * Convert raw markdown to sanitized HTML.
 *
 * Strips: <script>, <iframe>, <style>, on* event handlers, javascript: URLs,
 * data-* attributes. All other HTML tags are stripped (only ALLOWED_TAGS
 * survive).
 *
 * Returns an empty string when `raw` is empty/null/undefined.
 */
export function renderMarkdown(raw: string): string {
  if (!raw) return '';
  const html = marked.parse(raw, { breaks: true, gfm: true }) as string;
  return getPurify().sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
