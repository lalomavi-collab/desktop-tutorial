-- Tests for migration 0064 (conflict notes off the audit chain). Run after the stubs, 0018, 0014, 0019, the extensions.digest shim,
-- 0059, 0060, 0061, the lalum_set_conflict_status body of 0012 and 0064:
--   psql -v ON_ERROR_STOP=1 -f conflict_notes.sql
-- Every assertion raises on failure. Fixtures roll back.
create schema if not exists t;
grant usage on schema t to authenticated;
create or replace function t.as_user(p_uid uuid, p_claims text default '{}') returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', p_claims, true);
  execute 'set local role authenticated';
end $$;
create or replace function t.eq(p_got anyelement, p_want anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then raise exception 'FAIL: % (got %, want %)', p_label, p_got, p_want; end if;
  raise notice 'PASS: %', p_label;
end $$;
create or replace function t.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expect || '%' then raise notice 'PASS: %', p_label; return; end if;
    raise exception 'FAIL: % (wrong error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % (statement succeeded)', p_label;
end $$;
grant execute on all functions in schema t to authenticated;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); st uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); v_note text := 'Cleared after review: Ploni Almoni is a former tenant only'; meta jsonb; n bigint;
begin
  if to_regclass('public.lalum_matter_audit_log') is null then raise exception 'FAIL: audit table missing, build the chain first'; end if;
  insert into auth.users (id, email) values (p1,'p1@x'),(p2,'p2@x'),(st,'st@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee, require_mfa) values
    (f1,'F1','1','x','f1@x','1',0,false),(f2,'F2','2','x','f2@x','2',0,false);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f2,p2,'P2','p2@x','FIRM_PARTNER'),(f1,st,'ST','st@x','ATTORNEY');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (m1, f1, 'M1');

  perform t.as_user(p1);
  perform public.lalum_set_conflict_status(m1, 'CLEAN', '  ' || v_note || '  ');
  reset role;
  select m into meta from (select a.meta as m from public.lalum_matter_audit_log a where a.matter_id = m1 and a.action = 'CONFLICT_STATUS_SET' order by a.seq desc limit 1) q;
  perform t.eq(meta ? 'note', false, 'the chain row has no note key');
  perform t.eq(meta ->> 'note_chars', length(v_note)::text, 'the chain row carries the length of the trimmed note');
  perform t.eq(meta ->> 'note_sha256', encode(extensions.digest(convert_to(v_note, 'UTF8'), 'sha256'), 'hex'), 'the chain row carries the sha256 of the trimmed note');
  perform t.eq(meta::text like '%Ploni%', false, 'no part of the note text is in the chain row');
  perform t.eq((select n.note from public.lalum_conflict_notes n where n.matter_id = m1), v_note, 'the trimmed note is in the notes table');
  perform t.eq((select count(*) from public.lalum_conflict_notes n join public.lalum_matter_audit_log a on a.id = n.audit_id where n.matter_id = m1 and a.action = 'CONFLICT_STATUS_SET'), 1::bigint, 'the note row points at its chain row');
  perform t.eq((select conflict_status from public.lalum_cockpit_matters where id = m1), 'CLEAN', 'the status is set');

  -- blank note: no table row, length 0
  perform t.as_user(p1);
  perform public.lalum_set_conflict_status(m1, 'POTENTIAL', '   ');
  perform public.lalum_set_conflict_status(m1, 'POTENTIAL');
  reset role;
  perform t.eq((select count(*) from public.lalum_conflict_notes where matter_id = m1), 1::bigint, 'a blank or missing note adds no row');
  select a.meta into meta from public.lalum_matter_audit_log a where a.matter_id = m1 and a.action = 'CONFLICT_STATUS_SET' order by a.seq desc limit 1;
  perform t.eq(meta, jsonb_build_object('status', 'POTENTIAL', 'note_chars', 0), 'a blank note leaves only status and a zero length');

  -- who may read and write
  perform t.as_user(p1);
  perform t.eq((select count(*) from public.lalum_conflict_notes), 1::bigint, 'the firm partner reads the firm note');
  perform t.fails(format('insert into public.lalum_conflict_notes (firm_id, matter_id, note, note_sha256) values (%L,%L,%L,%L)', f1, m1, 'x', 'y'), 'permission denied', 'a partner cannot write the table directly');
  perform t.as_user(p2);
  perform t.eq((select count(*) from public.lalum_conflict_notes), 0::bigint, 'another firm reads nothing');
  perform t.fails(format('select public.lalum_set_conflict_status(%L,%L,%L)', m1, 'CLEAN', 'x'), 'matter not found', 'another firm cannot set the status');
  perform t.as_user(st);
  perform t.eq((select count(*) from public.lalum_conflict_notes), 0::bigint, 'an attorney reads no notes');
  perform t.fails(format('select public.lalum_set_conflict_status(%L,%L,%L)', m1, 'CLEAN', 'x'), 'not allowed', 'an attorney cannot set the status');
  perform t.as_user(null);
  perform t.fails(format('select public.lalum_set_conflict_status(%L,%L,%L)', m1, 'CLEAN', 'x'), 'matter not found', 'no user is refused');
  perform t.as_user(p1);
  perform t.fails(format('select public.lalum_set_conflict_status(%L,%L,%L)', m1, 'BOGUS', 'x'), 'invalid status', 'an unknown status is refused');
  reset role;
  perform t.eq(has_table_privilege('anon', 'public.lalum_conflict_notes', 'select'), false, 'anon has no access');
  raise exception 'ALL_PASSED_ROLLBACK';
exception when others then
  if sqlerrm <> 'ALL_PASSED_ROLLBACK' then raise; end if;
  raise notice 'conflict_notes: all assertions passed (fixtures rolled back)';
end $$;
