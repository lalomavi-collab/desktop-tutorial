-- Finance: the send record behind "send document to the customer" (edge function lalum-fin-doc-send, and the WhatsApp hand off in the UI).
-- Not applied by this file being merged: apply as "lalum_finance_doc_sends" with the owner's approval.
--
--  * One row per send. EMAIL rows are written by the edge function: RESERVED before the mail goes out (PENDING), then SENT or FAILED.
--    WHATSAPP rows are written by the browser after the partner opens WhatsApp with the message prepared (there is no provider
--    receipt for that path, so SENT means "handed to the partner's WhatsApp", nothing more).
--  * The recipient list and the text are stored with the row: what a customer was sent is a record the firm may need.
--  * Only an ISSUED document can be sent. A double click inside two minutes on the same document, channel and recipient is refused.
--  * Needs finance level 3 to send, level 2 to read the log (the same levels as the documents tab).

create table if not exists public.lalum_fin_doc_sends (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null,
  document_id   uuid not null references public.lalum_fin_documents(id),
  channel       text not null check (channel in ('EMAIL','WHATSAPP')),
  recipient     text not null check (length(recipient) between 1 and 600),
  subject       text check (subject is null or length(subject) <= 200),
  body          text check (body is null or length(body) <= 4000),
  status        text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
  provider_ref  text check (provider_ref is null or length(provider_ref) <= 200),
  error         text check (error is null or length(error) <= 500),
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists lalum_fin_doc_sends_doc_idx on public.lalum_fin_doc_sends (document_id, created_at desc);
create index if not exists lalum_fin_doc_sends_firm_idx on public.lalum_fin_doc_sends (firm_id, created_at desc);

alter table public.lalum_fin_doc_sends enable row level security;
drop policy if exists lalum_fin_doc_sends_read on public.lalum_fin_doc_sends;
create policy lalum_fin_doc_sends_read on public.lalum_fin_doc_sends for select
  using ((select public.lalum_fin_can(firm_id, 2)));
revoke all on public.lalum_fin_doc_sends from anon, authenticated;
grant select on public.lalum_fin_doc_sends to authenticated;
-- No insert or update grant: the only writers are the two functions below.

-- Reserve a send. Returns the row to finish.
create or replace function public.lalum_fin_doc_send_reserve(p_document uuid, p_channel text, p_recipient text, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_status text; v_id uuid;
begin
  select firm_id, status into v_firm, v_status from public.lalum_fin_documents where id = p_document;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'ISSUED' then raise exception 'NOT_ISSUED'; end if;
  if p_channel not in ('EMAIL','WHATSAPP') then raise exception 'BAD_CHANNEL'; end if;
  if length(btrim(coalesce(p_recipient, ''))) = 0 then raise exception 'NO_RECIPIENT'; end if;
  perform pg_advisory_xact_lock(hashtext('lalum_fin_doc_send:' || p_document::text));
  if exists (
    select 1 from public.lalum_fin_doc_sends s
    where s.document_id = p_document and s.channel = p_channel and s.recipient = left(btrim(p_recipient), 600)
      and s.status in ('SENT','PENDING') and s.created_at > now() - interval '2 minutes'
  ) then raise exception 'DUPLICATE_SEND'; end if;
  insert into public.lalum_fin_doc_sends (firm_id, document_id, channel, recipient, subject, body, created_by)
  values (v_firm, p_document, p_channel, left(btrim(p_recipient), 600), left(p_subject, 200), left(p_body, 4000), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_doc_send_reserve(uuid, text, text, text, text) from public, anon;
grant execute on function public.lalum_fin_doc_send_reserve(uuid, text, text, text, text) to authenticated;

-- Close a reserved send.
create or replace function public.lalum_fin_doc_send_finish(p_id uuid, p_ok boolean, p_ref text default null, p_error text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_status text;
begin
  select firm_id, status into v_firm, v_status from public.lalum_fin_doc_sends where id = p_id;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'PENDING' then raise exception 'NOT_PENDING'; end if;
  update public.lalum_fin_doc_sends set status = case when p_ok then 'SENT' else 'FAILED' end,
    provider_ref = left(p_ref, 200), error = case when p_ok then null else left(coalesce(p_error, 'failed'), 500) end
  where id = p_id;
end $$;
revoke execute on function public.lalum_fin_doc_send_finish(uuid, boolean, text, text) from public, anon;
grant execute on function public.lalum_fin_doc_send_finish(uuid, boolean, text, text) to authenticated;
