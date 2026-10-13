-- Finance infrastructure for more than one business and for a direct connection to the Tax Authority (owner approved
-- 2026-10-13). Nothing here is applied automatically to a business: the rows are seeded per firm, and the code falls back
-- to its built-in constants when a firm has no row yet.
--
-- 1. lalum_fin_business_profile: who the issuing business is (entity type, business number, legal name, software
--    registration number, which is null while there is no registration certificate).
-- 2. lalum_fin_business_addresses: dated addresses of two kinds. FINANCE is the real office, used in the compliance file
--    and internally. PUBLIC is the official address shown to clients on issued documents. They are different on purpose.
-- 3. lalum_tax_connections: one row per firm and environment for the Tax Authority allocation connection. Secrets are never
--    stored here: client_secret and the refresh token live in Supabase Vault, and this table holds only the Vault ids. The
--    client roles cannot read those two columns at all.
-- 4. lalum_tax_api_log: every request to the Tax Authority, kept 12 months as the Authority's information security annex
--    requires. Written by the service role only.

create or replace function public.lalum_il_id_ok(p text) returns boolean
language sql immutable set search_path to 'public' as $$
  select p ~ '^\d{9}$' and (
    select sum(case when d >= 10 then d - 9 else d end) % 10 = 0
    from (select (substr(p, i, 1)::int * (case when i % 2 = 1 then 1 else 2 end)) as d from generate_series(1, 9) i) t
  ) $$;

create table if not exists public.lalum_fin_business_profile (
  firm_id             uuid primary key references public.lalum_firms(id) on delete cascade,
  entity_type         text not null check (entity_type in ('INDIVIDUAL', 'COMPANY')),
  tax_id              text not null check (public.lalum_il_id_ok(tax_id)),
  legal_name          text not null,
  software_reg_number text,
  updated_by          uuid,
  updated_at          timestamptz not null default now()
);

create table if not exists public.lalum_fin_business_addresses (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  kind       text not null check (kind in ('FINANCE', 'PUBLIC')),
  valid_from date not null,
  street     text not null,
  house_num  text not null,
  city       text not null,
  zip        text not null default '',
  unique (firm_id, kind, valid_from)
);

create table if not exists public.lalum_tax_connections (
  firm_id                uuid not null references public.lalum_firms(id) on delete cascade,
  environment            text not null check (environment in ('sandbox', 'production')),
  client_id              text,
  client_secret_vault_id uuid,
  refresh_token_vault_id uuid,
  status                 text not null default 'NOT_CONNECTED' check (status in ('NOT_CONNECTED', 'PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED')),
  authorized_at          timestamptz,
  expires_at             date,
  last_error             text,
  updated_at             timestamptz not null default now(),
  primary key (firm_id, environment)
);

create table if not exists public.lalum_tax_api_log (
  id          bigint generated always as identity primary key,
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  at          timestamptz not null default now(),
  environment text not null,
  operation   text not null,
  invoice_ref text,
  http_status integer,
  outcome     text not null,
  detail      text
);
create index if not exists lalum_tax_api_log_firm_at on public.lalum_tax_api_log (firm_id, at desc);

alter table public.lalum_fin_business_profile   enable row level security;
alter table public.lalum_fin_business_addresses enable row level security;
alter table public.lalum_tax_connections        enable row level security;
alter table public.lalum_tax_api_log            enable row level security;

revoke all on public.lalum_fin_business_profile, public.lalum_fin_business_addresses,
              public.lalum_tax_connections, public.lalum_tax_api_log from anon, authenticated;
grant select on public.lalum_fin_business_profile, public.lalum_fin_business_addresses to authenticated;
-- the Vault ids and the raw error text stay server side
grant select (firm_id, environment, client_id, status, authorized_at, expires_at, updated_at) on public.lalum_tax_connections to authenticated;
grant select on public.lalum_tax_api_log to authenticated;

create policy lalum_fin_business_profile_read on public.lalum_fin_business_profile for select
  using ((select public.lalum_fin_can(firm_id, 1)));
create policy lalum_fin_business_addresses_read on public.lalum_fin_business_addresses for select
  using ((select public.lalum_fin_can(firm_id, 1)));
create policy lalum_tax_connections_read on public.lalum_tax_connections for select
  using ((select public.lalum_fin_can(firm_id)));
create policy lalum_tax_api_log_read on public.lalum_tax_api_log for select
  using ((select public.lalum_fin_can(firm_id)));

-- Changes go through these functions only (admin level), and are written to the audit chain.
create or replace function public.lalum_fin_set_business_profile(
  p_firm uuid, p_entity text, p_tax_id text, p_name text, p_software_reg text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.lalum_fin_can(p_firm) then raise exception 'not allowed'; end if;
  insert into public.lalum_fin_business_profile (firm_id, entity_type, tax_id, legal_name, software_reg_number, updated_by, updated_at)
    values (p_firm, p_entity, p_tax_id, p_name, nullif(trim(coalesce(p_software_reg, '')), ''), auth.uid(), now())
  on conflict (firm_id) do update set entity_type = excluded.entity_type, tax_id = excluded.tax_id,
    legal_name = excluded.legal_name, software_reg_number = excluded.software_reg_number,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'FIN_BUSINESS_PROFILE_SET', null, jsonb_build_object('entity', p_entity));
end $$;
revoke execute on function public.lalum_fin_set_business_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.lalum_fin_set_business_profile(uuid, text, text, text, text) to authenticated;

create or replace function public.lalum_fin_set_business_address(
  p_firm uuid, p_kind text, p_valid_from date, p_street text, p_house text, p_city text, p_zip text default '') returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.lalum_fin_can(p_firm) then raise exception 'not allowed'; end if;
  insert into public.lalum_fin_business_addresses (firm_id, kind, valid_from, street, house_num, city, zip)
    values (p_firm, p_kind, p_valid_from, p_street, p_house, p_city, coalesce(p_zip, ''))
  on conflict (firm_id, kind, valid_from) do update set street = excluded.street, house_num = excluded.house_num,
    city = excluded.city, zip = excluded.zip;
  perform public.lalum_append_audit(p_firm, null, auth.uid(), 'FIN_BUSINESS_ADDRESS_SET', null,
    jsonb_build_object('kind', p_kind, 'valid_from', p_valid_from));
end $$;
revoke execute on function public.lalum_fin_set_business_address(uuid, text, date, text, text, text, text) from public, anon;
grant execute on function public.lalum_fin_set_business_address(uuid, text, date, text, text, text, text) to authenticated;
