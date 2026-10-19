-- lalum_trust_post: a REVERSAL must name an entry of the same firm and the same matter. Before this change the
-- reversed entry was looked up by id alone, which would let a user of one firm reverse an entry of another once a
-- second firm exists. Applied to production on 2026-10-19; only the lookup line changed.
create or replace function public.lalum_trust_post(p_matter uuid, p_account uuid, p_type text, p_amount numeric, p_counterparty text default null::text, p_notes text default null::text, p_reverses bigint default null::bigint, p_value_date date default null::date)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_cust uuid; v_signed numeric; v_orig numeric; v_orig_vd date; v_vd date; v_id bigint;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if p_type not in ('DEPOSIT','DISBURSEMENT_TO_THIRD_PARTY','REFUND_TO_CLIENT','REVERSAL') then raise exception 'BAD_TYPE'; end if;
  select fin_customer_id into v_cust from public.lalum_matter_fees where matter_id = p_matter;
  if v_cust is null then raise exception 'MATTER_HAS_NO_CUSTOMER'; end if;
  if p_type = 'REVERSAL' then
    select amount, value_date into v_orig, v_orig_vd from public.lalum_trust_ledger where id = p_reverses and firm_id = v_firm and matter_id = p_matter;
    if v_orig is null then raise exception 'REVERSAL_TARGET_MISSING'; end if;
    v_signed := -v_orig;
    v_vd := v_orig_vd;
  else
    if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;
    v_signed := case when p_type = 'DEPOSIT' then p_amount else -p_amount end;
    v_vd := coalesce(p_value_date, (now() at time zone 'Asia/Jerusalem')::date);
  end if;
  insert into public.lalum_trust_ledger (firm_id, trust_account_id, matter_id, customer_id, tx_type, amount, counterparty, notes, reverses_entry_id, value_date)
    values (v_firm, p_account, p_matter, v_cust, p_type, v_signed, p_counterparty, p_notes, p_reverses, v_vd)
    returning id into v_id;
  return v_id;
end $function$;
