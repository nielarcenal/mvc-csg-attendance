# TODO.md — Known gaps (hard rule 4: say so explicitly)

Features that are **not** implemented. Their UI affordances were removed in
the 2026-07-17 audit so nothing pretends to work — re-add UI only together
with the real implementation.

## Backend / infrastructure
- **FCM push notifications** (event reminders, "attendance recorded", "marked absent" — Phase 6).
  Needs a Firebase project + `firebase_messaging` in both Flutter apps + a
  trigger (Edge Function or pg_cron) to send. The student app currently
  *synthesizes* a notifications list from the student's own records on
  refresh, which is real data but not push.
- **Forced password change on first login** (Phase 6/7). Temp-password accounts
  can keep the temp password. Needs a `must_change_password` flag on profiles
  (set by the provision-account function) and a change-password screen in the
  student app enforced after sign-in.
- **Checker offline store uses SharedPreferences, not drift** (CLAUDE.md stack
  decision says drift/SQLite). Functionally equivalent for current volumes
  (roster JSON + scan queue survive restarts) but a deliberate substitution —
  migrate to drift or get sign-off on the substitution.
- **Real connectivity detection in the checker app**. The ONLINE/OFFLINE pill is
  a manual toggle that gates sync (works, and is honest), but it does not
  auto-detect airplane mode. Add `connectivity_plus` and flip state + flush

## FEATURE_BATCH_2 transition (backend landed Session 8, 2026-07-18)
- **Clients not yet session-aware.** The DB is session-level
  (event_sessions, attendance.session_id); deployed clients still scan at
  event level. `upsert_scan` resolves the session server-side from
  scanned_at, so old checker builds keep working — but the checker session
  picker, student per-day schedule, and event maker session editor are
  Sessions 9–11 (see NEXT_STEPS.md).
- **`full_name` is a trigger-synced legacy mirror** on profiles/students.
  Drop the column (and the sync trigger) once no client reads or writes it.
- **Dashboard CSV import and student-create will fail for new students until
  Session 9**: `students.school_id` is now NOT NULL and the current UI does
  not send it (existing rows were backfilled from course codes). Deliberate —
  the CSV format changes in Session 9 anyway.
- **QR v2 columns exist (qr_mode/qr_active/qr_expires_at, TTL setting) but
  behavior is unchanged** until Session 10 ships `issue_qr_pass` + checker
  validation. Everything still scans the static qr_token.
