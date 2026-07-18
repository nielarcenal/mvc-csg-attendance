# NEXT_STEPS.md — FEATURE_BATCH_2 session plan

Status after 2026-07-18.

## Session 8 — Migrations & backend ✅ DONE (2026-07-18)
A1–A8 migrations (`supabase/migrations/0003_feature_batch_2.sql`), backfills,
`upsert_scan` rework (session-level, legacy-compatible signature), RLS for new
tables, seed update, `list_users` on the provision-account edge function,
migration report (`migration_report` table; see report in commit message /
conversation). Applied to the live project and verified:
- existing events got exactly one backfilled session (id = event id); all 20
  existing attendance rows repointed; unique constraint now
  (session_id, student_id, scan_type); earliest-scanned_at still wins.
- name split: 2 rows flagged ("Dela Cruz, Juan Miguel" ×2 — compound first
  name); both resolved (seed ground truth).
- `full_name` on profiles/students is now a trigger-synced mirror of
  first/middle/last (display form "First M. Last"). DROP it after Sessions
  9–11 remove the last full_name writers/readers.
- students.school_id / first+last names / attendance.session_id /
  events.start_date+end_date are NOT NULL on live.

## Session 9 — Event maker UI (NOT STARTED)
Event duration/sessions/audience editor, delete/archive with confirmations,
all confirmation dialogs (FEATURE_BATCH_2 §B), header logo nav + modal
barrier, School column/filters (relabel from Course), sortable tables with
URL-reflected sort, admin edit student, CSV import new column format
(student_no, first_name, middle_name, last_name, email, school, course,
year_level, section).
Accept: create a 1-week event with 2 sessions on day 1; edit and delete flows
confirm properly; logo click does nothing while a dialog is open; students
sort by school/year/course/name and survive refresh.

## Session 10 — QR v2 (NOT STARTED)
`issue_qr_pass` edge function + ed25519 keys in secrets, student Generate
screen with countdown ring, checker offline validation (signature + TTL +
replay block), admin QR controls (mode/expiry/deactivate/regenerate),
printing auto-fit. Roster download bundles sessions + audience-scoped
students + QR public key.
Accept: generated pass scans offline; re-scan rejected; screenshot after TTL
fails "Expired"; deactivated static QR fails; 45-char name fits the card.

## Session 11 — Reports, polish, self-service (NOT STARTED)
xlsx student/event exports, audit viewer with full date+time + actor/table/
date filters, Last login column (backend `list_users` is live already),
auto+manual refresh on all clients, student change-password, per-day
schedule in student event detail, display-name helper used everywhere.

## Session 12 — Regression (NOT STARTED)
Full offline walkthrough under the session model (download → airplane →
dynamic pass + static + manual + duplicate → reconnect → correct rows,
statuses from session windows) + UX audit checklist on all screens touched
in 8–11.
