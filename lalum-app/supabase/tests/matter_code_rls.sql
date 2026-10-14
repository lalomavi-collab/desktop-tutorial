-- Tests for migration 0040 (matter_code, sync_enabled, lalum_matter_folders, lalum_set_matter_sync).
-- Order: 00_supabase_stubs, 01_live_only_stubs, 0018, 02_matter_team_stub, 0014, 0040, then this file:
--   psql -v ON_ERROR_STOP=1 -f matter_code_rls.sql
-- Every assertion raises on failure, so a clean run is the pass signal. Fixtures roll back at the end.
-- Not covered here: concurrent inserts (the counter upsert serialises them) and the live trigger set on lalum_cockpit_matters.
create schema if not exists t;
grant usage on schema t to authenticated;
create or replace function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role authenticated';
end $$;
create or replace function t.n(p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin execute 'select count(*) from (' || p_sql || ') q' into v; return v; end $$;
grant execute on function t.as_user(uuid), t.n(text) to authenticated;

begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'),
  ('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000a3','unassigned@a.test'),
  ('00000000-0000-0000-0000-0000000000b1','partner@b.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0),
  ('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','u','unassigned@a.test','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER');

-- 1. Codes: format, year from created_at, independent sequence per firm and year.
insert into public.lalum_cockpit_matters (id, firm_id, title, created_at) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','m1','2025-03-01'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000a','m2','2025-04-01'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-00000000000a','m3','2026-01-05'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000b','n1','2025-05-01');
do $$ begin
  assert (select matter_code from public.lalum_cockpit_matters where title='m1') = 'L-2025-0001', 'first code of a firm and year';
  assert (select matter_code from public.lalum_cockpit_matters where title='m2') = 'L-2025-0002', 'second code increments';
  assert (select matter_code from public.lalum_cockpit_matters where title='m3') = 'L-2026-0001', 'a new year restarts the sequence';
  assert (select matter_code from public.lalum_cockpit_matters where title='n1') = 'L-2025-0001', 'another firm has its own sequence';
  assert (select matter_code ~ '^L-[0-9]{4}-[0-9]{4}$' from public.lalum_cockpit_matters where title='m1'), 'format';
end $$;

-- 2. Immutable, unique per firm, never reused after a delete.
do $$ begin
  begin update public.lalum_cockpit_matters set matter_code='L-1999-0001' where title='m1'; assert false, 'code changed';
  exception when others then assert sqlerrm like '%immutable%', 'wrong error: ' || sqlerrm; end;
  begin insert into public.lalum_cockpit_matters (firm_id,title,matter_code,created_at) values ('00000000-0000-0000-0000-00000000000a','dup','L-2025-0001','2025-06-01'); assert false, 'duplicate code accepted';
  exception when unique_violation then null; end;
  update public.lalum_cockpit_matters set title='m2 renamed' where title='m2';
  assert (select matter_code from public.lalum_cockpit_matters where title='m2 renamed') = 'L-2025-0002', 'ordinary update keeps the code';
  delete from public.lalum_cockpit_matters where title='m2 renamed';
  insert into public.lalum_cockpit_matters (firm_id,title,created_at) values ('00000000-0000-0000-0000-00000000000a','m4','2025-07-01');
  assert (select matter_code from public.lalum_cockpit_matters where title='m4') = 'L-2025-0003', 'a deleted code is not reused';
end $$;

-- 3. Sync is off by default.
do $$ begin assert (select bool_or(sync_enabled) from public.lalum_cockpit_matters) is false, 'sync must default to off'; end $$;

-- 4. lalum_set_matter_sync: only a partner or admin of the matter's firm, and it is audited.
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  begin perform public.lalum_set_matter_sync('00000000-0000-0000-0000-0000000000c1', true); assert false, 'attorney switched sync on';
  exception when others then assert sqlerrm like '%not allowed%', 'wrong error: ' || sqlerrm; end;
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  begin perform public.lalum_set_matter_sync('00000000-0000-0000-0000-0000000000c1', true); assert false, 'partner of another firm switched sync on';
  exception when others then assert sqlerrm like '%not allowed%', 'wrong error: ' || sqlerrm; end;
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_set_matter_sync('00000000-0000-0000-0000-0000000000c1', true);
reset role;
do $$ begin
  assert (select sync_enabled from public.lalum_cockpit_matters where id='00000000-0000-0000-0000-0000000000c1'), 'partner could not switch sync on';
  assert (select count(*) from public.lalum_audit_stub where action='MATTER_SYNC_SET' and matter_id='00000000-0000-0000-0000-0000000000c1') = 1, 'switch not audited';
  assert (select sync_enabled from public.lalum_cockpit_matters where id='00000000-0000-0000-0000-0000000000c3') is false, 'another matter was changed';
end $$;

-- 5. lalum_matter_folders: read only through matter access, never writable by a signed in user.
insert into public.lalum_matter_folders (matter_id, firm_id, provider, remote_folder_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','MS_FILES','folder-1');
/* A partner sees a matter through the department match of 0014. */
update public.lalum_firm_members set department='RE' where user_id='00000000-0000-0000-0000-0000000000a1';
update public.lalum_cockpit_matters set department='RE' where id='00000000-0000-0000-0000-0000000000c1';
insert into public.lalum_matter_team (matter_id, user_id) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2');
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert t.n('select 1 from public.lalum_matter_folders') = 1, 'assigned attorney should see the folder'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin assert t.n('select 1 from public.lalum_matter_folders') = 0, 'unassigned attorney must not see the folder'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin assert t.n('select 1 from public.lalum_matter_folders') = 0, 'another firm must not see the folder'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert t.n('select 1 from public.lalum_matter_folders') = 1, 'partner should see the folder';
  begin insert into public.lalum_matter_folders (matter_id, firm_id, provider, remote_folder_id) values ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-00000000000a','MS_FILES','x'); assert false, 'signed in user wrote a folder row';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 6. The counter table is not readable by signed in users.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin perform t.n('select 1 from public.lalum_matter_code_counters'); assert false, 'counters must not be readable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'matter_code tests passed' as result;
