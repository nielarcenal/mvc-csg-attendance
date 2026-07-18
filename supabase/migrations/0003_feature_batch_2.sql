-- FEATURE_BATCH_2 — Session 8: schema + backfills (A1–A8).
--
-- Transition notes (deliberate deviations, see FEATURE_BATCH_2.md):
-- * schools keeps its existing text `code` PK (event_checkers/attendance
--   already reference it on the live DB); A2's "schools(id, name, active)"
--   is satisfied by adding `active` and pointing students.school_id at code.
-- * profiles/students keep `full_name` as a trigger-synced mirror of the
--   name parts until every client writes parts (Sessions 9–11); it always
--   holds display_name(first, middle, last). Parts are the source of truth.
-- * upsert_scan keeps its old argument list (deployed checker apps call it
--   by name) and gains `p_session default null`; when null the session is
--   resolved from scanned_at so queued offline scans from old builds still
--   sync. Rows that don't backfill cleanly land in migration_report.

-- ── new enums ──────────────────────────────────────────────────────
do $$ begin create type event_duration as enum ('single_day', 'one_week', 'custom');
exception when duplicate_object then null; end $$;
do $$ begin create type session_mode as enum ('in_out', 'in_only');
exception when duplicate_object then null; end $$;
do $$ begin create type event_audience as enum ('all_students', 'by_school');
exception when duplicate_object then null; end $$;
do $$ begin create type qr_mode_type as enum ('dynamic', 'static');
exception when duplicate_object then null; end $$;

-- ── migration report (A1: rows needing manual fix) ─────────────────
create table if not exists migration_report (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  field text not null,
  value text,
  issue text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (table_name, record_id, field)
);
alter table migration_report enable row level security;
create policy migration_report_staff on migration_report for all
  using (my_role() in ('super_admin', 'event_maker'));

-- ── A1: name split ─────────────────────────────────────────────────
alter table profiles
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text;
alter table students
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text;

-- The one shared display-name rule: "First M. Last".
create or replace function display_name(p_first text, p_middle text, p_last text)
returns text language sql immutable as $$
  select trim(regexp_replace(concat_ws(' ', nullif(trim(p_first), ''),
    case when coalesce(trim(p_middle), '') = '' then null
         else left(trim(p_middle), 1) || '.' end,
    nullif(trim(p_last), '')), '\s+', ' ', 'g'))
$$;

-- Best-effort splitter. Handles both "Last, First M." (current data) and
-- "First M. Last". clean=false rows go to migration_report for manual fix.
create or replace function split_full_name(p text)
returns table (first_name text, middle_name text, last_name text,
               clean boolean, reason text)
language plpgsql immutable as $$
declare
  s text := regexp_replace(coalesce(trim(p), ''), '\s+', ' ', 'g');
  rest text;
  toks text[];
  n int;
  i int;
  particle_at int := 0;
begin
  first_name := ''; middle_name := null; last_name := '';
  clean := true; reason := null;
  if s = '' then
    clean := false; reason := 'empty name';
    return next; return;
  end if;

  if position(',' in s) > 0 then
    -- "Last, First [M.]"
    last_name := trim(split_part(s, ',', 1));
    rest := trim(substr(s, position(',' in s) + 1));
    if rest = '' then
      clean := false; reason := 'nothing after the comma — first name missing';
      return next; return;
    end if;
    toks := string_to_array(rest, ' ');
    n := array_length(toks, 1);
    if n = 1 then
      first_name := toks[1];
    elsif toks[n] ~ '^[A-Za-z]\.?$' then
      middle_name := rtrim(toks[n], '.');
      first_name := array_to_string(toks[1:n-1], ' ');
    else
      first_name := rest;
      clean := false;
      reason := 'multi-word given name — cannot tell first name from middle name';
    end if;
    return next; return;
  end if;

  -- "First [M.] Last" (no comma)
  toks := string_to_array(s, ' ');
  n := array_length(toks, 1);
  if n = 1 then
    first_name := s;
    clean := false; reason := 'single word — last name missing';
    return next; return;
  end if;
  -- surname particles ("Dela Cruz", "de los Santos"): merge from the first
  -- particle onward into the last name, but flag for review — heuristic.
  for i in 2..n-1 loop
    if lower(toks[i]) in ('de','del','dela','delas','delos','da','di','du',
                          'la','le','san','sta','sto','santa','santo',
                          'van','von','der','den','y') then
      particle_at := i; exit;
    end if;
  end loop;
  if particle_at > 0 then
    last_name := array_to_string(toks[particle_at:n], ' ');
    toks := toks[1:particle_at-1];
    n := array_length(toks, 1);
    clean := false; reason := 'surname particle detected — split guessed, verify';
  else
    last_name := toks[n];
    toks := toks[1:n-1];
    n := array_length(toks, 1);
  end if;
  if n >= 2 and toks[n] ~ '^[A-Za-z]\.?$' then
    middle_name := rtrim(toks[n], '.');
    first_name := array_to_string(toks[1:n-1], ' ');
  else
    first_name := array_to_string(toks, ' ');
    if n >= 2 then
      clean := false;
      reason := coalesce(reason, 'multi-word given name — cannot tell first name from middle name');
    end if;
  end if;
  return next;
end $$;

-- Keep parts and full_name coherent both directions while legacy writers
-- still send full_name only. Parts win; a full_name-only write is split.
create or replace function sync_name_columns() returns trigger
language plpgsql as $$
declare sp record; raw text;
begin
  raw := trim(coalesce(new.full_name, ''));
  if (tg_op = 'UPDATE'
      and new.full_name is distinct from old.full_name
      and new.first_name is not distinct from old.first_name
      and new.middle_name is not distinct from old.middle_name
      and new.last_name is not distinct from old.last_name)
     or (coalesce(new.first_name, '') = '' or coalesce(new.last_name, '') = '')
        and raw <> '' then
    -- legacy write path: full_name is what changed (or parts are missing) → split it
    select * into sp from split_full_name(raw);
    new.first_name := sp.first_name;
    new.middle_name := sp.middle_name;
    new.last_name := sp.last_name;
    new.full_name := display_name(sp.first_name, sp.middle_name, sp.last_name);
    if not sp.clean then
      insert into migration_report (table_name, record_id, field, value, issue)
      values (tg_table_name, new.id::text, 'full_name', raw, sp.reason)
      on conflict (table_name, record_id, field) do update
        set value = excluded.value, issue = excluded.issue, resolved = false;
    end if;
  elsif coalesce(new.first_name, '') <> '' and coalesce(new.last_name, '') <> '' then
    new.full_name := display_name(new.first_name, new.middle_name, new.last_name);
    -- an explicit change to the parts is a manual fix → resolve any flag
    if tg_op = 'INSERT'
       or new.first_name is distinct from old.first_name
       or new.middle_name is distinct from old.middle_name
       or new.last_name is distinct from old.last_name then
      update migration_report set resolved = true
        where table_name = tg_table_name and record_id = new.id::text
          and field = 'full_name' and not resolved;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_names_profiles on profiles;
create trigger trg_sync_names_profiles before insert or update on profiles
  for each row execute function sync_name_columns();
drop trigger if exists trg_sync_names_students on students;
create trigger trg_sync_names_students before insert or update on students
  for each row execute function sync_name_columns();

-- Backfill: split every existing full_name; report the unclean ones with
-- the ORIGINAL value (the trigger normalizes full_name to display form).
do $$
declare r record; sp record;
begin
  for r in select id, full_name from profiles where first_name is null loop
    select * into sp from split_full_name(r.full_name);
    update profiles set first_name = sp.first_name, middle_name = sp.middle_name,
                        last_name = sp.last_name where id = r.id;
    if not sp.clean then
      insert into migration_report (table_name, record_id, field, value, issue)
      values ('profiles', r.id::text, 'full_name', r.full_name, sp.reason)
      on conflict (table_name, record_id, field) do update
        set value = excluded.value, issue = excluded.issue, resolved = false;
    end if;
  end loop;
  for r in select id, full_name from students where first_name is null loop
    select * into sp from split_full_name(r.full_name);
    update students set first_name = sp.first_name, middle_name = sp.middle_name,
                        last_name = sp.last_name where id = r.id;
    if not sp.clean then
      insert into migration_report (table_name, record_id, field, value, issue)
      values ('students', r.id::text, 'full_name', r.full_name, sp.reason)
      on conflict (table_name, record_id, field) do update
        set value = excluded.value, issue = excluded.issue, resolved = false;
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from profiles where first_name is null or last_name is null) then
    alter table profiles alter column first_name set not null,
                         alter column last_name set not null;
  end if;
  if not exists (select 1 from students where first_name is null or last_name is null) then
    alter table students alter column first_name set not null,
                         alter column last_name set not null;
  end if;
end $$;

-- ── A2: school as required student FK ──────────────────────────────
alter table schools add column if not exists active boolean not null default true;
alter table students add column if not exists school_id text references schools (code);

-- Backfill from the course code where the mapping is unambiguous.
update students s set school_id = m.code
from (values
  ('BSIT','SOC'), ('BSCS','SOC'), ('BSA','SBA'), ('BSBA','SBA'),
  ('BSAIS','SBA'), ('BSED','SOE'), ('BEED','SOE'), ('BSN','SON'),
  ('BSMT','SMT'), ('BSMLS','SMT'), ('BSAGRI','SOA'), ('ABTH','SOT'),
  ('BATH','SOT'), ('BSPSYCH','SAS'), ('ABCOMM','SAS')
) as m(course, code)
where s.school_id is null and upper(regexp_replace(coalesce(s.course, ''), '[^A-Za-z]', '', 'g')) = m.course;

insert into migration_report (table_name, record_id, field, value, issue)
select 'students', id::text, 'school_id', course,
       'no school could be derived from course — assign manually'
from students where school_id is null
on conflict (table_name, record_id, field) do nothing;

do $$ begin
  if not exists (select 1 from students where school_id is null) then
    alter table students alter column school_id set not null;
  end if;
end $$;

-- ── A5: QR system v2 columns ───────────────────────────────────────
alter table students
  add column if not exists qr_mode qr_mode_type not null default 'dynamic',
  add column if not exists qr_active boolean not null default true,
  add column if not exists qr_expires_at timestamptz;

insert into settings (key, value) values ('qr_pass_ttl_seconds', '150')
on conflict (key) do nothing;

-- ── A3: multi-day events & checking sessions ───────────────────────
alter table events
  add column if not exists duration_type event_duration not null default 'single_day',
  add column if not exists start_date date,
  add column if not exists end_date date,
  -- A4 audience
  add column if not exists audience_type event_audience not null default 'all_students',
  -- A6 soft delete / archive
  add column if not exists active boolean not null default true,
  add column if not exists archived boolean not null default false;

update events set start_date = (starts_at at time zone 'utc')::date where start_date is null;
update events set end_date = (ends_at at time zone 'utc')::date where end_date is null;

-- Legacy event writers don't send the date columns — derive them.
create or replace function events_derive_dates() returns trigger
language plpgsql as $$
begin
  if new.start_date is null then new.start_date := (new.starts_at at time zone 'utc')::date; end if;
  if new.end_date is null then new.end_date := (new.ends_at at time zone 'utc')::date; end if;
  if new.end_date < new.start_date then new.end_date := new.start_date; end if;
  return new;
end $$;
drop trigger if exists trg_events_derive_dates on events;
create trigger trg_events_derive_dates before insert or update on events
  for each row execute function events_derive_dates();

alter table events alter column start_date set not null,
                   alter column end_date set not null;

create table if not exists event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  session_date date not null,
  program text,
  venue text,
  mode session_mode not null default 'in_out',
  checking_opens_at timestamptz not null,
  checking_closes_at timestamptz not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_sessions_event_idx on event_sessions (event_id, session_date, sort_order);

alter table event_sessions enable row level security;
create policy sessions_read on event_sessions for select using (auth.uid() is not null);
create policy sessions_manage on event_sessions for all
  using (my_role() = 'super_admin'
         or (my_role() = 'event_maker'
             and exists (select 1 from events e
                         where e.id = event_sessions.event_id and e.created_by = auth.uid())));

-- Backfill: exactly one session per existing event, from its old checking
-- window. Session id = event id → deterministic, and the seed can target it.
insert into event_sessions (id, event_id, session_date, program, venue, mode,
                            checking_opens_at, checking_closes_at, sort_order)
select e.id, e.id, (e.checking_opens_at at time zone 'utc')::date, null, e.venue,
       case when e.requires_time_out then 'in_out' else 'in_only' end::session_mode,
       e.checking_opens_at, e.checking_closes_at, 0
from events e
where not exists (select 1 from event_sessions es where es.event_id = e.id)
on conflict (id) do nothing;

-- attendance moves to the session level.
alter table attendance add column if not exists session_id uuid references event_sessions;
update attendance set session_id = event_id where session_id is null;  -- backfill session id = event id

insert into migration_report (table_name, record_id, field, value, issue)
select 'attendance', id::text, 'session_id', event_id::text,
       'scan could not be pointed at a session — event had none'
from attendance where session_id is null
on conflict (table_name, record_id, field) do nothing;

do $$ begin
  if not exists (select 1 from attendance where session_id is null) then
    alter table attendance alter column session_id set not null;
  end if;
end $$;

alter table attendance drop constraint if exists attendance_event_id_student_id_scan_type_key;
do $$ begin
  alter table attendance add constraint attendance_session_student_type_key
    unique (session_id, student_id, scan_type);
exception when duplicate_object or duplicate_table then null; end $$;

-- ── A4: event audience ─────────────────────────────────────────────
create table if not exists event_schools (
  event_id uuid not null references events on delete cascade,
  school_code text not null references schools (code),
  primary key (event_id, school_code)
);
alter table event_schools enable row level security;
create policy event_schools_read on event_schools for select using (auth.uid() is not null);
create policy event_schools_manage on event_schools for all
  using (my_role() = 'super_admin'
         or (my_role() = 'event_maker'
             and exists (select 1 from events e
                         where e.id = event_schools.event_id and e.created_by = auth.uid())));

-- Is this student part of this event's audience?
create or replace function student_in_audience(p_event uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case e.audience_type
    when 'all_students' then true
    else exists (select 1 from event_schools es
                 join students s on s.id = p_student
                 where es.event_id = e.id and es.school_code = s.school_id)
  end
  from events e where e.id = p_event;
$$;

-- ── A3 cont.: session-level scan logic ─────────────────────────────
drop function if exists compute_scan_status(uuid, timestamptz);
create or replace function compute_scan_status(p_session uuid, p_scanned timestamptz)
returns attendance_status language sql stable security definer set search_path = public as $$
  select case
    when p_scanned <= es.checking_closes_at
      + make_interval(mins => coalesce(
          (select value #>> '{}' from settings where key = 'grace_period_minutes')::int, 0))
      then 'valid'::attendance_status
    else 'for_review'::attendance_status
  end
  from event_sessions es where es.id = p_session;
$$;

-- Which session does a scan belong to when the client didn't say?
-- (Old checker builds sync without p_session.) In-window session first,
-- else the nearest one; events created by legacy UI without sessions get
-- one derived from their checking window on first scan.
create or replace function resolve_session(p_event uuid, p_scanned timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from event_sessions
    where event_id = p_event
      and p_scanned between checking_opens_at and checking_closes_at
    order by checking_opens_at limit 1;
  if sid is null then
    select id into sid from event_sessions
      where event_id = p_event
      order by least(abs(extract(epoch from (p_scanned - checking_opens_at))),
                     abs(extract(epoch from (p_scanned - checking_closes_at)))) limit 1;
  end if;
  if sid is null then
    insert into event_sessions (event_id, session_date, venue, mode,
                                checking_opens_at, checking_closes_at)
    select e.id, (e.checking_opens_at at time zone 'utc')::date, e.venue,
           case when e.requires_time_out then 'in_out' else 'in_only' end::session_mode,
           e.checking_opens_at, e.checking_closes_at
    from events e where e.id = p_event
    returning id into sid;
  end if;
  return sid;
end $$;

-- Same name + argument names as before, plus optional p_session, so both
-- old and new checker builds resolve to this one function.
drop function if exists upsert_scan(uuid, uuid, uuid, scan_type, scan_method, timestamptz, uuid, text, text, text);
create or replace function upsert_scan(
  p_id uuid, p_event uuid, p_student uuid, p_type scan_type,
  p_method scan_method, p_scanned timestamptz, p_checker uuid,
  p_device text, p_school text, p_note text default null,
  p_session uuid default null
) returns attendance language plpgsql security definer set search_path = public as $$
declare rec attendance; sid uuid;
begin
  if auth.uid() is not null then
    if my_role() = 'checker' then
      if p_checker <> auth.uid() or not exists (
        select 1 from event_checkers ec
        where ec.event_id = p_event and ec.profile_id = auth.uid()
      ) then
        raise exception 'checker is not assigned to this event';
      end if;
    elsif my_role() not in ('super_admin', 'event_maker') then
      raise exception 'role cannot record attendance';
    end if;
  end if;
  if not coalesce(student_in_audience(p_event, p_student), false) then
    raise exception 'student is not in this event''s audience';
  end if;
  if p_session is not null then
    if not exists (select 1 from event_sessions es
                   where es.id = p_session and es.event_id = p_event) then
      raise exception 'session does not belong to this event';
    end if;
    sid := p_session;
  else
    sid := resolve_session(p_event, p_scanned);
  end if;
  insert into attendance (id, event_id, student_id, session_id, scan_type, method,
                          status, scanned_at, checker_id, device_id, school, note)
  values (p_id, p_event, p_student, sid, p_type, p_method,
          compute_scan_status(sid, p_scanned),
          p_scanned, p_checker, p_device, p_school, p_note)
  on conflict (session_id, student_id, scan_type) do update
    set scanned_at = least(attendance.scanned_at, excluded.scanned_at),
        status = compute_scan_status(attendance.session_id,
                                     least(attendance.scanned_at, excluded.scanned_at))
    where attendance.scanned_at > excluded.scanned_at
  returning * into rec;
  if rec.id is null then
    select * into rec from attendance
      where session_id = sid and student_id = p_student and scan_type = p_type;
  end if;
  return rec;
end $$;

-- Fines: absent = no valid/approved `in` scan for a session; event-level
-- absence = absent in ANY session (v1 rule). Audience-scoped.
create or replace function generate_fines(p_event uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and my_role() not in ('super_admin', 'event_maker') then
    raise exception 'role cannot generate fines';
  end if;
  insert into fines (student_id, event_id, amount)
  select distinct s.id, e.id, e.fine_amount
  from events e
  join event_sessions es on es.event_id = e.id
  cross join students s
  where e.id = p_event and e.is_required and e.active and s.active
    and student_in_audience(e.id, s.id)
    and not exists (select 1 from attendance a
                    where a.session_id = es.id and a.student_id = s.id
                      and a.scan_type = 'in' and a.status in ('valid', 'approved'))
    and not exists (select 1 from excuses x
                    where x.event_id = e.id and x.student_id = s.id and x.status = 'approved')
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── A6: event delete/archive rules ─────────────────────────────────
-- Nothing is ever hard-deleted (CLAUDE.md hard rule); soft delete only
-- when the event has zero attendance, otherwise archive.
create or replace function enforce_event_lifecycle() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'events are never hard-deleted — set active=false (delete) or archived=true (archive)';
  end if;
  if new.active = false and old.active = true
     and exists (select 1 from attendance a where a.event_id = new.id) then
    raise exception 'event has attendance records — archive it instead of deleting';
  end if;
  return new;
end $$;
drop trigger if exists trg_event_lifecycle on events;
create trigger trg_event_lifecycle before update or delete on events
  for each row execute function enforce_event_lifecycle();

-- ── A7: audit coverage for students / events / event_sessions ──────
drop trigger if exists trg_audit_students on students;
create trigger trg_audit_students after insert or update or delete on students
  for each row execute function write_audit();
drop trigger if exists trg_audit_events on events;
create trigger trg_audit_events after insert or update or delete on events
  for each row execute function write_audit();
drop trigger if exists trg_audit_sessions on event_sessions;
create trigger trg_audit_sessions after insert or update or delete on event_sessions
  for each row execute function write_audit();

-- Event makers need to read the audit trail of their own admin actions
-- (viewer ships in Session 11; super_admin already has read).
create policy audit_maker_read on audit_log for select
  using (my_role() = 'event_maker' and actor_id = auth.uid());

-- Realtime on sessions so open dashboards see schedule edits.
do $$ begin
  alter publication supabase_realtime add table event_sessions;
exception when duplicate_object then null; end $$;
