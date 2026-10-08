-- Annex assembly for the case cockpit.
-- An ordered list of appendices (נספחים) for a matter's main document. Each annex is
-- either another document already in the matter (annex_document_id) or a named placeholder
-- for an item attached physically outside the system (annex_document_id null, e.g. a Tabu
-- extract). This table holds only organisational metadata: labels, order and status. The
-- annex content itself lives in lalum_matter_documents, masked, and is composed client side
-- at export time, so the PII shield is unchanged. RLS mirrors the cockpit idiom: firm + MFA.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_doc_annexes".

create table if not exists public.lalum_doc_annexes (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id           uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  parent_document_id  uuid not null references public.lalum_matter_documents(id) on delete cascade,
  annex_document_id   uuid references public.lalum_matter_documents(id) on delete set null,
  label               text not null default '',
  title               text not null default '',
  sort_order          int  not null default 0,
  status              text not null default 'INCLUDED' check (status in ('INCLUDED','PENDING','WAIVED')),
  note                text,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists lalum_doc_annexes_parent_idx on public.lalum_doc_annexes (parent_document_id, sort_order);

alter table public.lalum_doc_annexes enable row level security;
create policy lalum_doc_annexes_read on public.lalum_doc_annexes for select
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()));
create policy lalum_doc_annexes_insert on public.lalum_doc_annexes for insert
  with check (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()));
create policy lalum_doc_annexes_update on public.lalum_doc_annexes for update
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()))
  with check (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()));
create policy lalum_doc_annexes_delete on public.lalum_doc_annexes for delete
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()));

revoke all on public.lalum_doc_annexes from anon, authenticated;
grant select, insert, update, delete on public.lalum_doc_annexes to authenticated;

create trigger lalum_doc_annexes_touch before update on public.lalum_doc_annexes
  for each row execute function public.lalum_touch_updated_at();

-- Audit a composed export, mirroring lalum_log_archive_export. Enums and counts only.
create or replace function public.lalum_log_annex_export(p_matter uuid, p_parent uuid, p_annexes integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  select firm_id into v_firm from public.lalum_cockpit_matters where id = p_matter;
  if v_firm is null or v_firm is distinct from public.lalum_my_firm_id()
     or public.lalum_my_role() not in ('FIRM_PARTNER','ADMIN','ATTORNEY') then raise exception 'not allowed'; end if;
  perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'ANNEX_EXPORTED', null,
    jsonb_build_object('parent', p_parent, 'annexes', greatest(p_annexes, 0)));
end $$;
revoke execute on function public.lalum_log_annex_export(uuid, uuid, integer) from public, anon;
grant execute on function public.lalum_log_annex_export(uuid, uuid, integer) to authenticated;
