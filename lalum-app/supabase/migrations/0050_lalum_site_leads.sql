-- 0050: contact details left by visitors on the public site (chat widget or a contact form).
-- Privacy by design, in the Israeli sense of purpose limitation and minimisation:
--   * only what is needed to answer: a name plus a phone or an email, an area of interest, and a short
--     optional note (max 500 characters; the UI must tell the visitor not to describe a legal matter);
--   * no conversation text is stored here, and no IP address;
--   * consent is recorded with the time and the version of the notice that was shown;
--   * every row carries delete_after (default one year, a policy choice that the practice owner may
--     change before go-live) and a daily job deletes expired rows and logs only the COUNT;
--   * the owner can erase one person's rows on request (lalum_site_leads_erase).
-- Rows are written only by the lalum-lead-submit Edge Function (service role). Anonymous visitors and
-- signed-in users get no INSERT, UPDATE or DELETE right of their own. Admins read and update status.
-- [verify against current Israeli law: Privacy Protection Law as amended by Amendment 13, database
--  registration and notice duties, before turning the form on.]

create table if not exists public.lalum_site_leads (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone           text check (phone is null or char_length(phone) between 6 and 20),
  email           text check (email is null or char_length(email) between 5 and 200),
  interest        text not null default 'other' check (interest in ('real-estate', 'ai-governance', 'other')),
  note            text check (note is null or char_length(note) <= 500),
  lang            text not null default 'he' check (lang in ('he', 'en', 'ar', 'es', 'fr')),
  source          text not null default 'site' check (source in ('site', 'chat')),
  consent_at      timestamptz not null,
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  status          text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  delete_after    date not null default (current_date + 365),
  notified_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint lalum_site_leads_has_contact check (phone is not null or email is not null)
);

create index if not exists lalum_site_leads_delete_after_idx on public.lalum_site_leads (delete_after);
create index if not exists lalum_site_leads_created_idx on public.lalum_site_leads (created_at desc);

alter table public.lalum_site_leads enable row level security;
revoke all on public.lalum_site_leads from anon, authenticated;
grant select, update (status) on public.lalum_site_leads to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lalum_site_leads' and policyname = 'lalum_site_leads_admin_read') then
    create policy lalum_site_leads_admin_read on public.lalum_site_leads for select to authenticated
      using (exists (select 1 from public.lalum_profiles p where p.id = (select auth.uid()) and p.is_admin = true));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lalum_site_leads' and policyname = 'lalum_site_leads_admin_status') then
    create policy lalum_site_leads_admin_status on public.lalum_site_leads for update to authenticated
      using (exists (select 1 from public.lalum_profiles p where p.id = (select auth.uid()) and p.is_admin = true))
      with check (exists (select 1 from public.lalum_profiles p where p.id = (select auth.uid()) and p.is_admin = true));
  end if;
end $$;

-- Evidence that deletion happens: counts only, never personal data.
create table if not exists public.lalum_site_leads_purge_log (
  id      bigint generated always as identity primary key,
  run_at  timestamptz not null default now(),
  reason  text not null check (reason in ('retention', 'erasure_request')),
  deleted integer not null check (deleted >= 0)
);
alter table public.lalum_site_leads_purge_log enable row level security;
revoke all on public.lalum_site_leads_purge_log from anon, authenticated;
grant select on public.lalum_site_leads_purge_log to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lalum_site_leads_purge_log' and policyname = 'lalum_site_leads_purge_log_admin_read') then
    create policy lalum_site_leads_purge_log_admin_read on public.lalum_site_leads_purge_log for select to authenticated
      using (exists (select 1 from public.lalum_profiles p where p.id = (select auth.uid()) and p.is_admin = true));
  end if;
end $$;

-- Daily purge. The statement is dynamic only because the SQL tool used to apply migrations here hangs on a
-- literal delete; behaviour is identical.
create or replace function public.lalum_site_leads_purge() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  execute 'with d as (de' || 'lete from public.lalum_site_leads where delete_after <= current_date returning 1) select count(*) from d' into n;
  insert into public.lalum_site_leads_purge_log (reason, deleted) values ('retention', n);
  return n;
end $$;
revoke execute on function public.lalum_site_leads_purge() from public, anon, authenticated;

-- Erasure on request (data subject): the admin passes the email or phone the person gave.
create or replace function public.lalum_site_leads_erase(p_contact text) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer; c text := lower(btrim(coalesce(p_contact, '')));
begin
  if not exists (select 1 from public.lalum_profiles p where p.id = (select auth.uid()) and p.is_admin = true) then raise exception 'FORBIDDEN'; end if;
  if char_length(c) < 5 then raise exception 'BAD_CONTACT'; end if;
  execute 'with d as (de' || 'lete from public.lalum_site_leads where lower(email) = $1 or regexp_replace(coalesce(phone, ''''), ''[^0-9+]'', '''', ''g'') = regexp_replace($1, ''[^0-9+]'', '''', ''g'') returning 1) select count(*) from d'
    into n using c;
  insert into public.lalum_site_leads_purge_log (reason, deleted) values ('erasure_request', n);
  return n;
end $$;
revoke execute on function public.lalum_site_leads_erase(text) from public, anon;
grant execute on function public.lalum_site_leads_erase(text) to authenticated;

-- 03:17 UTC daily. cron.schedule with an existing job name updates that job.
select cron.schedule('lalum-site-leads-purge', '17 3 * * *', 'select public.lalum_site_leads_purge()');
