-- Tests for migration 0061 (audit log: matter reference RESTRICT, no personal names in the chain).
-- Run after the stubs, 0018, 0014, 0019, 0059, 0060 and 0061. 0059 needs extensions.digest (pgcrypto) and 0061 rewrites
-- lalum_portal_sign only where lalum_signature_requests exists, so this file creates a minimal stand-in for it first.
--   psql -v ON_ERROR_STOP=1 -f audit_log_hygiene.sql
-- Where the audit table is absent (the repository's stub schema) the file prints a notice and passes. Fixtures roll back.
create schema if not exists t;

create or replace function t.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expect || '%' then raise notice 'PASS: %', p_label; return; end if;
    raise exception 'FAIL: % (wrong error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % (statement succeeded)', p_label;
end $$;

create or replace function t.eq(p_got anyelement, p_want anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then raise exception 'FAIL: % (got %, want %)', p_label, p_got, p_want; end if;
  raise notice 'PASS: %', p_label;
end $$;

do $$
declare
  f uuid := gen_random_uuid(); u uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); req uuid := gen_random_uuid(); req2 uuid := gen_random_uuid();
  r jsonb; meta_signed jsonb; n0 bigint;
begin
  if to_regclass('public.lalum_matter_audit_log') is null then
    raise notice 'audit_log_hygiene: audit table not present, skipped';
    return;
  end if;
  insert into auth.users (id, email) values (u, 'signer@test.invalid');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee) values (f,'F','1','x','f@x','1',0);
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (m1, f, 'with history'), (m2, f, 'no history');
  perform public.lalum_append_audit(f, m1, null, 'MATTER_TRASHED', null, jsonb_build_object('documents', 3));

  -- a. RESTRICT
  perform t.eq((select confdeltype::text from pg_constraint where conname = 'lalum_matter_audit_log_matter_id_fkey'), 'r', 'matter reference is ON DELETE RESTRICT');
  perform t.eq((select convalidated from pg_constraint where conname = 'lalum_matter_audit_log_matter_id_fkey'), true, 'the constraint is validated');
  perform t.fails(format('delete from public.lalum_cockpit_matters where id = %L', m1), 'violates foreign key constraint', 'a matter with audit history cannot be deleted');
  perform t.eq((select matter_id from public.lalum_matter_audit_log where firm_id = f limit 1), m1, 'the audit row still points at its matter');
  delete from public.lalum_cockpit_matters where id = m2;
  perform t.eq((select count(*) from public.lalum_cockpit_matters where id = m2), 0::bigint, 'a matter with no audit history can still be deleted');
  -- the app path: anonymise the matter row and append MATTER_PURGED
  update public.lalum_cockpit_matters set title = 'purged' where id = m1;
  perform public.lalum_append_audit(f, m1, null, 'MATTER_PURGED', null, jsonb_build_object('documents', 3));
  perform t.eq((select count(*) from public.lalum_matter_audit_log where firm_id = f), 2::bigint, 'the purge path still appends to the chain');

  -- c. no personal keys, at any depth, in any case; ids and counts pass
  n0 := (select count(*) from public.lalum_matter_audit_log);
  perform t.fails(format('select public.lalum_append_audit(%L,%L,null,%L,null,%L::jsonb)', f, m1, 'X', '{"name":"someone"}'), 'personal data field', 'top level name key is refused');
  perform t.fails(format('select public.lalum_append_audit(%L,%L,null,%L,null,%L::jsonb)', f, m1, 'X', '{"Signer_Name":"someone"}'), 'personal data field', 'key match ignores case and underscores variant');
  perform t.fails(format('select public.lalum_append_audit(%L,%L,null,%L,null,%L::jsonb)', f, m1, 'X', '{"party":{"phone":"0"}}'), 'personal data field', 'a nested key is refused');
  perform t.fails(format('select public.lalum_append_audit(%L,%L,null,%L,null,%L::jsonb)', f, m1, 'X', '{"rows":[{"fullname":"a"}]}'), 'personal data field', 'a key inside an array is refused');
  perform t.fails(format('select public.lalum_append_audit(%L,%L,null,%L,null,%L::jsonb)', f, m1, 'X', '{"note":"a@b.co"}'), 'e-mail address', 'the existing e-mail rule still holds');
  perform t.eq((select count(*) from public.lalum_matter_audit_log), n0, 'a refused write leaves no row');
  perform public.lalum_append_audit(f, m1, null, 'DOCUMENT_CLASSIFIED', null, jsonb_build_object('doc', gen_random_uuid(), 'origin', 'upload', 'bytes', 12, 'party_no', 1, 'parties', 2, 'name_count', 4));
  perform t.eq((select count(*) from public.lalum_matter_audit_log), n0 + 1, 'ids, counts and words that merely contain "name" are accepted');
  perform t.eq((select public.lalum_verify_audit_chain(f)), null::bigint, 'the chain verifies clean');
  -- the writers that exist today must pass: the pipeline meta is passed through lalum_provision_matter as sent
  perform public.lalum_append_audit(f, m1, null, 'AUTOMATED_PIPELINE_SUCCESS', '', jsonb_build_object('source', 'UPLOAD', 'practice_area', 'REAL_ESTATE', 'risk_level', 'CAUTION', 'red', 0, 'yellow', 2, 'entities', 5));
  perform public.lalum_append_audit(f, m1, null, 'CONFLICT_HALT', '', jsonb_build_object('match_count', 1, 'source', 'UPLOAD'));
  perform public.lalum_append_audit(f, m1, null, 'KYC_COMPLETED', '', jsonb_build_object('party_no', 1, 'track', 'A', 'risk', 'LOW', 'pep', false, 'subject', 'INDIVIDUAL'));
  perform public.lalum_append_audit(f, m1, null, 'SIGNATURE_SENT', null, jsonb_build_object('request', gen_random_uuid(), 'provider', 'DOCUSEAL', 'submission', 123));
  perform t.eq((select count(*) from public.lalum_matter_audit_log), n0 + 5, 'the shapes the existing writers send are all accepted');

  -- b. the signature flow: the typed name is kept where it belongs, and not in the chain
  insert into public.lalum_signature_requests (id, firm_id, matter_id, signer_email, status, content_sha256)
    values (req, f, m1, 'signer@test.invalid', 'SENT', 'abc'), (req2, f, m1, 'signer@test.invalid', 'SENT', 'abd');
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', '{"email":"signer@test.invalid"}', true);
  r := public.lalum_portal_sign(req, 'Typed Signer', true);
  perform t.eq(r ->> 'status', 'SIGNED', 'signing still works');
  perform t.eq((select signed_name from public.lalum_signature_requests where id = req), 'Typed Signer', 'the typed name is stored on the signature request');
  select meta into meta_signed from public.lalum_matter_audit_log where action = 'SIGNATURE_SIGNED' and firm_id = f;
  perform t.eq(meta_signed ? 'name', false, 'the audit row for the signature has no name');
  perform t.eq(meta_signed ->> 'request', req::text, 'the audit row for the signature names the request by id');
  r := public.lalum_portal_sign(req2, null, false, true, 'no thanks');
  perform t.eq(r ->> 'status', 'DECLINED', 'declining still works and is audited');
  perform t.eq((select public.lalum_verify_audit_chain(f)), null::bigint, 'the chain still verifies clean after the signature flow');

  raise notice 'ALL AUDIT LOG HYGIENE CHECKS PASSED';
  raise exception 'ROLLBACK_FIXTURES';
exception when others then
  if sqlerrm = 'ROLLBACK_FIXTURES' then raise notice 'rolled back fixtures'; else raise; end if;
end $$;
