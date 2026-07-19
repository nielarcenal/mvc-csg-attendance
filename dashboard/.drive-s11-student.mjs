// Session 11 acceptance — student app: per-day schedule on event detail,
// change-password flow (verified by real re-login), cached pass on an
// OFFLINE reopen. Student web build served on :8081; run from dashboard/.
import { chromium } from 'playwright-core';
import { join } from 'node:path';

const SHOTS = process.env.SHOTS_DIR;
const BASE = 'https://tpofzircnvafxvsnwshj.supabase.co';
const ANON = process.env.ANON;
const OLD_PW = 'MvcStudent!2026';
const NEW_PW = 'MvcStudent!2026x';
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

async function apiLogin(pw) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'j.delacruz@mvc.edu.ph', password: pw }),
  });
  return r.ok;
}

try {
  step('login as student');
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(6000);
  const placeholder = page.locator('flt-semantics-placeholder');
  if (await placeholder.count()) await placeholder.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.mouse.click(240, 290);
  await page.waitForTimeout(300);
  await page.keyboard.type('j.delacruz@mvc.edu.ph');
  await page.mouse.click(240, 370);
  await page.waitForTimeout(300);
  await page.keyboard.type(OLD_PW);
  await page.keyboard.press('Enter');
  await expectText('Hi, Juan', 'home after login');

  step('event detail shows the per-day session schedule');
  await shot('t01-home');
  // Hero card is the "Test" event — its Details button sits at ≈(408,207).
  await page.mouse.click(408, 207);
  await expectText('SCHEDULE', 'schedule card on event detail');
  await expectText('check-in', 'session row with mode + window');
  await shot('t02-detail-schedule');
  // back to home
  await page.mouse.click(36, 40);
  await expectText('Hi, Juan', 'back on home');

  step('generate a pass (TTL is now 600s)');
  await page.mouse.click(300, 918); // My ID tab
  await expectText('Digital ID', 'Digital ID screen');
  await shot('t03-id');
  // If a cached pass from an earlier session shows, the button says
  // Regenerate / Generate a new code; empty state says Generate my code.
  const idText = await text();
  const y = idText.includes('Generate my code') ? 356 : (idText.includes('valid for') ? 410 : 356);
  await page.mouse.click(240, y);
  await expectText('valid for', 'countdown running');
  const m1 = (await text()).match(/valid for (\d+) s/);
  if (!m1 || Number(m1[1]) < 500) throw new Error(`TTL should be ~600s, shows ${m1 && m1[1]}`);
  console.log(`OK: pass TTL ${m1[1]}s (600s default live)`);
  await shot('t04-pass-600');

  step('OFFLINE reopen still shows the cached pass honestly');
  await context.route(`${BASE}/**`, (r) => r.abort());
  await page.reload();
  await page.waitForTimeout(7000);
  const p2 = page.locator('flt-semantics-placeholder');
  if (await p2.count()) await p2.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await expectText('Hi, Juan', 'offline reopen lands on Home (cached identity)');
  await page.mouse.click(300, 918);
  await expectText('Digital ID', 'Digital ID after offline reopen');
  await expectText('valid for', 'cached pass shown with live countdown');
  const m2 = (await text()).match(/valid for (\d+) s/);
  console.log(`OK: cached pass countdown at ${m2 && m2[1]}s after reload`);
  await shot('t05-offline-cached');
  await context.unroute(`${BASE}/**`);

  step('change password (Profile → Change password)');
  await page.reload();
  await page.waitForTimeout(6000);
  const p3 = page.locator('flt-semantics-placeholder');
  if (await p3.count()) await p3.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await expectText('Hi, Juan', 'back online home');
  await page.mouse.click(420, 918); // Profile tab
  await expectText('Change password', 'profile menu');
  await shot('t06-profile');
  await page.getByText('Change password').first().click({ force: true })
    .catch(async () => { await page.mouse.click(240, 500); });
  await expectText('At least 8 characters', 'rule hints visible');
  await shot('t07-change-pw');
  // Fields: current (240,124), new (240,205), confirm (240,286) — replace
  // any stale text with select-all + type.
  const fill = async (y, value) => {
    await page.mouse.click(240, y);
    await page.waitForTimeout(400);
    await page.keyboard.press('Control+a');
    await page.keyboard.type(value);
    await page.waitForTimeout(200);
  };
  await fill(124, OLD_PW);
  await fill(205, NEW_PW);
  await fill(286, NEW_PW);
  await shot('t08-filled');
  await page.keyboard.press('Enter'); // confirm field submits
  await expectText('Password changed', 'success snackbar');
  await shot('t09-changed');

  step('verify against auth: old fails, new works');
  if (await apiLogin(OLD_PW)) throw new Error('old password still works');
  console.log('OK: old password refused');
  if (!(await apiLogin(NEW_PW))) throw new Error('new password does not work');
  console.log('OK: new password signs in');

  console.log('PAGE ERRORS:', consoleErrors.length ? consoleErrors : 'none');
  console.log('RESULT: PASS');
} catch (e) {
  await shot('t99-failure').catch(() => {});
  console.log('PAGE ERRORS:', consoleErrors);
  console.error('RESULT: FAIL —', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
