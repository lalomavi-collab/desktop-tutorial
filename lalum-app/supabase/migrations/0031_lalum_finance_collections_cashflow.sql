-- Finance: collections control (receivables aging by due date) and the 13 week cash forecast.
-- Applied to project meoymkcotomoluwlwues as "lalum_finance_collections_cashflow". Access follows the finance levels of 0024: collections work (lock, reminders, DSO) needs level 3,
-- the cash plan needs level 4, the same as lalum_cash_forecast_items. Additive only: nothing here changes an existing table's meaning.
--
-- Boundaries kept on purpose:
--  * Aging, DSO and the forecast are computed in src/lib/cockpit/arAging.ts and cashFlow.ts from the ledger
--    tables that already exist (documents, payments, customers). They are verified by `npm run ar-aging-check`
--    and `npm run cashflow-check`. This migration stores only what cannot be derived: a cached DSO, the billing
--    lock, the reminder log and the cash plan settings.
--  * Client trust money is NOT read or written here. It belongs to the billing model (0020) and must never
--    enter an operating cash forecast.
--  * The lock is a flag and a decision record. Making lalum_time_entries refuse new rows for a locked customer is a
--    separate change in the billing lane, with a partner override, and is not part of this migration.
--  * Reminders are only RECORDED here. Nothing is sent from this migration or from the screens that use it.

-- ---- customers: DSO cache and billing lock ----
alter table public.lalum_fin_customers
  add column if not exists historical_dso_days int check (historical_dso_days is null or historical_dso_days between 0 and 730),
  add column if not exists dso_sample_size     int not null default 0 check (dso_sample_size >= 0),
  add column if not exists dso_computed_at     timestamptz,
  add column if not exists is_collections_locked boolean not null default false,
  add column if not exists collections_locked_at timestamptz,
  add column if not exists collections_locked_by uuid,
  add column if not exists collections_lock_reason text check (collections_lock_reason is null or length(collections_lock_reason) <= 500);

create index if not exists lalum_fin_customers_dso_idx on public.lalum_fin_customers (firm_id, historical_dso_days);
create index if not exists lalum_fin_customers_locked_idx on public.lalum_fin_customers (firm_id) where is_collections_locked;

-- Lock or unlock a customer. A partner's decision, with a reason, never automatic.
create or replace function public.lalum_fin_set_collections_lock(p_customer uuid, p_locked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_locked and length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'LOCK_REASON_REQUIRED'; end if;
  update public.lalum_fin_customers set
    is_collections_locked = p_locked,
    collections_locked_at = case when p_locked then now() else null end,
    collections_locked_by = case when p_locked then auth.uid() else null end,
    collections_lock_reason = case when p_locked then left(btrim(p_reason), 500) else null end
  where id = p_customer;
end $$;
revoke execute on function public.lalum_fin_set_collections_lock(uuid, boolean, text) from public, anon;
grant execute on function public.lalum_fin_set_collections_lock(uuid, boolean, text) to authenticated;

-- ---- reminder log ----
create table if not exists public.lalum_fin_dunning_log (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.lalum_firms(id) on delete cascade,
  customer_id  uuid not null references public.lalum_fin_customers(id),
  tier         smallint not null check (tier between 1 and 3),
  channel      text not null check (channel in ('EMAIL','WHATSAPP','PHONE','MANUAL')),
  sent_on      date not null default (now() at time zone 'Asia/Jerusalem')::date,
  note         text check (note is null or length(note) <= 500),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  -- the same customer, tier and day is one reminder: a double click cannot log twice
  unique (customer_id, tier, sent_on)
);
create index if not exists lalum_fin_dunning_log_customer_idx on public.lalum_fin_dunning_log (customer_id, sent_on desc);
alter table public.lalum_fin_dunning_log enable row level security;
create policy lalum_fin_dunning_log_read on public.lalum_fin_dunning_log for select
  using ((select public.lalum_fin_can(firm_id, 3)));
revoke all on public.lalum_fin_dunning_log from anon, authenticated;
grant select on public.lalum_fin_dunning_log to authenticated;
-- No insert grant: the only writer is lalum_fin_log_reminder, which enforces the cooldown.

-- Record a reminder. Same rule as COOLDOWN_DAYS in arAging.ts: no second reminder within 7 days.
create or replace function public.lalum_fin_log_reminder(p_customer uuid, p_tier int, p_channel text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_today date := (now() at time zone 'Asia/Jerusalem')::date; v_id uuid;
begin
  select firm_id into v_firm from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_tier not between 1 and 3 then raise exception 'BAD_TIER'; end if;
  -- serialise per customer so two concurrent calls cannot both pass the cooldown check
  perform pg_advisory_xact_lock(hashtext('lalum_fin_dunning:' || p_customer::text));
  if exists (select 1 from public.lalum_fin_dunning_log where customer_id = p_customer and sent_on > v_today - 7) then
    raise exception 'COOLDOWN_ACTIVE';
  end if;
  insert into public.lalum_fin_dunning_log (firm_id, customer_id, tier, channel, sent_on, note, created_by)
  values (v_firm, p_customer, p_tier, p_channel, v_today, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_log_reminder(uuid, int, text, text) from public, anon;
grant execute on function public.lalum_fin_log_reminder(uuid, int, text, text) to authenticated;

-- ---- cash plan settings (operating money only) ----
create table if not exists public.lalum_fin_cashflow_settings (
  firm_id          uuid primary key references public.lalum_firms(id) on delete cascade,
  opening_balance  numeric(14,2) not null default 0,
  balance_as_of    date,
  credit_facility  numeric(14,2) not null default 0 check (credit_facility >= 0),
  safety_reserve   numeric(14,2) not null default 50000 check (safety_reserve >= 0),
  updated_by       uuid,
  updated_at       timestamptz not null default now()
);

-- Outflows and non invoice inflows (payroll, rent, VAT remittance) are NOT stored here. They live in lalum_cash_forecast_items
-- (migration 0020, billing model), which also holds the weekly actuals and variance reasons. This table adds only what that
-- one lacks: the opening balance, the unused credit facility and the safety reserve.

alter table public.lalum_fin_cashflow_settings enable row level security;
create policy lalum_fin_cashflow_settings_all on public.lalum_fin_cashflow_settings for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
revoke all on public.lalum_fin_cashflow_settings from anon, authenticated;
grant select, insert, update, delete on public.lalum_fin_cashflow_settings to authenticated;

create trigger lalum_fin_cashflow_settings_touch before update on public.lalum_fin_cashflow_settings
  for each row execute function public.lalum_touch_updated_at();
