-- 0080: the firm export needs a second factor entered in the last 10 minutes, not only an aal2 session.
--
-- lalum_export_allowed (0066) accepted any aal2 session, so a browser tab left signed in from the morning could pull every record of the firm with
-- one click. For a partner it was even weaker: lalum_mfa_ok() answers true when the firm's require_mfa is off, so no second factor was needed at all.
-- A full export is the most sensitive thing the platform does, so it now asks for a second factor typed shortly before it, for the platform admin and
-- for the partner alike. The JWT already says when: its amr claim lists each method used in the session with the time it was used, and a second
-- factor verified again in the same session adds a new entry (the session stays aal2, the entry's timestamp moves).
--   * lalum_mfa_age_seconds(): seconds since the newest second factor entry (totp, phone, webauthn) in the caller's JWT, null when there is none.
--   * lalum_export_role_ok(firm): the old gate (admin with aal2, or a partner of that firm with financial permission), unchanged.
--   * lalum_export_allowed(firm): role_ok AND aal2 AND an entry no older than 600 seconds (and not more than 60 seconds in the future, for clock skew).
--     It is called by the manifest, the page and both originals functions, so there is no way round it by skipping the manifest.
--   * lalum_export_status(firm): the answer the screen asks before it starts: {eligible, fresh, window_seconds}. It reveals nothing but those
--     two booleans about the caller's own session, so the screen can ask for a code instead of failing half way.
-- A partner of a firm with no second factor enrolled can no longer export; the screen sends them to the security settings to enrol one.
-- The 600 seconds are one constant, in lalum_export_allowed and lalum_export_status; the export takes about half a minute for 250 originals.

create or replace function public.lalum_mfa_age_seconds() returns bigint
language sql stable security definer set search_path to 'public' as $$
  select extract(epoch from now())::bigint - max((e ->> 'timestamp')::bigint)
    from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'object'
     and e ->> 'method' in ('totp', 'phone', 'webauthn', 'mfa/totp', 'mfa/phone', 'mfa/webauthn')
     and e ->> 'timestamp' ~ '^[0-9]{1,12}$'
$$;
revoke all on function public.lalum_mfa_age_seconds() from public, anon, authenticated;

create or replace function public.lalum_export_role_ok(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and p_firm is not null and (
    (coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
    or (p_firm = public.lalum_my_firm_id() and public.lalum_my_role() in ('FIRM_PARTNER', 'ADMIN')
        and coalesce(public.lalum_mfa_ok(), false) and coalesce(public.lalum_fin_can(p_firm), false)))
$$;
revoke all on function public.lalum_export_role_ok(uuid) from public, anon, authenticated;

create or replace function public.lalum_export_allowed(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_export_role_ok(p_firm)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and coalesce(public.lalum_mfa_age_seconds() between -60 and 600, false)
$$;
revoke all on function public.lalum_export_allowed(uuid) from public, anon, authenticated;

create or replace function public.lalum_export_status(p_firm uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'eligible', public.lalum_export_role_ok(p_firm),
    'fresh', coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and coalesce(public.lalum_mfa_age_seconds() between -60 and 600, false),
    'window_seconds', 600)
$$;
revoke all on function public.lalum_export_status(uuid) from public, anon;
grant execute on function public.lalum_export_status(uuid) to authenticated;
