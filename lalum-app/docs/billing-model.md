# Billing model (חיוב ושכר טרחה)

Foundation for the upgrade of `/settings/billing`: fee terms per matter, time tracking, a partner
view and a client financial summary. This change is the database layer only. The UI follows in a
separate pull request, and the client portal after that.

## Roles and what each can reach

| Who | Fee terms, rates, milestones | Time entries | Matter messages | Audit log | Partner overview |
|---|---|---|---|---|---|
| FIRM_PARTNER, ADMIN (MFA) | all, own firm | all, own firm | all, own firm | read | yes |
| ATTORNEY | none | own, only on matters where on the matter team | matters on the team, including internal notes | none | no |
| CLIENT (portal user, never a firm member) | none | none | their granted matter, never an internal note | none | no |

Authorization is enforced in RLS and in SECURITY DEFINER functions. The UI hides nothing that the
database would allow.

## Tables (migration 0017)

`lalum_matter_team`, `lalum_matter_fees` (one row per matter, `billing_active` needs a stored fee
agreement path), `lalum_rate_cards`, `lalum_time_entries`, `lalum_milestones`,
`lalum_fin_document_matters` (links an issued ledger document to a matter, needed for profitability),
`lalum_matter_client_access`, `lalum_matter_messages` (append only), `lalum_audit_log` (append only,
blocked for update, delete and truncate, even for the owner).

Functions: `lalum_partner_overview()`, `lalum_partner_matter_economics()`,
`lalum_client_matter_financials(matter)`. The first two are partner only and write a
`VIEWED_FINANCIALS` audit row. Figures are aggregated from time entries, rate cards, ledger documents
and payments. No balance is a typed field.

## Time tracking rules enforced in the database

Billable time is in 6 minute units and never exceeds worked time. A submitted entry needs a narrative
of at least 15 characters. An associate cannot approve their own time or backdate beyond 7 days.
Approved, billed and written off entries are locked for associates. Approval stamps the approving
partner.

## Deliberately not built

Trust account balances and the 13 week cash forecast. There is no trust ledger and no collection
history to compute them from, and a figure with no source is worse than none. The partner overview
lists these under `excludes`.

Encoding of the Israel Bar fee agreement rules (written agreement, contingent fees). The text of the
rules has not been verified against two sources, so nothing legal is enforced beyond an internal
guard that billing cannot be switched on without an agreement file.

## Hardening found while testing

`lalum_fin_can` returned NULL for a user who is not a firm member, and `if not <NULL>` does not
raise. 0017 redefines it to always return true or false. The same NULL pattern exists in the RPCs of
0014 (`lalum_fin_save_draft`, `lalum_fin_delete_draft`). Those cannot do harm today because the
inserts fail on a NOT NULL firm id, and the redefinition closes the gap for them too.

## Schema drift

`lalum_firms`, `lalum_firm_members`, `lalum_cockpit_matters` and the role helpers existed only in
the live project. Migration 0016 records their live definition and is idempotent. Many other tables
used by the app are still live only (tasks, events, invoices, matter documents and more), so a replay
of the repo from scratch is not yet possible.

## Tests

`supabase/tests/billing_rls.sql` runs 51 assertions as distinct users on plain Postgres 16, with
`00_supabase_stubs.sql` standing in for Supabase auth. Order: stubs, 0016, 0014, 0017, then the
test file. It rolls its own fixtures back.

```
psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/00_supabase_stubs.sql
psql -v ON_ERROR_STOP=1 -d <db> -f supabase/migrations/0016_lalum_firm_core_baseline.sql
psql -v ON_ERROR_STOP=1 -d <db> -f supabase/migrations/0014_lalum_finance_ledger.sql
psql -v ON_ERROR_STOP=1 -d <db> -f supabase/migrations/0017_lalum_billing_model.sql
psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/billing_rls.sql
```

## Rollout

1. Apply 0016 (no change on the live project) then 0017.
2. Next pull request: partner overview, hours and fee tabs on `/settings/billing`.
3. After: client portal financial tab and matter messages, once the client grant flow exists.
