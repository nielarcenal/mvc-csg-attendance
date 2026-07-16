# MVC CSG Attendance System

Offline-capable attendance system for MVC Central Student Government events,
implemented from the design handoff in `design_handoff_mvc_attendance/`
(direction **1b "Campus"**, spec + amendments applied).

## Projects

| Directory | App | Stack | Accent |
|---|---|---|---|
| `student_app/` | Student app — digital QR ID, calendar, event detail + RSVP, history, excuses, fines, notifications | Flutter (Android/iOS/web) | Blue `#3F9BD8` |
| `checker_app/` | Checker app — event prep, scan screen, manual lookup, sync status, kiosk mode | Flutter (Android/iOS/web) | Green `#35A463` |
| `dashboard/` | Event maker web dashboard — analytics, events, live attendance, review queue, accounts, batch QR IDs, audit log, settings | Vite + React + TypeScript | Purple `#8E5FAE` |
| `supabase/` | Postgres schema, RLS policies, triggers (audit log, fines, idempotent scan upsert) | Supabase SQL | — |

## Running

```sh
# Dashboard (http://localhost:5173)
cd dashboard && npm install && npm run dev

# Student app
cd student_app && flutter pub get && flutter run    # -d chrome also works

# Checker app
cd checker_app && flutter pub get && flutter run
```

Without backend configuration all three apps run on **demo data** that
mirrors the handoff mocks (sign-in accepts anything). With a Supabase
project configured they run fully live.

## Going live

1. **Create a Supabase project** (free tier) at supabase.com.
2. **Apply schema + seed** — set env vars and run the one-shot script:

   ```powershell
   $env:SUPABASE_PROJECT_REF      = "<project ref>"
   $env:SUPABASE_ACCESS_TOKEN     = "sbp_..."   # dashboard → account → tokens
   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."    # project settings → API
   node scripts/setup-live.mjs
   ```

   It applies `supabase/migrations/`, seeds demo accounts/roster/events,
   and prints the sign-in credentials.
3. **Deploy the edge function** (account provisioning; service key stays
   server-side per spec §6):

   ```powershell
   npx supabase functions deploy provision-account --project-ref <ref>
   ```
4. **Configure the clients**
   - Dashboard: copy `dashboard/.env.example` → `.env.local`.
   - Flutter apps: pass `--dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...`
     to `flutter run` / `flutter build`.
5. **Deploy** — pushing to `main` runs `.github/workflows/deploy.yml`, which
   builds the dashboard + both Flutter web apps and publishes them to GitHub
   Pages (`/`, `/dashboard/`, `/student/`, `/checker/`). Set the repo secrets
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` first. Android APKs build via
   `.github/workflows/android.yml` (manual dispatch) or locally with
   `flutter build apk --release` + the same dart-defines.

On Android the checker app scans with the real camera (`mobile_scanner`);
on web the **Simulate next scan** button walks the cached roster so the
full pipeline can be exercised without a camera.

## Key domain rules implemented

- **Scan-time validity** — attendance status is computed from `scanned_at`,
  never `synced_at`; offline scans made inside the window stay `valid` when
  they sync late (`compute_scan_status` in the migration; surfaced in the
  sync screen + live table UI).
- **Idempotent offline sync** — every scan carries a client-generated UUID;
  unique `(event_id, student_id, scan_type)` with earliest-scan-wins merge
  (`upsert_scan`).
- **Schools, not gates** — checkers are assigned per school (SBA/SOA/SOC/
  SAS/SOT/SON/SMT/SOE); the school tag is stamped on every attendance record.
- **Late scans → review queue**; approve/reject writes to the append-only
  audit log (DB triggers, read-only for every role).
- **Fines** — auto-generated when a required event closes for absentees
  without an approved excuse; approved excuses waive fines automatically.

## Design tokens

Single source: handoff README. Encoded in `dashboard/src/styles/tokens.css`
and `*/lib/theme.dart` (identical values, per-app accent). Fonts: Bricolage
Grotesque (display) + Plus Jakarta Sans (UI), via Google Fonts.
