/* 0075: the external bookkeeper may read the firm's invoice journal (lalum_invoices: the subscription invoices LALUM issues to the firm).
   Before: lalum_invoices_read allowed only FIRM_PARTNER and ADMIN of the firm (and the platform admin).
   Now: BOOKKEEPER too, but only while her finance level (lalum_fin_level, which already needs a second factor for her) is 1 or more,
   so removing her finance level removes this access with it. Reading only: writing stays with the platform admin (lalum_invoices_admin_write).
   Altered in place, no drop. Not applied to production until approved. */

alter policy lalum_invoices_read on public.lalum_invoices
  using ((firm_id = public.lalum_my_firm_id() and (
            public.lalum_my_role() = any (array['FIRM_PARTNER','ADMIN'])
            or (public.lalum_my_role() = 'BOOKKEEPER' and public.lalum_fin_level(firm_id) >= 1)))
         or public.lalum_is_admin());
