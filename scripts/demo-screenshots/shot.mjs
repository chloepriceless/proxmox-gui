// Logs into the demo instance and captures README screenshots.
//
// Usage:  node shot.mjs [baseUrl] [outDir]
//   baseUrl default http://127.0.0.1:5173   (SvelteKit dev/preview server)
//   outDir  default <repo>/docs
//
// Requires a running demo backend (demo_server.py) + frontend. Reuses the
// Playwright + chromium install under /tmp/pwshot if present, else the local
// node_modules.

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pwPath = existsSync('/tmp/pwshot/node_modules/playwright')
  ? '/tmp/pwshot/node_modules/playwright'
  : 'playwright';
const { chromium } = require(pwPath);

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const OUT = process.argv[3] || path.resolve(process.cwd(), 'docs');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2,
  colorScheme: 'dark'
});
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

async function settle(ms = 1500) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  await page.waitForTimeout(ms);
}

// 1. Log in.
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#login-username', 'admin');
await page.fill('#login-password', 'demo-admin');
await Promise.all([
  page.waitForURL('**/inventory', { timeout: 20000 }).catch(() => {}),
  page.click('button[type=submit]')
]);
await settle();

// 2. Inventory overview. Make sure the VM rows are actually visible — the
//    cluster section is an accordion; expand it if the rows are hidden.
async function ensureRowsVisible() {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await page.locator('text=db-primary').first().isVisible().catch(() => false)) return true;
    const trigger = page.locator('[data-accordion-trigger], button:has-text("Homelab")').first();
    if (await trigger.count()) { await trigger.click().catch(() => {}); await page.waitForTimeout(700); }
    else await page.waitForTimeout(700);
  }
  return page.locator('text=db-primary').first().isVisible().catch(() => false);
}
await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
await settle(800);
await ensureRowsVisible();
await settle(800);
await page.screenshot({ path: path.join(OUT, 'screenshot-inventory.png'), fullPage: true });
console.log('wrote', path.join(OUT, 'screenshot-inventory.png'));

// 3. VM detail (db-primary, cluster 1, vmid 110).
await page.goto(`${BASE}/inventory/1/110`, { waitUntil: 'networkidle' });
await settle(1800); // let the RRD chart animate/draw
await page.screenshot({ path: path.join(OUT, 'screenshot-vm-detail.png'), fullPage: true });
console.log('wrote', path.join(OUT, 'screenshot-vm-detail.png'));

await browser.close();
