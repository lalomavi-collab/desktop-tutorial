/* Re-running a matter's analysis under another practice area (a partner action).
   The analysis itself is computed by the pipeline's analyze route (rules from lalum_practice_playbooks, run on the
   document text that is already masked). This migration only lets the result be stored, so the risk rollup (0042) and
   every screen see it:
   - lalum_document_set_analysis(doc, analysis, area): partner or admin of the firm with fresh MFA; the shape of the
     analysis is validated (findings list, risk object with a known level and integer counts, bounded size); written to
     the audit chain with a hash of the analysis, never its content.
   - lalum_matter_set_practice(matter, area): sets the practice area of the matter (matter row and routing row).
   Neither function changes document text, type, original or any other column.
   Not applied to production until approved. */

create or replace function public.lalum_document_set_analysis(p_doc uuid, p_analysis jsonb, p_area text) returns void
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_firm uuid; v_matter uuid; v_risk jsonb;
begin
  select firm_id, matter_id into v_firm, v_matter from public.lalum_matter_documents where id = p_doc and deleted_at is null;
  if v_firm is null or not coalesce(public.lalum_mgr_ok(v_firm), false) then raise exception 'not allowed'; end if;
  if p_area is null or p_area not in ('REAL_ESTATE','COMMERCIAL_MA','LABOR_LAW','AI_GOVERNANCE','LITIGATION') then raise exception 'bad practice area'; end if;
  -- Every test below is written so that a missing key reads as "bad", never as NULL (NULL would let the check pass).
  if p_analysis is null or coalesce(jsonb_typeof(p_analysis), '') <> 'object' or length(p_analysis::text) > 200000 then raise exception 'bad analysis'; end if;
  if coalesce(jsonb_typeof(p_analysis->'findings'), '') <> 'array' then raise exception 'bad analysis'; end if;
  if jsonb_array_length(p_analysis->'findings') > 200 then raise exception 'bad analysis'; end if;
  v_risk := p_analysis->'risk';
  if coalesce(jsonb_typeof(v_risk), '') <> 'object' or coalesce(v_risk->>'level', '') not in ('HIGH_RISK','CAUTION','COMPLIANT') then raise exception 'bad analysis'; end if;
  if coalesce(jsonb_typeof(v_risk->'score'), '') <> 'number' or coalesce(jsonb_typeof(v_risk->'red'), '') <> 'number'
     or coalesce(jsonb_typeof(v_risk->'yellow'), '') <> 'number' or coalesce(jsonb_typeof(v_risk->'green'), '') <> 'number' then raise exception 'bad analysis'; end if;
  if (v_risk->>'score')::numeric not between 0 and 100 or (v_risk->>'red')::numeric < 0 or (v_risk->>'yellow')::numeric < 0 or (v_risk->>'green')::numeric < 0 then raise exception 'bad analysis'; end if;
  update public.lalum_matter_documents set analysis = p_analysis where id = p_doc;
  perform public.lalum_append_audit(v_firm, v_matter, auth.uid(), 'DOCUMENT_REANALYZED',
    encode(digest(p_analysis::text, 'sha256'), 'hex'), jsonb_build_object('practice_area', p_area));
end $$;
revoke execute on function public.lalum_document_set_analysis(uuid, jsonb, text) from public, anon;
grant execute on function public.lalum_document_set_analysis(uuid, jsonb, text) to authenticated;

create or replace function public.lalum_matter_set_practice(p_matter uuid, p_area text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_cockpit_matters where id = p_matter and deleted_at is null;
  if v_firm is null or not coalesce(public.lalum_mgr_ok(v_firm), false) then raise exception 'not allowed'; end if;
  if p_area is null or p_area not in ('REAL_ESTATE','COMMERCIAL_MA','LABOR_LAW','AI_GOVERNANCE','LITIGATION') then raise exception 'bad practice area'; end if;
  update public.lalum_cockpit_matters set practice_area = p_area where id = p_matter;
  update public.lalum_intake_routings set practice_area = p_area where matter_id = p_matter;
  perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'MATTER_PRACTICE_SET', null, jsonb_build_object('practice_area', p_area));
end $$;
revoke execute on function public.lalum_matter_set_practice(uuid, text) from public, anon;
grant execute on function public.lalum_matter_set_practice(uuid, text) to authenticated;
