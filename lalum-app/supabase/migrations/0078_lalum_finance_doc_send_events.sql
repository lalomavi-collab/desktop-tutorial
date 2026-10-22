-- Finance: delivery and open status for sent documents, and sending from the history archive.
-- Builds on 0077 (lalum_fin_doc_sends and its two writer functions). Not applied by this file being merged: apply as
-- "lalum_finance_doc_send_events" with the owner's approval. Apply the statements one at a time if the combined call times out.
--
--  * A row may now point at an archive document (history imported from the provider) instead of a ledger document. Exactly one of the two.
--  * The mail provider reports what happened to a message (delivered, bounced, complained, opened) to the edge function
--    lalum-fin-doc-send-webhook, which calls lalum_fin_doc_send_event with the service role. The event is matched on provider_ref.
--  * An open is a weak signal: it comes from a tracking image, so a mail client that blocks images never reports one, and a client that loads
--    images in advance reports one nobody made. The screen therefore shows "opened" when it is known and never shows "not opened".

alter table public.lalum_fin_doc_sends alter column document_id drop not null;
alter table public.lalum_fin_doc_sends add column if not exists archive_id uuid references public.lalum_fin_archive(id);
alter table public.lalum_fin_doc_sends add column if not exists delivered_at timestamptz;
alter table public.lalum_fin_doc_sends add column if not exists opened_at timestamptz;
alter table public.lalum_fin_doc_sends add column if not exists bounced_at timestamptz;
alter table public.lalum_fin_doc_sends add column if not exists complained_at timestamptz;
alter table public.lalum_fin_doc_sends add column if not exists last_event text check (last_event is null or length(last_event) <= 40);
alter table public.lalum_fin_doc_sends add column if not exists last_event_at timestamptz;
alter table public.lalum_fin_doc_sends add constraint lalum_fin_doc_sends_one_target check ((document_id is not null) <> (archive_id is not null));

create index if not exists lalum_fin_doc_sends_archive_idx on public.lalum_fin_doc_sends (archive_id, created_at desc) where archive_id is not null;
create index if not exists lalum_fin_doc_sends_ref_idx on public.lalum_fin_doc_sends (provider_ref) where provider_ref is not null;

-- Reserve a send of an archive document. Same rules as lalum_fin_doc_send_reserve; an archive document has no draft or test state.
create or replace function public.lalum_fin_doc_send_reserve_archive(p_archive uuid, p_channel text, p_recipient text, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_id uuid;
begin
  select firm_id into v_firm from public.lalum_fin_archive where id = p_archive;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_channel not in ('EMAIL','WHATSAPP') then raise exception 'BAD_CHANNEL'; end if;
  if length(btrim(coalesce(p_recipient, ''))) = 0 then raise exception 'NO_RECIPIENT'; end if;
  perform pg_advisory_xact_lock(hashtext('lalum_fin_doc_send:' || p_archive::text));
  if exists (
    select 1 from public.lalum_fin_doc_sends s
    where s.archive_id = p_archive and s.channel = p_channel and s.recipient = left(btrim(p_recipient), 600)
      and s.status in ('SENT','PENDING') and s.created_at > now() - interval '2 minutes'
  ) then raise exception 'DUPLICATE_SEND'; end if;
  insert into public.lalum_fin_doc_sends (firm_id, archive_id, channel, recipient, subject, body, created_by)
  values (v_firm, p_archive, p_channel, left(btrim(p_recipient), 600), left(p_subject, 200), left(p_body, 4000), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_doc_send_reserve_archive(uuid, text, text, text, text) from public, anon;
grant execute on function public.lalum_fin_doc_send_reserve_archive(uuid, text, text, text, text) to authenticated;

-- Record a mail provider event against the send it belongs to. Service role only: the webhook verifies the provider's signature first.
-- Events can arrive out of order or twice, so each kind keeps its first time and last_event only moves forward.
create or replace function public.lalum_fin_doc_send_event(p_ref text, p_event text, p_at timestamptz)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n integer;
begin
  if p_ref is null or length(p_ref) = 0 or p_event not in ('email.delivered','email.opened','email.bounced','email.complained') then return 0; end if;
  update public.lalum_fin_doc_sends set
    delivered_at  = case when p_event = 'email.delivered'  then coalesce(delivered_at,  p_at) else delivered_at  end,
    opened_at     = case when p_event = 'email.opened'     then coalesce(opened_at,     p_at) else opened_at     end,
    bounced_at    = case when p_event = 'email.bounced'    then coalesce(bounced_at,    p_at) else bounced_at    end,
    complained_at = case when p_event = 'email.complained' then coalesce(complained_at, p_at) else complained_at end,
    last_event    = case when last_event_at is null or p_at >= last_event_at then p_event else last_event end,
    last_event_at = case when last_event_at is null or p_at >= last_event_at then p_at    else last_event_at end
  where provider_ref = p_ref and channel = 'EMAIL';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.lalum_fin_doc_send_event(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.lalum_fin_doc_send_event(text, text, timestamptz) to service_role;
