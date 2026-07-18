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
// Per-file tracking: apply exactly the migrations not yet recorded.
await mgmtQuery(`
  create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now());
  alter table schema_migrations enable row level security;`);
const [{ t: hasProfiles }] = await mgmtQuery(`select to_regclass('public.profiles') as t`);
const doneRows = await mgmtQuery(`select name from schema_migrations`);
const done = new Set(doneRows.map((r) => r.name));
if (hasProfiles && done.size === 0) {
  // DB predates migration tracking → baseline the originally applied files.
  for (const f of ['0001_init.sql', '0002_announcements.sql']) done.add(f);
  await mgmtQuery(`insert into schema_migrations (name) values
    ('0001_init.sql'), ('0002_announcements.sql') on conflict do nothing`);
  console.log('schema: baselined 0001, 0002 (already live)');
}
const dir = join(ROOT, 'supabase', 'migrations');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(f)) continue;
  console.log(`schema: applying ${f} ...`);
  await mgmtQuery(readFileSync(join(dir, f), 'utf8'));
  await mgmtQuery(`insert into schema_migrations (name) values ('${f}') on conflict do nothing`);
}
console.log('schema: up to date');

// ── 2. seed ─────────────────────────────────────────────────────────
const PW = {
  admin: 'MvcAdmin!2026', maker: 'MvcMaker!2026',
  checker: 'MvcChecker!2026', student: 'MvcStudent!2026',
};

// Names as parts (FEATURE_BATCH_2 A1) — full_name is derived by trigger.
const users = [
  { key: 'admin', email: 'm.ferrer@mvc.edu.ph', first: 'Marco', middle: 'A', last: 'Ferrer', role: 'super_admin', pw: PW.admin },
  { key: 'maker', email: 'r.uy@mvc.edu.ph', first: 'Rica', middle: 'S', last: 'Uy', role: 'event_maker', pw: PW.maker },
  { key: 'ramos', email: 'j.ramos@mvc.edu.ph', first: 'Joel', middle: 'V', last: 'Ramos', role: 'checker', pw: PW.checker },
  { key: 'tan', email: 'l.tan@mvc.edu.ph', first: 'Liza', middle: 'M', last: 'Tan', role: 'checker', pw: PW.checker },
  { key: 'juan', email: 'j.delacruz@mvc.edu.ph', first: 'Juan Miguel', middle: null, last: 'Dela Cruz', role: 'student', pw: PW.student },
  { key: 'bea', email: 'b.garcia@mvc.edu.ph', first: 'Bea', middle: 'A', last: 'Garcia', role: 'student', pw: PW.student },
  { key: 'nathan', email: 'n.reyes@mvc.edu.ph', first: 'Nathan', middle: 'J', last: 'Reyes', role: 'student', pw: PW.student },
];

const ids = {};
for (const u of users) {
  ids[u.key] = await ensureUser(u.email, u.pw, `${u.first} ${u.last}`);
  console.log(`auth: ${u.email} → ${ids[u.key]}`);
}

await upsert('profiles', users.map((u) => ({
  id: ids[u.key], role: u.role, first_name: u.first, middle_name: u.middle,
  last_name: u.last, email: u.email, account_status: 'activated',
})), 'id');
console.log('seed: profiles');

// Roster — linked students (with app accounts) + roster-only students.
// school_id is required (A2). PostgREST bulk inserts need identical keys
// on every row, so nullable fields are always explicit.
const students = [
  { student_no: '2023-01417', first_name: 'Juan Miguel', middle_name: null, last_name: 'Dela Cruz', email: 'j.delacruz@mvc.edu.ph', school_id: 'SOC', course: 'BSIT', year_level: 3, section: 'A', profile_id: ids.juan },
  { student_no: '2024-00318', first_name: 'Bea', middle_name: 'A', last_name: 'Garcia', email: 'b.garcia@mvc.edu.ph', school_id: 'SBA', course: 'BSBA', year_level: 2, section: 'A', profile_id: ids.bea },
  { student_no: '2023-00840', first_name: 'Nathan', middle_name: 'J', last_name: 'Reyes', email: 'n.reyes@mvc.edu.ph', school_id: 'SOE', course: 'BSED', year_level: 3, section: 'A', profile_id: ids.nathan },
  { student_no: '2023-00911', first_name: 'Mae', middle_name: 'S', last_name: 'Estrada', email: 'm.estrada@mvc.edu.ph', school_id: 'SOC', course: 'BSIT', year_level: 3, section: 'A', profile_id: null },
  { student_no: '2023-00552', first_name: 'Paolo', middle_name: 'R', last_name: 'Fernandez', email: 'p.fernandez@mvc.edu.ph', school_id: 'SOE', course: 'BSED', year_level: 3, section: 'B', profile_id: null },
  { student_no: '2025-00092', first_name: 'Hannah', middle_name: 'C', last_name: 'Lim', email: 'h.lim@mvc.edu.ph', school_id: 'SOE', course: 'BSED', year_level: 1, section: 'A', profile_id: null },
  { student_no: '2024-01566', first_name: 'Dave', middle_name: 'S', last_name: 'Ocampo', email: 'd.ocampo@mvc.edu.ph', school_id: 'SON', course: 'BSN', year_level: 2, section: 'C', profile_id: null },
  { student_no: '2022-01904', first_name: 'Rommel', middle_name: 'T', last_name: 'Dela Rosa', email: 'r.delarosa@mvc.edu.ph', school_id: 'SON', course: 'BSN', year_level: 4, section: 'A', profile_id: null },
  { student_no: '2024-00281', first_name: 'Andrea', middle_name: 'B', last_name: 'Dela Cruz', email: 'a.delacruz@mvc.edu.ph', school_id: 'SOE', course: 'BSED', year_level: 2, section: 'B', profile_id: null },
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
    duration_type: 'single_day', audience_type: 'all_students',
  },
  {
    id: EV_PARTY, name: 'Acquaintance Party', venue: 'Covered Court',
    description: 'Optional — RSVP so we can plan seating.',
    starts_at: iso(plus(now, 9 * 24 * 60)), ends_at: iso(plus(now, 9 * 24 * 60 + 240)),
    checking_opens_at: iso(plus(now, 9 * 24 * 60 - 30)), checking_closes_at: iso(plus(now, 9 * 24 * 60 + 60)),
    is_required: false, requires_time_out: false, fine_amount: 0, created_by: ids.maker,
    duration_type: 'single_day', audience_type: 'all_students',
  },
], 'id');
console.log('seed: 2 events (GA checking window is open now)');

// Checking sessions (A3). The GA morning session reuses the event id so it
// merges with the row the 0003 backfill created; the afternoon session
// exercises the multi-session flow.
const SES_GA_PM = '11111111-1111-4111-8111-11111111111a';
await upsert('event_sessions', [
  {
    id: EV_GA, event_id: EV_GA, session_date: iso(now).slice(0, 10),
    program: 'Opening Program', venue: 'MVC Gymnasium', mode: 'in_only',
    checking_opens_at: iso(plus(now, -30)), checking_closes_at: iso(plus(now, 120)),
    sort_order: 0,
  },
  {
    id: SES_GA_PM, event_id: EV_GA, session_date: iso(now).slice(0, 10),
    program: 'Afternoon Plenary', venue: 'MVC Gymnasium', mode: 'in_out',
    checking_opens_at: iso(plus(now, 180)), checking_closes_at: iso(plus(now, 300)),
    sort_order: 1,
  },
  {
    id: EV_PARTY, event_id: EV_PARTY, session_date: iso(plus(now, 9 * 24 * 60)).slice(0, 10),
    program: 'Acquaintance Party', venue: 'Covered Court', mode: 'in_only',
    checking_opens_at: iso(plus(now, 9 * 24 * 60 - 30)), checking_closes_at: iso(plus(now, 9 * 24 * 60 + 60)),
    sort_order: 0,
  },
], 'id');
console.log('seed: 3 checking sessions (GA has morning + afternoon)');

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
