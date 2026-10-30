# Supabase advisor close-out, 2026-10-30

Run on `main` at `db197d9` and on the live project `meoymkcotomoluwlwues` (advisors read 22:03 UTC). Read only, except the migration in this pull request. Follows `docs/security-check-2026-10-19.md` and the security day of 27 and 28.10.

## The five findings of the 26.10 scan

| Finding | State on 30.10 | Evidence |
|---|---|---|
| 3 functions without `search_path` | Closed 27.10 | Migration `20261027185211`; the lint no longer appears. |
| Leaked password protection off | Closed 28.10 | Turned on by the owner (security day step 11); the lint no longer appears. |
| `PII_GATEWAY_TOKEN` equal to `RESEND_API_KEY` | Closed 28.10 | Dedicated `lpg_` token (security day step 6); `pii_shield.gateway_clients` holds 1 active row, created 28.10 13:39 UTC. |
| `pg_net` installed in `public` | Moved to `extensions` by migration `20261031070000` (applied by hand, see below) | Only the registration was in `public`; the extension's objects live in schema `net` and stay there. |
| SECURITY DEFINER functions callable by `authenticated` (141) | Reviewed; 3 gates fixed, 3 grants removed, the rest by design | This document. |

Still listed by the advisor and by design: 12 tables with row level security on and no policy (`lalum_private.*`, `pii_shield.*`, three run and counter tables in `public`). They are read and written only by the service role or by SECURITY DEFINER functions; no policy means signed in users get nothing.

## Fixed: three gates that opened for a user in no firm

Sign-up is open, so any person can hold a signed in session that belongs to no firm. For that caller `lalum_my_firm_id()` and `lalum_my_role()` are NULL, a comparison with them is NULL, and `if not <NULL> then raise` does not raise. The same class as `lalum_mgr_ok` in 0045.

- `lalum_admin_ok(firm)` returned NULL. Two callers test it with nothing in front: `lalum_set_member_role` (changes any member's role; the last ADMIN guard still held) and `lalum_member_reset_target` (returns any member's e-mail). Both need a member id.
- `lalum_rotate_intake_token(firm)`: the same comparison inline. It replaces the firm's intake token and returns the new one. It needs only the firm id, which appears in the public repository.
- `lalum_verify_audit_chain(firm)`: the same comparison inline; read only.

Shown live on 30.10 with a simulated signed in id in no firm, rolled back: `lalum_admin_ok` NULL, both inline gates NULL. No call to the four entry points in the API log of the last 24 hours; the audit log holds 2 `MEMBER_ROLE_SET` and 1 `MEMBER_PASSWORD_RESET_REQUESTED`, all by the firm administrator. Older API logs were not read.

Fix: migration `20261030223000_lalum_definer_null_gates.sql` wraps each test in `coalesce(..., false)`. Test: `lalum-app/supabase/tests/definer_null_gates.sql` shows the gap before the migration, the refusal after it, and that members keep the same rules.

Every other gate in the 141 was read for the same pattern: those that compare with `lalum_my_firm_id()` either check `v_firm is null` first, use `is distinct from`, or fail on a later lookup by firm (`not exists ... firm_id = v_firm`). The helpers `lalum_fin_level`, `lalum_mgr_ok`, `lalum_is_partner_of`, `lalum_export_role_ok` and the `exists` helpers never return NULL.

## The 141 SECURITY DEFINER functions

| Group | Count | Treatment |
|---|---|---|
| Policy and invoker helpers (`lalum_my_role`, `lalum_fin_can`, `lalum_can_view_matter`, the three `lalum_original_*` storage helpers, ...) | 14 | Keep. A policy runs as the caller, so revoking breaks it. |
| Called by the app (`lalum-app/src`) | 89 | Keep. Each has an identity gate. |
| Called by an edge function with the user's token (`asUser`) | 7 | Keep, same reason. |
| Platform admin procedures, gated on admin plus `aal2` (firm closure, firm provisioning, site lead erasure) | 9 | Keep. Their only path is a signed in admin session; the SQL editor has no `auth.uid()`. |
| Built and tested as signed in users, not wired to a screen yet (billing from WIP, client portal reads, submission review, trust balance, business profile setters, own engine seal and void, ...) | 17 | Keep. The tests in `lalum-app/supabase/tests/billing*_rls.sql` call them as `authenticated`. |
| Internal helper kept (`lalum_mgr_ok`, tested as `authenticated` in `mgr_ok_never_null.sql`) | 1 | Keep. |
| Reached only through other SECURITY DEFINER functions, or a finished one time seed | 3 | Revoked: `lalum_is_partner_of`, `lalum_my_department`, `lalum_fin_seed_series_from_archive`. |

After the migration the advisor should list 138. The number is not the measure: the measure is that every function a stranger can call refuses a stranger.

## pg_net: moved from public to extensions

The advisor flags the extension's registered schema, `public`. Its functions and its queue tables are in schema `net`, which is not among the API's exposed schemas, so the move removes a lint rather than an exposure. The owner chose to move it anyway on 30.10, for a clean advisor list.

`pg_net` is not relocatable, so migration `20261031070000_lalum_pg_net_to_extensions.sql` drops it and creates it again in schema `extensions` at the same version (0.20.4), in one transaction:

- It takes an exclusive lock on the queue and the response log with a 5 second `lock_timeout`, and refuses to continue if a request is waiting in the queue. Either case aborts with nothing changed, and it can run again seconds later.
- Lost: `net._http_response`, a 6 hour log (`pg_net.ttl`). `lalum_private.ops_snapshot` counts HTTP results from it, so the snapshot's `http` figures restart from the moment of the move.
- Grants come back through the platform's event trigger `issue_pg_net_access` (USAGE on `net` for postgres, anon, authenticated, service_role, supabase_functions_admin) and the extension script's own table grants.
- Read on 30.10 before writing it: no database object outside the extension depends on its objects, no trigger calls `supabase_functions`, and every caller uses `net.*` by name: five cron jobs (`lalum-dispatch-worker` every minute, `lalum-daily-report`, `lalum-campaign-sync`, `lalum-outlook-sync`, `lalum-fin-bank-sync`) and `ops_snapshot`.
- Window: between 07:00 and 11:00 UTC, clear of the bank, campaign and calendar syncs. Rehearsed on a local Postgres 16 with a stand in extension: clean run, a rerun, a busy queue and a held lock.

After the move, check that `lalum-dispatch-worker` keeps succeeding and that new 2xx rows reach `net._http_response`. If no row arrives within two minutes, `select net.worker_restart();` restarts the background worker (the documented call).

## Reviewing a new SECURITY DEFINER function

Read-only query, run as the owner. It lists gates that compare with the caller's firm or role and have no NULL guard:

```sql
with f as (
  select p.proname, regexp_replace(p.prosrc, '\s+', ' ', 'g') src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')
), conds as (
  select f.proname, m[1] cond from f, regexp_matches(f.src, '\mif\M((?:(?!\mthen\M).){1,255})\mthen\M\s*raise', 'gi') m
)
select proname, cond from conds
where cond ~* '(lalum_my_firm_id|lalum_my_role|lalum_admin_ok)'
  and cond !~* '(lalum_my_firm_id\(\)\s+is\s+null|is distinct from|coalesce|is not true)'
order by 1;
```

On 30.10, after the fix, every row it returns is safe for one of the reasons above; a new row needs a reason or a fix.
