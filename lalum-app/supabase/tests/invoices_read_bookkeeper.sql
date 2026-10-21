-- Tests for migration 0075. Order: 00_supabase_stubs, 01_live_only_stubs, 0018_lalum_firm_core_baseline, 02_matter_team_stub, 04_intake_routings_stub,
-- 0014_lalum_matter_access_by_role, 0016_lalum_member_admin, 0040, 0044, 0072, 05_fin_permissions_stub, 0073, 0074, 06_invoices_stub, 0075, then this file:
--   psql -v ON_ERROR_STOP=1 -f invoices_read_bookkeeper.sql
create schema if not exists t;
grant usage on schema t to authenticated;
create or replace function t.as_user(p_uid uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function t.as_user(uuid, text) to authenticated;

begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','books@a.test'), ('00000000-0000-0000-0000-0000000000c1','partner@c.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false),
  ('00000000-0000-0000-0000-00000000000c','C','2','c','c@c.test','p',0,false);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','at','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1','b','books@a.test','BOOKKEEPER'),
  ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','p2','partner@c.test','FIRM_PARTNER');
insert into public.lalum_invoices (firm_id, invoice_no) values
  ('00000000-0000-0000-0000-00000000000a','A-1'), ('00000000-0000-0000-0000-00000000000c','C-1');

-- Default finance level 0: she sees no invoice.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert (select count(*) from public.lalum_invoices) = 0, 'level 0: no invoices'; end $$;

-- Level 1 with the second factor: her firm's invoices only.
reset role;
insert into public.lalum_fin_permissions values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b1', 1);
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin
  assert (select count(*) from public.lalum_invoices) = 1, 'level 1: her firm invoice';
  assert (select invoice_no from public.lalum_invoices) = 'A-1', 'and not the other firm''s';
end $$;

-- Level 1 without the second factor: nothing.
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal1');
do $$ begin assert (select count(*) from public.lalum_invoices) = 0, 'no second factor: no invoices'; end $$;

-- Taking her level away takes the access with it.
reset role;
update public.lalum_fin_permissions set level = 0 where user_id = '00000000-0000-0000-0000-0000000000b1';
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
do $$ begin assert (select count(*) from public.lalum_invoices) = 0, 'level back to 0: no invoices'; end $$;

-- Unchanged for others: the partner reads her firm's, the attorney reads none, and she cannot write.
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert (select count(*) from public.lalum_invoices) = 1, 'partner reads her firm only'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a2', 'aal2');
do $$ begin assert (select count(*) from public.lalum_invoices) = 0, 'attorney still reads none'; end $$;
reset role;
do $$ begin assert not has_table_privilege('authenticated', 'public.lalum_invoices', 'insert'), 'no write grant for signed in users in this fixture'; end $$;
rollback;
select 'invoices_read_bookkeeper: all assertions passed' as result;
