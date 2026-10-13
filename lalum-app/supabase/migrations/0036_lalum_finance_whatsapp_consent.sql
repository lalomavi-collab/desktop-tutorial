-- Finance: the customer's consent to WhatsApp messages from the firm, and the block on sending without it.
-- Applied to project meoymkcotomoluwlwues as "lalum_finance_whatsapp_consent". Builds on 0035 (lalum_fin_dunning_reserve).
--
--  * Meta requires that a customer agreed to receive messages from the business on WhatsApp. The ledger had no place to record that, and
--    the sender did not check it. This adds the record and makes the database refuse to reserve a WhatsApp send without it.
--  * Consent is a partner's statement about the customer, with the basis for it (a fee agreement, a written message, a spoken yes noted
--    in the file, or a consent form). It is recorded with who stated it and when. Withdrawing keeps the history and ends the consent.
--  * A manual log of a reminder sent outside the system (lalum_fin_log_reminder) is not blocked: it records what already happened.
--  * E-mail is not covered by this rule.

alter table public.lalum_fin_customers
  add column if not exists whatsapp_consent_at         timestamptz,
  add column if not exists whatsapp_consent_basis      text check (whatsapp_consent_basis is null or whatsapp_consent_basis in ('AGREEMENT','WRITTEN','VERBAL','FORM')),
  add column if not exists whatsapp_consent_by         uuid,
  add column if not exists whatsapp_consent_note       text check (whatsapp_consent_note is null or length(whatsapp_consent_note) <= 300),
  add column if not exists whatsapp_consent_revoked_at timestamptz;

-- Record or withdraw the consent.
create or replace function public.lalum_fin_set_whatsapp_consent(p_customer uuid, p_given boolean, p_basis text default null, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_at timestamptz;
begin
  select firm_id, whatsapp_consent_at into v_firm, v_at from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_given then
    if p_basis is null or p_basis not in ('AGREEMENT','WRITTEN','VERBAL','FORM') then raise exception 'BAD_BASIS'; end if;
    update public.lalum_fin_customers set whatsapp_consent_at = now(), whatsapp_consent_basis = p_basis, whatsapp_consent_by = auth.uid(),
      whatsapp_consent_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''), whatsapp_consent_revoked_at = null where id = p_customer;
  else
    if v_at is null then raise exception 'NO_CONSENT'; end if;
    update public.lalum_fin_customers set whatsapp_consent_revoked_at = now() where id = p_customer;
  end if;
end $$;
revoke execute on function public.lalum_fin_set_whatsapp_consent(uuid, boolean, text, text) from public, anon;
grant execute on function public.lalum_fin_set_whatsapp_consent(uuid, boolean, text, text) to authenticated;

-- The reservation (0035) now refuses a WhatsApp send to a customer without an active consent.
create or replace function public.lalum_fin_dunning_reserve(p_customer uuid, p_tier int, p_channel text, p_recipient text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_today date := (now() at time zone 'Asia/Jerusalem')::date; v_id uuid; v_cons timestamptz; v_rev timestamptz;
begin
  select firm_id, whatsapp_consent_at, whatsapp_consent_revoked_at into v_firm, v_cons, v_rev from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_tier not between 1 and 3 then raise exception 'BAD_TIER'; end if;
  if p_channel not in ('EMAIL','WHATSAPP') then raise exception 'BAD_CHANNEL'; end if;
  if p_channel = 'WHATSAPP' and (v_cons is null or v_rev is not null) then raise exception 'NO_WHATSAPP_CONSENT'; end if;
  if length(btrim(coalesce(p_recipient, ''))) = 0 then raise exception 'NO_RECIPIENT'; end if;
  perform pg_advisory_xact_lock(hashtext('lalum_fin_dunning:' || p_customer::text));
  if public.lalum_fin_dunning_blocked(p_customer) then raise exception 'COOLDOWN_ACTIVE'; end if;
  update public.lalum_fin_dunning_log set status = 'PENDING', channel = p_channel, created_by = auth.uid(), created_at = now(),
    recipient = left(btrim(p_recipient), 254), body = left(p_body, 4000), provider_ref = null, error = null
   where customer_id = p_customer and tier = p_tier and sent_on = v_today
     and (status = 'FAILED' or (status = 'PENDING' and created_at <= now() - interval '10 minutes'))
  returning id into v_id;
  if v_id is null then
    insert into public.lalum_fin_dunning_log (firm_id, customer_id, tier, channel, sent_on, created_by, status, recipient, body)
    values (v_firm, p_customer, p_tier, p_channel, v_today, auth.uid(), 'PENDING', left(btrim(p_recipient), 254), left(p_body, 4000))
    returning id into v_id;
  end if;
  return v_id;
end $$;
