# MVC Central Student Government — Attendance System
## Complete Project Specification (Design Handoff)

**Version:** 1.0 · **Date:** July 15, 2026
**Tech stack:** Flutter (student app + checker app), Flutter Web or standard web (event maker dashboard), Supabase (Postgres, Auth, Realtime, Edge Functions), Firebase Cloud Messaging (push notifications)

---

## 1. Project overview

An offline-capable attendance system for MVC Central Student Government events. Students are identified by unique QR codes or RFID cards. Attendance is scanned by checkers at event gates, synced to a central Supabase backend, and monitored live by event makers through a web dashboard. The system supports late-scan review, excuse letters, fines, and full audit trails.

**Three client applications:**

1. **Student app** (Flutter, Android/iOS) — digital QR ID, event calendar, notifications, attendance history
2. **Checker app** (Flutter, Android/iOS) — QR camera scanning, RFID tap input, offline scan queue
3. **Event maker web** (dashboard) — event management, live attendance, review queue, account provisioning, reports

---

## 2. User roles and permissions

| Role | Scope |
|---|---|
| **Super-admin** | Full CRUD on everything: users (create/edit/deactivate all roles, reset passwords, promote/demote), any event, any attendance record (edit/void with automatic audit entry), excuses and fines (override, waive, correct), master data (courses, year levels, sections, school years, gate labels, fine rates), system settings (email templates, grace periods, notification timing). Audit log is read-only even for super-admin. All deletes are soft deletes. |
| **Event maker** | Create/manage own events, import student rosters, assign checkers, review late scans and excuses, generate reports, create accounts for checkers and students, send credential invites via email. |
| **Checker** | Scan attendance (QR/RFID/manual lookup) only for events they are assigned to. |
| **Student** | View own QR code, event calendar, attendance history, fines; file excuse letters. No access to other students' data. |

Role hierarchy: super-admin → event maker → checker → student. Enforced by Supabase row-level security at the database level.

---

## 3. Core attendance logic

### 3.1 Student identification
- Every student record has a random **`qr_token` (UUID)** — the QR encodes this token, never the raw student number, so codes cannot be forged from a known student ID.
- **RFID cards** (EM4100 / MIFARE USB keyboard-wedge readers) type the card UID into a hidden focused input on the checker screen. A one-time enrollment step links each card UID to a student record (tap card → enter student number → saved).
- **Manual lookup fallback**: checker searches by name/student number when a phone is dead or ID forgotten. Manual entries are tagged `method = manual` and are the first thing auditors filter for.

### 3.2 Checking window and late-scan review
- Each event has `checking_opens_at` and `checking_closes_at` timestamps set by the event maker.
- Scans **inside the window** → saved with status `valid`.
- Scans **after the window closes** are still accepted (unexpected delays happen) but saved with status `for_review`, with minutes-late recorded and an optional checker note (e.g., "bus broke down, whole block delayed").
- Event maker reviews each flagged scan in a **review queue** and approves (`approved` — counts as present) or rejects (`rejected`) with a reason.
- **Critical rule:** status is computed from the **scan timestamp**, not the sync time. A scan made offline during the valid window must not be flagged when it syncs an hour later.

### 3.3 Offline-first sync (checker app)
- Before the event (online): app downloads the event roster (names, QR tokens, RFID UIDs) into local storage (SQLite via drift/hive).
- During the event (offline OK): every scan validates locally against the cached roster — instant feedback with student name; duplicates blocked on-device.
- Each scan stored locally with a **client-generated UUID** and timestamp; queued for sync.
- When online: queue pushes to Supabase as **idempotent upserts**. Unique constraint on `(event_id, student_id, scan_type)` — earliest timestamp wins if two devices scanned the same student.
- Both `scanned_at` (counts for attendance) and `synced_at` (upload time) are stored and displayed, so late uploads don't look suspicious.

### 3.4 Time-in / time-out
- Events can optionally require time-out (`requires_time_out`).
- Optional minimum-stay rule: students who scan out before N minutes are marked "left early."

---

## 4. Feature list by application

### 4.1 Student app (Flutter mobile)
- **Login** (Supabase Auth; account created by event maker, activated via emailed invite/temp password with forced change on first login)
- **Digital ID screen** — full-screen QR, auto max brightness, cached offline. Optional rotating QR (TOTP-style refresh every 30–60s when online, static fallback offline) to prevent screenshot sharing
- **Event calendar** — month/list view of upcoming and past SG events
- **Upcoming events** — home-screen cards with venue, time, required/optional badge
- **Push notifications** (FCM) — event reminders (24h and 1h before), "attendance recorded" confirmation, "marked absent" alert, announcements
- **Attendance history** — per-event time-in/out, method, status; semester attendance rate
- **Excuse submission** — file excused absence with photo attachment (medical cert/excuse letter), track approval status
- **Fines/sanctions tracker** — running balance auto-computed from unexcused absences, payment status
- **Event RSVP** — pre-register for optional events (headcount prediction); required events skip RSVP
- **Announcements feed**

### 4.2 Checker app (Flutter mobile)
- **Login** (checker role account)
- **Assigned events list** — only events this checker is assigned to
- **Pre-event roster download** — one tap while online caches the full roster
- **Scan screen** — camera QR scanning + hidden focused input for RFID keyboard-wedge taps; large instant feedback (student name + photo placeholder + green check / red duplicate warning)
- **Manual lookup** — search by name or student number; tagged `manual`, optional photo requirement
- **Late-scan note** — attach context when scanning after the window
- **Live counters** — scanned count, pending-sync count, clear offline/online indicator
- **Gate/checkpoint label** — checker tags which entrance they cover
- **Kiosk mode** — lock app to scan screen for borrowed devices
- **Background sync** with retry when connectivity returns

### 4.3 Event maker web dashboard
- **Login** (event maker or super-admin)
- **Event CRUD** — name, venue, start/end, checking window, requires time-out, fine amount; event templates and recurring events
- **Roster management** — CSV import of students (student no, name, email, course, year)
- **Checker assignment** — assign checkers to events with gate labels
- **Live attendance view** (Supabase Realtime) — names appear as scans sync
- **Attendance detail sheet (per event)** — every row shows: student, exact time-in/time-out, **method** (QR / RFID / manual, with icon), **checker name**, **gate**, device, **scanned-at vs synced-at**, status. Filters: by method (audit manual entries), by arrival time, by checker, by status
- **Review queue** — approve/reject late scans (with checker notes and minutes-late) and excuse letters, in one inbox
- **Account provisioning** — create checker accounts individually; bulk-create student accounts from CSV; send credentials via email using Supabase `inviteUserByEmail` (activation link) or temp password with forced first-login change; account creation runs through a secure edge function (service key never in browser). Account status per user (invited / activated / never logged in) with resend-invite; self-service password reset; deactivation for transferred/graduated students
- **Analytics dashboard** — attendance rate per course/year/section, trends across events, chronic absentee list
- **Batch QR ID generation** — printable PDF of ID cards with QR codes from roster CSV
- **Reports/exports** — Excel/PDF per event or semester: attendance sheet, absentee list, fines summary
- **Audit log viewer** (super-admin) — who scanned/approved/edited what, old vs new values
- **Master data management** (super-admin) — courses, year levels, sections, school years, gate labels, fine rates, email templates

### 4.4 Optional/flagged features (second release)
- **Geofencing** — checker app accepts scans only within X meters of venue (can misfire indoors)
- **Minimum-stay time-out** enforcement
- **Fraud alerts** — same student scanned at two gates minutes apart

---

## 5. Database schema (Supabase / Postgres)

### profiles
`id (uuid, PK → auth.users)`, `role (super_admin | event_maker | checker | student)`, `full_name`, `email`, `account_status (invited | activated | never_logged_in)`, `invited_by (FK → profiles)`, `active (bool, soft delete)`

### students
`id (uuid, PK)`, `student_no (unique)`, `full_name`, `email`, `course`, `year_level`, `section`, `qr_token (uuid, unique)`, `rfid_uid (unique, nullable)`, `profile_id (FK → profiles, nullable)`, `active (bool)`

> Students exist as roster records independent of login accounts — attendance works even if a student never installs the app. `profile_id` links the record once they activate.

### events
`id (uuid, PK)`, `name`, `description`, `venue`, `starts_at`, `ends_at`, `checking_opens_at`, `checking_closes_at`, `requires_time_out (bool)`, `fine_amount (numeric)`, `created_by (FK → profiles)`

### event_checkers
`event_id (FK)`, `profile_id (FK)`, `gate_label` — composite PK (event_id, profile_id)

### attendance
`id (uuid, PK — client-generated on device for idempotent sync)`, `event_id (FK)`, `student_id (FK)`, `scan_type (in | out)`, `method (qr | rfid | manual)`, `status (valid | for_review | approved | rejected)`, `scanned_at`, `synced_at`, `checker_id (FK → profiles)`, `device_id`, `gate_label`, `note`, `reviewed_by (FK → profiles)`, `reviewed_at`
**Unique constraint:** `(event_id, student_id, scan_type)`

### excuses
`id`, `student_id (FK)`, `event_id (FK)`, `reason`, `attachment_url`, `status (pending | approved | rejected)`, `reviewed_by (FK → profiles)`

### fines
`id`, `student_id (FK)`, `event_id (FK)`, `amount`, `status (unpaid | paid | waived)`, `paid_at`
> Generated by a function when an event closes: absent + no approved excuse → fine created.

### audit_log
`id`, `actor_id (FK → profiles)`, `action`, `table_name`, `record_id`, `old_values (jsonb)`, `new_values (jsonb)`, `created_at` — append-only, read-only for all roles.

---

## 6. Security model

- Supabase **row-level security** on every table, mapped to the four roles
- Checkers can insert attendance only for assigned events; students read only their own rows; event makers manage own events; super-admin unrestricted (but audited)
- QR encodes a random token, not the student number
- Account creation via **edge function** with Admin API — service key never exposed to clients
- Credentials delivered as activation links or temp passwords (forced change), never permanent plaintext passwords
- All destructive operations are soft deletes; all edits to attendance/fines/excuses write to audit_log automatically (Postgres triggers)

---

## 7. Key screens to design

**Student app:** Login → Home (upcoming event cards + announcements) → Digital ID (full-screen QR) → Calendar → Event detail (with RSVP) → Attendance history → Excuse submission form → Fines tracker → Notifications

**Checker app:** Login → Assigned events list → Event prep (roster download, gate selection) → Scan screen (camera viewfinder + status feedback + counters + offline indicator) → Manual lookup → Sync status → Kiosk mode

**Event maker web:** Login → Dashboard (analytics overview) → Events list → Event create/edit (with checking window) → Live attendance view → Attendance detail sheet (filterable table) → Review queue (late scans + excuses) → Accounts (users table, invite flow, CSV import) → Reports/export → Batch QR generation → Audit log → Settings/master data (super-admin)

**Suggested visual identity notes for the designer:** the scan screen is the highest-stakes UI — it must be readable outdoors at arm's length, with success/duplicate/unknown states distinguishable at a glance (color + icon + sound/haptic). The student QR screen should feel like an official ID. The web dashboard is data-dense; prioritize the attendance detail table and review queue.

---

## 8. Build phases

1. **Phase 1 — Core:** student CSV import, QR generation, event CRUD, online-only scanner
2. **Phase 2 — Offline:** local roster cache, scan queue, background sync, conflict handling
3. **Phase 3 — Roles & live:** RFID enrollment and scanning, checker assignments with RLS, realtime dashboard, checking window + review queue
4. **Phase 4 — Polish:** account provisioning + email invites, printable QR IDs, excuses, fines, analytics, exports, audit log viewer

Ship the core (Phases 1–3) first; fines, excuses, and rotating QR are a second release.
