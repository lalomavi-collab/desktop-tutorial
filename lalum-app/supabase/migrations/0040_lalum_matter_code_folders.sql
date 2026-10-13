/* Stage 1 of the case folder link (docs/matter-folder-sync-design.md).
   Gives every matter a stable human key (matter_code, L-YYYY-NNNN, per firm, issued in sequence, never reused,
   never changed) and a table that maps a matter to its folder at an external provider.
   Nothing here talks to any provider. Sync stays off for every matter until a partner switches it on for it
   (sync_enabled defaults to false), so the pilot is opt in per matter.
   Applied to project meoymkcotomoluwlwues in steps (see the migration list there). */

alter table public.lalum_cockpit_matters
  add column if not exists matter_code  text,
  add column if not exists sync_enabled boolean not null default false;

/* One counter row per firm and year. Written only by the trigger below (security definer). */
create table if not exists public.lalum_matter_code_counters (
  firm_id uuid not null references public.lalum_firms(id) on delete cascade,
  year    int  not null,
  last_n  int  not null default 0,
  primary key (firm_id, year)
);
alter table public.lalum_matter_code_counters enable row level security;
/* Internal bookkeeping: no direct access for anyone signed in or anonymous, only the security definer functions. */
revoke all on public.lalum_matter_code_counters from anon, authenticated;

create or replace function public.lalum_next_matter_code(p_firm uuid, p_year int) returns text
language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  insert into public.lalum_matter_code_counters as c (firm_id, year, last_n) values (p_firm, p_year, 1)
  on conflict (firm_id, year) do update set last_n = c.last_n + 1
  returning c.last_n into v_n;
  return 'L-' || p_year || '-' || lpad(v_n::text, 4, '0');
end $$;
revoke execute on function public.lalum_next_matter_code(uuid, int) from public, anon, authenticated;

create or replace function public.lalum_matter_code_assign() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if new.matter_code is null then
      new.matter_code := public.lalum_next_matter_code(new.firm_id, extract(year from coalesce(new.created_at, now()))::int);
    end if;
  elsif new.matter_code is distinct from old.matter_code and old.matter_code is not null then
    raise exception 'matter_code is immutable';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_matter_code_assign() from public, anon, authenticated;

drop trigger if exists lalum_matter_code_assign on public.lalum_cockpit_matters;
create trigger lalum_matter_code_assign before insert or update of matter_code on public.lalum_cockpit_matters
  for each row execute function public.lalum_matter_code_assign();

/* Backfill existing matters in creation order, by the year each was created. The update trigger allows
   setting a code that is still null. */
do $$
declare r record;
begin
  for r in select id, firm_id, extract(year from created_at)::int as y
           from public.lalum_cockpit_matters where matter_code is null order by created_at, id loop
    update public.lalum_cockpit_matters set matter_code = public.lalum_next_matter_code(r.firm_id, r.y) where id = r.id;
  end loop;
end $$;

alter table public.lalum_cockpit_matters alter column matter_code set not null;
create unique index if not exists lalum_cockpit_matters_firm_code_key on public.lalum_cockpit_matters (firm_id, matter_code);

/* Matter to external folder. Holds provider ids only: no client name, no path, no secret. */
create table if not exists public.lalum_matter_folders (
  matter_id        uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  provider         text not null check (provider in ('MS_FILES','GDRIVE_BACKUP')),
  remote_folder_id text not null,
  sync_state       text not null default 'ACTIVE'
                   check (sync_state in ('ACTIVE','PAUSED','FROZEN_LEGAL_HOLD','CLOSED')),
  created_at       timestamptz not null default now(),
  primary key (matter_id, provider)
);
alter table public.lalum_matter_folders enable row level security;
/* Explicit privileges: Supabase default grants would otherwise hand every write privilege to signed in users. Writes come only from the service role. */
revoke all on public.lalum_matter_folders from anon, authenticated;
grant select on public.lalum_matter_folders to authenticated;

/* Read: whoever may view the matter. Write: no policy, so only the service role (the sync function) can write. */
drop policy if exists lalum_matter_folders_read on public.lalum_matter_folders;
create policy lalum_matter_folders_read on public.lalum_matter_folders for select to authenticated
  using (public.lalum_can_view_matter(matter_id));

/* Switching sync on or off for a matter: partner or admin of the firm, fresh MFA, written to the audit chain. */
create or replace function public.lalum_set_matter_sync(p_matter uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_cockpit_matters where id = p_matter and deleted_at is null;
  if v_firm is null or not public.lalum_mgr_ok(v_firm) then raise exception 'not allowed'; end if;
  update public.lalum_cockpit_matters set sync_enabled = p_enabled where id = p_matter;
  perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'MATTER_SYNC_SET', null, jsonb_build_object('sync_enabled', p_enabled));
end $$;
revoke execute on function public.lalum_set_matter_sync(uuid, boolean) from public, anon;
grant execute on function public.lalum_set_matter_sync(uuid, boolean) to authenticated;
