/* Client names are hidden on screen by default (docs: the main screens show the matter code, L-YYYY-NNNN, instead).
   Showing the name is a deliberate act that only a partner or attorney with a fresh MFA may perform, and every reveal
   is written to the hash chained audit log. This migration gives the interface the two things it needs:
   - lalum_can_see_client_names(): may the signed in user ask for names (the interface shows or hides the control by it);
   - lalum_reveal_client_names(): the act itself, which re-checks the same rule and appends the audit entry.
   - matter_code on lalum_v_admin_matters, so the list screens can show the code without a second query.
   Limit, stated plainly: this protects the screen, not the wire. A user who may read a matter (RLS) still receives its
   title from the database; hiding is done by the interface. Removing the title from the payload for users who may not
   reveal it is a separate, larger change.
   Roles allowed to reveal: FIRM_PARTNER and ATTORNEY (and the platform admin). ADMIN and COMPLIANCE_OFFICER work from
   the code. To change who may reveal, change the role list in lalum_can_see_client_names only.
   Not applied to production until approved. */

create or replace function public.lalum_can_see_client_names() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_is_admin() or (
    public.lalum_my_firm_id() is not null and public.lalum_mfa_ok()
    and public.lalum_my_role() in ('FIRM_PARTNER','ATTORNEY')
  );
$$;
revoke execute on function public.lalum_can_see_client_names() from public, anon;
grant execute on function public.lalum_can_see_client_names() to authenticated;

create or replace function public.lalum_reveal_client_names() returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id();
begin
  if v_firm is null or not public.lalum_can_see_client_names() then raise exception 'not allowed'; end if;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'CLIENT_NAMES_REVEALED', null, '{}'::jsonb);
end $$;
revoke execute on function public.lalum_reveal_client_names() from public, anon;
grant execute on function public.lalum_reveal_client_names() to authenticated;

/* Same definition as before, with matter_code appended as the last column. */
create or replace view public.lalum_v_admin_matters with (security_invoker = true) as
 SELECT m.id AS matter_id,
    m.firm_id,
    f.firm_name,
    m.title,
    r.practice_area,
    m.status AS matter_status,
    m.conflict_status,
    r.partner_response,
    r.dispatched_at,
    r.first_viewed_at,
    (m.risk_summary ->> 'level'::text) AS risk_level,
    ((r.first_viewed_at IS NULL) AND (r.partner_response = 'PENDING_REVIEW'::text) AND (r.dispatched_at < (now() - '02:00:00'::interval))) AS sla_breached,
        CASE
            WHEN ((r.first_viewed_at IS NULL) AND (r.partner_response = 'PENDING_REVIEW'::text)) THEN (floor((EXTRACT(epoch FROM (now() - r.dispatched_at)) / (60)::numeric)))::integer
            ELSE NULL::integer
        END AS minutes_pending,
    m.matter_code
   FROM ((lalum_cockpit_matters m
     JOIN lalum_intake_routings r ON ((r.matter_id = m.id)))
     JOIN lalum_firms f ON ((f.id = m.firm_id)));
