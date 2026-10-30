-- Tests for migration 20261030223000. Order: 00_supabase_stubs.sql, then this file, which pulls in the migration
-- halfway through. Run: psql -v ON_ERROR_STOP=1 -f 00_supabase_stubs.sql -f definer_null_gates.sql
-- The helpers, lalum_set_member_role and lalum_member_reset_target are copied from production on 30.10.2026, and so are
-- the three gated functions as they were before the migration; the tables keep only the columns these functions read.
create schema if not exists extensions;
create or replace function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select public.gen_random_bytes($1) $$;
create or replace function extensions.digest(bytea, text) returns bytea language sql as $$ select public.digest($1, $2) $$;
create schema if not exists lalum_private;
create table lalum_private.firm_secrets (firm_id uuid primary key, intake_token_hash text);
create table public.lalum_firms (id uuid primary key, require_mfa boolean not null default false);
create table public.lalum_firm_members (firm_id uuid not null, user_id uuid primary key, role text not null, department text);
create table public.lalum_matter_audit_log (seq bigint, firm_id uuid, matter_id uuid, attorney_id uuid, action text,
  ai_output_hash text, meta jsonb, "timestamp" timestamptz, prev_hash text, hash text);
create table public.lalum_fin_archive (firm_id uuid, i4u_doc_type integer, doc_number bigint);
create table public.lalum_fin_series (firm_id uuid, doc_type text, last_number bigint, updated_at timestamptz,
  primary key (firm_id, doc_type));

create or replace function public.lalum_is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists ( select 1 from public.lalum_profiles p where p.id = auth.uid() and p.is_admin )
      or exists ( select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = 'avraham@lalum.co' ); $$;
create or replace function public.lalum_my_firm_id() returns uuid language sql stable security definer set search_path to 'public' as
  $$ select firm_id from public.lalum_firm_members where user_id = auth.uid() limit 1 $$;
create or replace function public.lalum_my_role() returns text language sql stable security definer set search_path to 'public' as
  $$ select role from public.lalum_firm_members where user_id = auth.uid() limit 1 $$;
create or replace function public.lalum_mfa_ok() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(not (select f.require_mfa from public.lalum_firms f where f.id = public.lalum_my_firm_id()), true)
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;
create or replace function public.lalum_my_department() returns text language sql stable security definer set search_path to 'public' as
  $$ select department from public.lalum_firm_members where user_id = (select auth.uid()) limit 1 $$;
create or replace function public.lalum_is_partner_of(p_firm uuid) returns boolean language sql stable security definer set search_path to 'public' as
  $$ select coalesce(p_firm is not null and p_firm = lalum_my_firm_id() and lalum_my_role() = 'FIRM_PARTNER' and lalum_mfa_ok() and lalum_is_admin(), false) $$;
create or replace function public.lalum_fin_can(p_firm uuid) returns boolean language sql stable security definer set search_path to 'public' as
  $$ select coalesce(p_firm = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN'), false) $$;
create or replace function public.lalum_fin_seed_series_from_archive(p_firm uuid) returns table(doc_type text, seeded_to bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.lalum_fin_can(p_firm) then raise exception 'FORBIDDEN'; end if;
  return query select 'INVOICE'::text, 0::bigint;
end $$;
-- A stand in for the audit writer: appends one row, no hashing.
create or replace function public.lalum_append_audit(p_firm uuid, p_matter uuid, p_actor uuid, p_action text, p_ai_hash text, p_meta jsonb)
returns bigint language sql security definer set search_path to 'public' as $$
  insert into public.lalum_matter_audit_log (seq, firm_id, matter_id, attorney_id, action, meta, "timestamp")
  values ((select coalesce(max(seq), 0) + 1 from public.lalum_matter_audit_log), p_firm, p_matter, p_actor, p_action, p_meta, now()) returning seq $$;
create or replace function public.lalum_audit_hash(p_prev text, p_seq bigint, p_firm uuid, p_matter uuid, p_actor uuid, p_action text,
  p_ai_hash text, p_meta jsonb, p_ts timestamptz) returns text language sql immutable as $$ select repeat('0', 64) $$;

-- The three gates as in production before the migration.
create or replace function public.lalum_admin_ok(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_is_admin() or (
    p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
    and public.lalum_my_role() = 'ADMIN'
  );
$$;
create or replace function public.lalum_rotate_intake_token(p_firm uuid) returns text
language plpgsql security definer set search_path to 'public', 'lalum_private', 'extensions' as $function$
declare v_token text := 'lit_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not (public.lalum_is_admin()
          or (p_firm = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN'))) then
    raise exception 'not authorized';
  end if;
  update lalum_private.firm_secrets
     set intake_token_hash = encode(extensions.digest(convert_to(v_token,'utf8'),'sha256'),'hex')
   where firm_id = p_firm;
  return v_token;
end $function$;
create or replace function public.lalum_verify_audit_chain(p_firm uuid) returns bigint
language plpgsql stable security definer set search_path to 'public', 'extensions' as $function$
declare r record; v_prev text := repeat('0', 64); v_expected bigint := 1;
begin
  if not (public.lalum_is_admin() or p_firm = public.lalum_my_firm_id()) then
    raise exception 'not authorized';
  end if;
  for r in select * from public.lalum_matter_audit_log where firm_id = p_firm order by seq loop
    if r.seq <> v_expected or r.prev_hash <> v_prev
       or r.hash <> public.lalum_audit_hash(r.prev_hash, r.seq, r.firm_id, r.matter_id, r.attorney_id, r.action, r.ai_output_hash, r.meta, r."timestamp") then
      return r.seq;
    end if;
    v_prev := r.hash; v_expected := v_expected + 1;
  end loop;
  return null;
end $function$;

-- The two callers of lalum_admin_ok that test it with nothing in front, as in production.
create or replace function public.lalum_set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare v_firm uuid; v_prev text;
begin
  select firm_id, role into v_firm, v_prev from public.lalum_firm_members where user_id = p_user;
  if v_firm is null then raise exception 'not a firm member'; end if;
  if not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  if p_role not in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER','ADMIN','BOOKKEEPER') then raise exception 'invalid role'; end if;
  if v_prev = 'ADMIN' and p_role <> 'ADMIN'
     and (select count(*) from public.lalum_firm_members where firm_id = v_firm and role = 'ADMIN') <= 1 then
    raise exception 'cannot remove the last administrator';
  end if;
  update public.lalum_firm_members set role = p_role where user_id = p_user;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_ROLE_SET', null,
    jsonb_build_object('user', p_user, 'role', p_role, 'prev_role', v_prev));
end $function$;
create or replace function public.lalum_member_reset_target(p_user uuid) returns text
language plpgsql security definer set search_path to 'public' as $function$
declare v_firm uuid; v_email text;
begin
  select firm_id into v_firm from public.lalum_firm_members where user_id = p_user;
  if v_firm is null then raise exception 'not a firm member'; end if;
  if not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  select email into v_email from auth.users where id = p_user;
  if v_email is null then raise exception 'no e-mail on file'; end if;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_PASSWORD_RESET_REQUESTED', null,
    jsonb_build_object('user', p_user));
  return v_email;
end $function$;
-- As in production: no execute for PUBLIC, explicit grants to authenticated.
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
grant usage on schema extensions, lalum_private to authenticated;

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
create or replace function t.fails(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin execute p_sql; raise exception 'should have failed: %', p_sql;
  exception when others then if sqlerrm not like p_msg then raise exception 'wrong error for %: %', p_sql, sqlerrm; end if; end;
end $$;
grant execute on function t.fails(text, text) to authenticated;

-- Firm A (MFA required): admin a1, attorney a2, bookkeeper a3. Firm B: admin b1. f1 is signed in and in no firm.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','admin@a.test'),('00000000-0000-0000-0000-0000000000a2','attorney@a.test'),
  ('00000000-0000-0000-0000-0000000000a3','books@a.test'),('00000000-0000-0000-0000-0000000000b1','admin@b.test'),('00000000-0000-0000-0000-0000000000f1','nofirm@x.test');
insert into public.lalum_firms (id, require_mfa) values ('00000000-0000-0000-0000-00000000000a', true), ('00000000-0000-0000-0000-00000000000b', true);
insert into public.lalum_firm_members (firm_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','ADMIN'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','ATTORNEY'),
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','BOOKKEEPER'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','ADMIN');
insert into lalum_private.firm_secrets (firm_id, intake_token_hash) values ('00000000-0000-0000-0000-00000000000a', 'original');

-- 0. Before the migration: the gap. A signed in user in no firm gets NULL, and all four entry points let them through.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ begin assert public.lalum_admin_ok('00000000-0000-0000-0000-00000000000a') is null, 'before: NULL for a user in no firm'; end $$;
select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a3', 'FIRM_PARTNER');
do $$ begin assert public.lalum_member_reset_target('00000000-0000-0000-0000-0000000000a1') = 'admin@a.test', 'before: another firm''s e-mail'; end $$;
do $$ begin assert public.lalum_rotate_intake_token('00000000-0000-0000-0000-00000000000a') like 'lit_%', 'before: token rotated'; end $$;
select public.lalum_verify_audit_chain('00000000-0000-0000-0000-00000000000a');
reset role;
do $$ begin assert (select role from public.lalum_firm_members where user_id = '00000000-0000-0000-0000-0000000000a3') = 'FIRM_PARTNER', 'before: the role was changed';
  assert (select intake_token_hash from lalum_private.firm_secrets) <> 'original', 'before: the token was replaced'; end $$;
rollback;

\ir ../migrations/20261030223000_lalum_definer_null_gates.sql

-- 1. After: never NULL, signed in or out.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ begin assert public.lalum_admin_ok('00000000-0000-0000-0000-00000000000a') = false, 'user in no firm: false, not NULL'; end $$;
select t.as_user(null);
do $$ begin assert public.lalum_admin_ok('00000000-0000-0000-0000-00000000000a') = false, 'signed out: false, not NULL'; end $$;
rollback;

-- 2. After: the user in no firm is refused by all four, and nothing changed.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.fails($q$select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a3', 'FIRM_PARTNER')$q$, 'not allowed');
select t.fails($q$select public.lalum_member_reset_target('00000000-0000-0000-0000-0000000000a1')$q$, 'not allowed');
select t.fails($q$select public.lalum_rotate_intake_token('00000000-0000-0000-0000-00000000000a')$q$, 'not authorized');
select t.fails($q$select public.lalum_verify_audit_chain('00000000-0000-0000-0000-00000000000a')$q$, 'not authorized');
reset role;
do $$ begin assert (select role from public.lalum_firm_members where user_id = '00000000-0000-0000-0000-0000000000a3') = 'BOOKKEEPER', 'role unchanged';
  assert (select intake_token_hash from lalum_private.firm_secrets) = 'original', 'token unchanged';
  assert (select count(*) from public.lalum_matter_audit_log) = 0, 'no audit row written'; end $$;
rollback;

-- 3. After: the rules themselves are unchanged for members.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a2', 'aal2');
select t.fails($q$select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a3', 'FIRM_PARTNER')$q$, 'not allowed');
select t.fails($q$select public.lalum_rotate_intake_token('00000000-0000-0000-0000-00000000000a')$q$, 'not authorized');
do $$ begin assert public.lalum_verify_audit_chain('00000000-0000-0000-0000-00000000000a') is null, 'an attorney of the firm verifies its chain'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1', 'aal2');
select t.fails($q$select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a3', 'ATTORNEY')$q$, 'not allowed');
select t.fails($q$select public.lalum_member_reset_target('00000000-0000-0000-0000-0000000000a1')$q$, 'not allowed');
select t.fails($q$select public.lalum_verify_audit_chain('00000000-0000-0000-0000-00000000000a')$q$, 'not authorized');
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal1');
select t.fails($q$select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a3', 'ATTORNEY')$q$, 'not allowed');
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert public.lalum_admin_ok('00000000-0000-0000-0000-00000000000a') = true, 'the firm administrator with MFA'; end $$;
select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a3', 'ATTORNEY');
do $$ begin assert public.lalum_member_reset_target('00000000-0000-0000-0000-0000000000a2') = 'attorney@a.test', 'administrator reads a member e-mail'; end $$;
do $$ begin assert public.lalum_rotate_intake_token('00000000-0000-0000-0000-00000000000a') like 'lit_%', 'administrator rotates the token'; end $$;
select t.fails($q$select public.lalum_set_member_role('00000000-0000-0000-0000-0000000000a1', 'ATTORNEY')$q$, 'cannot remove the last administrator');
reset role;
do $$ begin assert (select role from public.lalum_firm_members where user_id = '00000000-0000-0000-0000-0000000000a3') = 'ATTORNEY', 'administrator changed the role'; end $$;
rollback;

-- 4. After: the three revoked functions are closed to signed in users and still work from a definer caller.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
select t.fails($q$select public.lalum_is_partner_of('00000000-0000-0000-0000-00000000000a')$q$, 'permission denied for function lalum_is_partner_of');
select t.fails($q$select public.lalum_my_department()$q$, 'permission denied for function lalum_my_department');
select t.fails($q$select * from public.lalum_fin_seed_series_from_archive('00000000-0000-0000-0000-00000000000a')$q$, 'permission denied for function lalum_fin_seed_series_from_archive');
rollback;
begin;
create function public.t_definer_probe() returns text language sql stable security definer set search_path to 'public' as
  $$ select coalesce(public.lalum_my_department(), 'none') || '/' || public.lalum_is_partner_of(public.lalum_my_firm_id())::text $$;
grant execute on function public.t_definer_probe() to authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin assert public.t_definer_probe() = 'none/false', 'a definer caller still reaches both helpers'; end $$;
rollback;

select 'definer_null_gates: all assertions passed' as result;
