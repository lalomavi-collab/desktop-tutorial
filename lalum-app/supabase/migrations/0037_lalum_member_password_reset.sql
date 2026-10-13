-- 0037_lalum_member_password_reset.sql
-- Admin-initiated password reset for a firm member. The administrator never sets,
-- sees or receives a password or a reset link: this function only authorises the
-- request, records it in the audit chain (user id only, the log refuses e-mail
-- addresses) and returns the member's address so the client can ask Supabase Auth
-- to send its own recovery e-mail to that person. Same gate as role changes
-- (lalum_admin_ok: platform admin, or the firm's ADMIN with fresh MFA).

create or replace function public.lalum_member_reset_target(p_user uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_email text;
begin
  select firm_id into v_firm from public.lalum_firm_members where user_id = p_user;
  if v_firm is null then raise exception 'not a firm member'; end if;
  if not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  select email into v_email from auth.users where id = p_user;
  if v_email is null then raise exception 'no e-mail on file'; end if;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_PASSWORD_RESET_REQUESTED', null,
    jsonb_build_object('user', p_user));
  return v_email;
end $$;
revoke execute on function public.lalum_member_reset_target(uuid) from public, anon;
grant execute on function public.lalum_member_reset_target(uuid) to authenticated;
