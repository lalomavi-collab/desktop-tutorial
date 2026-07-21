-- 0004_calls_admin_read.sql
-- Surface the voice-call tables in the app portal for firm admins.
-- The tables keep RLS enabled; these policies grant SELECT only to admins
-- (via the existing lalum_is_admin() helper: is_admin in lalum_profiles, or the
-- firm email). The service-role backend still bypasses RLS entirely, and
-- non-admin clients get nothing.

create policy "admin_read_calls_meta" on public.lalum_calls_meta
  for select to authenticated using (public.lalum_is_admin());

create policy "admin_read_crm_tasks" on public.lalum_crm_tasks
  for select to authenticated using (public.lalum_is_admin());

create policy "admin_read_billing_ledgers" on public.lalum_billing_ledgers
  for select to authenticated using (public.lalum_is_admin());

create policy "admin_read_contacts" on public.lalum_contacts
  for select to authenticated using (public.lalum_is_admin());
