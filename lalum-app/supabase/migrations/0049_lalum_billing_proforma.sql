-- 0049: billing on the CASH basis. Replaces the held accrual draft (supabase/held/0021b, now removed).
-- The firm bills with a PRO FORMA (a demand for payment). Revenue is recognised when money is received,
-- which is the INVOICE_RECEIPT issued from the pro forma (source_proforma_id, migration 0025). So:
--   * drafts made from WIP or from a milestone are PROFORMA, never INVOICE;
--   * issuing the pro forma locks the reserved WIP; a pro forma voided through a credit can release it;
--   * collection is the INVOICE_RECEIPT itself, so there is NO payment RPC and NO forecast write here.
--     That removes the double count the accrual draft had (payments table plus forecast actuals).
--   * the trust settlement RPC is not included: the firm holds no client trust funds.
-- Requires 0021_lalum_billing_wip.sql. Apply 0049 only after reviewing against the live database.

-- ───────────────────────── drafts (pro forma) ─────────────────────────

create or replace function public.lalum_billing_draft_from_wip(
  p_matter uuid, p_to_date date default current_date, p_vat_rate numeric default null,
  p_allow_over_cap boolean default false, p_subject text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_matter_firm(p_matter); f record; v_lines jsonb := '[]'::jsonb; v_doc uuid;
  v_entry_ids uuid[]; v_disb_ids uuid[]; v_norate integer; v_fees numeric := 0; v_disb numeric := 0; v_cap_used numeric; r record;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  select * into f from public.lalum_matter_fees where matter_id = p_matter;
  if not found or f.fin_customer_id is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if not f.billing_active then raise exception 'BILLING_NOT_ACTIVE'; end if;
  if f.fee_model not in ('hourly','capped','hybrid') then raise exception 'FEE_MODEL_NOT_TIME_BASED'; end if;

  select count(*) into v_norate from public.lalum_time_entries te
   where te.matter_id = p_matter and te.status = 'approved' and te.invoice_doc_id is null and te.work_date <= p_to_date and te.billable_minutes > 0
     and coalesce(public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date), 0) <= 0;
  if v_norate > 0 then raise exception 'ENTRIES_WITHOUT_RATE: %', v_norate; end if;

  for r in
    select x.rate, coalesce(fm.name, 'עורך דין') as keeper, sum(x.billable_minutes) as mins, array_agg(x.id) as ids
      from (select te.id, te.billable_minutes, te.timekeeper_id,
                   public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date) as rate
              from public.lalum_time_entries te
             where te.matter_id = p_matter and te.status = 'approved' and te.invoice_doc_id is null
               and te.work_date <= p_to_date and te.billable_minutes > 0) x
      left join public.lalum_firm_members fm on fm.user_id = x.timekeeper_id
     group by x.rate, fm.name order by fm.name
  loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'name', left('שכר טרחה, ' || r.keeper || ', ' || round(r.mins / 60.0, 2)::text || ' שעות', 200),
      'qty', round(r.mins / 60.0, 4), 'price', r.rate));
    v_fees := v_fees + round(r.mins / 60.0 * r.rate, 2);
    v_entry_ids := coalesce(v_entry_ids, '{}') || r.ids;
  end loop;

  for r in
    select expense_type, sum(amount) as total, array_agg(id) as ids from public.lalum_disbursements
     where matter_id = p_matter and status = 'UNBILLED' and is_reimbursable and invoice_doc_id is null and incurred_date <= p_to_date
     group by expense_type order by expense_type
  loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'name', left('הוצאות: ' || case r.expense_type when 'COURT_FEE' then 'אגרות בית משפט' when 'EXPERT_WITNESS' then 'עדי מומחה'
                   when 'COURIER' then 'שליחויות' when 'PHOTOCOPY' then 'צילומים' else 'אחר' end, 200),
      'qty', 1, 'price', r.total));
    v_disb := v_disb + r.total;
    v_disb_ids := coalesce(v_disb_ids, '{}') || r.ids;
  end loop;

  if jsonb_array_length(v_lines) = 0 then raise exception 'NOTHING_TO_BILL'; end if;

  if f.fee_model = 'capped' and f.fee_cap is not null and not p_allow_over_cap then
    select coalesce(sum(te.billable_minutes / 60.0 * coalesce(public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date), 0)), 0)
      into v_cap_used from public.lalum_time_entries te
     where te.matter_id = p_matter and (te.status = 'billed' or (te.status = 'approved' and te.invoice_doc_id is not null));
    if v_cap_used + v_fees > f.fee_cap then raise exception 'EXCEEDS_CAP: cap %, would reach %', f.fee_cap, v_cap_used + v_fees; end if;
  end if;

  v_doc := public.lalum_fin_save_draft(null, jsonb_build_object(
    'customer_id', f.fin_customer_id, 'doc_type', 'PROFORMA', 'subject', coalesce(p_subject, ''),
    'tax_included', false, 'vat_rate', coalesce(p_vat_rate, 18), 'lines', v_lines));

  if v_entry_ids is not null then update public.lalum_time_entries set invoice_doc_id = v_doc where id = any(v_entry_ids); end if;
  if v_disb_ids is not null then update public.lalum_disbursements set invoice_doc_id = v_doc where id = any(v_disb_ids); end if;
  insert into public.lalum_fin_document_matters (document_id, matter_id, firm_id, amount) values (v_doc, p_matter, v_firm, round(v_fees + v_disb, 2));

  return jsonb_build_object('document_id', v_doc, 'fees', round(v_fees, 2), 'disbursements', round(v_disb, 2),
    'time_entries', coalesce(array_length(v_entry_ids, 1), 0), 'disbursement_rows', coalesce(array_length(v_disb_ids, 1), 0));
end $$;
revoke execute on function public.lalum_billing_draft_from_wip(uuid, date, numeric, boolean, text) from public, anon;
grant execute on function public.lalum_billing_draft_from_wip(uuid, date, numeric, boolean, text) to authenticated;

create or replace function public.lalum_billing_draft_from_milestone(p_milestone uuid, p_vat_rate numeric default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare m record; f record; v_doc uuid;
begin
  select * into m from public.lalum_milestones where id = p_milestone;
  if not found or not public.lalum_fin_can(m.firm_id) then raise exception 'FORBIDDEN'; end if;
  if m.achieved_at is null then raise exception 'MILESTONE_NOT_ACHIEVED'; end if;
  if m.fin_document_id is not null then raise exception 'MILESTONE_ALREADY_BILLED'; end if;
  select * into f from public.lalum_matter_fees where matter_id = m.matter_id;
  if not found or f.fin_customer_id is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if not f.billing_active then raise exception 'BILLING_NOT_ACTIVE'; end if;
  if m.amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  v_doc := public.lalum_fin_save_draft(null, jsonb_build_object(
    'customer_id', f.fin_customer_id, 'doc_type', 'PROFORMA', 'subject', m.name, 'tax_included', false,
    'vat_rate', coalesce(p_vat_rate, 18), 'lines', jsonb_build_array(jsonb_build_object('name', left(m.name, 200), 'qty', 1, 'price', m.amount))));
  update public.lalum_milestones set fin_document_id = v_doc where id = p_milestone;
  insert into public.lalum_fin_document_matters (document_id, matter_id, firm_id, amount) values (v_doc, m.matter_id, m.firm_id, m.amount);
  return jsonb_build_object('document_id', v_doc, 'amount', m.amount);
end $$;
revoke execute on function public.lalum_billing_draft_from_milestone(uuid, numeric) from public, anon;
grant execute on function public.lalum_billing_draft_from_milestone(uuid, numeric) to authenticated;

-- ───────────────────────── lock when the pro forma is issued ─────────────────────────

create or replace function public.lalum_billing_on_issue() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.doc_type = 'PROFORMA' and new.status = 'ISSUED' and old.status is distinct from 'ISSUED' then
    update public.lalum_time_entries set status = 'billed' where invoice_doc_id = new.id and status = 'approved';
    update public.lalum_disbursements set status = 'BILLED' where invoice_doc_id = new.id and status = 'UNBILLED';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_billing_on_issue() from public, anon, authenticated;
create or replace trigger lalum_billing_on_issue_t after update on public.lalum_fin_documents
  for each row execute function public.lalum_billing_on_issue();

-- ───────────────────────── guards ─────────────────────────

-- The release bypass below is keyed on a transaction-local setting that only lalum_billing_release_wip
-- sets. PostgREST exposes only functions in public, set_config is not among them, and each request is one
-- statement, so an end user cannot set it. Reviewed; the setting also has to equal the row id.
create or replace function public.lalum_time_entries_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_partner boolean := public.lalum_fin_can(coalesce(new.firm_id, old.firm_id));
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if current_setting('lalum.wip_release', true) = coalesce(old.id::text, '') and tg_op = 'UPDATE' then
    new.updated_at := now();
    return new;
  end if;
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

create or replace function public.lalum_disbursements_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status <> 'UNBILLED' then raise exception 'DISBURSEMENT_LOCKED'; end if;
    return old;
  end if;
  if old.status <> 'UNBILLED' and old.invoice_doc_id is not null and new.status = 'UNBILLED' and new.invoice_doc_id is null then
    return new;
  end if;
  if old.status <> 'UNBILLED' and (new.amount is distinct from old.amount or new.matter_id is distinct from old.matter_id
     or new.expense_type is distinct from old.expense_type or new.invoice_doc_id is distinct from old.invoice_doc_id) then
    raise exception 'DISBURSEMENT_LOCKED';
  end if;
  return new;
end $$;

-- ───────────────────────── release after the pro forma is voided ─────────────────────────

-- Only for a pro forma that was voided through a credit (lalum_fin_void_document sets status VOID).
-- p_action: 'release' puts the work back into WIP, 'write_off' closes it as lost.
create or replace function public.lalum_billing_release_wip(p_doc uuid, p_action text) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare d record; r record; n integer := 0;
begin
  select * into d from public.lalum_fin_documents where id = p_doc;
  if not found or not public.lalum_fin_can(d.firm_id) then raise exception 'FORBIDDEN'; end if;
  if p_action not in ('release','write_off') then raise exception 'BAD_ACTION'; end if;
  if d.doc_type <> 'PROFORMA' or d.status <> 'VOID' then raise exception 'NOT_A_VOIDED_PROFORMA'; end if;
  for r in select id from public.lalum_time_entries where invoice_doc_id = p_doc and status = 'billed' loop
    perform set_config('lalum.wip_release', r.id::text, true);
    if p_action = 'release' then
      update public.lalum_time_entries set status = 'approved', invoice_doc_id = null where id = r.id;
    else
      update public.lalum_time_entries set status = 'written_off' where id = r.id;
    end if;
    n := n + 1;
  end loop;
  perform set_config('lalum.wip_release', '', true);
  if p_action = 'release' then
    update public.lalum_disbursements set status = 'UNBILLED', invoice_doc_id = null where invoice_doc_id = p_doc and status = 'BILLED';
  end if;
  perform public.lalum_audit_write(d.firm_id, 'WIP_' || upper(p_action), 'lalum_fin_documents', p_doc::text, jsonb_build_object('entries', n));
  return n;
end $$;
revoke execute on function public.lalum_billing_release_wip(uuid, text) from public, anon;
grant execute on function public.lalum_billing_release_wip(uuid, text) to authenticated;
