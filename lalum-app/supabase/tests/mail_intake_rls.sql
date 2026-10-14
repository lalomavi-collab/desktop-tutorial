-- Tests for migration 0041 (lalum_mail_intake, lalum_mail_triage_assign, lalum_mail_triage_reject).
-- Order: 00_supabase_stubs, 01_live_only_stubs, 0018, 02_matter_team_stub, 0014, 0040, 0041, then this file:
--   psql -v ON_ERROR_STOP=1 -f mail_intake_rls.sql
-- Every assertion raises on failure, so a clean run is the pass signal. Fixtures roll back at the end.
create schema if not exists t;
grant usage on schema t to authenticated, service_role;
create or replace function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true); execute 'set local role authenticated'; end $$;
create or replace function t.n(p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin execute 'select count(*) from (' || p_sql || ') q' into v; return v; end $$;
create or replace function t.fails(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if sqlerrm like p_like then return; end if; raise exception 'wrong error for [%]: %', p_sql, sqlerrm; end;
  raise exception 'expected failure [%] did not happen', p_sql;
end $$;
create or replace function t.as_service() returns void language plpgsql as $$ begin execute 'reset role'; execute 'set local role service_role'; end $$;
grant execute on function t.as_user(uuid), t.n(text), t.fails(text, text), t.as_service() to authenticated, service_role;

begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','partner@a.test'), ('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000a3','unassigned@a.test'), ('00000000-0000-0000-0000-0000000000b1','partner@b.test');
insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee) values
  ('00000000-0000-0000-0000-00000000000a','A','1','c','a@a.test','p',0), ('00000000-0000-0000-0000-00000000000b','B','2','c','b@b.test','p',0);
insert into public.lalum_firm_members (firm_id, user_id, name, email, role, department) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','p','partner@a.test','FIRM_PARTNER','RE'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','a','attorney@a.test','ATTORNEY',null),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','u','unassigned@a.test','ATTORNEY',null),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','p','partner@b.test','FIRM_PARTNER','RE');
insert into public.lalum_cockpit_matters (id, firm_id, title, department, conflict_status, status) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','m1','RE','CLEAN','ACTIVE_REVIEW'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000a','m2','RE','DIRECT_CONFLICT','ACTIVE_REVIEW'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-00000000000a','m3','RE','CLEAN','ARCHIVED'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000b','n1','RE','CLEAN','ACTIVE_REVIEW');
insert into public.lalum_matter_team (matter_id, user_id) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2'), ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000a2'), ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a2');

-- Fixtures: one filed row on m1, three triage rows, one conflict hold.
insert into public.lalum_mail_intake (id, firm_id, message_key, received_at, state, matter_id, route) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-00000000000a',repeat('a',64),now(),'FILED','00000000-0000-0000-0000-0000000000c1','ALIAS');
insert into public.lalum_mail_intake (id, firm_id, message_key, received_at, state, reason) values
  ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-00000000000a',repeat('b',64),now(),'TRIAGE','NO_MATCH'),
  ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-00000000000a',repeat('c',64),now(),'TRIAGE','AMBIGUOUS'),
  ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-00000000000a',repeat('d',64),now(),'TRIAGE','NO_MATCH'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-00000000000a',repeat('f',64),now(),'CONFLICT_HOLD',null);

-- 1. Constraints: unique per firm, hash format only, known states.
select t.fails($$insert into public.lalum_mail_intake (firm_id, message_key, received_at, state) values ('00000000-0000-0000-0000-00000000000a',repeat('a',64),now(),'TRIAGE')$$, '%duplicate key%');
select t.fails($$insert into public.lalum_mail_intake (firm_id, message_key, received_at, state) values ('00000000-0000-0000-0000-00000000000a','<abc@x.com>',now(),'TRIAGE')$$, '%check constraint%');
select t.fails($$insert into public.lalum_mail_intake (firm_id, message_key, received_at, state) values ('00000000-0000-0000-0000-00000000000a',repeat('9',64),now(),'DONE')$$, '%check constraint%');
insert into public.lalum_mail_intake (firm_id, message_key, received_at, state) values ('00000000-0000-0000-0000-00000000000b',repeat('a',64),now(),'TRIAGE');  -- the same hash in another firm is allowed

-- 2. Visibility.
select t.as_user('00000000-0000-0000-0000-0000000000a2');   -- assigned attorney: the filed row only, no triage queue
do $$ begin assert t.n('select 1 from public.lalum_mail_intake') = 1, 'assigned attorney should see only the filed row'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');   -- unassigned attorney: nothing
do $$ begin assert t.n('select 1 from public.lalum_mail_intake') = 0, 'unassigned attorney must see nothing'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1');   -- partner: filed row (department match) plus the triage queue of the firm
do $$ begin assert t.n('select 1 from public.lalum_mail_intake') = 5, 'partner sees 1 filed and 4 pending'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1');   -- other firm: only its own
do $$ begin assert t.n('select 1 from public.lalum_mail_intake') = 1, 'other firm sees only its own row'; end $$;

-- 3. Nobody signed in writes directly.
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.fails($$insert into public.lalum_mail_intake (firm_id, message_key, received_at, state) values ('00000000-0000-0000-0000-00000000000a',repeat('8',64),now(),'TRIAGE')$$, '%permission denied%');
select t.fails($$update public.lalum_mail_intake set state='FILED'$$, '%permission denied%');
select t.fails($$delete from public.lalum_mail_intake$$, '%permission denied%');

-- 4. Assignment rules.
select t.as_user('00000000-0000-0000-0000-0000000000a3');   -- unassigned attorney cannot assign
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1')$$, '%not allowed%');
select t.as_user('00000000-0000-0000-0000-0000000000b1');   -- another firm cannot assign into this firm
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1')$$, '%not allowed%');
select t.as_user('00000000-0000-0000-0000-0000000000a2');   -- assigned attorney: a clean matter, a plain triage row
select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1');
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c1')$$, '%not pending%');   -- once only
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000c2')$$, '%partner required%');   -- direct conflict matter
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000c1')$$, '%partner required%');   -- conflict hold
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000c3')$$, '%matter closed%');
select t.fails($$select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000d1')$$, '%not allowed%');   -- matter of another firm
select t.as_user('00000000-0000-0000-0000-0000000000a1');   -- partner: conflict hold and conflict matter are allowed
select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000c1');
select public.lalum_mail_triage_assign('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000c2');
reset role;
do $$ begin
  assert (select state||'/'||route from public.lalum_mail_intake where id='00000000-0000-0000-0000-0000000000e2') = 'ASSIGNED/MANUAL', 'assignment not recorded';
  assert (select count(*) from public.lalum_audit_stub where action='MAIL_TRIAGE_ASSIGNED') = 3, 'each assignment is audited';
  assert (select state from public.lalum_mail_intake where id='00000000-0000-0000-0000-0000000000e4') = 'TRIAGE', 'an untouched row stays pending';
end $$;

-- 5. Rejection: partner or admin only, once.
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select t.fails($$select public.lalum_mail_triage_reject('00000000-0000-0000-0000-0000000000e4')$$, '%not allowed%');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select public.lalum_mail_triage_reject('00000000-0000-0000-0000-0000000000e4');
select t.fails($$select public.lalum_mail_triage_reject('00000000-0000-0000-0000-0000000000e4')$$, '%not pending%');
reset role;
do $$ begin
  assert (select state from public.lalum_mail_intake where id='00000000-0000-0000-0000-0000000000e4') = 'REJECTED', 'rejection not recorded';
  assert (select count(*) from public.lalum_audit_stub where action='MAIL_TRIAGE_REJECTED') = 1, 'rejection not audited';
  assert not exists (select 1 from public.lalum_audit_stub where detail::text ~* '@'), 'no address in the audit detail';
end $$;

-- 6. The secure filing path: service role only, fixed path, once, and the row becomes FILED.
reset role;
insert into public.lalum_matter_documents (id, matter_id, firm_id, file_name) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','mail-1.eml'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000a','mail-2.eml'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000a','mail-3.eml');
insert into public.lalum_mail_intake (id, firm_id, message_key, received_at, state, matter_id, route, graph_message_id) values
  ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-00000000000a',repeat('1',64),now(),'QUEUED','00000000-0000-0000-0000-0000000000c1','ALIAS','AAMk-opaque-1'),
  ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-00000000000a',repeat('2',64),now(),'QUEUED','00000000-0000-0000-0000-0000000000c1','ALIAS','AAMk-opaque-2');
select t.as_user('00000000-0000-0000-0000-0000000000a1');    -- a signed in partner cannot call them, and cannot read the Graph id
select t.fails($$select public.lalum_mail_set_document('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-0000000000f1')$$, '%permission denied%');
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'x',repeat('a',64),10)$$, '%permission denied%');
select t.fails($$select public.lalum_mail_set_state('00000000-0000-0000-0000-00000000000a',repeat('1',64),'FAILED',null)$$, '%permission denied%');
select t.fails($$select graph_message_id from public.lalum_mail_intake$$, '%permission denied%');
do $$ begin assert t.n('select id, state, document_id from public.lalum_mail_intake') > 0, 'the other columns stay readable'; end $$;
select t.as_service();
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'p',repeat('a',64),10)$$, '%not pending%');   -- no document linked yet
select t.fails($$select public.lalum_mail_set_document('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-0000000000f2')$$, '%mismatch%');   -- document of another matter
select t.fails($$select public.lalum_mail_set_document('00000000-0000-0000-0000-00000000000b',repeat('1',64),'00000000-0000-0000-0000-0000000000f1')$$, '%mismatch%');   -- wrong firm
select public.lalum_mail_set_document('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-0000000000f1');
select public.lalum_mail_set_document('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-0000000000f1');   -- the same link again is harmless
select t.fails($$select public.lalum_mail_set_document('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-0000000000f3')$$, '%already linked%');
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000f1/original.txt',repeat('a',64),10)$$, '%object missing%');
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'elsewhere/original.txt',repeat('a',64),10)$$, '%bad path%');
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000f1/original.eml',repeat('a',64),10)$$, '%bad path%');   -- only original.txt
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000f1/original.txt','NOTAHASH',10)$$, '%bad hash%');
reset role;
insert into storage.objects (bucket_id, name) values ('matter-originals','00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000f1/original.txt');
select t.as_service();
select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000f1/original.txt',repeat('a',64),1234);
select t.fails($$select public.lalum_mail_attach_original('00000000-0000-0000-0000-00000000000a',repeat('1',64),'00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000f1/original.txt',repeat('a',64),1234)$$, '%not pending%');   -- once only
select t.fails($$select public.lalum_mail_set_state('00000000-0000-0000-0000-00000000000a',repeat('2',64),'FILED',null)$$, '%bad state%');
select public.lalum_mail_set_state('00000000-0000-0000-0000-00000000000a',repeat('2',64),'CONFLICT_HOLD',null);
select public.lalum_mail_set_state('00000000-0000-0000-0000-00000000000a',repeat('1',64),'FAILED','TOO_LARGE');   -- already FILED: nothing happens
reset role;
do $$ begin
  assert (select state from public.lalum_mail_intake where id='00000000-0000-0000-0000-0000000000e6') = 'FILED', 'filed row not marked FILED';
  assert (select original_path||'/'||original_mime||'/'||original_size||'/'||doc_type from public.lalum_matter_documents where id='00000000-0000-0000-0000-0000000000f1') like '%/original.txt/text/plain/1234/CORRESPONDENCE', 'original not attached';
  assert (select state from public.lalum_mail_intake where id='00000000-0000-0000-0000-0000000000e7') = 'CONFLICT_HOLD', 'hold not recorded';
  assert (select count(*) from public.lalum_audit_stub where action='MAIL_FILED' and actor is null) = 1, 'filing is audited, with no signed in actor';
  assert (select count(*) from public.lalum_audit_stub where action='MAIL_FILING_STOPPED') = 1, 'only the pending row was stopped';
  assert not exists (select 1 from public.lalum_audit_stub where detail::text ~* '@'), 'no address in any audit detail';
end $$;
rollback;
select 'mail_intake tests passed' as result;
