# UX_AUDIT.md — audit against UX_STANDARDS (2026-07-18)

Rule numbers refer to UX_STANDARDS sections. Status: ☐ open · ☑ fixed ·
→TODO deferred with reason in TODO.md.

## Cross-cutting (all clients)

| Violation | Rule | Status |
|---|---|---|
| Flutter apps use raw `Navigator`, not go_router with named routes / auth redirect / role guards (web uses react-router with an equivalent auth+role gate — compliant in behavior) | §1 Router | →TODO (structural refactor; behavioral guarantees — auth redirect, role rejection, stack reset on sign-out — exist and are kept; go_router lands with the Session 9–11 client rework) |
| Notification deep-links (reminder → event detail, absent → history) | §1 | →TODO (FCM itself is not implemented yet — tracked in TODO.md) |
| Text-scale 1.3x / outdoor-device scan verification | §7, audit acceptance | →TODO (needs a physical device; scheduled with Session 12 regression) |

## Checker app

| Screen | Violations | Rules | Status |
|---|---|---|---|
| Login | No password visibility toggle; no field validation (empty submit allowed); no inline spinner in the busy button; no autofillHints | §3 | ☑ |
| My events | Sign out has NO confirmation and NO pending-sync warning; load error collapses into the empty state (no Retry); no pull-to-refresh; sign-out/sync-status touch targets < 48px | §2, §5, §4 | ☑ |
| Scan | Late (for_review) scans shown as plain green success — no distinct BLUE "Recorded — for review" state; no per-outcome sound; RFID wedge focus not restored after dialogs/navigation/app resume; back arrow 18px no-tooltip target | §6, §4 | ☑ (sound via SystemSound; custom audio assets →TODO) |
| Manual lookup | Empty-query state is a blank area (no prompt); remove/record touch targets small | §5, §4 | ☑ |
| Kiosk | No violations found (lock bar, hold-to-exit, offline pill all behave) | — | — |
| Sync status | "Sync now" has no in-flight state | §3 | ☑ |

## Student app

| Screen | Violations | Rules | Status |
|---|---|---|---|
| Shell (tabs) | Tabs are Home · ID · Calendar · More; standard requires **Home, Calendar, My ID, Profile** (order + naming); custom bar not `NavigationBar` | §1 | ☑ |
| Login | Show/Hide is a text button not the visibility `IconButton`; no validation; no inline spinner; no autofillHints | §3 | ☑ |
| Home | No pull-to-refresh; refresh errors silently swallowed (no error+Retry) | §5 | ☑ |
| Calendar | No pull-to-refresh | §5 | ☑ |
| Digital ID | No pull-to-refresh (QR/token can change server-side) | §5 | ☑ |
| Event detail | RSVP buttons small targets; otherwise compliant | §4 | ☑ |
| Excuse form | Validation errors surface ONLY as SnackBars, not under the fields | §3 | ☑ |
| Fines | No pull-to-refresh | §5 | ☑ |
| History | "Excused" chip is ORANGE here but BLUE on Calendar — status colors must be identical everywhere; no pull-to-refresh | §7, §5 | ☑ |
| Notifications | No pull-to-refresh | §5 | ☑ |
| More/Profile | Sign out has no confirmation dialog | §2 | ☑ |

## Event maker web

| Screen | Violations | Rules | Status |
|---|---|---|---|
| Shell / sidebar | Audit log + Settings shown to event makers (super_admin-only); sign out is an unlabeled ⎋ icon with NO confirmation, and no top-right avatar menu; table headers not sticky; no visible keyboard focus ring | §1, §2, §8, §7 | ☑ |
| Login | Password field has no visibility toggle | §3 | ☑ |
| Dashboard | Load errors swallowed (no error+Retry) | §5 | ☑ |
| Events | "Generate fines" (crucial change) fires with no confirmation; load errors swallowed | §4, §5 | ☑ |
| Event create | Field errors shown far from fields (header notice) — kept, plus inline required marker on name; otherwise compliant | §3 | ☑ |
| Live attendance | Filters NOT reflected in the URL (this is the attendance detail sheet §8 names explicitly); no error+Retry | §8, §5 | ☑ |
| Review queue | Reject (destructive) fires with NO confirmation naming the student | §4 | ☑ |
| Accounts | Deactivate / Reset password fire with NO confirmation naming the person; modals don't close on Esc; load errors swallowed | §4, §8, §5 | ☑ |
| Audit log | Timestamps are time-only (no date — "Jul 18, 8:04 AM" required) | §7 | ☑ |
| Batch QR | Long names can overflow the card (auto-fit is FEATURE_BATCH_2 §B) | §7 | →TODO (Session 9 QR print auto-fit) |
| Settings | Reachable only via sidebar now gated to super_admin; RLS already blocks writes for makers | §1 | ☑ |

## Acceptance checklist (from UX_STANDARDS)

- [x] Sign-out flows match §2 on all clients, incl. checker unsynced-scans warning
- [x] Every password field toggles visibility
- [x] Every list has loading/empty/error states (error+Retry demonstrable offline)
- [x] Scan feedback per §6 (BLUE for-review state, sound+haptic per outcome — full custom audio →TODO)
- [x] System back never dead-ends (verified: all pushed screens pop; sign-out resets stack)
- [x] Zero open violations or TODO.md entry with reason (see →TODO rows)
