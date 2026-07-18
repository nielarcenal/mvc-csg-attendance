# Migration report — 0003_feature_batch_2 name split (2026-07-18)

Backfill rule (FEATURE_BATCH_2 A1): `"Last, First M."` and `"First M. Last"`
formats split mechanically; anything ambiguous is flagged here and in the
live `migration_report` table (super_admin/event_maker readable).

## Names that did not split cleanly

| Table | Row | Original full_name | Guessed split | Issue | Status |
|---|---|---|---|---|---|
| profiles | `041ddcb3…2714` (j.delacruz@mvc.edu.ph) | `Dela Cruz, Juan Miguel` | first=`Juan Miguel`, middle=∅, last=`Dela Cruz` | multi-word given name — cannot tell first name from middle name | **Resolved** — seed ground truth confirms compound first name "Juan Miguel", no middle name |
| students | `edce6cf2…8d27` (2023-01417) | `Dela Cruz, Juan Miguel` | first=`Juan Miguel`, middle=∅, last=`Dela Cruz` | same | **Resolved** — same ground truth |

Every other row (7 profiles, 9 students) split cleanly from the
`"Last, First M."` format: middle initials captured (stored without the
period), e.g. `Ferrer, Marco A.` → `Marco` / `A` / `Ferrer`.

## Other backfills — nothing needed manual fixing

- **students.school_id**: all 9 students mapped from course codes
  (BSIT→SOC, BSBA→SBA, BSED→SOE, BSN→SON); column is now NOT NULL.
- **event_sessions**: 4 pre-existing events each got exactly one session
  from their old checking window (session id = event id); the seed's GA
  event additionally has an afternoon session to exercise multi-session.
- **attendance.session_id**: all 20 existing scans repointed; NOT NULL;
  unique constraint is now `(session_id, student_id, scan_type)`.

Ongoing: any future legacy write that sends only `full_name` is split by
trigger, and unclean splits keep landing in `migration_report` until every
client writes name parts (Sessions 9–11).
