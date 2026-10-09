-- Deleting material is for the platform administrator only (decision of the owner).
-- 1. lalum_is_partner_of is used only by the recycle bin (trash, restore, request purge, finish purge, original purge policy).
--    It now also requires the platform administrator, so every one of those paths is admin only and still firm scoped, FIRM_PARTNER and MFA.
-- 2. The bin listing requires the same.
-- 3. lalum_delete_document from 0011 is removed: it was a second, weaker path that bypassed the bin and the retention period.
create or replace function public.lalum_is_partner_of(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(p_firm is not null and p_firm = lalum_my_firm_id() and lalum_my_role() = 'FIRM_PARTNER' and lalum_mfa_ok() and lalum_is_admin(), false) $$;

create or replace function public.lalum_bin_list()
 returns table(kind text, id uuid, matter_id uuid, label text, deleted_at timestamptz, reason text, items integer, blocker text, purge_requested boolean)
 language plpgsql stable security definer set search_path to 'public' as $$
begin
  if coalesce(lalum_my_role() = 'FIRM_PARTNER' and lalum_mfa_ok() and lalum_is_admin(), false) is not true then raise exception 'not allowed'; end if;
  return query
    select 'MATTER'::text, m.id, m.id, m.title, m.deleted_at, m.deleted_reason, (select count(*)::int from public.lalum_matter_documents d where d.matter_id = m.id),
           public.lalum_purge_blocker(m.id), m.purge_requested_at is not null
      from public.lalum_cockpit_matters m where m.firm_id = lalum_my_firm_id() and m.deleted_at is not null and m.purged_at is null
    union all
    select 'DOCUMENT'::text, d.id, d.matter_id, d.file_name, d.deleted_at, null::text, 1, public.lalum_purge_blocker(d.matter_id), d.purge_requested_at is not null
      from public.lalum_matter_documents d join public.lalum_cockpit_matters m on m.id = d.matter_id
     where d.firm_id = lalum_my_firm_id() and d.deleted_at is not null and m.deleted_at is null
    order by 5 desc;
end $$;

drop function if exists public.lalum_delete_document(uuid);
