#!/usr/bin/env node
// One-shot Supabase go-live script.
//
// Usage (PowerShell):
//   $env:SUPABASE_PROJECT_REF   = "abcdefghijklmnop"
//   $env:SUPABASE_ACCESS_TOKEN  = "sbp_..."          # supabase.com/dashboard/account/tokens
//   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."        # project settings → API keys
//   node scripts/setup-live.mjs
//
// Steps: 1) apply supabase/migrations/*.sql via the Management API,
//        2) seed demo accounts + roster + events (idempotent),
//        3) print the credentials to sign in with.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!REF || !TOKEN || !SERVICE) {
  console.error('Missing env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const URL_ = `https://${REF}.supabase.co`;

// ── helpers ─────────────────────────────────────────────────────────
async function mgmtQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body}`);
  try { return JSON.parse(body); } catch { return body; }
}

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
};

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { ...svcHeaders, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function upsert(table, rows, onConflict) {
  return rest(`/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    body: rows,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
}

// Create (or fetch) an auth user; returns its id.
async function ensureUser(email, password, fullName) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svcHeaders,
    body: JSON.stringify({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    }),
  });
  if (res.ok) return (await res.json()).id;
  // Already exists → look it up (and reset the password so the printed creds stay true).
  const list = await rest(`/auth/v1/admin/users?page=1&per_page=1000`);
  const found = (list.users ?? list).find((u) => u.email === email);
  if (!found) throw new Error(`could not create or find auth user ${email}: ${await res.text()}`);
  await rest(`/auth/v1/admin/users/${found.id}`, { method: 'PUT', body: { password } });
  return found.id;
}

// ── 1. schema ───────────────────────────────────────────────────────
const applied = await mgmtQuery(`select to_regclass('public.profiles') as t`);
if (applied?.[0]?.t) {
  console.log('schema: already applied — skipping migrations');
} else {
  const dir = join(ROOT, 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    console.log(`schema: applying ${f} ...`);
    await mgmtQuery(readFileSync(join(dir, f), 'utf8'));
  }
  console.log('schema: done');
}

// ── 2. seed ─────────────────────────────────────────────────────────
const PW = {
  admin: 'MvcAdmin!2026', maker: 'MvcMaker!2026',
  checker: 'MvcChecker!2026', student: 'MvcStudent!2026',
};

const users = [
  { key: 'admin', email: 'm.ferrer@mvc.edu.ph', name: 'Ferrer, Marco A.', role: 'super_admin', pw: PW.admin },
  { key: 'maker', email: 'r.uy@mvc.edu.ph', name: 'Uy, Rica S.', role: 'event_maker', pw: PW.maker },
  { key: 'ramos', email: 'j.ramos@mvc.edu.ph', name: 'Ramos, Joel V.', role: 'checker', pw: PW.checker },
  { key: 'tan', email: 'l.tan@mvc.edu.ph', name: 'Tan, Liza M.', role: 'checker', pw: PW.checker },
  { key: 'juan', email: 'j.delacruz@mvc.edu.ph', name: 'Dela Cruz, Juan Miguel', role: 'student', pw: PW.student },
  { key: 'bea', email: 'b.garcia@mvc.edu.ph', name: 'Garcia, Bea A.', role: 'student', pw: PW.student },
  { key: 'nathan', email: 'n.reyes@mvc.edu.ph', name: 'Reyes, Nathan J.', role: 'student', pw: PW.student },
];

const ids = {};
for (const u of users) {
  ids[u.key] = await ensureUser(u.email, u.pw, u.name);
  console.log(`auth: ${u.email} → ${ids[u.key]}`);
}

await upsert('profiles', users.map((u) => ({
  id: ids[u.key], role: u.role, full_name: u.name, email: u.email, account_status: 'activated',
})), 'id');
console.log('seed: profiles');

// Roster — linked students (with app accounts) + roster-only students.
const students = [
  { student_no: '2023-01417', full_name: 'Dela Cruz, Juan Miguel', email: 'j.delacruz@mvc.edu.ph', course: 'BSIT', year_level: 3, section: 'A', profile_id: ids.juan },
  { student_no: '2024-00318', full_name: 'Garcia, Bea A.', email: 'b.garcia@mvc.edu.ph', course: 'BSBA', year_level: 2, section: 'A', profile_id: ids.bea },
  { student_no: '2023-00840', full_name: 'Reyes, Nathan J.', email: 'n.reyes@mvc.edu.ph', course: 'BSED', year_level: 3, section: 'A', profile_id: ids.nathan },
  // PostgREST bulk inserts need identical keys on every row, so
  // roster-only students carry an explicit profile_id: null.
  { student_no: '2023-00911', full_name: 'Estrada, Mae S.', email: 'm.estrada@mvc.edu.ph', course: 'BSIT', year_level: 3, section: 'A', profile_id: null },
  { student_no: '2023-00552', full_name: 'Fernandez, Paolo R.', email: 'p.fernandez@mvc.edu.ph', course: 'BSED', year_level: 3, section: 'B', profile_id: null },
  { student_no: '2025-00092', full_name: 'Lim, Hannah C.', email: 'h.lim@mvc.edu.ph', course: 'BSED', year_level: 1, section: 'A', profile_id: null },
  { student_no: '2024-01566', full_name: 'Ocampo, Dave S.', email: 'd.ocampo@mvc.edu.ph', course: 'BSN', year_level: 2, section: 'C', profile_id: null },
  { student_no: '2022-01904', full_name: 'Dela Rosa, Rommel T.', email: 'r.delarosa@mvc.edu.ph', course: 'BSN', year_level: 4, section: 'A', profile_id: null },
  { student_no: '2024-00281', full_name: 'Dela Cruz, Andrea B.', email: 'a.delacruz@mvc.edu.ph', course: 'BSED', year_level: 2, section: 'B', profile_id: null },
];
await upsert('students', students, 'student_no');
console.log(`seed: ${students.length} roster students`);

// Events — fixed UUIDs so re-running the script never duplicates them.
// GA runs today with a checking window that is open right now, so scans
// made during testing come back `valid`.
const EV_GA = '11111111-1111-4111-8111-111111111111';
const EV_PARTY = '22222222-2222-4222-8222-222222222222';
const now = new Date();
const iso = (d) => d.toISOString();
const plus = (base, mins) => new Date(base.getTime() + mins * 60000);

await upsert('events', [
  {
    id: EV_GA, name: 'SG General Assembly', venue: 'MVC Gymnasium',
    description: 'Mandatory general assembly for all students.',
    starts_at: iso(plus(now, -30)), ends_at: iso(plus(now, 180)),
    checking_opens_at: iso(plus(now, -30)), checking_closes_at: iso(plus(now, 120)),
    is_required: true, requires_time_out: false, fine_amount: 50.0, created_by: ids.maker,
  },
  {
    id: EV_PARTY, name: 'Acquaintance Party', venue: 'Covered Court',
    description: 'Optional — RSVP so we can plan seating.',
    starts_at: iso(plus(now, 9 * 24 * 60)), ends_at: iso(plus(now, 9 * 24 * 60 + 240)),
    checking_opens_at: iso(plus(now, 9 * 24 * 60 - 30)), checking_closes_at: iso(plus(now, 9 * 24 * 60 + 60)),
    is_required: false, requires_time_out: false, fine_amount: 0, created_by: ids.maker,
  },
], 'id');
console.log('seed: 2 events (GA checking window is open now)');

await upsert('event_checkers', [
  { event_id: EV_GA, profile_id: ids.ramos, school: 'SOC' },
  { event_id: EV_GA, profile_id: ids.tan, school: 'SOE' },
], 'event_id,profile_id');
console.log('seed: checker assignments (Ramos→SOC, Tan→SOE)');

// ── 3. summary ──────────────────────────────────────────────────────
console.log(`
──────────────────────────────────────────────────────
Supabase project is live: ${URL_}

Sign-in accounts (change these before real rollout):
  Super-admin   m.ferrer@mvc.edu.ph     ${PW.admin}
  Event maker   r.uy@mvc.edu.ph         ${PW.maker}
  Checker (SOC) j.ramos@mvc.edu.ph      ${PW.checker}
  Checker (SOE) l.tan@mvc.edu.ph        ${PW.checker}
  Student       j.delacruz@mvc.edu.ph   ${PW.student}
  Student       b.garcia@mvc.edu.ph     ${PW.student}
  Student       n.reyes@mvc.edu.ph      ${PW.student}
──────────────────────────────────────────────────────`);
