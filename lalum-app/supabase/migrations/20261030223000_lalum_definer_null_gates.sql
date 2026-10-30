/* Security fix, advisor close-out (30.10.2026): three SECURITY DEFINER gates let a signed in user who belongs to no
   firm straight through, because the test evaluated to NULL and "if not NULL then raise" does not raise.
   The same bug class as lalum_mgr_ok in 0045. Sign-up is open, so "a signed in user" is anyone.

   1. lalum_admin_ok(firm): "p_firm = lalum_my_firm_id()" is NULL for a caller with no firm, so the function returned
      NULL, not false. Two callers test it with nothing in front:
        lalum_set_member_role(user, role): changes the role of any firm member (the last ADMIN guard still holds).
        lalum_member_reset_target(user): returns any member's e-mail address.
      Both need the member's id. lalum_add_bookkeeper and lalum_set_name_reveal check "v_firm is null" first and the
      read policy on lalum_name_reveal_grants treats NULL as deny, so those were not open.
   2. lalum_rotate_intake_token(firm): the same comparison inline. It replaces the firm's intake token and returns the
      new one to the caller. Needs only the firm id.
   3. lalum_verify_audit_chain(firm): the same comparison inline. Read only: reports whether the firm's audit chain is
      intact and where it breaks.
   Simulated live on 30.10.2026 (signed in id with no firm, rolled back): lalum_admin_ok returned NULL and both inline
   gates evaluated to NULL. No call to the four entry points in the API log of the last 24 hours; the audit log holds
   2 MEMBER_ROLE_SET and 1 MEMBER_PASSWORD_RESET_REQUESTED, all by the firm administrator.
   The fix: every result is true or false. Signatures, grants and the rules themselves are unchanged; bodies are the
   production definitions of 30.10.2026 with only the gate wrapped.

   Also, three SECURITY DEFINER functions with no caller outside the database lose EXECUTE for signed in users, as in
   20261027185211: lalum_is_partner_of and lalum_my_department are reached only through other SECURITY DEFINER functions
   (no policy, no view, no invoker function, no app or edge function call), and lalum_fin_seed_series_from_archive was
   a one time seed of the numbering series, done in 0017. If a second firm ever needs the seed, run it from the SQL
   editor as the owner after "grant execute ... to authenticated", then revoke again. */

create or replace function public.lalum_admin_ok(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    public.lalum_is_admin() or (
      p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
      and public.lalum_my_role() = 'ADMIN'
    ), false);
$$;

create or replace function public.lalum_rotate_intake_token(p_firm uuid) returns text
language plpgsql security definer set search_path to 'public', 'lalum_private', 'extensions' as $function$
declare v_token text := 'lit_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not coalesce(public.lalum_is_admin()
          or (p_firm = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER','ADMIN')), false) then
    raise exception 'not authorized';
  end if;
  update lalum_private.firm_secrets
     set intake_token_hash = encode(extensions.digest(convert_to(v_token,'utf8'),'sha256'),'hex')
   where firm_id = p_firm;
  return v_token;
end $function$;

create or replace function public.lalum_verify_audit_chain(p_firm uuid) returns bigint
language plpgsql stable security definer set search_path to 'public', 'extensions' as $function$
declare r record; v_prev text := repeat('0', 64); v_expected bigint := 1;
begin
  if not coalesce(public.lalum_is_admin() or p_firm = public.lalum_my_firm_id(), false) then
    raise exception 'not authorized';
  end if;
  for r in select * from public.lalum_matter_audit_log where firm_id = p_firm order by seq loop
    if r.seq <> v_expected or r.prev_hash <> v_prev
       or r.hash <> public.lalum_audit_hash(r.prev_hash, r.seq, r.firm_id, r.matter_id, r.attorney_id, r.action, r.ai_output_hash, r.meta, r."timestamp") then
      return r.seq;
    end if;
    v_prev := r.hash; v_expected := v_expected + 1;
  end loop;
  return null;
end $function$;

revoke execute on function public.lalum_is_partner_of(uuid) from authenticated;
revoke execute on function public.lalum_my_department() from authenticated;
revoke execute on function public.lalum_fin_seed_series_from_archive(uuid) from authenticated;
