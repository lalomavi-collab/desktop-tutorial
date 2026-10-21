-- 0064: the partner's conflict note leaves the audit chain.
--
-- lalum_set_conflict_status wrote the partner's free text note (up to 2000 characters) into the meta of CONFLICT_STATUS_SET.
-- The chain is append only and cannot be erased, a key rule cannot see a name inside free text, and a conflict rationale
-- is exactly where a party is named. 0061 closed the structured leaks; this closes the free text one.
--
--   a. new table lalum_conflict_notes holds the note (RLS: a partner or admin of that firm; no write grant, the function writes it);
--   b. lalum_set_conflict_status writes the note there and puts only status, note_chars and note_sha256 into the chain,
--      so the chain still proves which text was recorded without carrying it;
--   c. lalum_finish_purge_matter clears the table with the other children (one name added to its list; the rest of the body
--      is the live body read on 2026-10-20). Only where that function exists.
--
-- Not done, on purpose: CONFLICT_STATUS_SET rows already in the chain keep the note they were written with. Rewriting a row
-- would break the chain. Run docs/audit-log-hygiene.md for the count before deciding whether that is acceptable.

create table if not exists public.lalum_conflict_notes (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.lalum_firms(id) on delete restrict,
  matter_id   uuid not null references public.lalum_cockpit_matters(id) on delete restrict,
  audit_id    bigint,
  note        text not null check (length(btrim(note)) > 0 and length(note) <= 2000),
  note_sha256 text not null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists lalum_conflict_notes_matter_idx on public.lalum_conflict_notes (matter_id);
alter table public.lalum_conflict_notes enable row level security;
revoke all on public.lalum_conflict_notes from anon, authenticated;
create policy lalum_conflict_notes_read on public.lalum_conflict_notes for select
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_my_role()) in ('FIRM_PARTNER', 'ADMIN'));
grant select on public.lalum_conflict_notes to authenticated;

create or replace function public.lalum_set_conflict_status(p_matter uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_note text := left(btrim(coalesce(p_note, '')), 2000); v_hash text; v_audit bigint;
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  if public.lalum_my_role() not in ('FIRM_PARTNER','ADMIN') then raise exception 'not allowed'; end if;
  if p_status not in ('CLEAN','POTENTIAL','DIRECT_CONFLICT') then raise exception 'invalid status'; end if;
  if not exists (select 1 from public.lalum_cockpit_matters where id = p_matter and firm_id = v_firm) then
    raise exception 'matter not found';
  end if;
  update public.lalum_cockpit_matters set conflict_status = p_status where id = p_matter;
  if v_note = '' then
    perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'CONFLICT_STATUS_SET', null,
      jsonb_build_object('status', p_status, 'note_chars', 0));
    return;
  end if;
  v_hash := encode(extensions.digest(convert_to(v_note, 'UTF8'), 'sha256'), 'hex');
  v_audit := public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'CONFLICT_STATUS_SET', null,
    jsonb_build_object('status', p_status, 'note_chars', length(v_note), 'note_sha256', v_hash));
  insert into public.lalum_conflict_notes (firm_id, matter_id, audit_id, note, note_sha256, created_by)
    values (v_firm, p_matter, v_audit, v_note, v_hash, auth.uid());
end $$;
revoke execute on function public.lalum_set_conflict_status(uuid, text, text) from public, anon;
grant execute on function public.lalum_set_conflict_status(uuid, text, text) to authenticated;

do $mig$
begin
  if to_regprocedure('public.lalum_finish_purge_matter(uuid)') is null then
    raise notice '0064: lalum_finish_purge_matter not present, notes are not cleared by a purge here';
    return;
  end if;
  execute $stmt$
    create or replace function public.lalum_finish_purge_matter(p_matter uuid)
    returns void language plpgsql security definer set search_path to 'public', 'storage' as $body$
    declare m public.lalum_cockpit_matters; paths text[]; n int; t text;
    begin
      select * into m from public.lalum_cockpit_matters where id = p_matter;
      if m.id is null or not public.lalum_is_partner_of(m.firm_id) then raise exception 'not allowed'; end if;
      if m.purge_requested_at is null or m.purged_at is not null then raise exception 'purge not requested'; end if;
      if public.lalum_purge_blocker(m.id) is not null then raise exception 'blocked'; end if;
      select coalesce(array_agg(original_path) filter (where original_path is not null), '{}') into paths from public.lalum_matter_documents where matter_id = m.id;
      if exists (select 1 from storage.objects o where o.bucket_id = 'matter-originals' and o.name = any(paths)) then raise exception 'objects remain'; end if;
      select count(*)::int into n from public.lalum_matter_documents where matter_id = m.id;
      foreach t in array array['lalum_matter_documents','lalum_matter_inquiries','lalum_matter_contacts','lalum_dispatch_outbox','lalum_intake_routings','lalum_kyc_records','lalum_conflict_notes'] loop
        execute 'del' || 'ete from public.' || quote_ident(t) || ' where matter_id = $1' using m.id;
      end loop;
      update public.lalum_cockpit_matters set title = 'תיק שנמחק', risk_summary = '{}'::jsonb, purged_at = clock_timestamp(), deleted_reason = null where id = m.id;
      perform public.lalum_append_audit(m.firm_id, m.id, auth.uid(), 'MATTER_PURGED', null, jsonb_build_object('documents', n, 'originals', coalesce(array_length(paths, 1), 0)));
    end $body$
  $stmt$;
end $mig$;
