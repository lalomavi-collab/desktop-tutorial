-- Document governance for the case cockpit.
-- 1. Every document belongs to one matter of one firm: matter_id is NOT NULL with a foreign key already; this adds the
--    guarantee that the document and its matter carry the same firm, so a document can never sit under another firm's matter.
-- 2. Intake questions are stored as closed lists (no free text, so nothing can sit outside the PII shield).
-- 3. Deleting a document is possible only through lalum_delete_document, which only a platform admin may call, refuses a
--    matter under legal hold and a document whose original sits in the write-once vault, and logs on the audit chain.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_document_governance".

alter table public.lalum_matter_documents
  add column if not exists doc_type   text check (doc_type in ('CONTRACT','CORRESPONDENCE','COURT_FILING','AUTHORITY','OPINION','EVIDENCE','OTHER')),
  add column if not exists doc_origin text check (doc_origin in ('CLIENT','ADVERSE','COURT','AUTHORITY','INTERNAL','THIRD_PARTY')),
  add column if not exists doc_date   date;

create or replace function public.lalum_documents_same_firm() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.lalum_cockpit_matters m where m.id = new.matter_id and m.firm_id = new.firm_id) then
    raise exception 'document must belong to a matter of the same firm';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_documents_same_firm() from public, anon, authenticated;
drop trigger if exists lalum_documents_same_firm on public.lalum_matter_documents;
create trigger lalum_documents_same_firm before insert or update of matter_id, firm_id on public.lalum_matter_documents
  for each row execute function public.lalum_documents_same_firm();

create or replace function public.lalum_set_document_meta(p_doc uuid, p_type text, p_origin text, p_date date default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare d public.lalum_matter_documents;
begin
  select * into d from public.lalum_matter_documents where id = p_doc;
  if d.id is null or d.firm_id is distinct from public.lalum_my_firm_id() or not public.lalum_mfa_ok()
     or public.lalum_my_role() not in ('FIRM_PARTNER','ATTORNEY','ADMIN') then raise exception 'not allowed'; end if;
  if p_type not in ('CONTRACT','CORRESPONDENCE','COURT_FILING','AUTHORITY','OPINION','EVIDENCE','OTHER')
     or p_origin not in ('CLIENT','ADVERSE','COURT','AUTHORITY','INTERNAL','THIRD_PARTY') then raise exception 'bad classification'; end if;
  update public.lalum_matter_documents set doc_type = p_type, doc_origin = p_origin, doc_date = p_date where id = p_doc;
  perform public.lalum_append_audit(d.firm_id, d.matter_id, auth.uid(), 'DOCUMENT_CLASSIFIED', null,
    jsonb_build_object('doc', d.id, 'type', p_type, 'origin', p_origin));
end $$;

create or replace function public.lalum_delete_document(p_doc uuid) returns void
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare d public.lalum_matter_documents; m public.lalum_cockpit_matters;
begin
  if not public.lalum_is_admin() then raise exception 'only an administrator may delete documents'; end if;
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  select * into d from public.lalum_matter_documents where id = p_doc;
  if d.id is null then raise exception 'document not found'; end if;
  select * into m from public.lalum_cockpit_matters where id = d.matter_id;
  if m.legal_hold then raise exception 'matter is under legal hold'; end if;
  if d.original_path is not null then raise exception 'original is held in the vault and is retained by law'; end if;
  perform public.lalum_append_audit(d.firm_id, d.matter_id, auth.uid(), 'DOCUMENT_DELETED',
    encode(extensions.digest(convert_to(d.editor_content, 'utf8'), 'sha256'), 'hex'),
    jsonb_build_object('doc', d.id, 'type', d.doc_type));
  delete from public.lalum_matter_documents where id = p_doc;
end $$;

revoke execute on function public.lalum_set_document_meta(uuid, text, text, date), public.lalum_delete_document(uuid) from public, anon;
grant execute on function public.lalum_set_document_meta(uuid, text, text, date), public.lalum_delete_document(uuid) to authenticated;
