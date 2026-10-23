-- Finance: tax classification of expenses, the tax profile per tax year, and the statutory parameters as data.
-- Not applied by this file being merged: apply as "lalum_finance_tax_engine" with the owner's approval.
--
--  * lalum_fin_expenses keeps `vat_recoverable_pct` as the VAT recognition rate (already there, 0 to 100) and gains the
--    income tax recognition rate and a tax category. Both are nullable: an older row falls back to the category's suggestion
--    in src/lib/cockpit/taxEngine.ts. Recognized VAT, unrecognized VAT and the deductible amount are computed by the engine
--    and not stored, so they can never drift from the amounts they come from.
--  * lalum_fin_tax_settings: one row per firm and tax year (entity type, reporting basis, credit points, advances paid so far,
--    deposits to keren hishtalmut and pension). Read at finance level 1, written at level 3, like expenses.
--  * lalum_tax_params: statutory figures of a tax year, replacing the built in table of taxParams.ts when a row exists. A row
--    marked VERIFIED must carry a verification date and at least two sources, enforced here. Written only by the service role.

alter table public.lalum_fin_expenses
  add column if not exists tax_category text check (tax_category in (
    'OPERATIONAL_100','VEHICLE_MAINTENANCE','VEHICLE_EV_CHARGING','OFFICE_REFRESHMENTS','CLIENT_GIFTS','PROFESSIONAL_ATTIRE',
    'HOME_OFFICE','LOCAL_HOSPITALITY_NON_DEDUCTIBLE','FINES_NON_DEDUCTIBLE','MIXED_CUSTOM')),
  add column if not exists income_tax_recognition_pct numeric(5,2) check (income_tax_recognition_pct between 0 and 100);

create table if not exists public.lalum_fin_tax_settings (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.lalum_firms(id) on delete cascade,
  tax_year     int not null check (tax_year between 2020 and 2100),
  entity_type  text not null default 'OSEK_MURSHE' check (entity_type in ('OSEK_MURSHE','LTD_COMPANY','OSEK_PATUR')),
  reporting_basis text not null default 'CASH' check (reporting_basis in ('CASH','ACCRUAL')),
  credit_points numeric(5,2) not null default 2.25 check (credit_points >= 0),
  mikdamot_income_tax_paid_ytd numeric(14,2) not null default 0 check (mikdamot_income_tax_paid_ytd >= 0),
  mikdamot_bituach_leumi_paid_ytd numeric(14,2) not null default 0 check (mikdamot_bituach_leumi_paid_ytd >= 0),
  vat_paid_ytd numeric(14,2) not null default 0 check (vat_paid_ytd >= 0),
  keren_hishtalmut_deposited_ytd numeric(14,2) not null default 0 check (keren_hishtalmut_deposited_ytd >= 0),
  pension_deposited_ytd numeric(14,2) not null default 0 check (pension_deposited_ytd >= 0),
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  unique (firm_id, tax_year)
);
alter table public.lalum_fin_tax_settings enable row level security;
create policy lalum_fin_tax_settings_read on public.lalum_fin_tax_settings for select using ((select public.lalum_fin_can(firm_id, 1)));
create policy lalum_fin_tax_settings_write on public.lalum_fin_tax_settings for all
  using ((select public.lalum_fin_can(firm_id, 3))) with check ((select public.lalum_fin_can(firm_id, 3)));
revoke all on public.lalum_fin_tax_settings from anon, authenticated;
grant select, insert, update, delete on public.lalum_fin_tax_settings to authenticated;
create trigger lalum_fin_tax_settings_touch before update on public.lalum_fin_tax_settings
  for each row execute function public.lalum_touch_updated_at();

create table if not exists public.lalum_tax_params (
  tax_year     int primary key check (tax_year between 2020 and 2100),
  status       text not null default 'DRAFT' check (status in ('DRAFT','VERIFIED')),
  verified_at  date,
  sources      text[] not null default '{}',
  params       jsonb not null,
  updated_at   timestamptz not null default now(),
  check (status = 'DRAFT' or (verified_at is not null and cardinality(sources) >= 2))
);
alter table public.lalum_tax_params enable row level security;
create policy lalum_tax_params_read on public.lalum_tax_params for select to authenticated using (true);
revoke all on public.lalum_tax_params from anon, authenticated;
grant select on public.lalum_tax_params to authenticated;
