-- Tests for migration 0063 (begin closing, cancel closing). Run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062 and 0063:
--   psql -v ON_ERROR_STOP=1 -f firm_begin_closing.sql
-- 0059 needs an extensions.digest shim and 0061 a lalum_signature_requests table; the stand ins for tables no repository migration builds
-- are created below when absent. Every assertion raises on failure. Fixtures roll back.
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
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); fh uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); ph uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); nobody uuid := gen_random_uuid();
  mA uuid := gen_random_uuid(); mB uuid := gen_random_uuid(); mBin uuid := gen_random_uuid(); mDone uuid := gen_random_uuid(); mH uuid := gen_random_uuid();
  aal2 text := '{"aal":"aal2"}'; reason text := 'the firm asked to leave the platform';
  eff date := current_date + 30; r jsonb; chain_meta jsonb; n_rows bigint;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(p2,'p2@x'),(ph,'ph@x'),(adm,'admin@x'),(nobody,'n@x');
  insert into public.lalum_profiles (id, is_admin) values (adm, true);
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'Firm One','1','x','f1@x','1',0,false),(f2,'Firm Two','2','x','f2@x','2',0,false),(fh,'Held Firm','3','x','fh@x','3',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f2,p2,'P2','p2@x','FIRM_PARTNER'),(fh,ph,'PH','ph@x','FIRM_PARTNER');
  -- firm one: two matters with no clock, one in the bin with no clock, one that already has a date, one purged
  insert into public.lalum_cockpit_matters (id, firm_id, title, deleted_at, handling_ended_at) values (mA,f1,'A',null,null),(mB,f1,'B',null,null),(mBin,f1,'Bin',now(),null),(mDone,f1,'Done',null,date '2025-01-31');
  insert into public.lalum_cockpit_matters (firm_id, title, purged_at) values (f1,'purged',now());
  insert into public.lalum_cockpit_matters (id, firm_id, title, legal_hold) values (mH, fh, 'held', true);
  insert into public.lalum_cockpit_matters (firm_id, title) values (f2, 'other firm matter');
  insert into lalum_private.firm_secrets (firm_id, intake_token_hash) values (f1,'hash1'),(f2,'hash2'),(fh,'hash3');

  -- who may call
  perform t.as_user(p1, aal2);
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, eff, reason, 'Firm One'), 'FORBIDDEN', 'a partner cannot begin closing their own firm');
  perform t.as_user(nobody, aal2);
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, eff, reason, 'Firm One'), 'FORBIDDEN', 'a stranger cannot');
  perform t.as_user(adm, '{}');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, eff, reason, 'Firm One'), 'FORBIDDEN', 'the platform admin needs a second factor session');
  perform t.as_user(null, aal2);
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f1, reason), 'FORBIDDEN', 'no user cannot cancel');

  -- validation (admin, second factor)
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', gen_random_uuid(), eff, reason, 'x'), 'NOT_FOUND', 'an unknown firm is not found');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, current_date - 1, reason, 'Firm One'), 'BAD_DATE', 'a past effective date is refused (it would shorten retention)');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, current_date + 400, reason, 'Firm One'), 'BAD_DATE', 'a date more than a year ahead is refused');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,null,%L,%L)', f1, reason, 'Firm One'), 'BAD_DATE', 'no date is refused');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, eff, 'short', 'Firm One'), 'REASON_REQUIRED', 'a reason of at least 10 characters is required');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L)', f1, eff, reason, 'firm one'), 'BAD_CONFIRM', 'the typed firm name must match exactly');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L,false)', f1, eff, reason, ''), 'BAD_CONFIRM', 'an empty confirmation is refused');

  -- the dry run changes nothing and reports
  r := public.lalum_firm_begin_closing(f1, eff, reason, 'Firm One');
  perform t.eq((r ->> 'dry_run')::boolean, true, 'it is a dry run by default');
  perform t.eq((r ->> 'would_proceed')::boolean, true, 'with no blockers it would proceed');
  perform t.eq((r ->> 'matters_to_clock')::integer, 3, 'three unpurged matters have no retention clock (the one with a date and the purged one do not count)');
  perform t.eq((r ->> 'bin_matters_not_purgeable_until_retention_ends')::integer, 1, 'the matter in the bin is called out');
  perform t.eq((r ->> 'intake_token_will_be_cleared')::boolean, true, 'the intake token would be cleared');
  perform t.eq(jsonb_array_length(r -> 'manual_steps'), 3, 'the manual steps are listed');
  reset role;
  perform t.eq((select status from public.lalum_firms where id = f1), 'ACTIVE', 'the dry run left the status alone');
  perform t.eq((select count(*) from public.lalum_cockpit_matters where firm_id = f1 and handling_ended_at is not null), 1::bigint, 'the dry run set no retention clock');
  perform t.eq((select intake_token_hash from lalum_private.firm_secrets where firm_id = f1), 'hash1', 'the dry run kept the intake token');
  perform t.eq((select count(*) from public.lalum_firm_closures), 0::bigint, 'the dry run wrote no closure record');
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'CLOSURE_STARTED'), 0::bigint, 'and nothing to the chain');

  -- blockers stop a real run, and show in the dry run
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_begin_closing(fh, eff, reason, 'Held Firm');
  perform t.eq((r ->> 'would_proceed')::boolean, false, 'a legal hold means it would not proceed');
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L,false)', fh, eff, reason, 'Held Firm'), 'BLOCKED', 'a real run is blocked by a blocker');
  reset role;
  perform t.eq((select status from public.lalum_firms where id = fh), 'ACTIVE', 'a blocked run changes nothing');

  -- a real run
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_begin_closing(f1, eff, reason, 'Firm One', false);
  perform t.eq(r ->> 'status', 'SUSPENDED', 'a real run suspends the firm');
  perform t.eq((r ->> 'matters_clocked')::integer, 3, 'and starts the clock on three matters');
  reset role;
  perform t.eq((select status from public.lalum_firms where id = f1), 'SUSPENDED', 'the status is stored');
  perform t.eq((select count(*) from public.lalum_cockpit_matters where firm_id = f1 and handling_ended_at = eff), 3::bigint, 'the clock is the effective date on those three');
  perform t.eq((select handling_ended_at from public.lalum_cockpit_matters where id = mDone), date '2025-01-31', 'a matter that already had a date keeps it');
  perform t.eq((select count(*) from public.lalum_cockpit_matters where firm_id = f1 and purged_at is not null and handling_ended_at is not null), 0::bigint, 'a purged matter is untouched');
  perform t.eq((select count(*) from public.lalum_cockpit_matters where firm_id = f2 and handling_ended_at is not null), 0::bigint, 'another firm is untouched');
  perform t.eq((select status from public.lalum_firms where id = f2), 'ACTIVE', 'another firm keeps its status');
  perform t.eq((select intake_token_hash from lalum_private.firm_secrets where firm_id = f1), null::text, 'the intake token is cleared');
  perform t.eq((select intake_token_hash from lalum_private.firm_secrets where firm_id = f2), 'hash2', 'another firm keeps its token');
  perform t.eq((select array_length(clocked_matter_ids, 1) from public.lalum_firm_closures where firm_id = f1), 3, 'the closure record keeps the ids it clocked');
  perform t.eq((select not (mDone = any(clocked_matter_ids)) from public.lalum_firm_closures where firm_id = f1), true, 'and not the matter that already had a date');
  select meta into chain_meta from public.lalum_matter_audit_log where action = 'CLOSURE_STARTED' and firm_id = f1;
  perform t.eq(chain_meta ->> 'status_to', 'SUSPENDED', 'the chain records CLOSURE_STARTED');
  perform t.eq(chain_meta::text like '%' || reason || '%', false, 'the reason text is not in the chain');
  perform t.eq((select public.lalum_verify_audit_chain(f1)), null::bigint, 'the chain verifies clean');
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_begin_closing(%L,%L,%L,%L,false)', f1, eff, reason, 'Firm One'), 'NOT_ACTIVE', 'a firm that is already closing cannot be started again');

  -- who can read the closure record
  perform t.as_user(p1, aal2);
  perform t.eq((select count(*) from public.lalum_firm_closures), 1::bigint, 'a partner of the firm can read its closure record');
  -- either the privilege is missing, or row level security (no write policy) leaves every row unchanged; both hold whatever grants an earlier test file left
  begin
    update public.lalum_firm_closures set reason = 'rewriting the record now';
    get diagnostics n_rows = row_count;
    if n_rows <> 0 then raise exception 'FAIL: a partner changed % closure rows', n_rows; end if;
    raise notice 'PASS: a partner cannot edit it (row level security left the record unchanged)';
  exception when insufficient_privilege then raise notice 'PASS: a partner cannot edit it (no privilege)';
  end;
  perform t.as_user(p2, aal2);
  perform t.eq((select count(*) from public.lalum_firm_closures), 0::bigint, 'a partner of another firm cannot see it');

  -- cancel
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f1, 'short'), 'REASON_REQUIRED', 'cancelling needs a reason');
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f2, reason), 'NO_ACTIVE_CLOSURE', 'a firm that is not closing cannot be cancelled');
  reset role;
  update public.lalum_cockpit_matters set purge_requested_at = now() where id = mBin;
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f1, reason), 'PURGE_IN_PROGRESS', 'it refuses while a purge is in progress');
  reset role;
  update public.lalum_cockpit_matters set purge_requested_at = null where id = mBin;
  update public.lalum_cockpit_matters set handling_ended_at = eff + 5 where id = mB;  -- changed after closing began: not ours to undo
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_cancel_closing(f1, reason);
  perform t.eq(r ->> 'status', 'ACTIVE', 'cancelling restores the previous status');
  perform t.eq((r ->> 'matters_unclocked')::integer, 2, 'it clears only the clocks still equal to the effective date');
  perform t.eq(r ->> 'intake_token', 'issue_a_new_one', 'and says the token must be issued again');
  reset role;
  perform t.eq((select handling_ended_at from public.lalum_cockpit_matters where id = mB), eff + 5, 'a clock changed after the start is left alone');
  perform t.eq((select handling_ended_at from public.lalum_cockpit_matters where id = mDone), date '2025-01-31', 'the older date is still there');
  perform t.eq((select cancelled_at is not null from public.lalum_firm_closures where firm_id = f1), true, 'the closure record is marked cancelled');
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'CLOSURE_CANCELLED' and firm_id = f1), 1::bigint, 'CLOSURE_CANCELLED is in the chain');
  perform t.eq((select public.lalum_verify_audit_chain(f1)), null::bigint, 'the chain still verifies clean');
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f1, reason), 'NO_ACTIVE_CLOSURE', 'a second cancel finds nothing to cancel');
  r := public.lalum_firm_begin_closing(f1, eff, reason, 'Firm One', false);
  perform t.eq(r ->> 'status', 'SUSPENDED', 'after a cancel, closing can begin again');
  perform t.eq((select count(*) from public.lalum_firm_closures where firm_id = f1), 2::bigint, 'with a new record beside the cancelled one');

  reset role;
  raise notice 'ALL BEGIN CLOSING CHECKS PASSED';
  raise exception 'ROLLBACK_FIXTURES';
exception when others then
  if sqlerrm = 'ROLLBACK_FIXTURES' then raise notice 'rolled back fixtures'; else raise; end if;
end $$;
