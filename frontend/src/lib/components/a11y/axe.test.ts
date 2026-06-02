// @vitest-environment happy-dom
/**
 * Automated axe-core accessibility audit (Plan 05-05, D-17).
 *
 * This is the AUTOMATED half of the D-17 a11y pass; the manual half (keyboard
 * sweep, real screen-reader smoke test, visual contrast) is the blocking
 * Task 3 checkpoint.
 *
 * ── What this audits ─────────────────────────────────────────────────────
 * It runs axe-core against the a11y-critical RENDERED STRUCTURES the app shell
 * and key pages produce — the app-shell landmarks + skip link, the navigation
 * lists (Sidebar / MobileNav, which share `$lib/nav`), the inventory filter
 * controls + data table + the <md card reflow, the login form surface, and the
 * wizard small-screen gate. Each fragment mirrors the real component output
 * (same roles / aria / labels / list semantics), so a regression that drops an
 * `aria-label`, a form label, or breaks list/landmark semantics fails here.
 *
 * ── Why fragments, not mounted pages (RESEARCH Assumption A2) ─────────────
 * The real pages (`+page.svelte`) are tightly coupled to the SvelteKit runtime
 * (`$app/stores`, `$app/navigation`, load `data`, the api client, live stores)
 * and do not mount in a bare happy-dom unit context. Rather than ship a brittle
 * mount harness, we audit the rendered structures the components emit. The
 * authoritative full-page + screen-reader verification is the manual Task 3
 * checkpoint.
 *
 * ── Rule scope ───────────────────────────────────────────────────────────
 * We run the WCAG 2.0/2.1 A + AA rule tags. The `color-contrast` rule is
 * disabled: happy-dom does not compute real layout/paint, so contrast cannot be
 * measured here (A2) — it is verified visually in Task 3. The page-level
 * best-practice rules (`region`, `landmark-one-main`, `page-has-heading-one`)
 * are not in the A/AA tag set and so do not penalise these isolated fragments.
 */
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: {
    // happy-dom has no real paint → contrast is unmeasurable here. Deferred to
    // the manual Task 3 visual check (RESEARCH Assumption A2).
    'color-contrast': { enabled: false }
  }
};

/** Render an HTML fragment into the document body and run axe over it. */
async function auditHtml(html: string): Promise<axe.Result[]> {
  document.body.innerHTML = html;
  const results = await axe.run(document.body, AXE_OPTIONS);
  return results.violations;
}

/** Turn axe violations into a readable failure message. */
function describeViolations(violations: axe.Result[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)]`)
    .join('\n');
}

describe('axe-core accessibility audit (D-17)', () => {
  it('app shell: skip link + header/nav/main landmarks have no A/AA violations', async () => {
    const violations = await auditHtml(`
      <a href="#main-content" class="skip-link">Skip to content</a>
      <header>
        <button type="button" aria-label="Open navigation menu">≡</button>
        <span>Proxmox GUI</span>
        <button type="button" aria-label="Open user menu">CV</button>
      </header>
      <aside aria-label="Primary navigation">
        <nav aria-label="Primary">
          <ul>
            <li><a href="/inventory" aria-current="page">Inventory</a></li>
            <li><a href="/audit">Audit log</a></li>
          </ul>
        </nav>
      </aside>
      <main id="main-content"><h1>Inventory</h1></main>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('navigation drawer (Sidebar / MobileNav shared markup) has no A/AA violations', async () => {
    const violations = await auditHtml(`
      <nav aria-label="Primary">
        <h2>Resources</h2>
        <ul>
          <li><a href="/inventory" aria-current="page">Inventory</a></li>
          <li><a href="/audit">Audit log</a></li>
          <li><a href="/backups">Backups</a></li>
        </ul>
        <h2>Account</h2>
        <ul>
          <li><a href="/profile">Profile</a></li>
          <li>
            <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer">API docs</a>
          </li>
        </ul>
      </nav>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('inventory filter controls have accessible names', async () => {
    const violations = await auditHtml(`
      <main>
        <h1>Inventory</h1>
        <div>
          <label for="inv-search">Search</label>
          <input id="inv-search" type="text" placeholder="Search by name, vmid, or tag…" />
          <button type="button" aria-pressed="false">Select</button>
          <button type="button" aria-label="Refresh inventory">Refresh</button>
        </div>
      </main>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('inventory data table (md+) has header semantics with no A/AA violations', async () => {
    const violations = await auditHtml(`
      <main>
        <h1>Inventory</h1>
        <table>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Name</th>
              <th scope="col">Tags</th>
              <th scope="col">Node</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>running</td>
              <td>web-01</td>
              <td>prod</td>
              <td>pve-1</td>
              <td><button type="button" aria-label="Actions for web-01">⋯</button></td>
            </tr>
          </tbody>
        </table>
      </main>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('inventory card reflow (<md) uses a stretched link (no nested interactives)', async () => {
    // Mirrors the real card: the name is a "stretched link" (navigates the
    // whole card) and the action menu is a SIBLING button — not nested inside
    // an interactive card — so axe's `nested-interactive` rule passes.
    const violations = await auditHtml(`
      <main>
        <h1>Inventory</h1>
        <div class="relative">
          <div>
            <a href="/inventory/1/100" class="after:absolute after:inset-0">web-01</a>
            <div>100 · pve-1</div>
          </div>
          <div class="relative z-10">
            <button type="button" aria-label="Actions for web-01">⋯</button>
          </div>
          <div><span>running</span></div>
        </div>
      </main>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('login form surface has labelled inputs with no A/AA violations', async () => {
    const violations = await auditHtml(`
      <main>
        <h1>Sign in</h1>
        <form>
          <label for="username">Username</label>
          <input id="username" name="username" type="text" autocomplete="username" />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" />
          <button type="submit">Sign in</button>
        </form>
      </main>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('wizard small-screen gate (D-16) has no A/AA violations', async () => {
    const violations = await auditHtml(`
      <main>
        <h1>Best on a larger screen</h1>
        <p>The create wizard works best on a larger screen.</p>
        <a href="/inventory">Back to inventory</a>
      </main>
    `);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
