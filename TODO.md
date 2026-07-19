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

## UX audit deferrals (2026-07-18 — reasons per UX_STANDARDS acceptance)
- **go_router adoption in both Flutter apps** (§1 Router). The behavioral
  guarantees exist today (auth redirect on launch/sign-out, role rejection at
  sign-in, stack reset to login, working system back), but routing is raw
  Navigator. Converting is a structural refactor that lands with the
  Session 9–11 client rework rather than as an audit patch.
- **Distinct scan sounds** (§6). Implemented with SystemSound (click for
  accepted, alert/click for unknown, silence+strong haptic for duplicate) —
  fully distinct custom audio needs bundled assets + an audio package; add
  when a real device test can tune volumes outdoors.
- **Notification deep-links** (§1) blocked on FCM (above).
- **1.3x font scale + outdoor real-device scan verification** (§7, audit
  acceptance): needs physical hardware; scheduled into Session 12 regression.
- **QR card name auto-fit** (§7 overflow): FEATURE_BATCH_2 Session 9 item.
- **Sortable tables + URL sort state** (§8 "where meaningful"): specified as
  part of FEATURE_BATCH_2 Session 9 (school/year/course/name sorting).
- **Audit log date-range filter**: Session 11 (viewer now shows full
  date+time and filters by actor/table/action).

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
- **QR v2 (Session 10) verified in-browser 2026-07-19** (offline checker
  validation incl. replay/expiry/tamper/deactivated, student Generate
  screen, batch-QR name auto-fit — drivers `.drive-offline.mjs`,
  `.drive-student.mjs`, `.drive-qrfit.mjs` in dashboard/, all PASS).
  Key facts: ed25519 private key ONLY in edge secret `QR_SIGNING_KEY`
  (losing it means rotating via `scripts/setup-qr-keys.mjs --rotate`),
  public key in `settings.qr_public_key`.
- **Real-device airplane-mode scan test still owed** for QR v2 acceptance
  (no Android device was attached); Android APKs need a rebuild to carry
  the v2 code. Fold into Session 12 regression.
