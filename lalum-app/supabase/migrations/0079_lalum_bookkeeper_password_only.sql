/* 0079: the external bookkeeper signs in with a password only (no second factor). Decision of the owner, 2026-10-22.
   Before (0073, 0077): lalum_fin_level gave the BOOKKEEPER role a level only in a second factor session (aal2), and, like everyone,
   only if lalum_mfa_ok() held (the firm requires MFA). Now: for BOOKKEEPER alone the finance level no longer depends on either,
   so a password session (aal1) is enough. Nothing else changes for her: level 1 cap and default, no name reveal, default deny on every
   non finance table. For every other role lalum_fin_level is exactly as before (it still needs lalum_mfa_ok()).
   Not changed here: lalum_mfa_ok() itself, which other sensitive records (KYC, document versions) use; the BOOKKEEPER role has no access to those.
   The interface part (no second factor screen for the role) is in CockpitFrame.tsx. Not applied to production until approved. */

create or replace function public.lalum_fin_level(p_firm uuid) returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce(case when p_firm is not null and p_firm = public.lalum_my_firm_id()
                        and (public.lalum_my_role() = 'BOOKKEEPER' or public.lalum_mfa_ok()) then
      least(
        coalesce((select p.level::integer from public.lalum_fin_permissions p where p.firm_id = p_firm and p.user_id = auth.uid()),
                 case when public.lalum_my_role() in ('FIRM_PARTNER','ADMIN') then 4
                      when public.lalum_my_role() = 'BOOKKEEPER' then 1 else 0 end),
        case when public.lalum_my_role() = 'BOOKKEEPER' then 1 else 4 end)
    end, 0) $$;
revoke execute on function public.lalum_fin_level(uuid) from public, anon;
grant execute on function public.lalum_fin_level(uuid) to authenticated;
