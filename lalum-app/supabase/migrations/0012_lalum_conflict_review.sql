-- Conflict-of-interest review surface for the cockpit.
-- The intake pipeline already stores each matter's parties as blind indexes (a
-- keyed hash of the name, never the name itself) in lalum_conflict_parties and
-- sets a matter's conflict_status. These two functions add the firm-facing
-- review on top of that existing data, without reintroducing any name: one finds
-- which other matters share a party with a given matter (by matching stored
-- blind indexes), the other records a partner's reasoned clearance or waiver to
-- the audit chain. No plaintext party name is read or returned.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_conflict_review".

-- Which other matters of the firm share a party with p_matter. Returns the
-- conflicting matter and the shared party's role and kind, never a name.
create or replace function public.lalum_conflict_review(p_matter uuid)
returns table(matter_id uuid, title text, role text, kind text, matter_active boolean)
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id();
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  if public.lalum_my_role() not in ('FIRM_PARTNER','ATTORNEY','ADMIN') then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.lalum_cockpit_matters where id = p_matter and firm_id = v_firm) then
    raise exception 'matter not found';
  end if;
  return query
    select distinct m2.id, m2.title, cp2.role, cp2.kind, (m2.status <> 'ARCHIVED')
      from public.lalum_conflict_parties cp1
      join public.lalum_conflict_parties cp2
        on cp2.firm_id = cp1.firm_id and cp2.blind_index = cp1.blind_index and cp2.matter_id <> cp1.matter_id
      join public.lalum_cockpit_matters m2 on m2.id = cp2.matter_id
     where cp1.firm_id = v_firm and cp1.matter_id = p_matter
     order by (m2.status <> 'ARCHIVED') desc, m2.title;
end $$;
revoke execute on function public.lalum_conflict_review(uuid) from public, anon;
grant execute on function public.lalum_conflict_review(uuid) to authenticated;

-- Record a partner's conflict decision for a matter: clear it, mark it for
-- manual review, or record a direct conflict, with the rationale written to the
-- audit chain. A clearance or waiver is a partner decision, so it is limited to
-- a firm partner or admin.
create or replace function public.lalum_set_conflict_status(p_matter uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id();
begin
  if not public.lalum_mfa_ok() then raise exception 'mfa required'; end if;
  if public.lalum_my_role() not in ('FIRM_PARTNER','ADMIN') then raise exception 'not allowed'; end if;
  if p_status not in ('CLEAN','POTENTIAL','DIRECT_CONFLICT') then raise exception 'invalid status'; end if;
  if not exists (select 1 from public.lalum_cockpit_matters where id = p_matter and firm_id = v_firm) then
    raise exception 'matter not found';
  end if;
  update public.lalum_cockpit_matters set conflict_status = p_status where id = p_matter;
  perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'CONFLICT_STATUS_SET', null,
    jsonb_build_object('status', p_status, 'note', left(coalesce(p_note, ''), 2000)));
end $$;
revoke execute on function public.lalum_set_conflict_status(uuid, text, text) from public, anon;
grant execute on function public.lalum_set_conflict_status(uuid, text, text) to authenticated;
