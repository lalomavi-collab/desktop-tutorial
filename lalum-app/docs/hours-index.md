# Hours index (migration 0058, screen `/workspace/hours`)

An attendance clock for every firm member, a matter timer and manual entry, and a partner report that sets
presence against hours logged on matters against hours that are billable.

## The three numbers

| Number | Source | Counts |
|---|---|---|
| Attendance | `lalum_attendance` (clock in, clock out) | closed sessions only, by Israel local day of the clock in |
| Logged | `lalum_time_entries.worked_minutes` | every status, written off included |
| Billable | `lalum_time_entries.billable_minutes` | submitted, approved and billed |

Presence is never divided among matters. Hours per matter exist only where someone logged them (timer or entry).
Time present and not logged shows as a gap; time logged above the time present shows as a flag.

Ratios: utilization = logged / attendance, billable share = billable / logged, billable of attendance = billable / attendance.
A ratio with no denominator is shown as "no data", never as zero. Value is billable time at the rate cards on hourly,
capped and hybrid matters only; entries with no rate are counted and left out.

## Rules in the database

- Sessions are written only by `lalum_clock_in`, `lalum_clock_out` and, for partners, `lalum_attendance_correct` and
  `lalum_attendance_add`. No direct insert, update or delete for end users.
- One open session per person. A session open for more than 24 hours cannot be closed by its owner; a partner corrects it
  with a reason of at least 10 characters. A correction is audited with the old and the new row. An ordinary punch is not.
- Time entries are never refused because the person was not clocked in. The report flags it instead.
- The report (`lalum_hours_index`) is partner and admin only, behind MFA, and each successful view is written to the audit log.

## Before relying on it

- Apply 0058 after 0057 (audit log hardening, held until after the demo of 22.10.2026). 0058 does not depend on 0057.
- Tests: `supabase/tests/hours_index_rls.sql` (36 assertions), run after the stubs, 0018, 0014 and 0019; the file adds the
  `matter_code` column by itself because 0040 needs live only objects. Pure logic: `npm run crm-check`.
- Attendance is personal data about employees. Before partners use the report to assess people, the firm should tell its
  employees what is recorded and why, and check the position under Israeli employment and privacy law. This repository does not
  encode that analysis and none of the above is legal advice.
- The screen was type checked, linted and built, and the SQL ran against Postgres 16. It was not opened in a browser against
  a live project.
