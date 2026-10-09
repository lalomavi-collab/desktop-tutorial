-- Client signing through the portal (ordinary electronic signature).
-- A firm prepares a document for a client to sign; the client, logged into the
-- portal, reviews the text and signs it with a typed name and explicit consent.
-- This is the one client-facing place that holds the real text a client sees, a
-- deliberate, tightly scoped exception to the masking design: the content is
-- firm-authored (the firm chooses what it sends) and readable only by the firm
-- that created it and the single client it is addressed to. The signed version
-- is pinned by content_sha256 so a later edit cannot change what was signed.
-- The client and the firm are otherwise separate worlds that share only the
-- login email, so a sent request reaches the client by matching that email, and
-- signing happens only through lalum_portal_sign, so a client can set the
-- signing fields and nothing else.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_signature_requests".

create table if not exists public.lalum_signature_requests (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id          uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  document_id        uuid references public.lalum_matter_documents(id) on delete set null,
  title              text not null default '',
  content            text not null default '',
  content_sha256     text not null default '',
  signer_name        text not null default '',
  signer_email       text not null default '',
  status             text not null default 'DRAFT'
                       check (status in ('DRAFT','SENT','VIEWED','SIGNED','DECLINED','CANCELLED')),
  sent_at            timestamptz,
  viewed_at          timestamptz,
  signed_at          timestamptz,
  declined_at        timestamptz,
  signed_name        text,
  signed_consent     boolean not null default false,
  signed_user_agent  text,
  decline_reason     text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists lalum_signature_requests_matter_idx on public.lalum_signature_requests (matter_id);
create index if not exists lalum_signature_requests_signer_idx on public.lalum_signature_requests (lower(signer_email), status);

alter table public.lalum_signature_requests enable row level security;

-- Firm side: partners, attorneys and admins of the owning firm, with fresh MFA.
create policy lalum_sig_firm_read on public.lalum_signature_requests for select
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())
    and (select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']));
create policy lalum_sig_firm_insert on public.lalum_signature_requests for insert
  with check (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())
    and (select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']));
create policy lalum_sig_firm_update on public.lalum_signature_requests for update
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())
    and (select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']))
  with check (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())
    and (select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN']));
create policy lalum_sig_firm_delete on public.lalum_signature_requests for delete
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())
    and (select public.lalum_my_role()) = any (array['FIRM_PARTNER','ATTORNEY','ADMIN'])
    and status = 'DRAFT');

-- Client side: the signer reads only requests addressed to their login email,
-- and only once they have been sent. No direct write grant; signing is an RPC.
create policy lalum_sig_client_read on public.lalum_signature_requests for select
  using (status <> 'DRAFT' and lower(signer_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

revoke all on public.lalum_signature_requests from anon, authenticated;
grant select, insert, update, delete on public.lalum_signature_requests to authenticated;

create trigger lalum_signature_requests_touch before update on public.lalum_signature_requests
  for each row execute function public.lalum_touch_updated_at();

-- Firm action: send a prepared request to the client. Pins the content hash and
-- stamps the audit chain.
create or replace function public.lalum_signature_send(p_request uuid)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare r public.lalum_signature_requests;
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  select * into r from public.lalum_signature_requests where id = p_request;
  if r.id is null or r.firm_id is distinct from public.lalum_my_firm_id()
     or public.lalum_my_role() not in ('FIRM_PARTNER','ATTORNEY','ADMIN') then raise exception 'not allowed'; end if;
  if r.status <> 'DRAFT' then raise exception 'already sent'; end if;
  if length(coalesce(r.signer_email,'')) = 0 or length(coalesce(r.content,'')) = 0 then raise exception 'incomplete'; end if;
  update public.lalum_signature_requests
     set status = 'SENT', sent_at = now(),
         content_sha256 = encode(digest(content, 'sha256'), 'hex')
   where id = p_request;
  perform public.lalum_append_audit(r.firm_id, r.matter_id, auth.uid(), 'SIGNATURE_SENT', null,
    jsonb_build_object('request', p_request));
end $$;
revoke execute on function public.lalum_signature_send(uuid) from public, anon;
grant execute on function public.lalum_signature_send(uuid) to authenticated;

-- Client action: mark a request viewed (first open).
create or replace function public.lalum_portal_mark_viewed(p_request uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r public.lalum_signature_requests; v_email text := (select auth.jwt() ->> 'email');
begin
  select * into r from public.lalum_signature_requests where id = p_request;
  if r.id is null or lower(r.signer_email) is distinct from lower(coalesce(v_email,'')) then raise exception 'not allowed'; end if;
  if r.status = 'SENT' then
    update public.lalum_signature_requests set status = 'VIEWED', viewed_at = now() where id = p_request;
  end if;
end $$;
revoke execute on function public.lalum_portal_mark_viewed(uuid) from public, anon;
grant execute on function public.lalum_portal_mark_viewed(uuid) to authenticated;

-- Client action: sign or decline. The caller's login email must match the
-- addressed signer, and the request must be open. Records only the signing
-- fields and writes the outcome to the audit chain.
create or replace function public.lalum_portal_sign(p_request uuid, p_name text, p_consent boolean, p_decline boolean default false, p_reason text default null, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.lalum_signature_requests; v_email text := (select auth.jwt() ->> 'email');
begin
  select * into r from public.lalum_signature_requests where id = p_request;
  if r.id is null or lower(r.signer_email) is distinct from lower(coalesce(v_email,'')) then raise exception 'not allowed'; end if;
  if r.status not in ('SENT','VIEWED') then raise exception 'not open for signing'; end if;

  if p_decline then
    update public.lalum_signature_requests
       set status = 'DECLINED', declined_at = now(), decline_reason = nullif(p_reason,'')
     where id = p_request;
    perform public.lalum_append_audit(r.firm_id, r.matter_id, auth.uid(), 'SIGNATURE_DECLINED', null,
      jsonb_build_object('request', p_request));
    return jsonb_build_object('status', 'DECLINED');
  end if;

  if coalesce(p_consent, false) is not true or length(trim(coalesce(p_name,''))) = 0 then
    raise exception 'name and consent required';
  end if;
  update public.lalum_signature_requests
     set status = 'SIGNED', signed_at = now(), signed_name = trim(p_name),
         signed_consent = true, signed_user_agent = left(coalesce(p_user_agent,''), 400)
   where id = p_request;
  perform public.lalum_append_audit(r.firm_id, r.matter_id, auth.uid(), 'SIGNATURE_SIGNED', r.content_sha256,
    jsonb_build_object('request', p_request, 'name', trim(p_name)));
  return jsonb_build_object('status', 'SIGNED');
end $$;
revoke execute on function public.lalum_portal_sign(uuid, text, boolean, boolean, text, text) from public, anon;
grant execute on function public.lalum_portal_sign(uuid, text, boolean, boolean, text, text) to authenticated;
