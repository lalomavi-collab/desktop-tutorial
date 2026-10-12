-- Firm roster administration: an admin changes a member's role, and both the
-- role change and the department change are written to the audit chain with
-- their exact time. Role management is admin-only (a platform admin, or a
-- firm member whose own role is ADMIN, with fresh MFA): a partner must not be
-- able to promote themselves. Setting a department stays open to a partner or
-- admin, as in 0014, but is now audited too.
-- The audit log refuses any meta that contains an e-mail address, so only the
-- member's user id and role are recorded, never their e-mail.
-- Applied to project meoymkcotomoluwlwues as migration "lalum_member_admin".

-- Only a platform admin or a firm ADMIN (with fresh MFA) may administer roles.
create or replace function public.lalum_admin_ok(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_is_admin() or (
    p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
    and public.lalum_my_role() = 'ADMIN'
  );
$$;
revoke execute on function public.lalum_admin_ok(uuid) from public, anon;
grant execute on function public.lalum_admin_ok(uuid) to authenticated;

-- Change a member's role. Validates the role, keeps it inside the caller's
-- firm, refuses to demote the firm's last ADMIN (so the firm cannot be left
-- with no administrator), and records the change with its previous value.
create or replace function public.lalum_set_member_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_prev text;
begin
  select firm_id, role into v_firm, v_prev from public.lalum_firm_members where user_id = p_user;
  if v_firm is null then raise exception 'not a firm member'; end if;
  if not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  if p_role not in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER','ADMIN') then raise exception 'invalid role'; end if;
  if v_prev = 'ADMIN' and p_role <> 'ADMIN'
     and (select count(*) from public.lalum_firm_members where firm_id = v_firm and role = 'ADMIN') <= 1 then
    raise exception 'cannot remove the last administrator';
  end if;
  update public.lalum_firm_members set role = p_role where user_id = p_user;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_ROLE_SET', null,
    jsonb_build_object('user', p_user, 'role', p_role, 'prev_role', v_prev));
end $$;
revoke execute on function public.lalum_set_member_role(uuid, text) from public, anon;
grant execute on function public.lalum_set_member_role(uuid, text) to authenticated;

-- Redefine the department setter (from 0014) so the change is audited too.
-- Gate and behaviour are unchanged: a partner or admin of the member's firm.
create or replace function public.lalum_set_member_department(p_user uuid, p_dept text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_dept text := nullif(trim(p_dept),'');
begin
  select firm_id into v_firm from public.lalum_firm_members where user_id = p_user;
  if v_firm is null or not public.lalum_mgr_ok(v_firm) then raise exception 'not allowed'; end if;
  update public.lalum_firm_members set department = v_dept where user_id = p_user;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_DEPARTMENT_SET', null,
    jsonb_build_object('user', p_user, 'department', v_dept));
end $$;
revoke execute on function public.lalum_set_member_department(uuid, text) from public, anon;
grant execute on function public.lalum_set_member_department(uuid, text) to authenticated;
