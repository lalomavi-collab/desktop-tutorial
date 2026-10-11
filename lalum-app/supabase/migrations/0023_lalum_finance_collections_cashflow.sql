-- Finance: collections control (receivables aging by due date) and the 13 week cash forecast.
-- Not yet applied to the project. Additive only: nothing here changes an existing table's meaning.
--
-- Boundaries kept on purpose:
--  * Aging, DSO and the forecast are computed in src/lib/cockpit/arAging.ts and cashFlow.ts from the ledger
--    tables that already exist (documents, payments, customers). They are verified by `npm run ar-aging-check`
--    and `npm run cashflow-check`. This migration stores only what cannot be derived: a cached DSO, the billing
--    lock, the reminder log and the partner's own cash plan.
--  * Client trust money is NOT read or written here. It belongs to the billing model (PR 732) and must never
--    enter an operating cash forecast. Enforcing the lock on time entries also waits for that model.
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
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
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
  using ((select public.lalum_fin_can(firm_id)));
revoke all on public.lalum_fin_dunning_log from anon, authenticated;
grant select on public.lalum_fin_dunning_log to authenticated;
-- No insert grant: the only writer is lalum_fin_log_reminder, which enforces the cooldown.

-- Record a reminder. Same rule as COOLDOWN_DAYS in arAging.ts: no second reminder within 7 days.
create or replace function public.lalum_fin_log_reminder(p_customer uuid, p_tier int, p_channel text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_today date := (now() at time zone 'Asia/Jerusalem')::date; v_id uuid;
begin
  select firm_id into v_firm from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
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

-- ---- the partner's cash plan (operating money only) ----
create table if not exists public.lalum_fin_cashflow_settings (
  firm_id          uuid primary key references public.lalum_firms(id) on delete cascade,
  opening_balance  numeric(14,2) not null default 0,
  balance_as_of    date,
  credit_facility  numeric(14,2) not null default 0 check (credit_facility >= 0),
  safety_reserve   numeric(14,2) not null default 50000 check (safety_reserve >= 0),
  updated_by       uuid,
  updated_at       timestamptz not null default now()
);

-- Known cash movements that are not customer invoices: payroll, rent, VAT remittance, a loan instalment.
-- MONTHLY repeats on day_of_month (clamped to the month's last day); ONCE happens on on_date.
create table if not exists public.lalum_fin_cashflow_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.lalum_firms(id) on delete cascade,
  label         text not null check (length(btrim(label)) between 1 and 120),
  direction     text not null check (direction in ('IN','OUT')),
  schedule      text not null check (schedule in ('MONTHLY','ONCE')),
  day_of_month  smallint check (day_of_month between 1 and 31),
  on_date       date,
  amount        numeric(14,2) not null check (amount > 0),
  active        boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((schedule = 'MONTHLY' and day_of_month is not null and on_date is null)
      or (schedule = 'ONCE' and on_date is not null and day_of_month is null))
);
create index if not exists lalum_fin_cashflow_items_firm_idx on public.lalum_fin_cashflow_items (firm_id, active);

alter table public.lalum_fin_cashflow_settings enable row level security;
alter table public.lalum_fin_cashflow_items enable row level security;
create policy lalum_fin_cashflow_settings_all on public.lalum_fin_cashflow_settings for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
create policy lalum_fin_cashflow_items_all on public.lalum_fin_cashflow_items for all
  using ((select public.lalum_fin_can(firm_id))) with check ((select public.lalum_fin_can(firm_id)));
revoke all on public.lalum_fin_cashflow_settings, public.lalum_fin_cashflow_items from anon, authenticated;
grant select, insert, update, delete on public.lalum_fin_cashflow_settings, public.lalum_fin_cashflow_items to authenticated;

create trigger lalum_fin_cashflow_items_touch before update on public.lalum_fin_cashflow_items
  for each row execute function public.lalum_touch_updated_at();
create trigger lalum_fin_cashflow_settings_touch before update on public.lalum_fin_cashflow_settings
  for each row execute function public.lalum_touch_updated_at();
