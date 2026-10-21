-- Tests for migration 0067 (revoke access: block logins, revoke tax connections; restore access). Run after the stubs, 0018, 0014, 0019, 0059, 0060, 0061, 0062, 0063, 0065 and 0067:
--   psql -v ON_ERROR_STOP=1 -f firm_revoke_access.sql
-- Stand ins for tables and columns that only the live project has are created below when absent (Auth sessions and banned_until, the vault).
-- Every assertion raises on failure. Fixtures roll back.
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


alter table auth.users add column if not exists banned_until timestamptz;
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), secret text);
alter table public.lalum_tax_connections add column if not exists client_secret_vault_id uuid;
alter table public.lalum_tax_connections add column if not exists refresh_token_vault_id uuid;
alter table public.lalum_tax_connections add column if not exists client_id text;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid(); f4 uuid := gen_random_uuid();
  pA uuid := gen_random_uuid(); pB uuid := gen_random_uuid(); cust uuid := gen_random_uuid(); admm uuid := gen_random_uuid();
  shared uuid := gen_random_uuid(); shc uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); nobody uuid := gen_random_uuid();
  q1 uuid := gen_random_uuid(); q2 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid(); s4 uuid := gen_random_uuid(); s_other uuid := gen_random_uuid();
  aal2 text := '{"aal":"aal2"}'; reason text := 'the firm asked to leave the platform'; r jsonb; ban_past timestamptz := timestamptz '2025-01-01 00:00:00+00';
  n0 bigint; meta jsonb;
begin
  -- lalum_firm_members.user_id is unique today (one firm per login), so the guard for a member of another live firm cannot trigger in production.
  -- It is kept as a defence in case that ever changes, and tested here by dropping the constraint inside this rolled back transaction.
  alter table public.lalum_firm_members drop constraint if exists lalum_firm_members_user_id_key;
  insert into auth.users (id, email) values (pA,'pa@x'),(pB,'pb@x'),(cust,'c@x'),(admm,'am@x'),(shared,'sh@x'),(shc,'shc@x'),(adm,'admin@x'),(nobody,'n@x'),(q1,'q1@x'),(q2,'q2@x');
  update auth.users set banned_until = ban_past where id = pB;
  insert into public.lalum_profiles (id, is_admin) values (adm, true), (admm, true);
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa, status) values
    (f1,'Firm One','1','x','f1@x','1',0,false,'ACTIVE'),(f2,'Firm Two','2','x','f2@x','2',0,false,'ACTIVE'),(f3,'Firm Three','3','x','f3@x','3',0,false,'CANCELED'),(f4,'Firm Four','4','x','f4@x','4',0,false,'ACTIVE');
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,pA,'A','pa@x','FIRM_PARTNER'),(f1,pB,'B','pb@x','ATTORNEY'),(f1,cust,'C','c@x','ATTORNEY'),(f1,admm,'AM','am@x','FIRM_PARTNER'),(f1,shared,'S','sh@x','ATTORNEY'),(f1,shc,'SC','shc@x','ATTORNEY'),
    (f2,shared,'S','sh@x','ATTORNEY'),(f3,shc,'SC','shc@x','ATTORNEY'),(f4,q1,'Q1','q1@x','FIRM_PARTNER'),(f4,q2,'Q2','q2@x','ATTORNEY');
  insert into public.lalum_cockpit_matters (firm_id, title) values (f1,'M1'),(f4,'M4');
  insert into lalum_private.firm_secrets (firm_id, intake_token_hash) values (f1,'h1'),(f2,'h2'),(f4,'h4');
  insert into auth.sessions (user_id) select u from unnest(array[pA,pB,cust,admm,shared,shc,q1,q2]) u;
  insert into vault.secrets (id, secret) values (s1,'a'),(s2,'b'),(s3,'c'),(s4,'d'),(s_other,'keep');
  insert into public.lalum_tax_connections (firm_id, client_id, client_secret_vault_id, refresh_token_vault_id) values (f1,'c1',s1,s2),(f1,'c2',s3,s4),(f2,'c3',s_other,null);

  -- who may call
  perform t.as_user(pA, aal2);
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', f1, 'Firm One'), 'FORBIDDEN', 'a partner cannot revoke their own firm access');
  perform t.as_user(nobody, aal2);
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', f1, 'Firm One'), 'FORBIDDEN', 'a stranger cannot');
  perform t.as_user(adm, '{}');
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', f1, 'Firm One'), 'FORBIDDEN', 'the platform admin needs a second factor session');
  perform t.as_user(null, aal2);
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', f1, 'Firm One'), 'FORBIDDEN', 'no user cannot');
  perform t.fails(format('select public.lalum_firm_restore_access(%L,%L)', f1, reason), 'FORBIDDEN', 'no user cannot restore either');
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', gen_random_uuid(), 'x'), 'NOT_FOUND', 'an unknown firm is not found');
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', f1, 'Firm One'), 'NO_ACTIVE_CLOSURE', 'a firm that never began closing cannot have its access revoked');
  perform t.fails(format('select public.lalum_firm_restore_access(%L,%L)', f1, reason), 'NO_REVOKED_ACCESS', 'nothing to restore before a revocation');

  -- begin closing, then the validations
  perform public.lalum_firm_begin_closing(f1, current_date + 30, reason, 'Firm One', false);
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L)', f1, 'firm one'), 'BAD_CONFIRM', 'the typed firm name must match exactly');
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L,%L,false)', f1, '', cust), 'BAD_CONFIRM', 'an empty confirmation is refused');
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L,%L)', f1, 'Firm One', nobody), 'CUSTODIAN_NOT_MEMBER', 'the custodian must be a member of the firm');
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L,%L)', f1, 'Firm One', q1), 'CUSTODIAN_NOT_MEMBER', 'a member of another firm is not this firm custodian');

  -- the dry run changes nothing and reports who would be touched
  r := public.lalum_firm_revoke_access(f1, 'Firm One', cust);
  perform t.eq((r ->> 'dry_run')::boolean, true, 'it is a dry run by default');
  perform t.eq((r ->> 'logins_to_ban')::integer, 3, 'three logins would be banned (partner, attorney, and the member of a cancelled other firm)');
  perform t.eq((r ->> 'logins_skipped_platform_admin')::integer, 1, 'a platform admin who is a member is skipped');
  perform t.eq((r ->> 'logins_skipped_other_firm')::integer, 1, 'a member of another live firm is skipped');
  perform t.eq((r ->> 'custodian_kept')::boolean, true, 'the custodian is kept');
  perform t.eq((r ->> 'tax_connections_to_revoke')::integer, 2, 'two tax connections of this firm');
  perform t.eq((r ->> 'vault_secrets_to_delete')::integer, 4, 'with four vault secrets');
  perform t.eq((r ->> 'tax_revocation_is_reversible')::boolean, false, 'the tax part is said to be irreversible');
  perform t.eq(jsonb_array_length(r -> 'manual_steps'), 2, 'the manual steps are listed');
  reset role;
  perform t.eq((select count(*) from auth.users where banned_until is not null and id <> pB), 0::bigint, 'the dry run banned nobody');
  perform t.eq((select count(*) from auth.sessions), 8::bigint, 'and ended no session');
  perform t.eq((select count(*) from vault.secrets), 5::bigint, 'and deleted no secret');
  perform t.eq((select count(*) from public.lalum_tax_connections), 3::bigint, 'and no connection');
  perform t.eq((select access_revoked_at from public.lalum_firm_closures where firm_id = f1), null::timestamptz, 'and recorded nothing');
  perform t.eq((select count(*) from public.lalum_matter_audit_log where action = 'ACCESS_REVOKED'), 0::bigint, 'and wrote nothing to the chain');

  -- a real run
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_revoke_access(f1, 'Firm One', cust, false);
  perform t.eq((r ->> 'logins_banned')::integer, 3, 'a real run bans three logins');
  perform t.eq((r ->> 'tax_connections_revoked')::integer, 2, 'and revokes two tax connections');
  perform t.eq((r ->> 'tokens_already_issued_work_until_they_expire')::boolean, true, 'it says issued tokens work until they expire');
  reset role;
  perform t.eq((select count(*) from auth.users where id in (pA, pB, shc) and banned_until > now() + interval '99 years'), 3::bigint, 'the three logins carry a hundred year ban');
  perform t.eq((select count(*) from auth.users where id in (cust, admm, shared, nobody, adm) and (banned_until is null)), 5::bigint, 'the custodian, the platform admins and the member of another live firm are untouched');
  perform t.eq((select count(*) from auth.sessions where user_id in (pA, pB, shc)), 0::bigint, 'their sessions are ended');
  perform t.eq((select count(*) from auth.sessions where user_id in (cust, admm, shared, q1, q2)), 5::bigint, 'the other sessions stay');
  perform t.eq((select count(*) from public.lalum_tax_connections where firm_id = f1), 0::bigint, 'the firm tax connections are gone');
  perform t.eq((select count(*) from public.lalum_tax_connections where firm_id = f2), 1::bigint, 'another firm connection is untouched');
  perform t.eq((select count(*) from vault.secrets where id in (s1, s2, s3, s4)), 0::bigint, 'the vault secrets of the firm are deleted');
  perform t.eq((select count(*) from vault.secrets where id = s_other), 1::bigint, 'another firm secret is kept');
  perform t.eq((select access_revoked_by from public.lalum_firm_closures where firm_id = f1), adm, 'the closure record names who revoked');
  perform t.eq((select tax_connections_revoked from public.lalum_firm_closures where firm_id = f1), 2, 'and how many connections');
  perform t.eq((select banned_users -> pB::text from public.lalum_firm_closures where firm_id = f1) #>> '{}', '2025-01-01T00:00:00+00:00', 'the previous ban of a user is stored exactly');
  perform t.eq((select banned_users -> pA::text from public.lalum_firm_closures where firm_id = f1), 'null'::jsonb, 'and a user who had none is stored as null');
  perform t.eq((select count(*) from jsonb_object_keys((select banned_users from public.lalum_firm_closures where firm_id = f1))), 3::bigint, 'only the banned users are recorded');
  select a.meta into meta from public.lalum_matter_audit_log a where a.firm_id = f1 and a.action = 'ACCESS_REVOKED';
  perform t.eq((select array_agg(k order by k) from jsonb_object_keys(meta) k), array['custodian_kept','logins_banned','skipped_other_firm','skipped_platform_admin','tax_connections_revoked'], 'the chain row carries counts and fixed words only');
  perform t.eq(meta::text like '%' || pA::text || '%', false, 'no user id in the chain row');

  -- repeated, and the interplay with the other closure functions
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_revoke_access(%L,%L,%L,false)', f1, 'Firm One', cust), 'ALREADY_REVOKED', 'a second revocation is refused');
  perform t.fails(format('select public.lalum_firm_cancel_closing(%L,%L)', f1, 'trying to undo it afterwards'), 'ACCESS_REVOKED', 'a closure with banned logins cannot be cancelled until access is restored');
  r := public.lalum_firm_finish_closing(f1, reason, 'Firm One');
  perform t.eq((r ->> 'tax_connections_remaining')::integer, 0, 'finish closing sees no tax connection left');

  -- restore: only a login that still carries our ban is put back
  reset role;
  update auth.users set banned_until = now() + interval '1 day' where id = shc;
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_restore_access(%L,%L)', f1, 'short'), 'REASON_REQUIRED', 'a reason of at least 10 characters is required');
  perform t.as_user(pA, aal2);
  perform t.fails(format('select public.lalum_firm_restore_access(%L,%L)', f1, reason), 'FORBIDDEN', 'a partner cannot restore');
  perform t.as_user(adm, aal2);
  r := public.lalum_firm_restore_access(f1, reason);
  perform t.eq((r ->> 'logins_restored')::integer, 2, 'two logins are restored (the one changed by hand is left alone)');
  perform t.eq((r ->> 'tax_connections_need_reconnecting')::integer, 2, 'the result says two tax connections must be reconnected');
  reset role;
  perform t.eq((select banned_until from auth.users where id = pA), null::timestamptz, 'a user who had no ban has none again');
  perform t.eq((select banned_until from auth.users where id = pB), ban_past, 'a user with a previous ban gets exactly that back');
  perform t.eq((select banned_until > now() and banned_until < now() + interval '2 days' from auth.users where id = shc), true, 'a login an admin changed by hand is not overwritten');
  perform t.eq((select count(*) from public.lalum_tax_connections where firm_id = f1), 0::bigint, 'the tax connections do not come back');
  perform t.eq((select count(*) from public.lalum_matter_audit_log where firm_id = f1 and action = 'ACCESS_RESTORED'), 1::bigint, 'the restore wrote one chain row');
  perform t.as_user(adm, aal2);
  perform t.fails(format('select public.lalum_firm_restore_access(%L,%L)', f1, reason), 'NO_REVOKED_ACCESS', 'a second restore is refused');
  r := public.lalum_firm_revoke_access(f1, 'Firm One', cust);
  perform t.eq((r ->> 'dry_run')::boolean, true, 'after a restore the access can be revoked again');
  r := public.lalum_firm_cancel_closing(f1, 'access restored, so the closure can be cancelled');
  perform t.eq(r ->> 'status', 'ACTIVE', 'after a restore the closure can be cancelled');

  -- no custodian: everyone who may be banned is banned, platform admins still are not
  perform public.lalum_firm_begin_closing(f4, current_date + 30, reason, 'Firm Four', false);
  r := public.lalum_firm_revoke_access(f4, 'Firm Four', null, false);
  perform t.eq((r ->> 'logins_banned')::integer, 2, 'without a custodian every member of the firm is banned');
  perform t.eq((r ->> 'custodian_kept')::boolean, false, 'and the result says there is no custodian');
  reset role;
  perform t.eq((select count(*) from auth.users where id in (q1, q2) and banned_until > now() + interval '99 years'), 2::bigint, 'both are banned');
  perform t.eq(has_function_privilege('anon', 'public.lalum_firm_revoke_access(uuid,text,uuid,boolean)', 'execute'), false, 'anon cannot execute revoke');
  perform t.eq(has_function_privilege('anon', 'public.lalum_firm_restore_access(uuid,text)', 'execute'), false, 'anon cannot execute restore');

  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm <> 'ALL_PASSED_ROLLBACK' then raise; end if;
  raise notice 'firm_revoke_access: all assertions passed (fixtures rolled back)';
end $$;
