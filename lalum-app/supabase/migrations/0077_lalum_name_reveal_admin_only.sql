/* 0077: only the firm administrator reveals client names, and only the administrator can allow a partner or attorney to.
   Decision of the owner, 2026-10-21. Before: lalum_can_see_client_names let every partner and attorney (and, since 0073, the
   bookkeeper) reveal names with a reason. Now:
   - the platform admin, and a firm member whose role is ADMIN (with the firm's second factor), may reveal;
   - a FIRM_PARTNER or ATTORNEY may reveal only while an explicit grant row exists for them (lalum_name_reveal_grants),
     set and removed by lalum_set_name_reveal, which only an administrator can call and which is written to the audit chain
     (user id and a yes or no, never an e-mail or a name);
   - BOOKKEEPER, COMPLIANCE_OFFICER and everyone else may not. The reason requirement and the audit of 0072 are unchanged.
   Bookkeeping access is also capped here: the BOOKKEEPER role never gets a finance level above 1 (view and download of what the
   finance tables hold; export logging is level 1), whatever the Permissions tab says. Level 1 is also her default until a level is
   set; a lower level set for her (0) is kept.
   Not applied to production until approved. In production the only member today is the platform admin, so nobody is locked out. */

create table if not exists public.lalum_name_reveal_grants (
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);
alter table public.lalum_name_reveal_grants enable row level security;
revoke all on public.lalum_name_reveal_grants from public, anon, authenticated;
grant select on public.lalum_name_reveal_grants to authenticated;
drop policy if exists lalum_name_reveal_grants_read on public.lalum_name_reveal_grants;
create policy lalum_name_reveal_grants_read on public.lalum_name_reveal_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.lalum_admin_ok(firm_id)));

create or replace function public.lalum_can_see_client_names() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_is_admin() or (
    public.lalum_my_firm_id() is not null and public.lalum_mfa_ok() and (
      public.lalum_my_role() = 'ADMIN'
      or (public.lalum_my_role() in ('FIRM_PARTNER','ATTORNEY')
          and exists (select 1 from public.lalum_name_reveal_grants g where g.firm_id = public.lalum_my_firm_id() and g.user_id = auth.uid()))
    )
  );
$$;
revoke execute on function public.lalum_can_see_client_names() from public, anon;
grant execute on function public.lalum_can_see_client_names() to authenticated;

-- Allow or stop a partner or attorney of the caller's firm from revealing names. Administrator only.
create or replace function public.lalum_set_name_reveal(p_user uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_role text;
begin
  if v_firm is null or not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  select role into v_role from public.lalum_firm_members where user_id = p_user and firm_id = v_firm;
  if v_role is null then raise exception 'not a firm member'; end if;
  if v_role not in ('FIRM_PARTNER','ATTORNEY') then raise exception 'role cannot be granted'; end if;
  if coalesce(p_allowed, false) then
    insert into public.lalum_name_reveal_grants (firm_id, user_id, granted_by) values (v_firm, p_user, auth.uid())
    on conflict (firm_id, user_id) do update set granted_by = excluded.granted_by, granted_at = now();
  else
    delete from public.lalum_name_reveal_grants where firm_id = v_firm and user_id = p_user;
  end if;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'NAME_REVEAL_GRANT_SET', null,
    jsonb_build_object('user', p_user, 'allowed', coalesce(p_allowed, false)));
end $$;
revoke execute on function public.lalum_set_name_reveal(uuid, boolean) from public, anon;
grant execute on function public.lalum_set_name_reveal(uuid, boolean) to authenticated;

-- A member who stops being a partner or attorney loses the grant (it would be dead weight, and would return if the role came back).
create or replace function public.lalum_name_reveal_drop_on_role_change() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.role not in ('FIRM_PARTNER','ATTORNEY') then
    delete from public.lalum_name_reveal_grants where firm_id = new.firm_id and user_id = new.user_id;
  end if;
  return new;
end $$;
revoke execute on function public.lalum_name_reveal_drop_on_role_change() from public, anon, authenticated;
drop trigger if exists lalum_name_reveal_drop_on_role_change on public.lalum_firm_members;
create trigger lalum_name_reveal_drop_on_role_change after update of role on public.lalum_firm_members
  for each row when (old.role is distinct from new.role) execute function public.lalum_name_reveal_drop_on_role_change();

-- The bookkeeper never goes above level 1; the rest of 0073's rule stands (second factor always).
create or replace function public.lalum_fin_level(p_firm uuid) returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce(case when p_firm is not null and p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
                        and (public.lalum_my_role() is distinct from 'BOOKKEEPER' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2') then
      least(
        coalesce((select p.level::integer from public.lalum_fin_permissions p where p.firm_id = p_firm and p.user_id = auth.uid()),
                 case when public.lalum_my_role() in ('FIRM_PARTNER','ADMIN') then 4
                      when public.lalum_my_role() = 'BOOKKEEPER' then 1 else 0 end),
        case when public.lalum_my_role() = 'BOOKKEEPER' then 1 else 4 end)
    end, 0) $$;
revoke execute on function public.lalum_fin_level(uuid) from public, anon;
grant execute on function public.lalum_fin_level(uuid) to authenticated;

-- The new table gets the bookkeeper default deny like every other non finance table (0073).
select public.lalum_bookkeeper_apply();
