// Session 10 acceptance — batch QR card name auto-fit: a 48-char display
// name scales down (no wrap/overflow) in BOTH the on-screen preview and the
// print HTML. Run from dashboard/ with a vite dev server on :5173.
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const SHOTS = process.env.SHOTS_DIR;
const LONG = 'Alexandrina Maximiliana S. Concepcion-Villanueva';
const consoleErrors = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const step = (m) => console.log('STEP:', m);

try {
  step('login as event maker');
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'r.uy@mvc.edu.ph');
  await page.fill('input[type="password"]', 'MvcMaker!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });

  step('open Batch QR (/reports) and wait for cards');
  await page.goto('http://localhost:5173/reports');
  const nameEl = page.getByText(LONG).first();
  await nameEl.waitFor({ timeout: 30000 });

  step('preview: long name must not wrap or overflow its card');
  const m = await nameEl.evaluate((el) => ({
    fontSize: getComputedStyle(el).fontSize,
    lines: Math.round(el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).fontSize) * 1.2)),
    overflows: el.scrollWidth > el.clientWidth + 1,
  }));
  console.log('preview name metrics:', JSON.stringify(m));
  // 48 chars renders as a deliberate balanced 2-line break, scaled per line.
  if (m.overflows) throw new Error('preview: name overflows the card');
  if (m.lines > 2) throw new Error(`preview: name wrapped to ${m.lines} lines`);
  if (parseFloat(m.fontSize) >= 10.5) throw new Error('preview: font did not scale down');
  if (parseFloat(m.fontSize) < 6) throw new Error('preview: font below the 6px floor');
  await page.screenshot({ path: join(SHOTS, 'p01-preview.png') });
  console.log('OK: preview auto-fit');

  step('print HTML: same auto-fit in the generated window');
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByText('Generate PDF').click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(800);
  const pm = await popup.evaluate((long) => {
    const el = [...document.querySelectorAll('div')].find(
      (d) => d.textContent.replace(/\s+/g, ' ').trim() === long && d.children.length === 0);
    if (!el) return null;
    return {
      fontSize: getComputedStyle(el).fontSize,
      overflows: el.scrollWidth > el.clientWidth + 1,
      lines: Math.round(el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).fontSize) * 1.2)),
    };
  }, LONG);
  console.log('print name metrics:', JSON.stringify(pm));
  if (!pm) throw new Error('print: long-name card not found in popup');
  if (pm.overflows) throw new Error('print: name overflows the card');
  if (pm.lines > 2) throw new Error(`print: name wrapped to ${pm.lines} lines`);
  await popup.screenshot({ path: join(SHOTS, 'p02-print.png') });
  console.log('OK: print auto-fit');

  console.log('PAGE ERRORS:', consoleErrors.length ? consoleErrors : 'none');
  console.log('RESULT: PASS');
} catch (e) {
  await page.screenshot({ path: join(SHOTS, 'p99-failure.png') }).catch(() => {});
  console.log('PAGE ERRORS:', consoleErrors);
  console.error('RESULT: FAIL —', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
