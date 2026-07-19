// Session 10 acceptance: the REAL checker app (flutter web build of the
// production code), roster cached online, then the network cut at browser
// level — dynamic pass accepted, replay refused, expired refused, tampered
// signature refused, deactivated static QR refused — all fully offline.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHOTS = process.env.SHOTS_DIR;
const fixtures = JSON.parse(readFileSync(join(SHOTS, 'qr-fixtures.json'), 'utf8'));
const consoleErrors = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 480, height: 950 } });
const page = await context.newPage();
page.on('pageerror', (e) => consoleErrors.push(String(e)));

const shot = (n) => page.screenshot({ path: join(SHOTS, `${n}.png`) });
const step = (m) => console.log('STEP:', m);
// Flutter web renders inside flt-glass-pane's shadow root — walk shadow
// DOMs to read what is actually on screen.
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
  for (let i = 0; i < 20; i++) {
    if ((await text()).includes(sub)) { console.log(`OK: ${label}`); return; }
    await page.waitForTimeout(300);
  }
  throw new Error(`ASSERT ${label}: "${sub}" not found on screen`);
}

async function wedgeScan(payload) {
  await page.keyboard.type(payload, { delay: 1 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}

try {
  step('load app');
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(6000);
  // Flutter a11y tree makes buttons/fields addressable.
  const placeholder = page.locator('flt-semantics-placeholder');
  if (await placeholder.count()) await placeholder.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('q01-loaded');

  step('login as checker');
  // Flutter's HTML renderer draws fields on canvas until focused — click
  // by coordinates (stable at the fixed 480px viewport).
  await page.mouse.click(240, 290); // school email
  await page.waitForTimeout(300);
  await page.keyboard.type('j.ramos@mvc.edu.ph');
  await page.mouse.click(240, 370); // password
  await page.waitForTimeout(300);
  await page.keyboard.type('MvcChecker!2026');
  await page.keyboard.press('Enter');
  await expectText('My events', 'events screen after login');
  await expectText('Roster cached', 'roster downloaded (with QR key)');
  await shot('q02-events');

  step('start scanning');
  await page.locator('[role="button"]', { hasText: 'Start scanning' }).first()
    .click({ force: true })
    .catch(async () => { // fallback: semantics label element
      await page.getByText('Start scanning →').first().click({ force: true });
    });
  await expectText('School of Computing', 'scan screen header');
  await shot('q03-scan');

  step('mint fresh pass, then go OFFLINE for all validations');
  const res = await fetch('https://tpofzircnvafxvsnwshj.supabase.co/functions/v1/issue_qr_pass', {
    method: 'POST',
    headers: { apikey: process.env.ANON, Authorization: `Bearer ${fixtures.accessToken}` },
  });
  const fresh = await res.json();
  if (!fresh.pass) throw new Error('could not mint fresh pass: ' + JSON.stringify(fresh));
  // manual pill first (app-level), then a REAL network cut (browser-level)
  await page.getByText('ONLINE').first().click({ force: true }).catch(() => {});
  await context.setOffline(true);
  await page.waitForTimeout(400);
  await shot('q04-offline');

  step('a) valid pass → accepted');
  await wedgeScan(fresh.pass);
  await expectText('TIME-IN RECORDED', 'valid pass accepted offline');
  await expectText('Juan Miguel Dela Cruz', 'student identified from cache');
  await shot('q05-accepted');

  step('b) same pass again → replay refused');
  await wedgeScan(fresh.pass);
  await expectText('Code already used', 'replay refused');
  await shot('q06-replay');

  step('c) expired pass → distinct expiry error');
  await wedgeScan(fixtures.expiredPass);
  await expectText('EXPIRED CODE', 'expired refused');
  await expectText('Expired code — ask the student to regenerate', 'expiry message');
  await shot('q07-expired');

  step('d) tampered signature → refused');
  const tampered = fresh.pass.slice(0, -2) + (fresh.pass.endsWith('AA') ? 'BB' : 'AA');
  await wedgeScan(tampered);
  await expectText('Invalid signature', 'tampered pass refused');
  await shot('q08-tampered');

  step('e) deactivated static QR → refused');
  await wedgeScan(fixtures.beaStaticToken);
  await expectText('QR deactivated', 'deactivated static refused');
  await shot('q09-deactivated');

  step('f) unknown code → not on roster');
  await wedgeScan('QP1.00000000-0000-4000-8000-000000000000.1.2.Zm9v');
  await expectText('NOT ON ROSTER', 'unknown refused');

  step('reconnect and sync the queued scan');
  await context.setOffline(false);
  await page.getByText('OFFLINE').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(4000);
  await shot('q10-synced');

  console.log('PAGE ERRORS:', consoleErrors.length ? consoleErrors : 'none');
  console.log('RESULT: PASS');
} catch (e) {
  await shot('q99-failure').catch(() => {});
  console.log('PAGE ERRORS:', consoleErrors);
  console.error('RESULT: FAIL —', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
