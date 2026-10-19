-- ============================================================================
-- LALUM: Supabase security audit (read only)
-- Paste into the Supabase SQL Editor and run. It changes nothing: one SELECT.
--
-- Checks (severity in brackets):
--   1  Tables in public with Row Level Security off                    [CRITICAL]
--   2  Policies open to everyone (USING/CHECK true) for anon or PUBLIC [HIGH]
--   3  SECURITY DEFINER functions callable by anon or PUBLIC           [HIGH]
--   4  Views that bypass RLS (not security_invoker) and are readable   [HIGH]
--   5  Public storage buckets                                          [HIGH]
--   6  Policies open to every signed in user (USING/CHECK true)        [MEDIUM]
--   7  Anonymous write policies with no identity check                 [MEDIUM]
--   8  SECURITY DEFINER functions with no search_path pinned           [MEDIUM]
--   9  SECURITY DEFINER functions for signed in users, no guard found  [REVIEW]
--  10  Tables with RLS on and no policy; policies for PUBLIC that      [INFO]
--      call an auth helper (fail for anon, so only a naming nit)
--  11  Extensions installed in public                                  [LOW]
--
-- Reading the result: every row is a lead, not a verdict. Row 6 and row 9 need a
-- human to decide whether the open access is intended (a public price list is;
-- an internal playbook is not). Row 9 is a heuristic: it looks for a call to an
-- auth or role helper inside the function body. Edit guard_pattern below to the
-- names of your own helpers. A match does not prove the check is correct, and a
-- miss does not prove it is missing.
-- ============================================================================

with
settings as (
  select '(auth\.(uid|jwt|role)\(|_is_admin|_my_role|_my_firm_id|_mgr_ok|_fin_can|_is_partner_of|_is_staff_on|_can_view_matter|_client_can|_matter_firm|_admin_ok|_mfa_ok)'::text as guard_pattern
),
tbl as (
  select c.oid, c.relname, c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
pol as (
  select schemaname, tablename, policyname, permissive, cmd,
         roles::text[] as roles,
         lower(btrim(coalesce(qual, ''))) as q,
         lower(btrim(coalesce(with_check, ''))) as wc
  from pg_policies
  where schemaname in ('public', 'storage')
),
findings as (
  select 1 as rank, 'CRITICAL' as severity, 'RLS disabled' as category,
         'public.' || relname as object,
         'Row Level Security is off: anyone holding the anon key can read and write, per the table grants.' as detail,
         'ALTER TABLE public.' || quote_ident(relname) || ' ENABLE ROW LEVEL SECURITY;' as fix
  from tbl where not rls

  union all
  select 2, 'HIGH', 'Open policy for anon or PUBLIC',
         schemaname || '.' || tablename,
         'policy "' || policyname || '" ' || cmd || ' to {' || array_to_string(roles, ',') || '} using [' || q || '] check [' || wc || ']',
         'Replace true with an ownership or tenant condition, or drop the policy.'
  from pol
  where permissive = 'PERMISSIVE' and (q = 'true' or wc = 'true') and roles && array['public', 'anon']

  union all
  select 2, 'HIGH', 'SECURITY DEFINER callable by anon or PUBLIC',
         p.oid::regprocedure::text,
         'Any visitor can call this function and it runs with its owner''s rights.',
         'REVOKE EXECUTE ON FUNCTION ' || p.oid::regprocedure::text || ' FROM PUBLIC, anon;'
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')

  union all
  select 2, 'HIGH', 'View bypasses RLS',
         'public.' || c.relname,
         case c.relkind when 'm' then 'Materialized views are not subject to RLS.' else 'View runs with its owner''s rights (' || pg_get_userbyid(c.relowner) || ') and ignores the caller''s RLS.' end,
         case c.relkind when 'm' then 'REVOKE SELECT ON public.' || quote_ident(c.relname) || ' FROM anon, authenticated;'
                        else 'ALTER VIEW public.' || quote_ident(c.relname) || ' SET (security_invoker = true);' end
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
    and not exists (select 1 from unnest(coalesce(c.reloptions, '{}')) o where o ~ '^security_invoker=(true|on|1)$')
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))

  union all
  select 2, 'HIGH', 'Public storage bucket', 'storage.' || id,
         'Files in this bucket are readable by URL without any signature.',
         'UPDATE storage.buckets SET public = false WHERE id = ' || quote_literal(id) || ';'
  from storage.buckets where public

  union all
  select 3, 'MEDIUM', 'Open policy for every signed in user',
         schemaname || '.' || tablename,
         'policy "' || policyname || '" ' || cmd || ' to {' || array_to_string(roles, ',') || '} using [' || q || '] check [' || wc || ']',
         'If sign-up is open this means any stranger. Restrict to a role or tenant, unless the data is meant to be public.'
  from pol
  where permissive = 'PERMISSIVE' and (q = 'true' or wc = 'true')
    and roles && array['authenticated'] and not (roles && array['public', 'anon'])

  union all
  select 3, 'MEDIUM', 'Anonymous write policy, no identity check',
         pl.schemaname || '.' || pl.tablename,
         'policy "' || pl.policyname || '" ' || pl.cmd || ' to {' || array_to_string(pl.roles, ',') || '} using [' || pl.q || '] check [' || pl.wc || ']',
         'A visitor with no account may write here. Confirm it is meant to, and that the check limits what.'
  from pol pl, settings s
  where pl.permissive = 'PERMISSIVE' and pl.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and pl.roles && array['public', 'anon'] and not (pl.q = 'true' or pl.wc = 'true')
    and (pl.q || ' ' || pl.wc) !~* s.guard_pattern

  union all
  select 5, 'INFO', 'Policy applies to PUBLIC but requires an identity',
         pl.schemaname || '.' || pl.tablename,
         'policy "' || pl.policyname || '" ' || pl.cmd || ' has no TO clause, so it covers PUBLIC, but its condition calls an auth or role helper and fails for anon.',
         'Optional: add TO authenticated so the intent is explicit.'
  from pol pl, settings s
  where pl.permissive = 'PERMISSIVE' and pl.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and pl.roles && array['public', 'anon'] and not (pl.q = 'true' or pl.wc = 'true')
    and (pl.q || ' ' || pl.wc) ~* s.guard_pattern

  union all
  select 3, 'MEDIUM', 'SECURITY DEFINER without a pinned search_path',
         p.oid::regprocedure::text,
         'A mutable search_path lets a caller shadow objects the function relies on.',
         'ALTER FUNCTION ' || p.oid::regprocedure::text || ' SET search_path = public, pg_temp;'
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')

  union all
  select 4, 'REVIEW', 'SECURITY DEFINER for signed in users, no guard found',
         p.oid::regprocedure::text,
         'Callable by any signed in user and no call to an auth or role helper was found in the body (heuristic).',
         'Read the function. Add an explicit check on auth.uid() or a role, or revoke EXECUTE from authenticated.'
  from pg_proc p, settings s
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute')
    and pg_get_functiondef(p.oid) !~* s.guard_pattern

  union all
  select 5, 'INFO', 'RLS on, no policy', 'public.' || t.relname,
         'Deny all for the API roles. Correct if only server code with the service role reads this table.',
         'None needed if intended.'
  from tbl t
  where t.rls and not exists (select 1 from pg_policies pp where pp.schemaname = 'public' and pp.tablename = t.relname)

  union all
  select 6, 'LOW', 'Extension in public', e.extname,
         'Extensions in public widen the API surface.',
         'ALTER EXTENSION ' || quote_ident(e.extname) || ' SET SCHEMA extensions;'
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where n.nspname = 'public'
)
select severity, category, object, detail, fix
from findings
order by rank, category, object;
