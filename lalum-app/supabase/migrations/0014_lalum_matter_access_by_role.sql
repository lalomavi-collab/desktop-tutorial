-- Role-based matter access: admin sees all, a partner sees their department, an
-- attorney sees only the matters assigned to them. Firm members and matters each
-- carry a department; assignment uses the existing lalum_matter_team table.
-- Platform admins and firm ADMIN/COMPLIANCE keep full visibility, and a matter's
-- creator keeps access, so the change cannot lock an admin out of their own firm.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_matter_access_by_role".

alter table public.lalum_firm_members add column if not exists department text;
alter table public.lalum_cockpit_matters add column if not exists department text;

create or replace function public.lalum_my_department() returns text
language sql stable security definer set search_path to 'public' as $$
  select department from public.lalum_firm_members where user_id = (select auth.uid()) limit 1;
$$;
revoke execute on function public.lalum_my_department() from public, anon;
grant execute on function public.lalum_my_department() to authenticated;

-- Whether the caller may view a given matter. SECURITY DEFINER, so it reads the
-- matter and team without recursing into their RLS.
create or replace function public.lalum_can_view_matter(p_matter uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.lalum_cockpit_matters m
    where m.id = p_matter and m.deleted_at is null and (
      public.lalum_is_admin()
      or (m.firm_id = public.lalum_my_firm_id() and (
            public.lalum_my_role() in ('ADMIN','COMPLIANCE_OFFICER')
            or m.created_by = (select auth.uid())
            or exists (select 1 from public.lalum_matter_team t where t.matter_id = m.id and t.user_id = (select auth.uid()))
            or (public.lalum_my_role() = 'FIRM_PARTNER' and m.department is not null and m.department = public.lalum_my_department())
          ))
    )
  );
$$;
revoke execute on function public.lalum_can_view_matter(uuid) from public, anon;
grant execute on function public.lalum_can_view_matter(uuid) to authenticated;

-- Scope the matter list and documents to what the caller may view. The other
-- conditions (soft delete, MFA) are preserved exactly as before.
alter policy lalum_matters_read on public.lalum_cockpit_matters
  using (deleted_at is null and public.lalum_can_view_matter(id));
alter policy lalum_documents_read on public.lalum_matter_documents
  using (deleted_at is null and (select public.lalum_mfa_ok()) and public.lalum_can_view_matter(matter_id));

-- Management RPCs: set departments and assign attorneys. Gated to a firm partner
-- or admin (or platform admin), scoped to the caller's firm, with fresh MFA.
create or replace function public.lalum_mgr_ok(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_is_admin() or (
    p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
    and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')
  );
$$;
revoke execute on function public.lalum_mgr_ok(uuid) from public, anon;
grant execute on function public.lalum_mgr_ok(uuid) to authenticated;

create or replace function public.lalum_set_matter_department(p_matter uuid, p_dept text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_cockpit_matters where id=p_matter;
  if v_firm is null or not public.lalum_mgr_ok(v_firm) then raise exception 'not allowed'; end if;
  update public.lalum_cockpit_matters set department=nullif(trim(p_dept),'') where id=p_matter;
  perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'MATTER_DEPARTMENT_SET', null, jsonb_build_object('department', nullif(trim(p_dept),'')));
end $$;
revoke execute on function public.lalum_set_matter_department(uuid, text) from public, anon;
grant execute on function public.lalum_set_matter_department(uuid, text) to authenticated;

create or replace function public.lalum_set_member_department(p_user uuid, p_dept text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_firm_members where user_id=p_user;
  if v_firm is null or not public.lalum_mgr_ok(v_firm) then raise exception 'not allowed'; end if;
  update public.lalum_firm_members set department=nullif(trim(p_dept),'') where user_id=p_user;
end $$;
revoke execute on function public.lalum_set_member_department(uuid, text) from public, anon;
grant execute on function public.lalum_set_member_department(uuid, text) to authenticated;

create or replace function public.lalum_matter_assign(p_matter uuid, p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_cockpit_matters where id=p_matter;
  if v_firm is null or not public.lalum_mgr_ok(v_firm) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.lalum_firm_members where user_id=p_user and firm_id=v_firm) then raise exception 'not a firm member'; end if;
  if p_on then
    insert into public.lalum_matter_team(matter_id, user_id, firm_id, added_by)
      values (p_matter, p_user, v_firm, auth.uid()) on conflict do nothing;
    perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'MATTER_ASSIGNED', null, jsonb_build_object('user', p_user));
  else
    delete from public.lalum_matter_team where matter_id=p_matter and user_id=p_user;
    perform public.lalum_append_audit(v_firm, p_matter, auth.uid(), 'MATTER_UNASSIGNED', null, jsonb_build_object('user', p_user));
  end if;
end $$;
revoke execute on function public.lalum_matter_assign(uuid, uuid, boolean) from public, anon;
grant execute on function public.lalum_matter_assign(uuid, uuid, boolean) to authenticated;

create or replace function public.lalum_firm_roster()
returns table(user_id uuid, name text, role text, department text)
language sql stable security definer set search_path to 'public' as $$
  select m.user_id, m.name, m.role, m.department
  from public.lalum_firm_members m
  where m.firm_id = public.lalum_my_firm_id() and public.lalum_mgr_ok(m.firm_id)
  order by m.name;
$$;
revoke execute on function public.lalum_firm_roster() from public, anon;
grant execute on function public.lalum_firm_roster() to authenticated;

create or replace function public.lalum_matter_assignees(p_matter uuid)
returns table(user_id uuid)
language sql stable security definer set search_path to 'public' as $$
  select t.user_id from public.lalum_matter_team t
  join public.lalum_cockpit_matters m on m.id = t.matter_id
  where t.matter_id = p_matter and public.lalum_mgr_ok(m.firm_id);
$$;
revoke execute on function public.lalum_matter_assignees(uuid) from public, anon;
grant execute on function public.lalum_matter_assignees(uuid) to authenticated;
