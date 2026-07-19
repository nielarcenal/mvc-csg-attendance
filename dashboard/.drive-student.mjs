// Session 10 acceptance — student Generate screen (dynamic QR): Generate
// button mints a pass, QR + countdown render, offline regenerate shows the
// connect message. Run from dashboard/ (playwright-core resolution).
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

try {
  step('load app');
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(6000);
  const placeholder = page.locator('flt-semantics-placeholder');
  if (await placeholder.count()) await placeholder.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('s01-loaded');

  step('login as student');
  await page.mouse.click(240, 290);
  await page.waitForTimeout(300);
  await page.keyboard.type('j.delacruz@mvc.edu.ph');
  await page.mouse.click(240, 370);
  await page.waitForTimeout(300);
  await page.keyboard.type('MvcStudent!2026');
  await page.keyboard.press('Enter');
  await expectText('Hi, Juan', 'home after login');
  await shot('s02-after-login');

  step('open My ID tab');
  await page.mouse.click(300, 918);
  await expectText('Digital ID', 'Digital ID screen');
  await expectText('Tap Generate to get your entry code.', 'empty state before generate');
  await expectText('Generate my code', 'Generate button present');
  await shot('s03-id-empty');

  step('generate a pass');
  // Semantics nodes are zero-size — click the pill button by coordinates.
  await page.mouse.click(240, 356);
  await expectText('valid for', 'countdown running');
  await expectText('Regenerate', 'button became Regenerate');
  await shot('s04-generated');
  // The ring must actually tick down, not freeze at the TTL.
  await page.waitForTimeout(3500);
  const t = await text();
  const m = t.match(/valid for (\d+) s/);
  if (!m || Number(m[1]) >= 150) throw new Error(`countdown not ticking (shows ${m && m[1]})`);
  console.log(`OK: countdown ticked down to ${m[1]}s`);

  step('offline regenerate shows connect message');
  await context.setOffline(true);
  // Countdown row pushed the button down ~54px from the empty-state spot.
  await page.mouse.click(240, 410);
  await expectText('Connect to the internet to generate your code', 'offline message');
  await shot('s05-offline');

  console.log('PAGE ERRORS:', consoleErrors.length ? consoleErrors : 'none');
  console.log('RESULT: PASS');
} catch (e) {
  await shot('s99-failure').catch(() => {});
  console.log('PAGE ERRORS:', consoleErrors);
  console.error('RESULT: FAIL —', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
