-- MVC CSG Attendance System — initial schema (spec §5 + §6)
-- Amendment applied: checkers are assigned to SCHOOLS, not gates.
-- `school` replaces `gate_label` in event_checkers and attendance.

-- ── enums ──────────────────────────────────────────────────────────
create type user_role as enum ('super_admin', 'event_maker', 'checker', 'student');
create type account_status as enum ('invited', 'activated', 'never_logged_in');
create type scan_type as enum ('in', 'out');
create type scan_method as enum ('qr', 'rfid', 'manual');
create type attendance_status as enum ('valid', 'for_review', 'approved', 'rejected');
create type excuse_status as enum ('pending', 'approved', 'rejected');
create type fine_status as enum ('unpaid', 'paid', 'waived');

-- ── master data ────────────────────────────────────────────────────
create table schools (
  code text primary key,          -- SBA, SOA, SOC, SAS, SOT, SON, SMT, SOE
  name text not null
);

insert into schools (code, name) values
  ('SBA', 'School of Business and Accountancy'),
  ('SOA', 'School of Agriculture'),
  ('SOC', 'School of Computing'),
  ('SAS', 'School of Arts and Sciences'),
  ('SOT', 'School of Theology'),
  ('SON', 'School of Nursing'),
  ('SMT', 'School of Medical Technology'),
  ('SOE', 'School of Education');

create table settings (
  key text primary key,
  value jsonb not null
);

insert into settings (key, value) values
  ('default_fine_amount', '50.00'),
  ('grace_period_minutes', '0'),
  ('excuse_deadline_days', '3'),
  ('reminder_hours', '[24, 1]');

-- ── profiles ───────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'student',
  full_name text not null,
  email text not null unique,
  account_status account_status not null default 'invited',
  invited_by uuid references profiles,
  active boolean not null default true   -- soft delete
);

-- ── students (roster records, independent of login accounts) ───────
create table students (
  id uuid primary key default gen_random_uuid(),
  student_no text not null unique,
  full_name text not null,
  email text,
  course text,
  year_level int,
  section text,
  qr_token uuid not null unique default gen_random_uuid(),
  rfid_uid text unique,
  profile_id uuid references profiles,
  active boolean not null default true
);

-- ── events ─────────────────────────────────────────────────────────
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  checking_opens_at timestamptz not null,
  checking_closes_at timestamptz not null,
  is_required boolean not null default true,
  requires_time_out boolean not null default false,
  minimum_stay_minutes int,
  fine_amount numeric(8,2) not null default 50.00,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now()
);

create table event_rsvps (
  event_id uuid not null references events on delete cascade,
  student_id uuid not null references students on delete cascade,
  going boolean not null,
  responded_at timestamptz not null default now(),
  primary key (event_id, student_id)
);

-- ── checker assignments (school, not gate — spec amendment #1) ─────
create table event_checkers (
  event_id uuid not null references events on delete cascade,
  profile_id uuid not null references profiles,
  school text not null references schools (code),
  primary key (event_id, profile_id)
);

-- ── attendance ─────────────────────────────────────────────────────
-- id is CLIENT-GENERATED on the scanning device so offline re-uploads
-- are idempotent. Unique (event_id, student_id, scan_type): earliest
-- scanned_at wins on conflict (see upsert_scan()).
create table attendance (
  id uuid primary key,
  event_id uuid not null references events,
  student_id uuid not null references students,
  scan_type scan_type not null,
  method scan_method not null,
  status attendance_status not null,
  scanned_at timestamptz not null,   -- decides validity
  synced_at timestamptz not null default now(),
  checker_id uuid not null references profiles,
  device_id text,
  school text not null references schools (code),
  note text,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  unique (event_id, student_id, scan_type)
);

-- Status from the SCAN time, never the sync time (spec §3.2).
create or replace function compute_scan_status(p_event uuid, p_scanned timestamptz)
returns attendance_status language sql stable security definer set search_path = public as $$
  select case
    when p_scanned <= e.checking_closes_at
      + make_interval(mins => coalesce(
          (select value #>> '{}' from settings where key = 'grace_period_minutes')::int, 0))
      then 'valid'::attendance_status
    else 'for_review'::attendance_status
  end
  from events e where e.id = p_event;
$$;

-- Idempotent upsert used by the checker app's sync queue.
-- Earliest scanned_at wins when two devices scanned the same student.
create or replace function upsert_scan(
  p_id uuid, p_event uuid, p_student uuid, p_type scan_type,
  p_method scan_method, p_scanned timestamptz, p_checker uuid,
  p_device text, p_school text, p_note text default null
) returns attendance language plpgsql security definer set search_path = public as $$
declare rec attendance;
begin
  -- security definer bypasses RLS, so enforce the checker rules here.
  -- auth.uid() is null only for service-role calls (seeding, admin jobs).
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
  insert into attendance (id, event_id, student_id, scan_type, method, status,
                          scanned_at, checker_id, device_id, school, note)
  values (p_id, p_event, p_student, p_type, p_method,
          compute_scan_status(p_event, p_scanned),
          p_scanned, p_checker, p_device, p_school, p_note)
  on conflict (event_id, student_id, scan_type) do update
    set scanned_at = least(attendance.scanned_at, excluded.scanned_at),
        status = compute_scan_status(p_event, least(attendance.scanned_at, excluded.scanned_at))
    where attendance.scanned_at > excluded.scanned_at
  returning * into rec;
  if rec.id is null then
    select * into rec from attendance
      where event_id = p_event and student_id = p_student and scan_type = p_type;
  end if;
  return rec;
end $$;

-- ── excuses ────────────────────────────────────────────────────────
create table excuses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students,
  event_id uuid not null references events,
  reason text not null,
  attachment_urls text[] not null default '{}',
  status excuse_status not null default 'pending',
  filed_at timestamptz not null default now(),
  reviewed_by uuid references profiles,
  reviewed_at timestamptz
);

-- ── fines ──────────────────────────────────────────────────────────
create table fines (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students,
  event_id uuid not null references events,
  amount numeric(8,2) not null,
  status fine_status not null default 'unpaid',
  paid_at timestamptz,
  or_number text,
  created_at timestamptz not null default now(),
  unique (student_id, event_id)
);

-- Generate fines when an event closes: absent + no approved excuse → fine.
create or replace function generate_fines(p_event uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and my_role() not in ('super_admin', 'event_maker') then
    raise exception 'role cannot generate fines';
  end if;
  insert into fines (student_id, event_id, amount)
  select s.id, e.id, e.fine_amount
  from events e
  cross join students s
  where e.id = p_event and e.is_required and s.active
    and not exists (select 1 from attendance a
                    where a.event_id = e.id and a.student_id = s.id
                      and a.scan_type = 'in' and a.status in ('valid', 'approved'))
    and not exists (select 1 from excuses x
                    where x.event_id = e.id and x.student_id = s.id and x.status = 'approved')
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Approved excuse waives the fine automatically.
create or replace function on_excuse_approved()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    update fines set status = 'waived'
      where student_id = new.student_id and event_id = new.event_id and status = 'unpaid';
  end if;
  return new;
end $$;

create trigger trg_excuse_approved
  after update on excuses
  for each row execute function on_excuse_approved();

-- ── audit log (append-only, written by triggers) ───────────────────
create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles,
  action text not null,
  table_name text not null,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

revoke update, delete on audit_log from public, anon, authenticated;

create or replace function write_audit()
returns trigger language plpgsql security definer as $$
begin
  insert into audit_log (actor_id, action, table_name, record_id, old_values, new_values)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((case when tg_op = 'DELETE' then old else new end).id::text, ''),
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger trg_audit_attendance after insert or update or delete on attendance
  for each row execute function write_audit();
create trigger trg_audit_excuses after insert or update or delete on excuses
  for each row execute function write_audit();
create trigger trg_audit_fines after insert or update or delete on fines
  for each row execute function write_audit();
create trigger trg_audit_profiles after insert or update or delete on profiles
  for each row execute function write_audit();

-- ── row-level security (spec §6) ───────────────────────────────────
alter table profiles enable row level security;
alter table students enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table event_checkers enable row level security;
alter table attendance enable row level security;
alter table excuses enable row level security;
alter table fines enable row level security;
alter table audit_log enable row level security;
alter table schools enable row level security;
alter table settings enable row level security;

-- security definer: these run inside RLS policies on the same tables they
-- read, so without it policy evaluation would recurse infinitely.
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where profile_id = auth.uid();
$$;

-- profiles: read own; staff read all; super-admin manages
create policy profiles_self on profiles for select using (id = auth.uid());
create policy profiles_staff_read on profiles for select
  using (my_role() in ('super_admin', 'event_maker'));
create policy profiles_admin_all on profiles for all
  using (my_role() = 'super_admin');

-- students: students see own record; checkers/makers read rosters
create policy students_self on students for select using (profile_id = auth.uid());
create policy students_staff_read on students for select
  using (my_role() in ('super_admin', 'event_maker', 'checker'));
create policy students_manage on students for all
  using (my_role() in ('super_admin', 'event_maker'));

-- events: everyone authenticated reads; makers manage own; admin all
create policy events_read on events for select using (auth.uid() is not null);
create policy events_maker on events for all
  using (my_role() = 'super_admin' or (my_role() = 'event_maker' and created_by = auth.uid()));

-- rsvps: student manages own
create policy rsvp_self on event_rsvps for all using (student_id = my_student_id());
create policy rsvp_staff_read on event_rsvps for select
  using (my_role() in ('super_admin', 'event_maker'));

-- event_checkers: checker sees own assignments; makers manage
create policy checkers_self on event_checkers for select using (profile_id = auth.uid());
create policy checkers_manage on event_checkers for all
  using (my_role() in ('super_admin', 'event_maker'));

-- attendance: checkers insert only for assigned events; students read own
create policy attendance_checker_insert on attendance for insert
  with check (
    checker_id = auth.uid()
    and exists (select 1 from event_checkers ec
                where ec.event_id = attendance.event_id and ec.profile_id = auth.uid())
  );
create policy attendance_checker_read on attendance for select
  using (exists (select 1 from event_checkers ec
                 where ec.event_id = attendance.event_id and ec.profile_id = auth.uid()));
create policy attendance_student_read on attendance for select
  using (student_id = my_student_id());
create policy attendance_staff on attendance for all
  using (my_role() in ('super_admin', 'event_maker'));

-- excuses: student files/reads own; makers review
create policy excuses_student on excuses for select using (student_id = my_student_id());
create policy excuses_student_insert on excuses for insert
  with check (student_id = my_student_id());
create policy excuses_staff on excuses for all
  using (my_role() in ('super_admin', 'event_maker'));

-- fines: student reads own; makers manage
create policy fines_student on fines for select using (student_id = my_student_id());
create policy fines_staff on fines for all
  using (my_role() in ('super_admin', 'event_maker'));

-- audit log: super-admin read-only (no write policies — triggers only)
create policy audit_admin_read on audit_log for select using (my_role() = 'super_admin');

-- master data: read for all; super-admin writes
create policy schools_read on schools for select using (true);
create policy schools_admin on schools for all using (my_role() = 'super_admin');
create policy settings_read on settings for select using (auth.uid() is not null);
create policy settings_admin on settings for all using (my_role() = 'super_admin');

-- ── storage: excuse attachments ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('excuse-attachments', 'excuse-attachments', false)
on conflict (id) do nothing;

create policy excuse_files_insert on storage.objects for insert
  with check (bucket_id = 'excuse-attachments' and auth.uid() is not null);
create policy excuse_files_read on storage.objects for select
  using (bucket_id = 'excuse-attachments'
         and (owner = auth.uid() or my_role() in ('super_admin', 'event_maker')));

-- Realtime for the live attendance dashboard
alter publication supabase_realtime add table attendance;
