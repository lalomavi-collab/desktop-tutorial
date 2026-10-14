/* Matter level risk rollup.
   Before this, lalum_provision_matter overwrote lalum_cockpit_matters.risk_summary with the analysis of whichever
   document was uploaded last, so the badge on a matter with dozens of files described one file, chosen by upload order.
   Now risk_summary is derived from the stored analysis of every live document in the matter and kept current by a trigger
   (insert, analysis change, type change, trash and restore, purge). lalum_provision_matter is not changed: its write is
   simply recomputed by the trigger when the document row is inserted right after it.

   What counts:
   - Only documents that carry an analysis and whose type is an instrument the risk rules were written for
     (CONTRACT, COURT_FILING) or is not set yet. Opinions, correspondence, evidence and authorities are inputs to the
     matter, not drafts under review, and are excluded; the summary says how many were left out.
   - Trashed documents do not count.
   Level keeps its meaning: any red finding in an assessed document gives HIGH_RISK, else any yellow gives CAUTION, else
   COMPLIANT. A matter with nothing assessed is NOT_ASSESSED, never COMPLIANT.
   Score is the lowest document score (the worst assessed document), so one bad contract is not diluted by thirty good ones.
   red, yellow and green keep their old meaning (number of findings) summed over assessed documents; docs_red and
   docs_yellow count documents; red_docs lists up to 20 document ids with a red finding, so the badge can say where to look.
   Not applied to production until a partner approves; the backfill at the end recomputes every existing matter. */

create or replace function public.lalum_matter_risk(p_matter uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with docs as (
    select d.id,
           coalesce((d.analysis->'risk'->>'red')::int, 0)    as red,
           coalesce((d.analysis->'risk'->>'yellow')::int, 0) as yellow,
           coalesce((d.analysis->'risk'->>'green')::int, 0)  as green,
           coalesce((d.analysis->'risk'->>'score')::int, 100) as score,
           (d.analysis ? 'risk' and jsonb_typeof(d.analysis->'risk') = 'object'
            and (d.doc_type is null or d.doc_type in ('CONTRACT','COURT_FILING'))) as assessed
      from public.lalum_matter_documents d
     where d.matter_id = p_matter and d.deleted_at is null
  ), a as (select * from docs where assessed)
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
    'docs_excluded', (select count(*) from docs where not assessed),
    'docs_red', (select count(*) from a where red > 0),
    'docs_yellow', (select count(*) from a where red = 0 and yellow > 0),
    'red_docs', coalesce((select jsonb_agg(id) from (select id from a where red > 0 order by score, id limit 20) x), '[]'::jsonb)
  )
$$;
revoke execute on function public.lalum_matter_risk(uuid) from public, anon, authenticated;

create or replace function public.lalum_matter_risk_refresh() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_old uuid; v_new uuid;
begin
  if tg_op in ('UPDATE','DELETE') then v_old := old.matter_id; end if;
  if tg_op in ('INSERT','UPDATE') then v_new := new.matter_id; end if;
  if v_new is not null then
    update public.lalum_cockpit_matters set risk_summary = public.lalum_matter_risk(v_new) where id = v_new;
  end if;
  if v_old is not null and v_old is distinct from v_new then
    update public.lalum_cockpit_matters set risk_summary = public.lalum_matter_risk(v_old) where id = v_old;
  end if;
  return null;
end $$;
revoke execute on function public.lalum_matter_risk_refresh() from public, anon, authenticated;

drop trigger if exists lalum_matter_risk_refresh on public.lalum_matter_documents;
create trigger lalum_matter_risk_refresh
  after insert or delete or update of analysis, doc_type, deleted_at, matter_id on public.lalum_matter_documents
  for each row execute function public.lalum_matter_risk_refresh();

/* Backfill: every existing matter that has at least one document. */
update public.lalum_cockpit_matters m set risk_summary = public.lalum_matter_risk(m.id)
 where exists (select 1 from public.lalum_matter_documents d where d.matter_id = m.id);
