/* Showing client names now needs a reason, and the audit entry says who and why.
   Before: lalum_reveal_client_names() wrote "CLIENT_NAMES_REVEALED" with an empty detail, so the log said that someone
   looked, never why. Now:
   - lalum_reveal_client_names(p_reason_code, p_note): the code must be one of the listed reasons, and OTHER needs a note
     of at least five characters. The note is optional otherwise, at most 200 characters. The audit log refuses
     personal data keys and e-mail addresses by itself (0061); the interface also tells the user not to type a name.
   - The zero argument version is dropped, so a reveal without a reason is impossible against this database.
   - lalum_hide_client_names(p_how): records the end of the window (USER, IDLE or AWAY), so a reveal has a start and an end.
   - Both write to the hash chained matter log (lalum_append_audit) and to the firm audit log the bookkeeping screens show
     (lalum_audit_write, when it exists), with the actor and role taken from the session.
   Who may reveal is unchanged: lalum_can_see_client_names (partner or attorney with a fresh MFA, and the platform admin).
   Not applied to production until approved. Until it is applied the interface falls back to the old call and says so. */

drop function if exists public.lalum_reveal_client_names();

create or replace function public.lalum_reveal_client_names(p_reason_code text, p_note text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_meta jsonb;
begin
  if v_firm is null or not public.lalum_can_see_client_names() then raise exception 'not allowed'; end if;
  if p_reason_code is null or p_reason_code not in ('INVOICE','COLLECTION','RECONCILIATION','CLIENT_CONTACT','MATTER_WORK','OTHER') then
    raise exception 'reason required';
  end if;
  if p_reason_code = 'OTHER' and (v_note is null or char_length(v_note) < 5) then raise exception 'reason required'; end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception 'note too long'; end if;
  v_meta := jsonb_build_object('reason', p_reason_code, 'note', v_note);
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'CLIENT_NAMES_REVEALED', null, v_meta);
  if to_regprocedure('public.lalum_audit_write(uuid,text,text,text,jsonb)') is not null then
    perform public.lalum_audit_write(v_firm, 'CLIENT_NAMES_REVEALED', 'client_names', null, v_meta);
  end if;
end $$;
revoke execute on function public.lalum_reveal_client_names(text, text) from public, anon;
grant execute on function public.lalum_reveal_client_names(text, text) to authenticated;

create or replace function public.lalum_hide_client_names(p_how text default 'USER') returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_how text := case when p_how in ('USER','IDLE','AWAY') then p_how else 'USER' end;
begin
  if v_firm is null or not public.lalum_can_see_client_names() then raise exception 'not allowed'; end if;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'CLIENT_NAMES_HIDDEN', null, jsonb_build_object('how', v_how));
  if to_regprocedure('public.lalum_audit_write(uuid,text,text,text,jsonb)') is not null then
    perform public.lalum_audit_write(v_firm, 'CLIENT_NAMES_HIDDEN', 'client_names', null, jsonb_build_object('how', v_how));
  end if;
end $$;
revoke execute on function public.lalum_hide_client_names(text) from public, anon;
grant execute on function public.lalum_hide_client_names(text) to authenticated;
