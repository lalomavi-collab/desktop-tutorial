-- Document version history for the case cockpit.
-- Every state of lalum_matter_documents.editor_content is kept as a version. Content is already
-- PII-masked (the pipeline masks before anything reaches editor_content), and no free text is
-- stored beside it, so the history carries no identifying data that the document itself lacks.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_document_versions".

create table if not exists public.lalum_document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.lalum_matter_documents(id) on delete cascade,
  firm_id      uuid not null references public.lalum_firms(id) on delete cascade,
  version_no   int  not null,
  content      text not null,
  content_hash text not null,
  reason       text not null check (reason in ('CREATED','AUTO','MANUAL','RESTORE')),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  unique (document_id, version_no)
);
create index if not exists lalum_document_versions_doc_idx on public.lalum_document_versions (document_id, version_no desc);

alter table public.lalum_document_versions enable row level security;
create policy lalum_document_versions_read on public.lalum_document_versions for select
  using (firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok()));
revoke all on public.lalum_document_versions from anon, authenticated;
grant select on public.lalum_document_versions to authenticated;

-- Records a version on insert and on every change of editor_content. Autosaves by the same user
-- within ten minutes fold into one version so a typing session is not thousands of rows.
create or replace function public.lalum_record_version() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_reason text := coalesce(nullif(current_setting('lalum.version_reason', true), ''), 'AUTO');
  v_last record;
  v_hash text := encode(extensions.digest(convert_to(new.editor_content, 'utf8'), 'sha256'), 'hex');
begin
  if tg_op = 'INSERT' then
    insert into public.lalum_document_versions (document_id, firm_id, version_no, content, content_hash, reason, created_by)
    values (new.id, new.firm_id, 1, new.editor_content, v_hash, 'CREATED', auth.uid());
    return new;
  end if;
  if new.editor_content is not distinct from old.editor_content then return new; end if;
  select * into v_last from public.lalum_document_versions where document_id = new.id order by version_no desc limit 1;
  if v_last.id is not null and v_reason = 'AUTO' and v_last.reason = 'AUTO'
     and v_last.created_at > now() - interval '10 minutes' and v_last.created_by is not distinct from auth.uid() then
    update public.lalum_document_versions set content = new.editor_content, content_hash = v_hash, created_at = now() where id = v_last.id;
  else
    insert into public.lalum_document_versions (document_id, firm_id, version_no, content, content_hash, reason, created_by)
    values (new.id, new.firm_id, coalesce(v_last.version_no, 0) + 1, new.editor_content, v_hash, v_reason, auth.uid());
  end if;
  return new;
end $$;
revoke execute on function public.lalum_record_version() from public, anon, authenticated;

drop trigger if exists lalum_matter_documents_versions on public.lalum_matter_documents;
create trigger lalum_matter_documents_versions
  after insert or update of editor_content on public.lalum_matter_documents
  for each row execute function public.lalum_record_version();

-- Marks the current text as a named milestone. No label is accepted on purpose: free text would
-- sit outside the PII shield.
create or replace function public.lalum_snapshot_document(p_doc uuid) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_content text; v_hash text; v_last record; v_no int;
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  select editor_content into v_content from public.lalum_matter_documents where id = p_doc and firm_id = v_firm;
  if v_content is null then raise exception 'document not found'; end if;
  v_hash := encode(extensions.digest(convert_to(v_content, 'utf8'), 'sha256'), 'hex');
  select * into v_last from public.lalum_document_versions where document_id = p_doc order by version_no desc limit 1;
  if v_last.id is not null and v_last.content_hash = v_hash then
    update public.lalum_document_versions set reason = 'MANUAL' where id = v_last.id and reason = 'AUTO';
    return jsonb_build_object('version_no', v_last.version_no);
  end if;
  v_no := coalesce(v_last.version_no, 0) + 1;
  insert into public.lalum_document_versions (document_id, firm_id, version_no, content, content_hash, reason, created_by)
  values (p_doc, v_firm, v_no, v_content, v_hash, 'MANUAL', auth.uid());
  return jsonb_build_object('version_no', v_no);
end $$;

-- Puts an old version back as the current text. Sign-off is bound to the content hash, so a
-- restore invalidates earlier approvals by construction. Logged on the audit chain.
create or replace function public.lalum_restore_version(p_version uuid) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v record; v_matter uuid;
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  select * into v from public.lalum_document_versions where id = p_version and firm_id = v_firm;
  if v.id is null then raise exception 'version not found'; end if;
  select matter_id into v_matter from public.lalum_matter_documents where id = v.document_id and firm_id = v_firm;
  if v_matter is null then raise exception 'document not found'; end if;
  perform set_config('lalum.version_reason', 'RESTORE', true);
  update public.lalum_matter_documents set editor_content = v.content where id = v.document_id;
  perform set_config('lalum.version_reason', '', true);
  perform public.lalum_append_audit(v_firm, v_matter, auth.uid(), 'DOCUMENT_VERSION_RESTORED', v.content_hash,
    jsonb_build_object('version_no', v.version_no));
  return jsonb_build_object('document_id', v.document_id, 'content', v.content);
end $$;

revoke execute on function public.lalum_snapshot_document(uuid), public.lalum_restore_version(uuid) from public, anon;
grant execute on function public.lalum_snapshot_document(uuid), public.lalum_restore_version(uuid) to authenticated;

-- Backfill: documents that predate this migration get their current text as version 1.
insert into public.lalum_document_versions (document_id, firm_id, version_no, content, content_hash, reason)
select d.id, d.firm_id, 1, d.editor_content, encode(extensions.digest(convert_to(d.editor_content, 'utf8'), 'sha256'), 'hex'), 'CREATED'
  from public.lalum_matter_documents d
 where not exists (select 1 from public.lalum_document_versions v where v.document_id = d.id);

-- Two real estate / urban renewal skeletons. Structure and merge fields only: no statutory
-- assertions, and each carries the standing reminder that an attorney completes and approves it.
insert into public.lalum_doc_templates (firm_id, name, practice_area, body)
select f.id, t.name, 'REAL_ESTATE', t.body
  from public.lalum_firms f
 cross join (values
  ('זיכרון דברים לרכישת דירה (שלד)',
$tpl$זיכרון דברים לרכישת דירה

תאריך: {{date}}

בין: {{counterparty_name}}, מספר זיהוי {{counterparty_id}} (להלן: "המוכר")
לבין: {{client_name}}, מספר זיהוי {{client_id}} (להלן: "הקונה")

הנכס: דירה הידועה כגוש {{gush}} חלקה {{helka}}, בקומה {{floor}}.

1. המוכר מוכר והקונה קונה את הנכס, כפוף לחתימה על הסכם מכר מלא.
2. התמורה: {{price}}.
3. מקדמה שתשולם בחתימה: {{deposit}}.
4. מועד חתימה על הסכם המכר: עד {{signing_date}}.
5. [על המשרד להשלים כאן את יתר התנאים: מועד מסירה, מצב רישום, שעבודים, מיסוי, והתאמה לנסיבות.]

חתימת המוכר: ______________    חתימת הקונה: ______________

הערה: מסמך זה הוא תבנית פנימית בלבד, ואינו מהווה ייעוץ משפטי. על עורך הדין להשלים, להתאים ולאשר את הנוסח לפני כל שימוש.$tpl$),
  ('הסכם ליווי משפטי לבעלי דירות בהתחדשות עירונית (שלד)',
$tpl$הסכם ליווי משפטי להתחדשות עירונית

תאריך: {{date}}

בין: LALUM (להלן: "המשרד")
לבין: {{client_name}}, מספר זיהוי {{client_id}} (להלן: "בעל הדירה")

בעניין: ליווי משפטי בפרויקט התחדשות עירונית בבניין הידוע כגוש {{gush}} חלקה {{helka}}, מסלול {{track}}.

1. המשרד ילווה את בעל הדירה במשא ומתן מול היזם ובבדיקת הסכם התחדשות, בהתאם למוסכם.
2. הליווי יכלול: בדיקת ההסכם המוצע, הערות סעיף אחר סעיף, ונוסח תיקונים לחתימה.
3. שכר הטרחה: {{fee}}.
4. [על המשרד להשלים כאן את יתר התנאים: היקף השירות, ייצוג משותף של דיירים, וניגוד עניינים, והתאמה לנסיבות.]

חתימת בעל הדירה: ______________    בשם המשרד: ______________

הערה: מסמך זה הוא תבנית פנימית בלבד, ואינו מהווה ייעוץ משפטי. על עורך הדין להשלים, להתאים ולאשר את הנוסח לפני כל שימוש.$tpl$)
 ) as t(name, body)
 where not exists (select 1 from public.lalum_doc_templates x where x.firm_id = f.id and x.name = t.name);
