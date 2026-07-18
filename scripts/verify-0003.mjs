#!/usr/bin/env node
// Session 8 acceptance checks against the live DB (read-only except one
// upsert_scan duplicate test wrapped in a rolled-back transaction).
const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function q(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body}`);
  try { return JSON.parse(body); } catch { return body; }
}

const show = async (label, query) => {
  console.log(`\n== ${label}`);
  console.table(await q(query));
};

await show('migration report', `
  select table_name, record_id, field, value, issue, resolved
  from migration_report order by table_name, field, value`);

await show('profiles name split', `
  select email, first_name, middle_name, last_name, full_name from profiles order by email`);

await show('students name split + school', `
  select student_no, first_name, middle_name, last_name, full_name, school_id, course, qr_mode, qr_active
  from students order by student_no`);

await show('required columns now NOT NULL?', `
  select table_name, column_name, is_nullable from information_schema.columns
  where (table_name, column_name) in (('students','school_id'), ('students','first_name'),
    ('students','last_name'), ('profiles','first_name'), ('profiles','last_name'),
    ('attendance','session_id'), ('events','start_date'), ('events','end_date'))
  order by table_name, column_name`);

await show('sessions per event / attendance repointed', `
  select e.name, e.duration_type, e.audience_type, e.active, e.archived,
         count(distinct es.id) as sessions,
         count(a.id) as scans, count(a.session_id) as scans_with_session
  from events e
  left join event_sessions es on es.event_id = e.id
  left join attendance a on a.event_id = e.id
  group by e.id order by e.name`);

await show('attendance unique constraint', `
  select conname, pg_get_constraintdef(oid) as def from pg_constraint
  where conrelid = 'attendance'::regclass and contype = 'u'`);

await show('audit triggers present', `
  select event_object_table, trigger_name from information_schema.triggers
  where trigger_name like 'trg_audit%' or trigger_name like 'trg_sync%'
     or trigger_name like 'trg_event%' group by 1, 2 order by 1, 2`);

// Duplicate blocking per session + earliest-wins, then roll back.
console.log('\n== upsert_scan session-level duplicate test (rolled back)');
console.table(await q(`
  begin;
  select set_config('search_path', 'public', true);
  with s as (select id from students where student_no = '2023-00911'),
       ses as (select id, event_id from event_sessions
               where id = '11111111-1111-4111-8111-111111111111'),
       first_scan as (
         select (upsert_scan('aaaaaaaa-0000-4000-8000-000000000001', ses.event_id, s.id,
           'in', 'qr', now(), (select id from profiles where email='j.ramos@mvc.edu.ph'),
           'verify-device', 'SOC', null, ses.id)).* from s, ses),
       dup_earlier as (
         select (upsert_scan('aaaaaaaa-0000-4000-8000-000000000002', ses.event_id, s.id,
           'in', 'qr', now() - interval '5 minutes',
           (select id from profiles where email='l.tan@mvc.edu.ph'),
           'verify-device-2', 'SOE', null, ses.id)).* from s, ses)
  select (select count(*) from first_scan) as first_inserted,
         (select id from dup_earlier) as surviving_id,
         (select scanned_at from dup_earlier) as surviving_scanned_at,
         (select status from dup_earlier) as status,
         (select count(*) from attendance a, s, ses
            where a.student_id = s.id and a.session_id = ses.id and a.scan_type='in') as rows_for_pair;
  rollback;`));

await show('audit rows written in the last 10 minutes (by table)', `
  select table_name, action, count(*) from audit_log
  where created_at > now() - interval '10 minutes'
  group by 1, 2 order by 1, 2`);
