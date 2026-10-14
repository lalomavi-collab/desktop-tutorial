/* Stage 2 of the case folder link (docs/matter-folder-sync-design.md, section 5): the record of every message the mail intake
   function has seen, and the two actions a person can take on a message that was not filed automatically.
   Content free by design: the Internet Message-ID and the conversation id are stored only as SHA-256 hashes, there is no
   subject, no address and no body here. A person sees the message itself only through the mailbox.
   graph_message_id is the opaque id the function needs to retry filing; it is not readable by signed in users (column grants below).
   Written only by the intake function (service role). NOT yet applied to any project. */

create table if not exists public.lalum_mail_intake (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.lalum_firms(id) on delete cascade,
  message_key      text not null check (message_key ~ '^[0-9a-f]{64}$'),
  conversation_key text check (conversation_key is null or conversation_key ~ '^[0-9a-f]{64}$'),
  received_at      timestamptz not null,
  route            text check (route is null or route in ('ALIAS','SUBJECT_CODE','THREAD','MANUAL')),
  matter_id        uuid references public.lalum_cockpit_matters(id) on delete restrict,
  state            text not null check (state in ('QUEUED','FILED','TRIAGE','CONFLICT_HOLD','ASSIGNED','REJECTED','FAILED')),
  reason           text check (reason is null or reason in ('NO_MATCH','AMBIGUOUS','UNKNOWN_CODE','MATTER_NOT_ENABLED','MATTER_CLOSED','TOO_LARGE','PII_BLOCKED')),
  document_id      uuid,
  graph_message_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (firm_id, message_key)
);
create index if not exists lalum_mail_intake_state_idx on public.lalum_mail_intake (firm_id, state, created_at);
create index if not exists lalum_mail_intake_conv_idx on public.lalum_mail_intake (firm_id, conversation_key) where conversation_key is not null;

alter table public.lalum_mail_intake enable row level security;
revoke all on public.lalum_mail_intake from anon, authenticated;
grant select (id, firm_id, message_key, conversation_key, received_at, route, matter_id, state, reason, document_id, created_at, updated_at)
  on public.lalum_mail_intake to authenticated;

/* A row tied to a matter is visible to whoever may view that matter. A row with no matter (the triage queue) is visible to the
   firm's partners and admins. Nobody signed in can write: the function uses the service role, people use the two functions below. */
drop policy if exists lalum_mail_intake_read on public.lalum_mail_intake;
create policy lalum_mail_intake_read on public.lalum_mail_intake for select to authenticated using (
  (matter_id is not null and public.lalum_can_view_matter(matter_id))
  or (matter_id is null and (public.lalum_is_admin()
        or (firm_id = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN'))))
);

/* Assign a message that was not filed automatically to a matter. A lawyer who may view the matter does it for TRIAGE. A message
   held for a conflict, or a matter in direct conflict, needs a partner or admin. The matter must be live and not archived. */
create or replace function public.lalum_mail_triage_assign(p_intake uuid, p_matter uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare i public.lalum_mail_intake; m public.lalum_cockpit_matters; v_role text := public.lalum_my_role(); v_mgr boolean;
begin
  select * into i from public.lalum_mail_intake where id = p_intake for update;
  select * into m from public.lalum_cockpit_matters where id = p_matter and deleted_at is null;
  if i.id is null or m.id is null or i.firm_id is distinct from m.firm_id then raise exception 'not allowed'; end if;
  v_mgr := public.lalum_is_admin() or (i.firm_id = public.lalum_my_firm_id() and v_role in ('FIRM_PARTNER','ADMIN'));
  if not public.lalum_mfa_ok() then raise exception 'not allowed'; end if;
  if i.state not in ('TRIAGE','CONFLICT_HOLD') then raise exception 'not pending'; end if;
  if m.status = 'ARCHIVED' then raise exception 'matter closed'; end if;
  if not (v_mgr or (v_role in ('ATTORNEY') and public.lalum_can_view_matter(p_matter))) then raise exception 'not allowed'; end if;
  if (i.state = 'CONFLICT_HOLD' or m.conflict_status = 'DIRECT_CONFLICT') and not v_mgr then raise exception 'partner required'; end if;
  update public.lalum_mail_intake set matter_id = p_matter, route = 'MANUAL', state = 'ASSIGNED', reason = null, updated_at = now() where id = p_intake;
  perform public.lalum_append_audit(i.firm_id, p_matter, auth.uid(), 'MAIL_TRIAGE_ASSIGNED', null,
    jsonb_build_object('intake', i.id, 'was', i.state, 'reason', i.reason));
end $$;
revoke execute on function public.lalum_mail_triage_assign(uuid, uuid) from public, anon;
grant execute on function public.lalum_mail_triage_assign(uuid, uuid) to authenticated;

/* Mark a message as not belonging to any matter. Partner or admin only, so a message is never discarded by someone who cannot
   see the matters it might belong to. The mailbox itself is never changed. */
create or replace function public.lalum_mail_triage_reject(p_intake uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare i public.lalum_mail_intake;
begin
  select * into i from public.lalum_mail_intake where id = p_intake for update;
  if i.id is null or not (public.lalum_is_admin() or (i.firm_id = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')))
     or not public.lalum_mfa_ok() then raise exception 'not allowed'; end if;
  if i.state not in ('TRIAGE','CONFLICT_HOLD') then raise exception 'not pending'; end if;
  update public.lalum_mail_intake set state = 'REJECTED', updated_at = now() where id = p_intake;
  perform public.lalum_append_audit(i.firm_id, i.matter_id, auth.uid(), 'MAIL_TRIAGE_REJECTED', null, jsonb_build_object('intake', i.id, 'was', i.state, 'reason', i.reason));
end $$;
revoke execute on function public.lalum_mail_triage_reject(uuid) from public, anon;
grant execute on function public.lalum_mail_triage_reject(uuid) to authenticated;

/* The secure filing path (supabase/functions/lalum-mail-intake/file.ts). These three functions are for the service role only: the
   intake function calls them after the existing pipeline route has created the masked document. A signed in user cannot call them. */
create or replace function public.lalum_mail_set_document(p_firm uuid, p_key text, p_doc uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare i public.lalum_mail_intake; d public.lalum_matter_documents;
begin
  select * into i from public.lalum_mail_intake where firm_id = p_firm and message_key = p_key for update;
  select * into d from public.lalum_matter_documents where id = p_doc;
  if i.id is null or d.id is null or i.matter_id is null or d.matter_id is distinct from i.matter_id or d.firm_id is distinct from p_firm then raise exception 'mismatch'; end if;
  if i.state not in ('QUEUED','ASSIGNED') then raise exception 'not pending'; end if;
  if i.document_id is not null and i.document_id <> p_doc then raise exception 'already linked'; end if;
  update public.lalum_mail_intake set document_id = p_doc, updated_at = now() where id = i.id;
end $$;

/* Attach the raw message source stored in the private vault as the original of the document, once, with its SHA-256. The path is
   fixed: firm/matter/document/original.txt. The object must already exist in the bucket. The row becomes FILED. */
create or replace function public.lalum_mail_attach_original(p_firm uuid, p_key text, p_path text, p_sha256 text, p_size bigint) returns void
language plpgsql security definer set search_path to 'public', 'storage' as $$
declare i public.lalum_mail_intake; d public.lalum_matter_documents;
begin
  select * into i from public.lalum_mail_intake where firm_id = p_firm and message_key = p_key for update;
  if i.id is null or i.document_id is null or i.state not in ('QUEUED','ASSIGNED') then raise exception 'not pending'; end if;
  select * into d from public.lalum_matter_documents where id = i.document_id and firm_id = p_firm and matter_id = i.matter_id;
  if d.id is null then raise exception 'mismatch'; end if;
  if p_path <> (d.firm_id::text || '/' || d.matter_id::text || '/' || d.id::text || '/original.txt') then raise exception 'bad path'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or coalesce(p_size, 0) <= 0 then raise exception 'bad hash or size'; end if;
  if d.original_path is not null then raise exception 'original already stored'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'matter-originals' and o.name = p_path) then raise exception 'object missing'; end if;
  update public.lalum_matter_documents set original_path = p_path, original_sha256 = p_sha256, original_size = p_size, original_mime = 'text/plain',
         original_stored_at = clock_timestamp(), doc_type = coalesce(doc_type, 'CORRESPONDENCE') where id = d.id;
  update public.lalum_mail_intake set state = 'FILED', updated_at = now() where id = i.id;
  perform public.lalum_append_audit(p_firm, d.matter_id, null, 'MAIL_FILED', p_sha256, jsonb_build_object('intake', i.id, 'doc', d.id, 'bytes', p_size));
end $$;

/* Stop filing a message: a conflict hold, or a failure a person has to look at. Only a message that is still pending. */
create or replace function public.lalum_mail_set_state(p_firm uuid, p_key text, p_state text, p_reason text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare i public.lalum_mail_intake;
begin
  if p_state not in ('CONFLICT_HOLD','FAILED') then raise exception 'bad state'; end if;
  select * into i from public.lalum_mail_intake where firm_id = p_firm and message_key = p_key and state in ('QUEUED','ASSIGNED') for update;
  if i.id is null then return; end if;
  update public.lalum_mail_intake set state = p_state, reason = p_reason, updated_at = now() where id = i.id;
  perform public.lalum_append_audit(p_firm, i.matter_id, null, 'MAIL_FILING_STOPPED', null, jsonb_build_object('intake', i.id, 'state', p_state, 'reason', p_reason));
end $$;

revoke execute on function public.lalum_mail_set_document(uuid, text, uuid), public.lalum_mail_attach_original(uuid, text, text, text, bigint),
  public.lalum_mail_set_state(uuid, text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.lalum_mail_set_document(uuid, text, uuid), public.lalum_mail_attach_original(uuid, text, text, text, bigint),
      public.lalum_mail_set_state(uuid, text, text, text) to service_role;
  end if;
end $$;
