/* Stage 2 of the case folder link (docs/matter-folder-sync-design.md, section 5): the record of every message the mail intake
   function has seen, and the two actions a person can take on a message that was not filed automatically.
   Content free by design: the Internet Message-ID and the conversation id are stored only as SHA-256 hashes, there is no
   subject, no address and no body here. A person sees the message itself only through the mailbox.
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
  reason           text check (reason is null or reason in ('NO_MATCH','AMBIGUOUS','UNKNOWN_CODE','MATTER_NOT_ENABLED','MATTER_CLOSED')),
  document_id      uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (firm_id, message_key)
);
create index if not exists lalum_mail_intake_state_idx on public.lalum_mail_intake (firm_id, state, created_at);
create index if not exists lalum_mail_intake_conv_idx on public.lalum_mail_intake (firm_id, conversation_key) where conversation_key is not null;

alter table public.lalum_mail_intake enable row level security;
revoke all on public.lalum_mail_intake from anon, authenticated;
grant select on public.lalum_mail_intake to authenticated;

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
