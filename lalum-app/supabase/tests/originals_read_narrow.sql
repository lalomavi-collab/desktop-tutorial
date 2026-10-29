-- Tests for migration 20261028140000 (step 4.1, T48). Order: 00_supabase_stubs.sql, then this file, which pulls in
-- the migration itself halfway through. Run: psql -v ON_ERROR_STOP=1 -f 00_supabase_stubs.sql -f originals_read_narrow.sql
-- The storage schema, the firm helpers and the three storage policies are copied from production on 28.10.2026;
-- the helpers read a small member table instead of lalum_firm_members, and MFA is the aal claim.
create schema if not exists storage;
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create or replace function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;

create table public.t_members (user_id uuid primary key, firm_id uuid, role text);
create or replace function public.lalum_my_firm_id() returns uuid language sql stable security definer set search_path = public as
  $$ select firm_id from public.t_members where user_id = auth.uid() $$;
create or replace function public.lalum_my_role() returns text language sql stable security definer set search_path = public as
  $$ select role from public.t_members where user_id = auth.uid() $$;
create or replace function public.lalum_mfa_ok() returns boolean language sql stable as
  $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;
create or replace function public.lalum_is_partner_of(p_firm uuid) returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.t_members where user_id = auth.uid() and firm_id = p_firm and role = 'FIRM_PARTNER') $$;

create table public.lalum_matter_documents (id uuid primary key, matter_id uuid, firm_id uuid, original_path text,
  purge_requested_at timestamptz, deleted_at timestamptz);
create or replace function public.lalum_original_purge_allowed(p_name text) returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.lalum_matter_documents d where d.original_path = p_name and d.purge_requested_at is not null
                   and public.lalum_is_partner_of(d.firm_id)) $function$;
create or replace function public.lalum_original_referenced(p_name text) returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.lalum_matter_documents d where d.original_path = p_name) $function$;
create or replace function public.lalum_original_slot_ok(p_name text) returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
declare parts text[]; d public.lalum_matter_documents;
begin
  if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/original\.[a-z0-9]{1,5}$' then return false; end if;
  parts := string_to_array(p_name, '/');
  select * into d from public.lalum_matter_documents where id = parts[3]::uuid;
  return d.id is not null and d.matter_id = parts[2]::uuid and d.firm_id = parts[1]::uuid and d.original_path is null and d.deleted_at is null;
end $function$;
grant execute on all functions in schema public to authenticated;

-- The three policies as they are in production before the migration.
create policy lalum_originals_read on storage.objects for select to authenticated using (((bucket_id = 'matter-originals'::text) AND ((storage.foldername(name))[1] = (( SELECT lalum_my_firm_id() AS lalum_my_firm_id))::text) AND ( SELECT lalum_mfa_ok() AS lalum_mfa_ok) AND (( SELECT lalum_my_role() AS lalum_my_role) = ANY (ARRAY['FIRM_PARTNER'::text, 'ATTORNEY'::text, 'ADMIN'::text]))));
create policy lalum_originals_insert on storage.objects for insert to authenticated with check (((bucket_id = 'matter-originals'::text) AND ((storage.foldername(name))[1] = (( SELECT lalum_my_firm_id() AS lalum_my_firm_id))::text) AND ( SELECT lalum_mfa_ok() AS lalum_mfa_ok) AND (( SELECT lalum_my_role() AS lalum_my_role) = ANY (ARRAY['FIRM_PARTNER'::text, 'ATTORNEY'::text, 'ADMIN'::text])) AND lalum_original_slot_ok(name)));
create policy lalum_originals_delete on storage.objects for delete to authenticated using (((bucket_id = 'matter-originals'::text) AND (lalum_original_purge_allowed(name) OR ((owner = auth.uid()) AND ((storage.foldername(name))[1] = (( SELECT lalum_my_firm_id() AS lalum_my_firm_id))::text) AND (NOT lalum_original_referenced(name))))));

create schema if not exists t;
grant usage on schema t to authenticated;
create or replace function t.as_user(p_uid uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function t.as_user(uuid, text) to authenticated;
create or replace function t.seen() returns bigint language sql as $$ select count(*) from storage.objects $$;
grant execute on function t.seen() to authenticated;

-- Firm A: partner a1, attorney a2, admin a3, attorney a4. Firm B: partner b1.
-- Documents: e1 linked, e2 linked and purge requested, e3 empty slot (no original yet), e4 linked in firm B.
-- Objects: e1, e2, e4 linked; f1 a failed upload of a2 that no document points to.
insert into public.t_members values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000000a','FIRM_PARTNER'),
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-00000000000a','ATTORNEY'),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-00000000000a','ADMIN'),
  ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-00000000000a','ATTORNEY'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000000b','FIRM_PARTNER');
insert into public.lalum_matter_documents (id, matter_id, firm_id, original_path, purge_requested_at) values
  ('00000000-0000-0000-0000-0000000001e1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000d1/00000000-0000-0000-0000-0000000001e1/original.pdf', null),
  ('00000000-0000-0000-0000-0000000001e2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000d1/00000000-0000-0000-0000-0000000001e2/original.pdf', now()),
  ('00000000-0000-0000-0000-0000000001e3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000a', null, null),
  ('00000000-0000-0000-0000-0000000001e4','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000d2/00000000-0000-0000-0000-0000000001e4/original.pdf', null);
insert into storage.objects (bucket_id, name, owner) values
  ('matter-originals','00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000d1/00000000-0000-0000-0000-0000000001e1/original.pdf','00000000-0000-0000-0000-0000000000a2'),
  ('matter-originals','00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000d1/00000000-0000-0000-0000-0000000001e2/original.pdf','00000000-0000-0000-0000-0000000000a2'),
  ('matter-originals','00000000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000d2/00000000-0000-0000-0000-0000000001e4/original.pdf','00000000-0000-0000-0000-0000000000b1'),
  ('matter-originals','00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000d1/00000000-0000-0000-0000-0000000000f1/original.pdf','00000000-0000-0000-0000-0000000000a2');

-- 0. Before the migration: the gap. Partner, attorney and admin all read the three linked originals of their firm directly.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert t.seen() = 3, 'before: partner reads e1, e2 and the failed upload f1'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin assert (select count(*) from storage.objects where name like '%1e1/original.pdf') = 1, 'before: admin reads a linked original directly'; end $$;
rollback;

\ir ../migrations/20261028140000_lalum_originals_read_narrow.sql

-- 1. A linked original is no longer readable directly, by any role, with or without a purge request it does not own.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from storage.objects where name like '%1e1/original.pdf') = 0, 'partner does not read a linked original';
  assert (select count(*) from storage.objects where name like '%1e2/original.pdf') = 1, 'partner reads the original whose purge was requested';
  assert t.seen() = 1, 'partner sees only the purge candidate';
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin assert t.seen() = 0, 'admin reads no original directly'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin assert t.seen() = 0, 'another attorney reads nothing, not even the failed upload of a2'; end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  assert (select count(*) from storage.objects where name like '%1e1/original.pdf') = 0, 'the uploader does not read the original once it is linked';
  assert (select count(*) from storage.objects where name like '%0f1/original.pdf') = 1, 'the uploader reads its own failed upload';
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin assert t.seen() = 0, 'firm B partner reads nothing: its own linked original is closed too, and firm A is not its folder'; end $$;
rollback;

-- 2. The uploader removes its own failed upload (storeOriginal), and cannot remove a linked one.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ declare n int; begin
  with d as (delete from storage.objects where name like '%0f1/original.pdf' returning 1) select count(*) into n from d;
  assert n = 1, 'the uploader removes its failed upload';
  with d as (delete from storage.objects where name like '%1e1/original.pdf' returning 1) select count(*) into n from d;
  assert n = 0, 'the uploader cannot remove a linked original';
end $$;
rollback;

-- 3. Purge: the partner removes an original whose purge was requested; an attorney cannot.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ declare n int; begin
  with d as (delete from storage.objects where name like '%1e2/original.pdf' returning 1) select count(*) into n from d;
  assert n = 0, 'an attorney cannot purge';
end $$;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare n int; begin
  with d as (delete from storage.objects where name like '%1e2/original.pdf' returning 1) select count(*) into n from d;
  assert n = 1, 'the partner purges';
end $$;
rollback;

-- 4. Upload into an empty slot still works, including reading the new row back (upload returns it).
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ declare n int; begin
  with i as (insert into storage.objects (bucket_id, name, owner) values ('matter-originals',
    '00000000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000d1/00000000-0000-0000-0000-0000000001e3/original.pdf',
    '00000000-0000-0000-0000-0000000000a2') returning name) select count(*) into n from i;
  assert n = 1, 'upload into an empty slot, with the row returned';
end $$;
rollback;

-- 5. Without a second factor nothing is readable, as before.
begin;
select t.as_user('00000000-0000-0000-0000-0000000000a2', 'aal1');
do $$ begin assert t.seen() = 0, 'no second factor, no read'; end $$;
rollback;

select 'originals_read_narrow: all checks passed' as result;
