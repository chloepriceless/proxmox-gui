// @vitest-environment happy-dom
// XSS regression tests for renderMarkdown (T-02-05-01 mitigation).
//
// Runs in happy-dom so DOMPurify has a real DOM (window + document) to work
// with. Without a DOM environment DOMPurify falls back to identity (server-
// side SSR path) and the XSS assertions would be vacuously true.

import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '$lib/utils/markdown';

describe('renderMarkdown', () => {
  it('renders basic bold + italic', () => {
    const html = renderMarkdown('**bold** _em_');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>em</em>');
  });

  it('strips <script> tags', () => {
    const html = renderMarkdown('hi <script>alert(1)</script>');
    expect(html.toLowerCase()).not.toContain('<script');
  });

  it('strips <iframe> tags', () => {
    const html = renderMarkdown('hi <iframe src="x"></iframe>');
    expect(html.toLowerCase()).not.toContain('<iframe');
  });

  it('strips on* event handlers', () => {
    const html = renderMarkdown('<a href="x" onclick="evil()">link</a>');
    expect(html.toLowerCase()).not.toContain('onclick');
  });

  it('strips javascript: URLs', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('converts single newlines to <br> with gfm breaks enabled', () => {
    const html = renderMarkdown('line1\nline2');
    expect(html).toContain('<br');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('preserves allowed tags: code, pre, blockquote', () => {
    const html = renderMarkdown('`inline code` and\n\n> blockquote');
    expect(html).toContain('<code>');
    expect(html).toContain('<blockquote>');
  });

  it('strips data-* attributes', () => {
    const html = renderMarkdown('<p data-x="y">text</p>');
    expect(html).not.toContain('data-x');
  });
});
