// Session 11 acceptance — dashboard: Reports chooser exports real .xlsx
// (event report: sheet per session; student report: one sheet), audit
// viewer date filters, Accounts Last-login column, refresh buttons.
// Run from dashboard/ with vite on :5173. SHOTS_DIR env required.
import { chromium } from 'playwright-core';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const SHOTS = process.env.SHOTS_DIR;
const consoleErrors = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const step = (m) => console.log('STEP:', m);
const ok = (m) => console.log('OK:', m);

async function download(trigger) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), trigger()]);
  const path = join(SHOTS, dl.suggestedFilename());
  await dl.saveAs(path);
  return path;
}

try {
  step('login as super admin (audit access)');
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'm.ferrer@mvc.edu.ph');
  await page.fill('input[type="password"]', 'MvcAdmin!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 45000 });

  step('Reports: event report .xlsx (per-session sheets)');
  await page.goto('http://localhost:5173/reports');
  await page.getByText('Event report').first().click();
  const opt = page.locator('select option', { hasText: 'SG General Assembly' }).first();
  await opt.waitFor({ state: 'attached', timeout: 20000 });
  await page.selectOption('select', await opt.getAttribute('value'));
  const evPath = await download(() => page.getByText('Download .xlsx').click());
  const evWb = XLSX.read(readFileSync(evPath));
  console.log('event workbook sheets:', evWb.SheetNames.join(' | '));
  if (evWb.SheetNames.length < 2) throw new Error('expected a sheet per session (event has 2)');
  const sheet1 = XLSX.utils.sheet_to_json(evWb.Sheets[evWb.SheetNames[0]], { header: 1 });
  const header = sheet1.find((r) => r[0] === 'Student no');
  if (!header || header[3] !== 'Status') throw new Error('event sheet header wrong: ' + JSON.stringify(header));
  const dataRows = sheet1.slice(sheet1.indexOf(header) + 1);
  if (dataRows.length === 0) throw new Error('event sheet has no roster rows');
  const statuses = new Set(dataRows.map((r) => String(r[3]).split(' ')[0]));
  console.log('sheet 1 rows:', dataRows.length, 'statuses:', [...statuses].join(','));
  ok(`event report xlsx: ${evWb.SheetNames.length} session sheets, ${dataRows.length} roster rows`);
  await page.screenshot({ path: join(SHOTS, 'd01-event-report.png') });

  step('Reports: event report .csv (flat, Session column)');
  const evCsvPath = await download(() => page.getByText('Download .csv').click());
  const csv = readFileSync(evCsvPath, 'utf8');
  if (!csv.startsWith('﻿Session,') && !csv.startsWith('Session,')) {
    throw new Error('csv missing Session column: ' + csv.slice(0, 60));
  }
  ok('event report csv has Session column');

  step('Reports: student report .xlsx');
  await page.getByText('Student report').first().click();
  await page.fill('input[placeholder*="Search name"]', 'dela cruz');
  await page.getByText('Juan Miguel Dela Cruz').first().click();
  const stPath = await download(() => page.getByText('Download .xlsx').click());
  const stWb = XLSX.read(readFileSync(stPath));
  const stAoa = XLSX.utils.sheet_to_json(stWb.Sheets[stWb.SheetNames[0]], { header: 1 });
  if (!String(stAoa[0][0]).includes('Juan Miguel Dela Cruz')) {
    throw new Error('student report title wrong: ' + stAoa[0][0]);
  }
  const stHeader = stAoa.find((r) => r[0] === 'Event');
  const stRows = stAoa.slice(stAoa.indexOf(stHeader) + 1);
  if (stRows.length === 0) throw new Error('student report has no session rows');
  console.log('student report rows:', stRows.length, 'summary:', stAoa[2][0]);
  ok(`student report xlsx: ${stRows.length} session rows`);
  await page.screenshot({ path: join(SHOTS, 'd02-student-report.png') });

  step('Audit log: full timestamps + date-range filter');
  await page.goto('http://localhost:5173/audit');
  await page.waitForTimeout(1500);
  const auditText = await page.locator('.table-row').first().innerText().catch(() => '');
  if (!/[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}/.test(auditText)) {
    throw new Error('audit rows missing full date+time: ' + auditText.slice(0, 80));
  }
  const before = await page.locator('.table-row').count();
  await page.fill('input[aria-label="From date"]', '2030-01-01');
  await page.waitForTimeout(400);
  const afterFuture = await page.locator('.table-row').count();
  if (afterFuture !== 0) throw new Error(`future from-date should empty the list (got ${afterFuture})`);
  await page.fill('input[aria-label="From date"]', '2026-07-01');
  await page.waitForTimeout(400);
  const afterReal = await page.locator('.table-row').count();
  if (afterReal === 0) throw new Error('july filter should keep rows');
  ok(`audit date filter works (${before} → 0 → ${afterReal} rows); timestamps carry the date`);
  await page.screenshot({ path: join(SHOTS, 'd03-audit.png') });

  step('Accounts: Last login column shows real times');
  await page.goto('http://localhost:5173/accounts');
  await page.waitForTimeout(2500); // list_users edge call
  const bodyText = await page.locator('body').innerText();
  const m = bodyText.match(/Last login/i);
  if (!m) throw new Error('no Last login column');
  // Juan signed in earlier today (student drives) — his row must show it.
  const row = await page.locator('.table-row', { hasText: 'j.delacruz@mvc.edu.ph' }).first().innerText();
  if (!/Jul \d{1,2}, \d{1,2}:\d{2}/.test(row)) {
    throw new Error('student row has no last-login timestamp: ' + row.replace(/\n/g, ' | '));
  }
  ok('Last login shows a real timestamp for a signed-in student');
  await page.screenshot({ path: join(SHOTS, 'd04-accounts.png') });

  step('refresh buttons present on list pages');
  for (const [path, name] of [['/events', 'Events'], ['/review', 'Review'], ['/dashboard', 'Dashboard']]) {
    await page.goto(`http://localhost:5173${path}`);
    await page.getByText('↻ Refresh').first().waitFor({ timeout: 10000 });
    ok(`${name} has a refresh button`);
  }

  console.log('PAGE ERRORS:', consoleErrors.length ? consoleErrors : 'none');
  console.log('RESULT: PASS');
} catch (e) {
  await page.screenshot({ path: join(SHOTS, 'd99-failure.png') }).catch(() => {});
  console.log('PAGE ERRORS:', consoleErrors);
  console.error('RESULT: FAIL —', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
