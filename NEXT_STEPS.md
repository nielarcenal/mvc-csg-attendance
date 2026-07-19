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

## Session 9 — Event maker UI (9a DONE 2026-07-19; 9b remaining)
**9a done:** event create/edit with duration selector (1 day / 1 week /
custom), per-day session editor (program, venue, mode, open/close, add/
remove), audience selector (all students / by school), Edit button + route
on the events list, CSV import in the new column format (with validation,
skip reporting and a downloadable template), Add-student form with name
parts + required School. Verified in a real browser against live Supabase
(1-week event, 2 sessions on day 1, by-school SOC+SOE, edit round-trip,
CSV import with a bad-school row skipped); test fixtures cleaned up.
**9b done (2026-07-19):** Accounts School column (course moved to the edit
modal / detail view), admin edit-student with save confirmation (roster is
name truth; linked profile name synced), students sortable by name A–Z /
school / year / course with the sort in the URL, reactivate confirmation,
events Delete (zero-attendance, soft) vs Archive (data intact) with
confirmations + Archived filter + Unarchive, CSG logo/"CSG Events" routes
to the dashboard, and all modal barriers now swallow background clicks —
Esc/Cancel are the only ways out. Browser-verified (sort survives refresh;
edit round-trip; delete/archive/unarchive; logo click blocked under an
open dialog). Session 9 is COMPLETE.

## Session 10 — QR v2 (CODE COMPLETE 2026-07-19; verification partially done)

### Done and verified against live
- **Keys (A5):** `scripts/setup-qr-keys.mjs` ran once — ed25519 private key
  (PKCS8 base64) lives ONLY in the edge secret `QR_SIGNING_KEY`; public key
  (raw 32B base64) is in `settings.qr_public_key` (authenticated read, rides
  with the checker roster bundle). Re-running the script is a no-op unless
  `--rotate` (rotation kills all outstanding passes/printed flows once
  checkers refresh). Current public key: 9UwPZeMtZAPv1kmb7n5SKKxVlo7qGexPFUAyqqOt228=
- **`supabase/functions/issue_qr_pass`** deployed (v1, verify_jwt=false —
  it does its own JWT check like provision-account). Smoke-tested with a
  real student login: 150s TTL honored, signature verifies against the
  published public key, tampered exp rejected. Pass format:
  `QP1.<student_id>.<iat>.<exp>.<sig_b64url>`, signature over
  `"<student_id>.<iat>.<exp>"` (UTF-8). TTL clamped to ≥30s server-side.

### Code complete, analyze/tsc clean, NOT yet end-to-end verified
- **Checker offline validation** (`checker_app/lib/data/scan_store.dart`
  `_recordDynamicPass` + static gating in `recordToken`; roster bundle in
  `live_repo.refreshRoster` now carries qr_active/qr_expires_at + the
  public key, persisted in SharedPreferences as `qr_public_key_v1`):
  ed25519 verify via the `cryptography` package (new pubspec dep), expiry,
  replay block (last-iat-per-student map), distinct ScanResult.expired /
  ScanResult.rejected states with reasons, wired into the scan + kiosk
  feedback cards.
- **Student Generate screen** (`student_app/lib/screens/digital_id_screen.dart`
  rewritten): dynamic mode = Generate/Regenerate + countdown ring + expiry
  gray-out + offline message; static mode = old token QR; deactivated
  message. `repo.issueQrPass()` in `student_app/lib/data/live_repo.dart`;
  `Student` model gained qrMode/qrActive.
- **Admin QR controls** (`dashboard/src/pages/Accounts.tsx`
  EditStudentModal "QR CODE" section): mode switch, active/deactivated,
  static expiry date (empty = never), Regenerate-token button — save and
  regenerate each confirm (§B); `regenerateQrToken`/`updateStudent` in
  `dashboard/src/data/api.ts`; StudentDetail carries qr fields.
- **Print auto-fit** (`dashboard/src/pages/BatchQr.tsx` `nameFontSize`):
  name font scales 10.5→6px by longest line, applied to preview AND print
  HTML. Not yet screenshot-tested with a 45-char name.

### Remaining verification (next session picks up here)
1. **Offline checker drive — IN PROGRESS.** Driver:
   `dashboard/.drive-offline.mjs` (run from `dashboard/` with
   `ANON=<anon key> SHOTS_DIR=<dir> node .drive-offline.mjs`; serve the
   checker web build first: `python -m http.server 8080 -d build/web` in
   checker_app; build cmd in the driver header comment / memory). Status:
   login + roster download + events screen WORK (coordinate clicks at
   480px viewport); last fix made the text assertion pierce Flutter's
   shadow DOM (`flt-glass-pane`) — NOT re-run since. Remaining asserts:
   valid pass accepted offline, replay refused, expired refused, tampered
   sig refused, deactivated static refused, reconnect sync.
   Fixtures were ephemeral (scratchpad `qr-fixtures.json` — expired pass,
   student access token, Bea's static token); regenerate by: set
   qr_pass_ttl_seconds=30 → issue pass → restore 150; set Bea
   (2024-00318) qr_active=false for the deactivated case and RESTORE
   after (live DB is currently clean: Bea active, TTL 150).
2. Student Generate screen browser check (web build + screenshot of QR +
   countdown; offline shows the connect message).
3. Batch QR 45-char-name screenshot.
4. **Real airplane-mode test on a physical device** — no device was
   attached; explicitly still owed (fold into Session 12 regression).
   Checker/student Android APKs must be rebuilt for v2 (new dart code).

## Session 11 — Reports, polish, self-service (NOT STARTED)

## Session 11 — Reports, polish, self-service (NOT STARTED)
xlsx student/event exports, audit viewer with full date+time + actor/table/
date filters, Last login column (backend `list_users` is live already),
auto+manual refresh on all clients, student change-password, per-day
schedule in student event detail, display-name helper used everywhere.
Note: checker session picker (batch-2 §D) is ALSO still unbuilt — the
checker still scans at event level with the server resolving the session
from scanned_at; roster cache does not yet invalidate on session changes.

## Session 12 — Regression (NOT STARTED)
Full offline walkthrough under the session model (download → airplane →
dynamic pass + static + manual + duplicate → reconnect → correct rows,
statuses from session windows) + UX audit checklist on all screens touched
in 8–11.
