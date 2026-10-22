-- Finance: automatic delivery of an issued document to the customer (e-mail and WhatsApp), written by lalum-fin-issue through lalum-fin-doc-send.
-- Not applied by this file being merged: apply as "lalum_finance_doc_auto_send" with the owner's approval.
--
--  * A send row now says whether it was automatic (auto) or a partner's click. The existing reserve function and the manual panel are unchanged.
--  * lalum_fin_doc_send_reserve_auto is the only reserve the automatic path may use. It differs from the manual one in two ways:
--      * once only: a document that already has a SENT or PENDING row on the channel is never sent automatically again, however much time
--        has passed (the manual guard is a two minute window). A FAILED row does not count, so a failed automatic send can be retried.
--      * WhatsApp needs the customer's recorded, unrevoked consent (migration 0036) and is never sent for a TEST document. The database
--        enforces this on top of the edge function, as it does for collections reminders.
--  * Same access as the manual path: finance level 3, decided with the caller's own JWT.

alter table public.lalum_fin_doc_sends add column if not exists auto boolean not null default false;

create or replace function public.lalum_fin_doc_send_reserve_auto(p_document uuid, p_channel text, p_recipient text, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_status text; v_test boolean; v_customer uuid; v_consent timestamptz; v_revoked timestamptz; v_id uuid;
begin
  select firm_id, status, is_test, customer_id into v_firm, v_status, v_test, v_customer from public.lalum_fin_documents where id = p_document;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'ISSUED' then raise exception 'NOT_ISSUED'; end if;
  if p_channel not in ('EMAIL','WHATSAPP') then raise exception 'BAD_CHANNEL'; end if;
  if length(btrim(coalesce(p_recipient, ''))) = 0 then raise exception 'NO_RECIPIENT'; end if;
  if p_channel = 'WHATSAPP' then
    if v_test then raise exception 'TEST_DOCUMENT'; end if;
    select whatsapp_consent_at, whatsapp_consent_revoked_at into v_consent, v_revoked from public.lalum_fin_customers where id = v_customer and firm_id = v_firm;
    if v_consent is null or v_revoked is not null then raise exception 'NO_WHATSAPP_CONSENT'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('lalum_fin_doc_send:' || p_document::text));
  if exists (select 1 from public.lalum_fin_doc_sends s where s.document_id = p_document and s.channel = p_channel and s.status in ('SENT','PENDING')) then
    raise exception 'ALREADY_SENT';
  end if;
  insert into public.lalum_fin_doc_sends (firm_id, document_id, channel, recipient, subject, body, created_by, auto)
  values (v_firm, p_document, p_channel, left(btrim(p_recipient), 600), left(p_subject, 200), left(p_body, 4000), auth.uid(), true)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_doc_send_reserve_auto(uuid, text, text, text, text) from public, anon;
grant execute on function public.lalum_fin_doc_send_reserve_auto(uuid, text, text, text, text) to authenticated;
