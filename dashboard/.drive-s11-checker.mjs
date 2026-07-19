// Session 11 acceptance — checker app: clock-skew warning (server_time is
// temporarily shifted +120s server-side), session picker with open-now
// default, in-only session hides the time-out toggle, and a scan carries
// the picked session's id to the DB (asserted by the caller afterwards).
// Checker web build on :8080; run from dashboard/.
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const SHOTS = process.env.SHOTS_DIR;
const consoleErrors = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 480, height: 950 } });
const page = await context.newPage();
page.on('pageerror', (e) => consoleErrors.push(String(e)));

const shot = (n) => page.screenshot({ path: join(SHOTS, `${n}.png`) });
const step = (m) => console.log('STEP:', m);
const text = () => page.evaluate(() => {
  const collect = (root) => {
    let out = root.textContent || '';
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) out += ' ' + collect(el.shadowRoot);
    }
    return out;
  };
  return collect(document.body);
});

async function expectText(sub, label) {
  for (let i = 0; i < 60; i++) {
    if ((await text()).includes(sub)) { console.log(`OK: ${label}`); return; }
    await page.waitForTimeout(300);
  }
  throw new Error(`ASSERT ${label}: "${sub}" not found on screen`);
}

async function wedgeScan(payload) {
  await page.keyboard.type(payload, { delay: 1 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
}

try {
  step('login as checker');
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(6000);
  const placeholder = page.locator('flt-semantics-placeholder');
  if (await placeholder.count()) await placeholder.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.mouse.click(240, 290);
  await page.waitForTimeout(300);
  await page.keyboard.type('j.ramos@mvc.edu.ph');
  await page.mouse.click(240, 370);
  await page.waitForTimeout(300);
  await page.keyboard.type('MvcChecker!2026');
  await page.keyboard.press('Enter');
  await expectText('My events', 'events screen after login');
  await expectText('Roster cached', 'roster downloaded');

  step('clock-skew warning shows (server_time shifted +120s)');
  await expectText('clock is', 'skew banner visible');
  const skewText = (await text()).match(/clock is (\d+)s (ahead of|behind)/);
  console.log(`  banner says: clock is ${skewText?.[1]}s ${skewText?.[2]} the server`);
  if (!skewText || Number(skewText[1]) < 90 || Number(skewText[1]) > 150) {
    throw new Error('skew magnitude wrong: ' + skewText?.[1]);
  }
  await shot('c01-skew-banner');

  step('session picker appears with the open-now default');
  await page.mouse.click(240, 472); // Start scanning (below the skew banner)
  await page.waitForTimeout(1200);
  await expectText('Which session?', 'picker sheet open');
  await expectText('Opening Program', 'session 1 listed');
  await expectText('Afternoon Plenary', 'session 2 listed');
  await expectText('● Open now', 'open-now default highlighted');
  await shot('c02-picker');

  step('pick session 1 (in-only) → toggle hidden, session in header');
  await page.mouse.click(240, 831); // Opening Program card in the sheet
  await page.waitForTimeout(1500);
  await expectText('School of Computing', 'scan screen open');
  await expectText('Opening Program', 'session label in header');
  await expectText('Check-in only session', 'in-only pill (no time-out toggle)');
  const scanText = await text();
  if (scanText.includes('Time-out')) throw new Error('Time-out toggle should be hidden for in_only');
  console.log('OK: no Time-out toggle');
  await shot('c03-inonly');

  step('scan Bea on session 1 → duplicate (her seeded in-scan is on THIS session)');
  await wedgeScan(process.env.BEA_TOKEN);
  await expectText('ALREADY TIMED-IN', 'session-1 duplicate blocked');
  await expectText('Bea A. Garcia', 'Bea identified');
  await shot('c04-s1-duplicate');

  step('back out, pick session 2 (in/out) → toggle visible');
  await page.mouse.click(30, 36); // back arrow
  await page.waitForTimeout(1200);
  await expectText('My events', 'back on events');
  await page.mouse.click(240, 472);
  await page.waitForTimeout(1200);
  await expectText('Which session?', 'picker again');
  await page.mouse.click(240, 898); // Afternoon Plenary card in the sheet
  await page.waitForTimeout(1500);
  await expectText('School of Computing', 'scan screen (session 2)');
  await expectText('Afternoon Plenary', 'session 2 label in header');
  await expectText('Time-out', 'toggle visible for in_out session');
  await shot('c05-inout');

  step('scan Bea on session 2 → ACCEPTED (duplicates are per session, A3)');
  await wedgeScan(process.env.BEA_TOKEN);
  await expectText('TIME-IN RECORDED', 'same student accepted on the other session');
  await shot('c06-s2-accepted');

  console.log('PAGE ERRORS:', consoleErrors.length ? consoleErrors : 'none');
  console.log('RESULT: PASS');
} catch (e) {
  await shot('c99-failure').catch(() => {});
  console.log('PAGE ERRORS:', consoleErrors);
  console.error('RESULT: FAIL —', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
