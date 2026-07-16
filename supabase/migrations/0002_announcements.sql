-- Announcements shown on the student app home screen.

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  active boolean not null default true,
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

create policy announcements_read on announcements for select
  using (auth.uid() is not null and active);
create policy announcements_staff on announcements for all
  using (my_role() in ('super_admin', 'event_maker'));

insert into announcements (title, body) values
  ('GA seating by course block',
   'Enter through your assigned gate. Gates open 6:30 AM.'),
  ('Excuse letters now digital',
   'File excuses in-app with a photo — no more paper.');
