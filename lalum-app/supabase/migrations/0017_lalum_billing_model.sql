-- Billing model for /settings/billing: fee terms per matter, time tracking, milestones,
-- matter team, client access to a matter, matter messages, append-only audit log, and the
-- aggregate functions behind the partner view and the client financial summary.
--
-- Design rules
--  * Additive only. No existing table, policy or function is changed.
--  * Authorization lives in RLS and in SECURITY DEFINER functions, never in the UI.
--  * Roles: FIRM_PARTNER and ADMIN see the whole firm (behind MFA, via lalum_fin_can).
--    ATTORNEY sees only matters on the matter team and only their own time entries, and never
--    a rate or a fee term. A CLIENT is a portal user who is NOT a firm member and reaches a
--    matter only through lalum_matter_client_access.
--  * Money in the partner view is aggregated from time entries, rate cards and the ledger
--    documents and payments. No balance is a hand edited field.
--  * Trust account balances and the 13 week cash forecast are deliberately absent: there is no
--    trust ledger and no collection history to compute them from.
-- Fee agreement rules of the Israel Bar (written agreement, contingent fees) are NOT encoded
-- here until verified against the rules' own text. The only guard is internal: billing cannot
-- be switched on for a matter without a stored agreement file.

-- ───────────────────────── tables ─────────────────────────

create table if not exists public.lalum_matter_team (
  matter_id  uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  added_by   uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (matter_id, user_id)
);
create index if not exists lalum_matter_team_user_idx on public.lalum_matter_team (user_id);

create table if not exists public.lalum_matter_fees (
  matter_id         uuid primary key references public.lalum_cockpit_matters(id) on delete cascade,
  firm_id           uuid not null references public.lalum_firms(id) on delete cascade,
  fin_customer_id   uuid references public.lalum_fin_customers(id),
  fee_model         text not null check (fee_model in ('hourly','fixed','capped','retainer','subscription','success','hybrid')),
  fixed_fee         numeric(14,2) check (fixed_fee is null or fixed_fee >= 0),
  fee_cap           numeric(14,2) check (fee_cap is null or fee_cap >= 0),
  retainer_monthly  numeric(14,2) check (retainer_monthly is null or retainer_monthly >= 0),
  cap_alert_pct     integer not null default 80 check (cap_alert_pct between 1 and 100),
  success_terms     jsonb,
  fee_agreement_path text,
  billing_active    boolean not null default false,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (fee_model <> 'fixed' or fixed_fee is not null),
  check (fee_model <> 'capped' or fee_cap is not null),
  check (fee_model not in ('retainer','subscription') or retainer_monthly is not null),
  check (not billing_active or fee_agreement_path is not null)
);
create index if not exists lalum_matter_fees_firm_idx on public.lalum_matter_fees (firm_id);

create table if not exists public.lalum_rate_cards (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id   uuid references public.lalum_cockpit_matters(id) on delete cascade,
  member_role text not null check (member_role in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER','ADMIN')),
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  valid_from  date not null default current_date,
  valid_to    date,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists lalum_rate_cards_lookup_idx on public.lalum_rate_cards (firm_id, member_role, valid_from desc);

create table if not exists public.lalum_time_entries (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id        uuid not null references public.lalum_cockpit_matters(id) on delete restrict,
  timekeeper_id    uuid not null default auth.uid() references auth.users(id) on delete restrict,
  work_date        date not null default current_date,
  worked_minutes   integer not null check (worked_minutes between 1 and 1440),
  billable_minutes integer not null check (billable_minutes >= 0),
  narrative        text not null default '',
  ai_assisted      boolean not null default false,
  status           text not null default 'draft' check (status in ('draft','submitted','approved','billed','written_off')),
  approved_by      uuid,
  approved_at      timestamptz,
  invoice_doc_id   uuid references public.lalum_fin_documents(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (billable_minutes <= worked_minutes),
  check (billable_minutes % 6 = 0),
  check (status = 'draft' or length(btrim(narrative)) >= 15),
  check (status <> 'billed' or invoice_doc_id is not null)
);
create index if not exists lalum_time_entries_matter_idx on public.lalum_time_entries (matter_id, work_date desc);
create index if not exists lalum_time_entries_keeper_idx on public.lalum_time_entries (timekeeper_id, work_date desc);
create index if not exists lalum_time_entries_firm_status_idx on public.lalum_time_entries (firm_id, status);

create table if not exists public.lalum_milestones (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id         uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  name              text not null check (length(btrim(name)) between 1 and 200),
  amount            numeric(14,2) not null check (amount >= 0),
  trigger_condition text not null check (length(btrim(trigger_condition)) > 0),
  achieved_at       date,
  fin_document_id   uuid references public.lalum_fin_documents(id),
  created_at        timestamptz not null default now()
);
create index if not exists lalum_milestones_matter_idx on public.lalum_milestones (matter_id);

-- Links an issued ledger document to the matter(s) it paid for. Needed for profitability per
-- matter, because the ledger documents carry no matter reference.
create table if not exists public.lalum_fin_document_matters (
  document_id uuid not null references public.lalum_fin_documents(id) on delete cascade,
  matter_id   uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  amount      numeric(14,2) not null,
  primary key (document_id, matter_id)
);

create table if not exists public.lalum_matter_client_access (
  matter_id      uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  firm_id        uuid not null references public.lalum_firms(id) on delete cascade,
  access_level   text not null default 'READ_WRITE' check (access_level in ('READ','READ_WRITE')),
  status         text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  granted_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  primary key (matter_id, client_user_id)
);
create index if not exists lalum_matter_client_access_user_idx on public.lalum_matter_client_access (client_user_id, status);

create table if not exists public.lalum_matter_messages (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id        uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  sender_id        uuid not null default auth.uid() references auth.users(id) on delete restrict,
  sender_kind      text not null check (sender_kind in ('CLIENT','FIRM')),
  body             text not null check (length(btrim(body)) between 1 and 8000),
  is_internal_only boolean not null default false,
  created_at       timestamptz not null default now(),
  check (sender_kind = 'FIRM' or not is_internal_only)
);
create index if not exists lalum_matter_messages_matter_idx on public.lalum_matter_messages (matter_id, created_at);

create table if not exists public.lalum_audit_log (
  id         bigint generated always as identity primary key,
  firm_id    uuid not null,
  actor_id   uuid,
  actor_role text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  ip         text,
  payload    jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);
create index if not exists lalum_audit_log_firm_idx on public.lalum_audit_log (firm_id, at desc);

-- ───────────────────────── access helpers ─────────────────────────

-- Hardening of the access gate from 0014. For a user who is not a firm member (a client), the
-- predicate evaluated to NULL, and `if not lalum_fin_can(...)` does not raise on NULL. It now
-- always returns true or false. Same logic otherwise; RLS behaviour is unchanged because a NULL
-- policy result already denied.
create or replace function public.lalum_fin_can(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(p_firm = public.lalum_my_firm_id()
     and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')
     and public.lalum_mfa_ok(), false) $$;

-- Firm side access to a matter: partner/admin of the firm, or a member of the matter team.
create or replace function public.lalum_is_staff_on(p_matter uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.lalum_cockpit_matters m
     where m.id = p_matter and m.deleted_at is null
       and m.firm_id = public.lalum_my_firm_id()
       and public.lalum_mfa_ok()
       and (public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')
            or exists (select 1 from public.lalum_matter_team t where t.matter_id = m.id and t.user_id = auth.uid()))) $$;

-- Client side access to a matter, through an active grant only.
create or replace function public.lalum_client_can(p_matter uuid, p_write boolean) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.lalum_matter_client_access a
     where a.matter_id = p_matter and a.client_user_id = auth.uid() and a.status = 'ACTIVE'
       and (not p_write or a.access_level = 'READ_WRITE')) $$;

create or replace function public.lalum_matter_firm(p_matter uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select firm_id from public.lalum_cockpit_matters where id = p_matter $$;

revoke execute on function public.lalum_is_staff_on(uuid), public.lalum_client_can(uuid, boolean),
  public.lalum_matter_firm(uuid) from public, anon;
grant execute on function public.lalum_is_staff_on(uuid), public.lalum_client_can(uuid, boolean),
  public.lalum_matter_firm(uuid) to authenticated;

-- Hourly rate in force for one time entry: a matter card beats a firm wide card.
create or replace function public.lalum_entry_rate(p_firm uuid, p_matter uuid, p_user uuid, p_date date) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select rc.hourly_rate from public.lalum_rate_cards rc
   where rc.firm_id = p_firm and (rc.matter_id = p_matter or rc.matter_id is null)
     and rc.member_role = (select role from public.lalum_firm_members where user_id = p_user)
     and p_date >= rc.valid_from and (rc.valid_to is null or p_date <= rc.valid_to)
   order by (rc.matter_id is not null) desc, rc.valid_from desc limit 1 $$;
revoke execute on function public.lalum_entry_rate(uuid, uuid, uuid, date) from public, anon, authenticated;

-- ───────────────────────── audit log ─────────────────────────

create or replace function public.lalum_audit_ip() returns text
language plpgsql stable set search_path to 'public' as $$
declare h text := nullif(current_setting('request.headers', true), '');
begin
  if h is null then return null; end if;
  return nullif(btrim(split_part(coalesce((h::json) ->> 'x-forwarded-for', ''), ',', 1)), '');
exception when others then return null;
end $$;
revoke execute on function public.lalum_audit_ip() from public, anon, authenticated;

create or replace function public.lalum_audit_write(p_firm uuid, p_action text, p_entity text, p_entity_id text, p_payload jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.lalum_audit_log (firm_id, actor_id, actor_role, action, entity, entity_id, ip, payload)
  values (p_firm, auth.uid(), public.lalum_my_role(), p_action, p_entity, p_entity_id, public.lalum_audit_ip(), coalesce(p_payload, '{}'::jsonb));
end $$;
revoke execute on function public.lalum_audit_write(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.lalum_audit_immutable() returns trigger
language plpgsql set search_path to 'public' as $$
begin raise exception 'AUDIT_LOG_IMMUTABLE'; end $$;
drop trigger if exists lalum_audit_no_change on public.lalum_audit_log;
create trigger lalum_audit_no_change before update or delete on public.lalum_audit_log
  for each row execute function public.lalum_audit_immutable();
drop trigger if exists lalum_audit_no_truncate on public.lalum_audit_log;
create trigger lalum_audit_no_truncate before truncate on public.lalum_audit_log
  for each statement execute function public.lalum_audit_immutable();

-- One trigger function for every billing table.
create or replace function public.lalum_billing_audit_trg() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_action text := case tg_op when 'INSERT' then 'CREATED' when 'UPDATE' then 'UPDATED' else 'DELETED' end;
  v_payload jsonb;
begin
  if tg_table_name = 'lalum_matter_messages' then
    v_action := case when new.sender_kind = 'CLIENT' then 'CLIENT_MESSAGE' else 'FIRM_MESSAGE' end;
    v_payload := jsonb_build_object('matter_id', new.matter_id, 'is_internal_only', new.is_internal_only, 'length', length(new.body));
  elsif tg_table_name = 'lalum_time_entries' then
    if tg_op = 'UPDATE' then
      if new.status is not distinct from old.status then return new; end if;
      v_action := 'STATUS_' || upper(new.status);
      v_payload := jsonb_build_object('from', old.status, 'to', new.status, 'matter_id', new.matter_id, 'billable_minutes', new.billable_minutes);
    else
      v_payload := jsonb_build_object('matter_id', r ->> 'matter_id', 'billable_minutes', r -> 'billable_minutes');
    end if;
  elsif tg_op = 'UPDATE' then
    v_payload := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    v_payload := r;
  end if;
  perform public.lalum_audit_write((r ->> 'firm_id')::uuid, v_action, tg_table_name,
    coalesce(r ->> 'id', r ->> 'matter_id'), v_payload);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.lalum_billing_audit_trg() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['lalum_matter_team','lalum_matter_fees','lalum_rate_cards','lalum_time_entries',
                           'lalum_milestones','lalum_fin_document_matters','lalum_matter_client_access','lalum_matter_messages']
  loop
    execute format('drop trigger if exists lalum_audit_t on public.%I', t);
    execute format('create trigger lalum_audit_t after insert or update or delete on public.%I for each row execute function public.lalum_billing_audit_trg()', t);
  end loop;
end $$;

-- ───────────────────────── write guards ─────────────────────────

-- Time entries: separation of duties and period control, enforced for end user sessions only
-- (service role and migrations have no auth.uid()).
create or replace function public.lalum_time_entries_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_partner boolean := public.lalum_fin_can(coalesce(new.firm_id, old.firm_id));
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.firm_id is distinct from public.lalum_matter_firm(new.matter_id) then raise exception 'FIRM_MISMATCH'; end if;
    if new.status not in ('draft','submitted') and not v_partner then raise exception 'STATUS_FORBIDDEN'; end if;
    if new.work_date < current_date - 7 and not v_partner then raise exception 'BACKDATE_NEEDS_PARTNER'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'ONLY_DRAFT_DELETABLE'; end if;
    return old;
  end if;
  if new.firm_id is distinct from old.firm_id or new.matter_id is distinct from old.matter_id
     or new.timekeeper_id is distinct from old.timekeeper_id then raise exception 'IDENTITY_IMMUTABLE'; end if;
  if old.status in ('billed','written_off') then raise exception 'ENTRY_LOCKED'; end if;
  if not v_partner then
    if old.status not in ('draft','submitted') or new.status not in ('draft','submitted') then raise exception 'STATUS_FORBIDDEN'; end if;
    if new.work_date is distinct from old.work_date and new.work_date < current_date - 7 then raise exception 'BACKDATE_NEEDS_PARTNER'; end if;
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lalum_time_entries_guard_t on public.lalum_time_entries;
create trigger lalum_time_entries_guard_t before insert or update or delete on public.lalum_time_entries
  for each row execute function public.lalum_time_entries_guard();

-- Same firm for every row that points at a matter or a ledger customer; a client user can
-- never also be a firm member.
create or replace function public.lalum_billing_integrity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  r jsonb := to_jsonb(new);
  v_matter uuid := (r ->> 'matter_id')::uuid;
  v_firm uuid := (r ->> 'firm_id')::uuid;
begin
  if v_matter is not null and v_firm is distinct from public.lalum_matter_firm(v_matter) then
    raise exception 'FIRM_MISMATCH';
  end if;
  if tg_table_name = 'lalum_matter_fees' then
    if r ->> 'fin_customer_id' is not null
       and not exists (select 1 from public.lalum_fin_customers c where c.id = (r ->> 'fin_customer_id')::uuid and c.firm_id = v_firm) then
      raise exception 'CUSTOMER_FIRM_MISMATCH';
    end if;
    new.updated_at := now();
  elsif tg_table_name = 'lalum_matter_client_access' then
    if exists (select 1 from public.lalum_firm_members fm where fm.user_id = (r ->> 'client_user_id')::uuid) then
      raise exception 'CLIENT_CANNOT_BE_FIRM_MEMBER';
    end if;
  elsif tg_table_name = 'lalum_matter_team' then
    if not exists (select 1 from public.lalum_firm_members fm where fm.user_id = (r ->> 'user_id')::uuid and fm.firm_id = v_firm) then
      raise exception 'TEAM_MEMBER_NOT_IN_FIRM';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.lalum_billing_integrity() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['lalum_matter_team','lalum_matter_fees','lalum_rate_cards','lalum_milestones',
                           'lalum_fin_document_matters','lalum_matter_client_access']
  loop
    execute format('drop trigger if exists lalum_integrity_t on public.%I', t);
    execute format('create trigger lalum_integrity_t before insert or update on public.%I for each row execute function public.lalum_billing_integrity()', t);
  end loop;
end $$;

-- A message takes its firm from the matter, so a sender cannot choose it.
create or replace function public.lalum_matter_messages_before() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  new.firm_id := public.lalum_matter_firm(new.matter_id);
  if new.firm_id is null then raise exception 'NO_SUCH_MATTER'; end if;
  return new;
end $$;
drop trigger if exists lalum_matter_messages_before_t on public.lalum_matter_messages;
create trigger lalum_matter_messages_before_t before insert on public.lalum_matter_messages
  for each row execute function public.lalum_matter_messages_before();

-- ───────────────────────── row level security ─────────────────────────

alter table public.lalum_matter_team           enable row level security;
alter table public.lalum_matter_fees           enable row level security;
alter table public.lalum_rate_cards            enable row level security;
alter table public.lalum_time_entries          enable row level security;
alter table public.lalum_milestones            enable row level security;
alter table public.lalum_fin_document_matters  enable row level security;
alter table public.lalum_matter_client_access  enable row level security;
alter table public.lalum_matter_messages       enable row level security;
alter table public.lalum_audit_log             enable row level security;

revoke all on public.lalum_matter_team, public.lalum_matter_fees, public.lalum_rate_cards, public.lalum_time_entries,
  public.lalum_milestones, public.lalum_fin_document_matters, public.lalum_matter_client_access,
  public.lalum_matter_messages, public.lalum_audit_log from anon, authenticated;

-- Matter team: partners manage, a member sees their own seat.
create policy lalum_matter_team_read on public.lalum_matter_team for select
  using ((select public.lalum_fin_can(firm_id)) or user_id = (select auth.uid()));
create policy lalum_matter_team_write on public.lalum_matter_team for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert, update, delete on public.lalum_matter_team to authenticated;

-- Fee terms, rates, milestones, document links: partner and admin only.
create policy lalum_matter_fees_all on public.lalum_matter_fees for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
create policy lalum_rate_cards_all on public.lalum_rate_cards for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
create policy lalum_milestones_all on public.lalum_milestones for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
create policy lalum_fin_document_matters_all on public.lalum_fin_document_matters for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert, update, delete on public.lalum_matter_fees, public.lalum_rate_cards,
  public.lalum_milestones, public.lalum_fin_document_matters to authenticated;

-- Time entries: partners see all; everyone else only their own.
create policy lalum_time_entries_read on public.lalum_time_entries for select
  using ((select public.lalum_fin_can(firm_id))
         or (timekeeper_id = (select auth.uid()) and firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())));
create policy lalum_time_entries_insert on public.lalum_time_entries for insert
  with check (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())
              and ((select public.lalum_fin_can(firm_id))
                   or (timekeeper_id = (select auth.uid()) and public.lalum_is_staff_on(matter_id))));
create policy lalum_time_entries_update on public.lalum_time_entries for update
  using ((select public.lalum_fin_can(firm_id))
         or (timekeeper_id = (select auth.uid()) and status in ('draft','submitted') and firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())))
  with check ((select public.lalum_fin_can(firm_id))
         or (timekeeper_id = (select auth.uid()) and status in ('draft','submitted') and firm_id = (select public.lalum_my_firm_id())));
create policy lalum_time_entries_delete on public.lalum_time_entries for delete
  using (status = 'draft' and ((select public.lalum_fin_can(firm_id))
         or (timekeeper_id = (select auth.uid()) and firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()))));
grant select, insert, update, delete on public.lalum_time_entries to authenticated;

-- Client access grants: partners manage; the client may read their own grant.
create policy lalum_client_access_read on public.lalum_matter_client_access for select
  using ((select public.lalum_fin_can(firm_id)) or client_user_id = (select auth.uid()));
create policy lalum_client_access_write on public.lalum_matter_client_access for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
grant select, insert, update, delete on public.lalum_matter_client_access to authenticated;

-- Messages: append only. Staff read everything on their matters; a client never reads an
-- internal note. A client can write only on a READ_WRITE grant and never an internal note.
create policy lalum_matter_messages_read on public.lalum_matter_messages for select
  using (public.lalum_is_staff_on(matter_id)
         or (not is_internal_only and public.lalum_client_can(matter_id, false)));
create policy lalum_matter_messages_insert on public.lalum_matter_messages for insert
  with check (sender_id = (select auth.uid())
              and ((sender_kind = 'FIRM' and public.lalum_is_staff_on(matter_id))
                   or (sender_kind = 'CLIENT' and not is_internal_only and public.lalum_client_can(matter_id, true))));
grant select, insert on public.lalum_matter_messages to authenticated;

-- Audit log: partners read; nobody writes except through the SECURITY DEFINER paths.
create policy lalum_audit_log_read on public.lalum_audit_log for select
  using ((select public.lalum_fin_can(firm_id)));
grant select on public.lalum_audit_log to authenticated;

-- ───────────────────────── aggregate functions ─────────────────────────

-- Partner executive view. Everything is computed from rows; nothing is typed in.
create or replace function public.lalum_partner_overview() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_wip numeric; v_wip_h numeric; v_norate integer; v_fixed_h numeric; v_ar jsonb; v_pending integer;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'partner_overview', null, '{}'::jsonb);

  select coalesce(sum(case when r.rate is not null then te.billable_minutes / 60.0 * r.rate end), 0),
         coalesce(sum(te.billable_minutes), 0) / 60.0,
         count(*) filter (where r.rate is null)
    into v_wip, v_wip_h, v_norate
    from public.lalum_time_entries te
    join public.lalum_matter_fees f on f.matter_id = te.matter_id and f.fee_model in ('hourly','capped','hybrid')
    cross join lateral (select public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date) as rate) r
   where te.firm_id = v_firm and te.status in ('submitted','approved');

  select coalesce(sum(te.billable_minutes), 0) / 60.0 into v_fixed_h
    from public.lalum_time_entries te
    left join public.lalum_matter_fees f on f.matter_id = te.matter_id
   where te.firm_id = v_firm and te.status in ('submitted','approved')
     and (f.matter_id is null or f.fee_model not in ('hourly','capped','hybrid'));

  select count(*) into v_pending from public.lalum_time_entries where firm_id = v_firm and status = 'submitted';

  with inv as (
    select d.id, coalesce(d.due_date, d.issue_date) as due,
           d.total
             - coalesce((select sum(p.amount) from public.lalum_fin_payments p where p.document_id = d.id), 0)
             - coalesce((select sum(x.total) from public.lalum_fin_documents x
                          where x.related_doc_id = d.id and x.status = 'ISSUED' and not x.is_test
                            and x.doc_type in ('RECEIPT','CREDIT')), 0) as open_amt
      from public.lalum_fin_documents d
     where d.firm_id = v_firm and d.doc_type = 'INVOICE' and d.status = 'ISSUED' and not d.is_test
  ), b as (
    select case when current_date - due <= 0 then 'current'
                when current_date - due <= 30 then 'd1_30'
                when current_date - due <= 60 then 'd31_60'
                when current_date - due <= 90 then 'd61_90'
                else 'd90_plus' end as bucket, open_amt
      from inv where open_amt > 0.004
  )
  select jsonb_build_object(
           'current',  coalesce(sum(open_amt) filter (where bucket = 'current'), 0),
           'd1_30',    coalesce(sum(open_amt) filter (where bucket = 'd1_30'), 0),
           'd31_60',   coalesce(sum(open_amt) filter (where bucket = 'd31_60'), 0),
           'd61_90',   coalesce(sum(open_amt) filter (where bucket = 'd61_90'), 0),
           'd90_plus', coalesce(sum(open_amt) filter (where bucket = 'd90_plus'), 0),
           'total',    coalesce(sum(open_amt), 0))
    into v_ar from b;

  return jsonb_build_object(
    'wip_value', round(v_wip, 2), 'wip_hours', round(v_wip_h, 2),
    'entries_without_rate', v_norate, 'unbilled_hours_non_hourly_matters', round(v_fixed_h, 2),
    'entries_awaiting_approval', v_pending, 'ar_aging', v_ar,
    'excludes', jsonb_build_array('Invoice4U archive documents', 'trust account balances', 'cash balance', '13 week cash flow'));
end $$;
revoke execute on function public.lalum_partner_overview() from public, anon;
grant execute on function public.lalum_partner_overview() to authenticated;

-- Economics per matter: effort, time value, cap use and effective hourly revenue.
create or replace function public.lalum_partner_matter_economics() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_out jsonb;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'matter_economics', null, '{}'::jsonb);
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into v_out from (
    select m.id as matter_id, m.title, m.practice_area, f.fee_model, f.fee_cap, f.cap_alert_pct,
           round(coalesce(t.worked_h, 0), 2) as worked_hours, round(coalesce(t.billable_h, 0), 2) as billable_hours,
           round(coalesce(t.time_value, 0), 2) as time_value,
           coalesce(rev.revenue, 0) as revenue,
           case when t.worked_h > 0 then round(coalesce(rev.revenue, 0) / t.worked_h, 2) end as effective_hourly_revenue,
           case when f.fee_cap > 0 then round(coalesce(t.time_value, 0) / f.fee_cap * 100, 1) end as cap_used_pct,
           (f.fee_cap > 0 and coalesce(t.time_value, 0) >= f.fee_cap * f.cap_alert_pct / 100.0) as cap_alert
      from public.lalum_cockpit_matters m
      left join public.lalum_matter_fees f on f.matter_id = m.id
      left join lateral (
        select sum(te.worked_minutes) / 60.0 as worked_h, sum(te.billable_minutes) / 60.0 as billable_h,
               sum(te.billable_minutes / 60.0 * coalesce(public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date), 0)) as time_value
          from public.lalum_time_entries te where te.matter_id = m.id and te.status <> 'written_off') t on true
      left join lateral (
        select sum(dm.amount) as revenue from public.lalum_fin_document_matters dm
          join public.lalum_fin_documents d on d.id = dm.document_id and d.status = 'ISSUED' and not d.is_test
         where dm.matter_id = m.id) rev on true
     where m.firm_id = v_firm and m.deleted_at is null
     order by m.created_at desc) x;
  return v_out;
end $$;
revoke execute on function public.lalum_partner_matter_economics() from public, anon;
grant execute on function public.lalum_partner_matter_economics() to authenticated;

-- Client financial summary: issued documents of the linked ledger customer only. The client
-- never touches the ledger tables, draft documents, hours or rates.
create or replace function public.lalum_client_matter_financials(p_matter uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_cust uuid; v_firm uuid; v_out jsonb;
begin
  if not public.lalum_client_can(p_matter, false) then raise exception 'FORBIDDEN'; end if;
  select f.fin_customer_id, f.firm_id into v_cust, v_firm from public.lalum_matter_fees f where f.matter_id = p_matter;
  perform public.lalum_audit_write(coalesce(v_firm, public.lalum_matter_firm(p_matter)), 'VIEWED_FINANCIALS', 'client_matter_financials', p_matter::text, '{}'::jsonb);
  if v_cust is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.issue_date desc), '[]'::jsonb) into v_out from (
    select d.id, d.doc_type, d.doc_number, d.subject, d.issue_date, d.due_date, d.total, d.pdf_url,
           case when d.doc_type = 'INVOICE' then
             d.total - coalesce((select sum(p.amount) from public.lalum_fin_payments p where p.document_id = d.id), 0)
                     - coalesce((select sum(r.total) from public.lalum_fin_documents r
                                  where r.related_doc_id = d.id and r.status = 'ISSUED' and not r.is_test
                                    and r.doc_type in ('RECEIPT','CREDIT')), 0) end as open_amount
      from public.lalum_fin_documents d
     where d.customer_id = v_cust and d.firm_id = v_firm and d.status = 'ISSUED' and not d.is_test
       and d.doc_type in ('INVOICE','INVOICE_RECEIPT','RECEIPT','CREDIT')) x;
  return v_out;
end $$;
revoke execute on function public.lalum_client_matter_financials(uuid) from public, anon;
grant execute on function public.lalum_client_matter_financials(uuid) to authenticated;
