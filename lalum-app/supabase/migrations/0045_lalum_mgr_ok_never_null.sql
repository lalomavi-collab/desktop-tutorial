/* Security fix: lalum_mgr_ok(firm) returned NULL, not false, for a signed in user who belongs to no firm.
   In SQL, "p_firm = lalum_my_firm_id()" is NULL when the caller has no firm, so the whole expression became NULL and
   "if v_firm is null or not lalum_mgr_ok(v_firm) then raise" did not raise: NULL is not true. Four SECURITY DEFINER
   functions use that exact test and are executable by any signed in user:
   lalum_matter_assign, lalum_set_matter_department, lalum_set_member_department and lalum_set_matter_sync.
   A signed in account without a firm membership, holding a matter or member id, could therefore call them.
   (Reading the data stays blocked by row level security; this was a write path.)
   The fix is the one function every caller shares: the result is always true or false. Signature, grants and the
   rule itself are unchanged. Not applied to production until approved. */

create or replace function public.lalum_mgr_ok(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    public.lalum_is_admin() or (
      p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
      and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')
    ), false);
$$;
