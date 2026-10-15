/* Which documents decide a matter's risk level.
   Finding from L-2026-0018: the matter showed HIGH_RISK because two shorter documents lacked clauses (late delivery
   compensation, tenants' investment guarantee) that the full agreement in the same matter contains. A rule of the form
   "clause absent" is true of that document, but it says nothing about the operative agreement. Two defects fed it:
   - the same text uploaded twice (two files, identical extracted text) was counted twice, inflating red and yellow counts;
   - an earlier version, an annex or a summary counted exactly like the operative agreement.
   What this changes (0042 rollup, same level and score semantics):
   - Identical text (same md5 of editor_content) counts once. Computed at rollup time, nothing is stored.
   - A partner or admin with fresh MFA can mark a document "not counted in the matter's risk" with a short reason
     (lalum_document_set_risk_scope). The document keeps its own analysis and badge; only the matter rollup skips it.
     The reason is stored on the document row (no client names in it, the screen says so) and only its hash goes to the audit chain.
   - The summary reports docs_duplicate and docs_partner_excluded, so the badge can say what was left out and why.
   Nothing is marked by default: until a partner decides, behaviour differs from 0042 only by the duplicate count.
   The trigger is not extended to editor_content (every autosave would recompute with md5 over large text); a text edit
   refreshes the rollup the next time the analysis, type, scope, trash state or matter changes.
   Not applied to production until a partner approves; the backfill at the end recomputes every existing matter. */

alter table public.lalum_matter_documents
  add column if not exists risk_excluded boolean not null default false,
  add column if not exists risk_excluded_reason text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lalum_docs_risk_reason_chk') then
    alter table public.lalum_matter_documents add constraint lalum_docs_risk_reason_chk
      check (not risk_excluded or (risk_excluded_reason is not null and length(btrim(risk_excluded_reason)) between 3 and 300));
  end if;
end $$;

create or replace function public.lalum_matter_risk(p_matter uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with docs as (
    select d.id,
           coalesce((d.analysis->'risk'->>'red')::int, 0)    as red,
           coalesce((d.analysis->'risk'->>'yellow')::int, 0) as yellow,
           coalesce((d.analysis->'risk'->>'green')::int, 0)  as green,
           coalesce((d.analysis->'risk'->>'score')::int, 100) as score,
           (d.analysis ? 'risk' and jsonb_typeof(d.analysis->'risk') = 'object'
            and (d.doc_type is null or d.doc_type in ('CONTRACT','COURT_FILING'))) as typed,
           d.risk_excluded,
           case when coalesce(length(d.editor_content), 0) > 0 then md5(d.editor_content) else d.id::text end as h
      from public.lalum_matter_documents d
     where d.matter_id = p_matter and d.deleted_at is null
  ), cand as (
    select *, row_number() over (partition by h order by score, id) as rn from docs where typed and not risk_excluded
  ), a as (select * from cand where rn = 1)
  select jsonb_build_object(
    'level', case when not exists (select 1 from a) then 'NOT_ASSESSED'
                  when exists (select 1 from a where red > 0) then 'HIGH_RISK'
                  when exists (select 1 from a where yellow > 0) then 'CAUTION'
                  else 'COMPLIANT' end,
    'score', (select min(score) from a),
    'red',    coalesce((select sum(red) from a), 0),
    'yellow', coalesce((select sum(yellow) from a), 0),
    'green',  coalesce((select sum(green) from a), 0),
    'basis', 'ALL_DOCUMENTS',
    'docs_total', (select count(*) from docs),
    'docs_assessed', (select count(*) from a),
    'docs_excluded', (select count(*) from docs where not typed),
    'docs_duplicate', (select count(*) from cand where rn > 1),
    'docs_partner_excluded', (select count(*) from docs where typed and risk_excluded),
    'docs_red', (select count(*) from a where red > 0),
    'docs_yellow', (select count(*) from a where red = 0 and yellow > 0),
    'red_docs', coalesce((select jsonb_agg(id) from (select id from a where red > 0 order by score, id limit 20) x), '[]'::jsonb)
  )
$$;
revoke execute on function public.lalum_matter_risk(uuid) from public, anon, authenticated;

drop trigger if exists lalum_matter_risk_refresh on public.lalum_matter_documents;
create trigger lalum_matter_risk_refresh
  after insert or delete or update of analysis, doc_type, deleted_at, matter_id, risk_excluded on public.lalum_matter_documents
  for each row execute function public.lalum_matter_risk_refresh();

create or replace function public.lalum_document_set_risk_scope(p_doc uuid, p_excluded boolean, p_reason text) returns void
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_firm uuid; v_matter uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select firm_id, matter_id into v_firm, v_matter from public.lalum_matter_documents where id = p_doc and deleted_at is null;
  if v_firm is null or not coalesce(public.lalum_mgr_ok(v_firm), false) then raise exception 'not allowed'; end if;
  if p_excluded is null then raise exception 'bad scope'; end if;
  if p_excluded and (v_reason is null or length(v_reason) not between 3 and 300) then raise exception 'reason required'; end if;
  update public.lalum_matter_documents
     set risk_excluded = p_excluded, risk_excluded_reason = case when p_excluded then v_reason else null end
   where id = p_doc;
  perform public.lalum_append_audit(v_firm, v_matter, auth.uid(), 'DOCUMENT_RISK_SCOPE_SET',
    encode(digest(coalesce(v_reason, ''), 'sha256'), 'hex'), jsonb_build_object('excluded', p_excluded));
end $$;
revoke execute on function public.lalum_document_set_risk_scope(uuid, boolean, text) from public, anon;
grant execute on function public.lalum_document_set_risk_scope(uuid, boolean, text) to authenticated;

/* Backfill: recompute every matter that has documents. */
update public.lalum_cockpit_matters m set risk_summary = public.lalum_matter_risk(m.id)
 where exists (select 1 from public.lalum_matter_documents d where d.matter_id = m.id);
