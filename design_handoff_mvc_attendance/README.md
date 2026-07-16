# Handoff: MVC Central Student Government — Attendance System (all three apps)

## Overview
Hi-fi UI designs for an offline-capable attendance system for MVC Central Student Government events, covering all three clients:

1. **Student app** (Flutter, Android/iOS) — digital QR ID, calendar, event detail + RSVP, attendance history, excuse submission, fines tracker, notifications, login
2. **Checker app** (Flutter, Android/iOS) — assigned events, event prep (roster download + school selection), scan screen, manual lookup, sync status, kiosk mode
3. **Event maker web dashboard** — analytics, events list, event create, live attendance, review queue, accounts, batch QR IDs, audit log, master data

The full product spec (roles, attendance logic, database schema, security model) is in `spec/mvc-attendance-system-spec.md`. **Read it first** — the designs implement it screen-for-screen (spec §7).

## ⚠️ Spec amendments (client corrections that override the spec)
1. **Checkers are assigned to SCHOOLS, not gates.** Everywhere the spec says `gate_label`, the working model is a school assignment. The schools are:
   - SBA — School of Business and Accountancy
   - SOA — School of Agriculture
   - SOC — School of Computing
   - SAS — School of Arts and Sciences
   - SOT — School of Theology
   - SON — School of Nursing
   - SMT — School of Medical Technology
   - SOE — School of Education
   The school tag is stamped on every attendance record (replacing `gate_label` in the `attendance` and `event_checkers` tables). Physical gate wording ("scan at the gate") only refers to the venue entrance.
2. **Student accounts can be created manually** (single form) in addition to CSV bulk import — see the "+ Add student" button on the Accounts screen.

## About the Design Files
The files in `design/` are **design references created in HTML** — interactive prototypes showing the intended look and behavior, NOT production code to copy. Your task is to **recreate these designs in the target stack from the spec** (Flutter for the two mobile apps, Flutter Web or a standard web framework for the dashboard, Supabase backend). Use the platform's established patterns (Material 3 on Android is a fine base — the mocks are drawn inside Material-style device frames). The device bezels, browser chrome, status bars, and the canvas/turn scaffolding in the HTML are **presentation only** — do not implement them.

Open `design/MVC Key Screens.dc.html` in a browser to view everything. It is a single canvas organized in turns (newest at top); every screen has a visible option id badge (`1a`…`6b`) and a `data-screen-label` attribute naming it.

## Fidelity
**High-fidelity.** The chosen direction is **"1b Campus"**. Colors, typography, spacing, radii, copy, and states are final — recreate them faithfully with the tokens below. (The canvas also contains two rejected explorations, `1a` "Registrar" and `1c` "Field kit", in turn 1 — ignore them except as context.)

## Screens / Views
All screens below are in the 1b Campus style. Mobile screens are designed at **412×892** (content gutter 20px); dashboard screens at **1240×790** (sidebar 208px, content gutter 22px).

### Student app (accent: blue #3F9BD8)
| Canvas id | Screen | Purpose / key elements |
|---|---|---|
| 4c | Login | Logo, school email + password, blue "Sign in" pill, activation-link info box (accounts are provisioned by SG; temp password forces change on first login) |
| 2a | Home | Date + greeting, blue hero card for next required event ("Open my ID" CTA), Upcoming list (date tile + RSVP/Going chips), Announcements card, 4-tab bar (Home/ID/Calendar/More) |
| 1b | Digital ID | White card: circular profile photo (64px, 2.5px blue ring) + name + student no; QR (206px, in 2.5px blue 16px-radius frame); "Refreshes in 0:24" countdown pill; "Works offline" + "Brightness up" chips; next-event card; tab bar. QR encodes the rotating `qr_token`, never the student number |
| 6a | Calendar | Month grid (event dot colors: green=attended, blue=upcoming, red=absent; today = filled blue circle), Month/List toggle, event rows below with status chips |
| 6a | Event detail | Blue header (title, "Optional · RSVP open" chip), info rows (schedule + check-in window, venue, late-scan warning), RSVP block ("Going ✓" green / "Can't" ghost, headcount), reminders note, "Open my ID" CTA |
| 2a | Attendance history | Semester ring (92%, conic green), present/excused/absent chips, filter pills, per-event cards (time-in/out, method, school, status chip; absent card shows ₱50 fine + "File an excuse →") |
| 2a | Excuse submission | Event picker card, reason textarea (142/500 counter), attachment rows (uploaded file + dashed "Add another photo"), review-SLA note, blue submit pill, previous excuse status card |
| 6a | Fines tracker | Dark balance card (₱ in red-tint #FF9D94, "Pay at SG office" + "File excuse" actions), Paid/Waived/Unpaid summary tiles, history cards with ₱ status chips, auto-waive explainer |
| 4c | Notifications | Today/Earlier groups; types: attendance recorded (green ✓), event reminder (blue ▸), marked absent (red !, includes "File an excuse →" chip), announcement (purple ◎); unread = blue dot, read = 75% opacity |

### Checker app (accent: green #35A463)
| Canvas id | Screen | Purpose / key elements |
|---|---|---|
| 2b | My events / Event prep | Green header, today's event card: "Roster cached — 460 students" state, **YOUR SCHOOL** picker (SBA / SOC ✓ / SOE / +5 ▾), big "Start scanning →"; upcoming event card with "↓ Download roster (while online)"; offline guidance line |
| 1b | Scan screen | Green header ("SOC — School of Computing", ONLINE pill, Time-in/Time-out segmented toggle), dark camera viewfinder (white corner brackets, animated green scanline), feedback card (see States), Scanned/Queued/Dupes counters, "Manual lookup" pill, RFID-ready indicator, offline queue note |
| 3a | Scan screen (interactive) | Same screen wired up: tapping "Simulate next scan" cycles success → duplicate → unknown, updates counters + recent-scans list. Use it to feel the intended feedback timing |
| 2b | Manual lookup | Search field (green focus ring) over keyboard, amber "Manual entries are tagged and reviewed" warning, result rows (avatar initials, "No scan yet"/"In · 7:38" chips), expanded row: "Record time-in · manual" green pill |
| 5a | Sync status | "BACK ONLINE" pill, upload progress card (3 of 14, offline period, last sync), green info box ("Safe to retry — every scan carries its own ID; scan time decides validity"), per-scan rows: Uploading (pulsing blue) / Queued (gray) / Merged · earliest kept (amber) / Synced ✓ (green), "Sync now" pill |
| 5a | Kiosk mode | Dark lock bar (🔒 Kiosk mode · locked to scanning · school), full-height viewfinder, green success card, exit instructions (hold lock 5s + checker PIN) |

### Event maker web dashboard (accent: purple #8E5FAE)
Shared shell: white 208px sidebar (logo, nav with active-tint pills, review-queue badge, user block), page header (Bricolage title + subtitle + pill actions), white 16px-radius content cards.

| Canvas id | Screen | Purpose / key elements |
|---|---|---|
| 4a | Dashboard / Analytics | Stat tiles (semester attendance, active students, pending excuses, unpaid fines), "Attendance by school" horizontal bars (SOC/SOE/SBA/SON in role colors), "Trend across events" column chart (latest highlighted w/ tooltip), chronic absentees table, Export PDF/Excel |
| 6b | Events list | Filter pills (All/Live/Upcoming/Closed), table: event, date, check-in window, checkers assigned ("0 — assign!" warning), attendance bar+%, status chip, ⋯ menu; "+ New event" + Templates |
| 3b | Event create | Details card (name, venue, description, Required vs Optional+RSVP toggle), Schedule card (starts/ends + purple-tinted CHECK-IN OPENS/CLOSES fields + amber rule note: late scans → review; status computed from scan time), Rules card (requires time-out switch, minimum stay, ₱ fine), right rail: Checkers (assigned rows w/ school, "+ Assign checker & school"), Roster (reuse / CSV import), recurring toggle; "Publish event" purple pill |
| 1b | Live attendance | Live + "Window closed — late scans go to review" pills, stat cards (Present 351/460 w/ green bar, Rate, For review, Pending sync), filter pills incl. "Manual only", realtime table: avatar, student, time-in, METHOD chip (QR blue / RFID purple / Manual orange), checker, SCHOOL, scanned→synced (offline sync highlighted blue), status chip; newest row tinted |
| 2c | Review queue | Tabs (All 5 / Late scans 3 / Excuses 2), left list cards (LATE SCAN +Nmin / EXCUSE · type, selected = 2px orange border), right detail: student header, 4 fact tiles (scanned-at +7 min after close in red, synced-at, method · school, checker), checker-note quote, "similar pending" hint, actions: "Approve — counts as present" (green) / "Reject with reason" (red outline), audit-trail note |
| 3c | Accounts | Role tabs (Students/Checkers/Event makers), status chips (Activated green / Invited blue / Never logged in orange / Deactivated gray), actions: "+ Invite checker", "+ Add student" (manual, ghost), "↑ Import students CSV" (purple); table rows with resend-invite pills, deactivated row at 55% opacity ("Graduated — Restore"), soft-delete footer note |
| 4b | Batch QR IDs | Scope pills (All / By school / By section), Layout card (paper, cards/page, cut-guides + photo-box toggles), A4 sheet preview with 2-col ID cards (blue header strip w/ logo + org name, QR, name, student no, course), pager (Page 1 of 58), "Generate PDF · 460 cards" purple pill, "why printed cards" info box |
| 5b | Audit log | Super-admin only (read-only, append-only). Filters (actor/table/action/date), rows: time, actor (+device), ACTION chip (APPROVE green / UPDATE purple / INSERT blue / INSERT · MANUAL orange / DEACTIVATE red / GENERATE gray), record, old→new value chips with reason text; footer: "written by DB triggers, no role can edit" |
| 5c | Settings / master data | Super-admin. Cards: Courses (removable chips + Add), year levels/sections/school year, **Schools** (all 8 school chips), Fines & grace (default ₱50, grace 0 min, excuse deadline 3 days), Notifications & email (24h+1h reminders, invite + absence templates w/ Edit links); purple "Save changes"; "every change here is audited" |

## Interactions & Behavior
- **Scan feedback states** (checker scan screen; see interactive demo 3a):
  - Success — solid green #35A463 card, ✓ glyph, "TIME-IN RECORDED", student name (Bricolage 18–19/700), meta line, timestamp · method · school. Pair with haptic + sound on device.
  - Duplicate — solid orange #E2913F, ⟳ glyph, "ALREADY TIMED-IN", shows first-scan time/school/checker. Blocked on-device against the cached roster.
  - Unknown — solid red #D95950, ✕ glyph, "NOT ON ROSTER", "Retry, or use manual lookup".
  - Idle — neutral #EEF1EF card, "READY / Waiting for first scan".
  - Feedback card transition: background .25s; button press scale(.97).
- **Offline mode** (scan screen): ONLINE pill → amber OFFLINE, Queued counter turns amber and grows, footer note "N scans queued — will sync automatically when back online". Scans validate locally against the cached roster; each carries a client-generated UUID + timestamp (idempotent upserts; earliest wins; `scanned_at` decides validity, never `synced_at`).
- **Animated scanline** in the viewfinder: 2.4s ease-in-out infinite alternate, top 6%→90%.
- **Live pills** pulse: opacity 1→.3→1, 1.6s.
- **QR rotation**: countdown ring (conic-gradient), 30s TOTP-style refresh online, static fallback offline; screenshots invalid while online.
- **Review queue**: selecting a list item populates the detail pane; Approve/Reject write to the audit log; "similar pending" links related items.
- Navigation flows: Home hero → Digital ID; history absent card → Excuse form; notification "marked absent" → Excuse form; events-list row → live view (during window) or detail sheet (after).

## State Management
Map screens to the spec's schema (§5): `students`, `events`, `event_checkers` (school instead of gate_label), `attendance` (status: valid | for_review | approved | rejected; method: qr | rfid | manual), `excuses`, `fines`, `audit_log`, `profiles` (account_status: invited | activated | never_logged_in). Checker app needs a local queue store (SQLite/drift or hive): cached roster, pending scans with client UUIDs, sync state per scan (queued/uploading/synced/merged). Dashboard live view subscribes to Supabase Realtime on `attendance` for the event.

## Design Tokens (direction 1b "Campus")
**Color**
- Background `#F4F6F5` · Surface `#FFFFFF` · Ink `#232A31` · Secondary text `#6B7580` · Muted `#9AA4AD` · Hairlines `#E5E9E7` / `#EEF1EF` · Dark card `#232A31`
- Role accents (from the CSG logo's four orbs): Student blue `#3F9BD8` (deep `#2B6DA0`) · Checker green `#35A463` (deep `#25794A`) · Event-maker purple `#8E5FAE` (deep `#6D4487`) · Alert orange `#E2913F` (deep `#B07714`) · Danger red `#D95950` (deep `#B13C34`)
- Tinted chips/fills: accent at 10–16% alpha over white, deep shade for text (e.g. `rgba(53,164,99,.12)` + `#25794A`)

**Typography** (Google Fonts)
- Display/headings: **Bricolage Grotesque** 700 (page titles 20–24, card titles 13–19, stat values 19–34)
- UI/body: **Plus Jakarta Sans** 400–800 (body 11–13.5; section labels 9–10px, weight 800, letter-spacing .08–.12em, uppercase)
- Minimum sizes: 10px captions mobile, 44px+ touch targets (all pills/buttons meet this)

**Shape & elevation**
- Cards 16–20px radius · inputs 11–13px · buttons/chips/pills fully rounded (99px) · viewfinder 18–22px
- Resting shadow `0 3px 12–14px rgba(35,42,49,.05–.06)` · emphasis `0 6–8px 20–24px rgba(35,42,49,.08–.14)` · primary buttons get a colored glow `0 8px 22px rgba(accent,.35)`
- Toggles: 40×23px track, 18px knob (on = green)

**Spacing**: 20px mobile gutters, 22px dashboard gutters; 8–14px gaps inside cards; 12–14px between cards.

## Assets
- `design/assets/sg-logo.png` — MVC CSG logo (client-provided). Display in a white circle.
- `design/assets/qr-campus*.svg` — illustrative QR patterns only; generate real QR codes from `qr_token` in production.
- Profile photo on the Digital ID is a drag-in placeholder (`image-slot`) — production uses the student's photo.
- All icons in the mocks are simple glyph/shape placeholders — substitute Material icons of matching meaning and weight.

## Files
- `design/MVC Key Screens.dc.html` — the full canvas, all 30 screens (open in a browser; ids `1a`–`6b`)
- `design/android-frame.jsx`, `design/browser-window.jsx`, `design/image-slot.js`, `design/support.js` — presentation scaffolding for the prototype only; do not port
- `spec/mvc-attendance-system-spec.md` — the authoritative product spec (with the school-assignment + manual-account amendments above)
