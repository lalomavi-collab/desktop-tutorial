-- KYC control records for the case cockpit.
-- Design boundary: the server stores NO identifying data here. A record is a structured
-- checklist: enumerations, yes/no answers and dates, with no free text, no names and no
-- identifiers. The identifying details themselves stay in the firm's own file, consistent with
-- the PII shield. Writes go only through lalum_kyc_save; completion is validated server side
-- and written to the audit chain (enums only).
-- Applied to project meoymkcotomoluwlwues as migrations "lalum_kyc_records*".

create table if not exists public.lalum_kyc_records (
  id                           uuid primary key default gen_random_uuid(),
  firm_id                      uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id                    uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  party_no                     int  not null check (party_no between 1 and 20),
  party_role                   text not null default 'CLIENT' check (party_role in ('CLIENT','REPRESENTATIVE','BENEFICIAL_OWNER')),
  subject_kind                 text not null default 'INDIVIDUAL' check (subject_kind in ('INDIVIDUAL','COMPANY')),
  service_track                text not null default 'REGULAR' check (service_track in ('REGULAR','BUSINESS_SERVICE')),
  id_verified                  boolean,
  id_method                    text check (id_method in ('IN_PERSON','REMOTE','THIRD_PARTY')),
  registry_checked             boolean,
  signatory_verified           boolean,
  beneficial_owner_identified  boolean,
  source_of_funds              text check (source_of_funds in ('SALARY','BUSINESS_INCOME','PROPERTY_SALE','SAVINGS','INHERITANCE_GIFT','LOAN','OTHER','NOT_APPLICABLE')),
  source_documented            boolean,
  pep                          text check (pep in ('NO','YES','REVIEW')),
  sanctions_screened           boolean,
  risk                         text check (risk in ('LOW','MEDIUM','HIGH')),
  status                       text not null default 'DRAFT' check (status in ('DRAFT','COMPLETE')),
  completed_by                 uuid,
  completed_at                 timestamptz,
  next_review_on               date,
  created_by                   uuid,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  unique (matter_id, party_no)
);
create index if not exists lalum_kyc_records_matter_idx on public.lalum_kyc_records (matter_id);

alter table public.lalum_kyc_records enable row level security;
create policy lalum_kyc_records_read on public.lalum_kyc_records for select
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()));
revoke all on public.lalum_kyc_records from anon, authenticated;
grant select on public.lalum_kyc_records to authenticated;

create trigger lalum_kyc_records_touch before update on public.lalum_kyc_records
  for each row execute function public.lalum_touch_updated_at();
create trigger lalum_kyc_records_legal_hold before delete on public.lalum_kyc_records
  for each row execute function public.lalum_guard_legal_hold();

-- Which answers are still missing for completion. Single source of truth, used by the save RPC.
create or replace function public.lalum_kyc_missing(r public.lalum_kyc_records) returns text[]
language sql immutable set search_path to 'public' as $$
  select array_remove(array[
    case when r.id_verified is not true then 'id_verified' end,
    case when r.id_method is null then 'id_method' end,
    case when r.subject_kind = 'COMPANY' and r.registry_checked is not true then 'registry_checked' end,
    case when r.subject_kind = 'COMPANY' and r.signatory_verified is not true then 'signatory_verified' end,
    case when r.subject_kind = 'COMPANY' and r.beneficial_owner_identified is not true then 'beneficial_owner_identified' end,
    case when r.source_of_funds is null then 'source_of_funds' end,
    case when r.source_of_funds is not null and r.source_of_funds <> 'NOT_APPLICABLE' and r.source_documented is null then 'source_documented' end,
    case when r.pep is null then 'pep' end,
    case when r.sanctions_screened is not true then 'sanctions_screened' end,
    case when r.risk is null then 'risk' end
  ], null) $$;
revoke execute on function public.lalum_kyc_missing(public.lalum_kyc_records) from public, anon, authenticated;

create or replace function public.lalum_kyc_save(p_matter uuid, p_party_no int, p jsonb, p_complete boolean default false) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_role text := public.lalum_my_role();
  r public.lalum_kyc_records;
  v_missing text[];
  v_was text;
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  if v_role not in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER') then raise exception 'not allowed for this role'; end if;
  if not exists (select 1 from public.lalum_cockpit_matters where id = p_matter and firm_id = v_firm) then raise exception 'matter not found'; end if;

  select * into r from public.lalum_kyc_records where matter_id = p_matter and party_no = p_party_no;
  v_was := r.status;
  if r.id is null then
    insert into public.lalum_kyc_records (firm_id, matter_id, party_no, created_by) values (v_firm, p_matter, p_party_no, auth.uid()) returning * into r;
  end if;

  update public.lalum_kyc_records set
    party_role = coalesce(p->>'party_role', party_role),
    subject_kind = coalesce(p->>'subject_kind', subject_kind),
    service_track = coalesce(p->>'service_track', service_track),
    id_verified = case when p ? 'id_verified' then (p->>'id_verified')::boolean else id_verified end,
    id_method = case when p ? 'id_method' then nullif(p->>'id_method','') else id_method end,
    registry_checked = case when p ? 'registry_checked' then (p->>'registry_checked')::boolean else registry_checked end,
    signatory_verified = case when p ? 'signatory_verified' then (p->>'signatory_verified')::boolean else signatory_verified end,
    beneficial_owner_identified = case when p ? 'beneficial_owner_identified' then (p->>'beneficial_owner_identified')::boolean else beneficial_owner_identified end,
    source_of_funds = case when p ? 'source_of_funds' then nullif(p->>'source_of_funds','') else source_of_funds end,
    source_documented = case when p ? 'source_documented' then (p->>'source_documented')::boolean else source_documented end,
    pep = case when p ? 'pep' then nullif(p->>'pep','') else pep end,
    sanctions_screened = case when p ? 'sanctions_screened' then (p->>'sanctions_screened')::boolean else sanctions_screened end,
    risk = case when p ? 'risk' then nullif(p->>'risk','') else risk end,
    next_review_on = case when p ? 'next_review_on' then nullif(p->>'next_review_on','')::date else next_review_on end,
    status = 'DRAFT', completed_by = null, completed_at = null
  where id = r.id returning * into r;

  v_missing := public.lalum_kyc_missing(r);
  if p_complete and cardinality(v_missing) = 0 then
    if (r.risk = 'HIGH' or r.pep = 'YES') and v_role <> 'FIRM_PARTNER' then
      return jsonb_build_object('status', 'DRAFT', 'missing', '[]'::jsonb, 'needs_partner', true);
    end if;
    update public.lalum_kyc_records set status = 'COMPLETE', completed_by = auth.uid(), completed_at = now() where id = r.id returning * into r;
    perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'KYC_COMPLETED', '',
      jsonb_build_object('party_no', r.party_no, 'track', r.service_track, 'risk', r.risk, 'pep', r.pep, 'subject', r.subject_kind));
  elsif v_was = 'COMPLETE' then
    perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'KYC_REOPENED', '', jsonb_build_object('party_no', r.party_no));
  end if;
  return jsonb_build_object('status', r.status, 'missing', to_jsonb(v_missing), 'needs_partner', false);
end $$;
revoke execute on function public.lalum_kyc_save(uuid, int, jsonb, boolean) from public, anon;
grant execute on function public.lalum_kyc_save(uuid, int, jsonb, boolean) to authenticated;
