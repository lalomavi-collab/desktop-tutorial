-- Tests for migration 0072 (a reveal needs a reason; hiding is recorded). Order: 00_supabase_stubs, 01_live_only_stubs,
-- 0018_lalum_firm_core_baseline, 02_matter_team_stub, 04_intake_routings_stub, 0014_lalum_matter_access_by_role, 0040, 0044, 0072,
-- then this file:  psql -v ON_ERROR_STOP=1 -f client_names_reason.sql
-- Every assertion raises on failure; fixtures roll back. Firm A does not require MFA.
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
-- The firm audit log the bookkeeping screens read is not part of this stub set: a stand in with the same call shape.
create table public.t_firm_audit (firm_id uuid, actor uuid, action text, entity text, entity_id text, payload jsonb);
grant insert, select on public.t_firm_audit to authenticated;
create function public.lalum_audit_write(p_firm uuid, p_action text, p_entity text, p_entity_id text, p_payload jsonb) returns void
language plpgsql security definer as $$ begin insert into public.t_firm_audit values (p_firm, auth.uid(), p_action, p_entity, p_entity_id, p_payload); end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000a3','office@a.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0,false);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','o','office@a.test','ADMIN');

-- 1. A reveal with a listed reason is written to both logs, with the actor and the reason, and no name.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_reveal_client_names('INVOICE');
select public.lalum_reveal_client_names('OTHER', 'בירור מול רשות המסים');
reset role;
do $$ declare n int; m jsonb; begin
  select count(*) into n from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED' and actor = '00000000-0000-0000-0000-0000000000a1';
  assert n = 2, 'two reveals, two chain entries, got ' || n;
  select detail into m from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED' order by 1 limit 1;
  assert m ->> 'reason' = 'INVOICE' and m -> 'note' = 'null'::jsonb, 'reason is in the entry, the note is empty: ' || m::text;
  assert exists (select 1 from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED' and detail ->> 'reason' = 'OTHER' and detail ->> 'note' = 'בירור מול רשות המסים'), 'the OTHER note is kept';
  select count(*) into n from public.t_firm_audit where action = 'CLIENT_NAMES_REVEALED' and actor = '00000000-0000-0000-0000-0000000000a1';
  assert n = 2, 'the firm audit log the bookkeeping screens show gets the same two';
end $$;

-- 2. No reason, an unknown reason, OTHER without a real note, or a note that is too long: refused, nothing written.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin perform public.lalum_reveal_client_names(null); assert false, 'null reason must fail';
  exception when others then assert sqlerrm = 'reason required', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_reveal_client_names(''); assert false, 'empty reason must fail';
  exception when others then assert sqlerrm = 'reason required', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_reveal_client_names('BECAUSE'); assert false, 'unknown reason must fail';
  exception when others then assert sqlerrm = 'reason required', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_reveal_client_names('OTHER'); assert false, 'OTHER without a note must fail';
  exception when others then assert sqlerrm = 'reason required', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_reveal_client_names('OTHER', '  abc '); assert false, 'OTHER with a short note must fail';
  exception when others then assert sqlerrm = 'reason required', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_reveal_client_names('INVOICE', repeat('x', 201)); assert false, 'a long note must fail';
  exception when others then assert sqlerrm = 'note too long', 'refused with: ' || sqlerrm; end;
end $$;

-- 3. Someone who may not reveal is refused before the reason is looked at.
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  begin perform public.lalum_reveal_client_names('INVOICE'); assert false, 'office admin reveal must fail';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
  begin perform public.lalum_hide_client_names('USER'); assert false, 'office admin hide must fail';
  exception when others then assert sqlerrm = 'not allowed', 'refused with: ' || sqlerrm; end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.lalum_audit_stub where action = 'CLIENT_NAMES_REVEALED') = 2, 'refused attempts write nothing';
  assert (select count(*) from public.t_firm_audit) = 2, 'refused attempts write nothing to the firm log either';
end $$;

-- 4. Hiding is recorded with how it ended; an unknown "how" is stored as USER.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_hide_client_names('IDLE');
select public.lalum_hide_client_names('whatever');
reset role;
do $$ begin
  assert (select detail ->> 'how' from public.lalum_audit_stub where action = 'CLIENT_NAMES_HIDDEN' order by 1 limit 1) = 'IDLE', 'IDLE kept';
  assert (select count(*) from public.lalum_audit_stub where action = 'CLIENT_NAMES_HIDDEN' and detail ->> 'how' = 'USER') = 1, 'unknown how becomes USER';
  assert (select count(*) from public.t_firm_audit where action = 'CLIENT_NAMES_HIDDEN') = 2, 'hides reach the firm log';
end $$;

-- 5. The old zero argument call is gone, so a reveal without a reason cannot be made; anon cannot call the new ones.
do $$ begin
  assert to_regprocedure('public.lalum_reveal_client_names()') is null, 'zero argument reveal is dropped';
  assert not has_function_privilege('anon', 'public.lalum_reveal_client_names(text,text)', 'execute'), 'anon cannot reveal';
  assert not has_function_privilege('anon', 'public.lalum_hide_client_names(text)', 'execute'), 'anon cannot hide';
  assert has_function_privilege('authenticated', 'public.lalum_reveal_client_names(text,text)', 'execute'), 'signed in can call (the function decides)';
end $$;

rollback;
select 'client_names_reason: all assertions passed' as result;
