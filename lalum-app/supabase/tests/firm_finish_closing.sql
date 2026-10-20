-- Tests for migration 0065 (finish closing, the tombstone). Run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0063 and 0065:
--   psql -v ON_ERROR_STOP=1 -f firm_finish_closing.sql
create schema if not exists t;
create schema if not exists lalum_private;
create table if not exists public.lalum_trust_ledger (id bigserial primary key, firm_id uuid, matter_id uuid, amount numeric);
create table if not exists public.lalum_deadlines (id uuid primary key default gen_random_uuid(), firm_id uuid, matter_id uuid, status text, due_date date);
create table if not exists public.lalum_signature_requests (id uuid primary key default gen_random_uuid(), firm_id uuid, matter_id uuid, status text);
create table if not exists public.lalum_matter_inquiries (id uuid primary key default gen_random_uuid(), firm_id uuid, status text);
create table if not exists public.lalum_matter_tasks (id uuid primary key default gen_random_uuid(), firm_id uuid, matter_id uuid, status text);
create table if not exists public.lalum_disbursements (id uuid primary key default gen_random_uuid(), firm_id uuid, status text);
create table if not exists public.lalum_invoices (id uuid primary key default gen_random_uuid(), firm_id uuid, status text, net_amount numeric, vat_amount numeric);
create table if not exists public.lalum_matter_documents (id uuid primary key default gen_random_uuid(), firm_id uuid, original_path text);
create table if not exists public.lalum_tax_connections (firm_id uuid);
create table if not exists lalum_private.firm_secrets (firm_id uuid primary key, intake_token_hash text);
alter table public.lalum_fin_documents drop constraint if exists lalum_fin_documents_status_check;
grant usage on schema t to authenticated;

create or replace function t.as_user(p_uid uuid, p_claims text default '{}') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', p_claims, true);
  execute 'set local role authenticated';
end $$;
create or replace function t.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expect || '%' then raise notice 'PASS: %', p_label; return; end if;
    raise exception 'FAIL: % (wrong error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % (statement succeeded)', p_label;
end $$;
create or replace function t.eq(p_got anyelement, p_want anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then raise exception 'FAIL: % (got %, want %)', p_label, p_got, p_want; end if;
  raise notice 'PASS: %', p_label;
end $$;
grant execute on all functions in schema t to authenticated;
-- no blanket table grants here: the roles must have exactly what the migrations gave them

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); nobody uuid := gen_random_uuid();
  mA uuid := gen_random_uuid(); mB uuid := gen_random_uuid();
  aal2 text := '{"aal":"aal2"}'; reason text := 'all matters purged and the firm asked to close';
  r jsonb; meta jsonb;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(adm,'admin@x'),(nobody,'n@x');
  insert into public.lalum_profiles (id, is_admin) values (adm, true);
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'Firm One','1','x','f1@x','1',0,false),(f2,'Firm Two','2','x','f2@x','2',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (mA,f1,'A'),(mB,f1,'B');
  insert into lalum_private.firm_secrets (firm_id, intake_token_hash) values (f1,'hash1'),(f2,'hash2');

  -- who may call
  perform t.as_user(p1, aal2);
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, reason, 'Firm One'), 'FORBIDDEN', 'a partner cannot finish closing');
  perform t.as_user(nobody, aal2);
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, reason, 'Firm One'), 'FORBIDDEN', 'a stranger cannot');
  perform t.as_user(adm, '{}');
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, reason, 'Firm One'), 'FORBIDDEN', 'the platform admin needs a second factor session');
  perform t.as_user(null, aal2);
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, reason, 'Firm One'), 'FORBIDDEN', 'no user cannot');

  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', gen_random_uuid(), reason, 'x'), 'NOT_FOUND', 'an unknown firm is not found');
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, reason, 'Firm One'), 'NO_ACTIVE_CLOSURE', 'a firm that never began closing cannot finish');

  -- begin closing for real, then finish
  r := public.lalum_firm_begin_closing(f1, current_date, 'the firm asked to leave the platform', 'Firm One', false);
  perform t.eq(r ->> 'status', 'SUSPENDED', 'closing began');
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, 'short', 'Firm One'), 'REASON_REQUIRED', 'a reason of at least 10 characters is required');
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L)', f1, reason, 'firm one'), 'BAD_CONFIRM', 'the typed firm name must match exactly');

  -- matters not purged block it
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One');
  perform t.eq((r ->> 'dry_run')::boolean, true, 'it is a dry run by default');
  perform t.eq((r ->> 'would_proceed')::boolean, false, 'unpurged matters mean it would not proceed');
  perform t.eq((r ->> 'matters_not_purged')::integer, 2, 'two matters are not purged');
  perform t.eq((r ->> 'matters_total')::integer, 2, 'two matters in all');
  perform t.eq(jsonb_array_length(r -> 'manual_steps'), 1, 'the manual step is listed');
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L,false)', f1, reason, 'Firm One'), 'BLOCKED', 'a real run is blocked by unpurged matters');
  reset role;
  perform t.eq((select status from public.lalum_firms where id = f1), 'SUSPENDED', 'a blocked run changes nothing');
  update public.lalum_cockpit_matters set purged_at = now() where firm_id = f1;

  -- a tax connection and an intake token each block it
  insert into public.lalum_tax_connections (firm_id) values (f1);
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One');
  perform t.eq((r ->> 'would_proceed')::boolean, false, 'a tax connection blocks');
  perform t.eq((r ->> 'tax_connections_remaining')::integer, 1, 'and is counted');
  reset role;
  delete from public.lalum_tax_connections where firm_id = f1;
  update lalum_private.firm_secrets set intake_token_hash = 'reissued' where firm_id = f1;
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One');
  perform t.eq((r ->> 'intake_token_set')::boolean, true, 'an intake token blocks');
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L,false)', f1, reason, 'Firm One'), 'BLOCKED', 'a real run is blocked by the token');
  reset role;
  update lalum_private.firm_secrets set intake_token_hash = null where firm_id = f1;

  -- a checklist blocker blocks it
  insert into public.lalum_trust_ledger (firm_id, matter_id, amount) values (f1, mA, 100);
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One');
  perform t.eq((r ->> 'checklist_blockers')::integer, 1, 'client money held is a checklist blocker');
  perform t.eq((r ->> 'would_proceed')::boolean, false, 'it would not proceed');
  reset role;
  delete from public.lalum_trust_ledger where firm_id = f1;

  -- nothing left: the dry run says go, a real run finishes
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One');
  perform t.eq((r ->> 'would_proceed')::boolean, true, 'with nothing left it would proceed');
  perform t.eq((r ->> 'members_logins_not_banned')::integer, 1, 'the member login that is not banned is reported');
  reset role;
  perform t.eq((select status from public.lalum_firms where id = f1), 'SUSPENDED', 'the dry run left the status alone');
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'CLOSURE_FINISHED'), 0::bigint, 'and wrote nothing to the chain');
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One', false);
  perform t.eq(r ->> 'status', 'CANCELED', 'a real run cancels the firm');
  reset role;
  perform t.eq((select status from public.lalum_firms where id = f1), 'CANCELED', 'the firm is CANCELED');
  perform t.eq((select status from public.lalum_firms where id = f2), 'ACTIVE', 'another firm is untouched');
  perform t.eq((select finished_by from public.lalum_firm_closures where firm_id = f1), adm, 'the closure record names who finished');
  perform t.eq((select finish_reason from public.lalum_firm_closures where firm_id = f1), reason, 'and why');
  perform t.eq((select count(*) from public.lalum_firms where id = f1), 1::bigint, 'the firm row stays as the tombstone');
  select a.meta into meta from public.lalum_matter_audit_log a where a.firm_id = f1 and a.action = 'CLOSURE_FINISHED';
  perform t.eq((select array_agg(k order by k) from jsonb_object_keys(meta) k), array['logins_not_banned','matters','status_from','status_to'], 'the chain row carries only counts and fixed words');
  perform t.eq(meta::text like '%asked to close%', false, 'the reason text is not in the chain');

  -- a finished closure cannot be repeated or cancelled
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_finish_closing(%L,%L,%L,false)', f1, reason, 'Firm One'), 'NO_ACTIVE_CLOSURE', 'finishing twice is refused');
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f1, 'trying to undo it afterwards'), 'NO_ACTIVE_CLOSURE', 'a finished closure cannot be cancelled');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L,false)', f1, current_date, reason, 'Firm One'), 'NOT_ACTIVE', 'and cannot begin again');
  reset role;
  perform t.eq(has_function_privilege('anon', 'public.lalum_firm_finish_closing(uuid,text,text,boolean)', 'execute'), false, 'anon cannot execute it');

  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm <> 'ALL_PASSED_ROLLBACK' then raise; end if;
  raise notice 'firm_finish_closing: all assertions passed (fixtures rolled back)';
end $$;
