-- 0061: the audit log keeps its matter reference (RESTRICT) and holds no personal names.
--
-- Found on 2026-10-20 (read only on the live project, and reproduced on a local Postgres 16):
--  1. lalum_matter_audit_log.matter_id was ON DELETE SET NULL. SET NULL is an UPDATE, the append-only trigger refuses
--     it, so a hard DELETE of a matter that has audit rows failed with a trigger error. The app never deletes a matter
--     row (the bin flags it, lalum_finish_purge_matter clears the children, blanks the title and sets purged_at), so
--     nothing in the app hit this. RESTRICT states the real rule in the schema: a matter with a history is not deleted.
--  2. Exactly one writer put a personal name into the chain: lalum_portal_sign wrote the signer's typed name into the
--     audit meta of SIGNATURE_SIGNED. The name is already kept where it belongs, in lalum_signature_requests.signed_name,
--     so the audit copy was redundant, and the chain cannot be erased. Every other meta value checked on the live project
--     was an id (doc and request are uuids in 100 percent of rows) or a count.
--
-- This migration:
--   a. changes the matter reference to ON DELETE RESTRICT;
--   b. rewrites lalum_portal_sign so the audit meta carries only the request id (the live body, one line changed);
--   c. makes lalum_append_audit refuse a meta key that carries personal data, at any depth, so a future writer cannot
--      bring names back. The rest of the function is the live body, unchanged; the hash and the chain are untouched.
--
-- Not done, on purpose: the two existing SIGNATURE_SIGNED rows keep the name they were written with. The chain is
-- append-only and rewriting a row would break it; whether to accept that, or to document an exception, is the owner's call.
-- Every step is guarded and idempotent: a no-op where the audit table or the signature table is absent.

do $mig$
begin
  if to_regclass('public.lalum_matter_audit_log') is null then
    raise notice '0061: public.lalum_matter_audit_log not present, nothing to do';
    return;
  end if;

  -- a. RESTRICT. Added NOT VALID and then validated, so the table is held only briefly.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.lalum_matter_audit_log'::regclass and contype = 'f'
       and conname = 'lalum_matter_audit_log_matter_id_fkey' and confdeltype = 'r'
  ) then
    alter table public.lalum_matter_audit_log drop constraint if exists lalum_matter_audit_log_matter_id_fkey;
    alter table public.lalum_matter_audit_log
      add constraint lalum_matter_audit_log_matter_id_fkey
      foreign key (matter_id) references public.lalum_cockpit_matters(id) on delete restrict not valid;
    alter table public.lalum_matter_audit_log validate constraint lalum_matter_audit_log_matter_id_fkey;
  end if;

  -- b. The signer's name stays in lalum_signature_requests.signed_name; the chain records only which request was signed.
  if to_regclass('public.lalum_signature_requests') is not null then
    execute $stmt$
      create or replace function public.lalum_portal_sign(p_request uuid, p_name text, p_consent boolean, p_decline boolean default false, p_reason text default null, p_user_agent text default null)
      returns jsonb language plpgsql security definer set search_path to 'public' as $body$
      declare r public.lalum_signature_requests; v_email text := (select auth.jwt() ->> 'email');
      begin
        select * into r from public.lalum_signature_requests where id = p_request;
        if r.id is null or lower(r.signer_email) is distinct from lower(coalesce(v_email,'')) then raise exception 'not allowed'; end if;
        if r.status not in ('SENT','VIEWED') then raise exception 'not open for signing'; end if;

        if p_decline then
          update public.lalum_signature_requests
             set status = 'DECLINED', declined_at = now(), decline_reason = nullif(p_reason,'')
           where id = p_request;
          perform public.lalum_append_audit(r.firm_id, r.matter_id, auth.uid(), 'SIGNATURE_DECLINED', null,
            jsonb_build_object('request', p_request));
          return jsonb_build_object('status', 'DECLINED');
        end if;

        if coalesce(p_consent, false) is not true or length(trim(coalesce(p_name,''))) = 0 then
          raise exception 'name and consent required';
        end if;
        update public.lalum_signature_requests
           set status = 'SIGNED', signed_at = now(), signed_name = trim(p_name),
               signed_consent = true, signed_user_agent = left(coalesce(p_user_agent,''), 400)
         where id = p_request;
        perform public.lalum_append_audit(r.firm_id, r.matter_id, auth.uid(), 'SIGNATURE_SIGNED', r.content_sha256,
          jsonb_build_object('request', p_request));
        return jsonb_build_object('status', 'SIGNED');
      end $body$
    $stmt$;
  end if;

  -- c. The one place every writer goes through. After b, no function and no Edge Function in this repository writes
  -- one of these keys. The pattern is on key names only, never on values, and looks inside nested objects and arrays.
  execute $stmt$
    create or replace function public.lalum_audit_meta_has_personal_key(p jsonb) returns boolean
    language sql immutable set search_path to 'public' as $body$
      with recursive n(v) as (
        select p
        union all
        select c.value from n, lateral (
          select value from jsonb_each(case when jsonb_typeof(n.v) = 'object' then n.v else '{}'::jsonb end)
          union all
          select value from jsonb_array_elements(case when jsonb_typeof(n.v) = 'array' then n.v else '[]'::jsonb end)
        ) c
      )
      select exists (
        select 1 from n, lateral jsonb_object_keys(case when jsonb_typeof(n.v) = 'object' then n.v else '{}'::jsonb end) k
         where k ~* '^(name|full_?name|signer_?name|client_?name|first_?name|last_?name|phone|address|id_?number|tax_?id|email)$'
      )
    $body$
  $stmt$;
  revoke all on function public.lalum_audit_meta_has_personal_key(jsonb) from public, anon, authenticated;

  if to_regprocedure('public.lalum_append_audit(uuid,uuid,uuid,text,text,jsonb)') is not null then
    execute $stmt$
      create or replace function public.lalum_append_audit(p_firm uuid, p_matter uuid, p_actor uuid, p_action text, p_ai_hash text, p_meta jsonb default '{}'::jsonb)
      returns bigint language plpgsql security definer set search_path to 'public', 'extensions' as $body$
      declare v_seq bigint; v_prev text; v_ts timestamptz := clock_timestamp(); v_id bigint;
      begin
        if p_meta::text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
          raise exception 'refusing to write an e-mail address into the audit log';
        end if;
        if public.lalum_audit_meta_has_personal_key(coalesce(p_meta, '{}'::jsonb)) then
          raise exception 'refusing to write a personal data field into the audit log: reference it by id';
        end if;
        perform pg_advisory_xact_lock(hashtextextended('lalum_audit:' || p_firm::text, 0));
        select seq, hash into v_seq, v_prev from public.lalum_matter_audit_log
         where firm_id = p_firm order by seq desc limit 1;
        v_seq := coalesce(v_seq, 0) + 1;
        v_prev := coalesce(v_prev, repeat('0', 64));
        insert into public.lalum_matter_audit_log
          (firm_id, seq, matter_id, attorney_id, action, ai_output_hash, meta, prev_hash, hash, "timestamp")
        values (p_firm, v_seq, p_matter, p_actor, p_action, coalesce(p_ai_hash,''), coalesce(p_meta,'{}'::jsonb), v_prev,
                public.lalum_audit_hash(v_prev, v_seq, p_firm, p_matter, p_actor, p_action, coalesce(p_ai_hash,''), coalesce(p_meta,'{}'::jsonb), v_ts),
                v_ts)
        returning id into v_id;
        return v_id;
      end $body$
    $stmt$;
  end if;
end $mig$;
