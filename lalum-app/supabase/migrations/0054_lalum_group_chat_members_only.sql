-- The portal group chat was an open room for every signed-in user. Sign-up is now open to anyone who wants to use
-- the site assistant, so "signed in" no longer means client or firm. Reading and posting now require an admin, a
-- firm member, or a client with a matter access grant. Applied to production on 2026-10-19 with ALTER POLICY.
alter policy lalum_group_chat_read on public.lalum_group_chat_messages
  using (
    public.lalum_is_admin()
    or public.lalum_my_firm_id() is not null
    or exists (select 1 from public.lalum_matter_client_access a where a.client_user_id = (select auth.uid()))
  );
alter policy lalum_group_chat_insert on public.lalum_group_chat_messages
  with check (
    user_id = (select auth.uid())
    and (
      public.lalum_is_admin()
      or public.lalum_my_firm_id() is not null
      or exists (select 1 from public.lalum_matter_client_access a where a.client_user_id = (select auth.uid()))
    )
  );
