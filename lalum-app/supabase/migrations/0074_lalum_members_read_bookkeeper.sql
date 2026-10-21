/* 0074: the external bookkeeper reads her own member row and no one else's.
   Before: lalum_members_read let every member of a firm read the whole roster (name, e-mail, phone, role) of that firm.
   The interface hides the roster from the BOOKKEEPER role (0073), but a direct API call would not have been stopped.
   Now: for BOOKKEEPER the policy returns her own row only (the cockpit needs it to know her role and firm); every other
   role, and the platform admin, is unchanged. Altered in place, no drop.
   Not applied to production until approved. */

alter policy lalum_members_read on public.lalum_firm_members
  using ((firm_id = public.lalum_my_firm_id() and (public.lalum_my_role() is distinct from 'BOOKKEEPER' or user_id = (select auth.uid())))
         or public.lalum_is_admin());
