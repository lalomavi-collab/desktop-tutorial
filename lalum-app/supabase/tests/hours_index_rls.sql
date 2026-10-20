-- Tests for migration 0058 (attendance clock and hours index). Run after 00_supabase_stubs.sql, 0018, 0014, 0019, 0058:
--   psql -v ON_ERROR_STOP=1 -f hours_index_rls.sql
-- Every assertion raises on failure, so a clean run is the pass signal. Fixtures roll back.
-- matter_code comes from 0040, which needs live only objects; the column alone is enough here.
alter table public.lalum_cockpit_matters add column if not exists matter_code text;
create schema if not exists t;
grant usage on schema t to authenticated;

create or replace function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role authenticated';
end $$;

create or replace function t.n(p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin execute 'select count(*) from (' || p_sql || ') q' into v; return v; end $$;

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

grant execute on all functions in schema t to authenticated;

do $$
declare
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); b1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid();
  d date := (now() at time zone 'Asia/Jerusalem')::date - 1;
  s1 uuid; r jsonb; me jsonb;
begin
  insert into auth.users (id, email) values (p1,'p1@x'),(a1,'a1@x'),(b1,'b1@x'),(p2,'p2@x');
  insert into public.lalum_firms (id, firm_name, registration_no, primary_contact, email, phone, monthly_fee)
    values (f1,'F1','1','x','f1@x','1',0),(f2,'F2','2','x','f2@x','2',0);
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values
    (f1,p1,'P1','p1@x','FIRM_PARTNER'),(f1,a1,'A1','a1@x','ATTORNEY'),(f1,b1,'B1','b1@x','ATTORNEY'),(f2,p2,'P2','p2@x','FIRM_PARTNER');
  insert into public.lalum_cockpit_matters (id, firm_id, title) values (m1,f1,'M1');
  insert into public.lalum_matter_team (matter_id, user_id, firm_id) values (m1,a1,f1);
  insert into public.lalum_matter_fees (matter_id, firm_id, fee_model) values (m1,f1,'hourly');
  insert into public.lalum_rate_cards (firm_id, member_role, hourly_rate, valid_from) values (f1,'ATTORNEY',500,current_date-30);

  -- a1 worked 09:00 to 17:00 Israel time yesterday (480 minutes of presence); b1 left a session open for 30 hours
  insert into public.lalum_attendance (firm_id, user_id, clock_in, clock_out)
    values (f1, a1, (d + time '09:00') at time zone 'Asia/Jerusalem', (d + time '17:00') at time zone 'Asia/Jerusalem');
  insert into public.lalum_attendance (firm_id, user_id, clock_in) values (f1, b1, now() - interval '30 hours');
  -- a1 logged 300 + 240 minutes on the day (more than the 480 present), and 60 minutes on a day with no attendance
  insert into public.lalum_time_entries (firm_id, matter_id, timekeeper_id, work_date, worked_minutes, billable_minutes, narrative, status) values
    (f1, m1, a1, d,     300, 288, 'review draft agreement section 4', 'submitted'),
    (f1, m1, a1, d,     240, 240, 'negotiation call and follow up notes', 'submitted'),
    (f1, m1, a1, d - 2,  60,  60, 'prepare the filing checklist', 'submitted');

  -- the clock
  perform t.as_user(a1);
  perform t.eq(t.n('select 1 from public.lalum_attendance'), 1::bigint, 'attorney sees only their own sessions');
  perform t.fails('select public.lalum_clock_out()', 'NOT_CLOCKED_IN', 'clock out without a session is refused');
  s1 := public.lalum_clock_in();
  perform t.eq(t.n('select 1 from public.lalum_attendance where clock_out is null'), 1::bigint, 'clock in opens one session');
  perform t.fails('select public.lalum_clock_in()', 'ALREADY_CLOCKED_IN', 'a second open session is refused');
  perform t.fails(format('insert into public.lalum_attendance (firm_id, user_id, clock_in, clock_out) values (%L,%L,now()-interval ''2 hours'',now()-interval ''1 hour'')', f1, a1),
    'permission denied', 'no direct insert into attendance');
  perform t.fails(format('update public.lalum_attendance set clock_out = now() where id = %L', s1), 'permission denied', 'no direct update of attendance');
  perform public.lalum_clock_out();
  perform t.eq(t.n('select 1 from public.lalum_attendance where clock_out is null'), 0::bigint, 'clock out closes the session');
  perform t.fails(format('select public.lalum_attendance_correct(%L, now()-interval ''2 hours'', now()-interval ''1 hour'', %L)', s1, 'attorney tries to edit own time'),
    'FORBIDDEN', 'an attorney cannot correct a session');
  perform t.fails('select public.lalum_hours_index(current_date-7, current_date)', 'FORBIDDEN', 'an attorney cannot call the hours index');

  perform t.as_user(b1);
  perform t.eq(t.n('select 1 from public.lalum_attendance'), 1::bigint, 'another attorney sees only their own session');
  perform t.fails('select public.lalum_clock_out()', 'SESSION_TOO_LONG_NEEDS_CORRECTION', 'a session open for 30 hours needs a partner');
  perform t.fails('select public.lalum_clock_in()', 'ALREADY_CLOCKED_IN', 'cannot start a new session over a stale one');

  -- the report
  perform t.as_user(p1);
  perform t.eq(t.n('select 1 from public.lalum_attendance'), 3::bigint, 'partner sees every session in the firm');
  r := public.lalum_hours_index(d - 5, d + 1);
  me := (select x from jsonb_array_elements(r -> 'people') x where x ->> 'name' = 'A1');
  perform t.eq((me ->> 'attendance_minutes')::integer, 480, 'attendance counts closed sessions in Israel days');
  perform t.eq((me ->> 'logged_minutes')::integer, 600, 'logged is the sum of worked minutes');
  perform t.eq((me ->> 'billable_minutes')::integer, 588, 'billable is the sum of billable minutes');
  perform t.eq((me ->> 'value')::numeric, 4900.00::numeric, 'value is billable hours at the rate card');
  perform t.eq((me ->> 'days_over')::integer, 1, 'a day with more logged than present is flagged');
  perform t.eq((me ->> 'days_no_attendance')::integer, 1, 'a day with time but no attendance is flagged');
  me := (select x from jsonb_array_elements(r -> 'people') x where x ->> 'name' = 'B1');
  perform t.eq((me ->> 'open_sessions')::integer, 1, 'an open session is counted apart');
  perform t.eq((me ->> 'attendance_minutes')::integer, 0, 'an open session adds no attendance minutes');
  perform t.eq(jsonb_array_length(r -> 'matters'), 1, 'one matter in the matter table');
  perform t.eq(((r -> 'matters' -> 0) ->> 'logged_minutes')::integer, 600, 'matter total equals the person total');
  perform t.fails('select public.lalum_hours_index(current_date, current_date - 1)', 'BAD_RANGE', 'a reversed range is refused');
  perform t.fails('select public.lalum_hours_index(current_date - 500, current_date)', 'BAD_RANGE', 'a range over 400 days is refused');
  perform t.eq(t.n('select 1 from public.lalum_audit_log where entity = ''hours_index'''), 1::bigint, 'a successful view of the report is audited (a refused range is not)');

  -- corrections
  perform t.fails(format('select public.lalum_attendance_correct(%L, now()-interval ''3 hours'', now()-interval ''2 hours'', %L)', s1, 'short'),
    'REASON_REQUIRED', 'a correction needs a reason');
  perform t.fails(format('select public.lalum_attendance_correct(%L, now()-interval ''3 hours'', now()+interval ''2 hours'', %L)', s1, 'forgot to close the session'),
    'FUTURE_TIME', 'a correction cannot end in the future');
  perform t.fails(format('select public.lalum_attendance_add(%L, %L, %L, %L)', a1, (d + time '12:00') at time zone 'Asia/Jerusalem', (d + time '13:00') at time zone 'Asia/Jerusalem', 'missed punch during the lunch hour'),
    'OVERLAP', 'a session cannot overlap another of the same person');
  perform public.lalum_attendance_correct((select id from public.lalum_attendance where user_id = b1), now() - interval '30 hours', now() - interval '22 hours', 'forgot to clock out, confirmed by phone');
  perform t.eq(t.n('select 1 from public.lalum_attendance where user_id = ''' || b1 || ''' and adjusted_by is not null'), 1::bigint, 'a correction records who and why');
  perform t.eq(t.n('select 1 from public.lalum_audit_log where entity = ''lalum_attendance'' and action = ''UPDATED'''), 1::bigint, 'a correction is audited with old and new values');
  perform t.fails(format('select public.lalum_attendance_add(%L, now()-interval ''5 hours'', now()-interval ''4 hours'', %L)', p2, 'user of another firm is not a member'),
    'NOT_A_MEMBER', 'a partner cannot add a session for a user outside the firm');

  -- tenant isolation
  perform t.as_user(p2);
  perform t.eq(t.n('select 1 from public.lalum_attendance'), 0::bigint, 'other firm partner sees no sessions');
  r := public.lalum_hours_index(d - 5, d + 1);
  perform t.eq(jsonb_array_length(r -> 'people'), 1, 'other firm report lists only its own people');
  perform t.eq(jsonb_array_length(r -> 'matters'), 0, 'other firm report has no matters of firm one');
  perform t.fails(format('select public.lalum_attendance_correct(%L, now()-interval ''3 hours'', now()-interval ''2 hours'', %L)', s1, 'cross tenant attempt on firm one'),
    'FORBIDDEN', 'cannot correct a session of another firm');

  reset role;
  raise notice 'ALL HOURS INDEX CHECKS PASSED';
  raise exception 'ROLLBACK_FIXTURES';
exception when others then
  if sqlerrm = 'ROLLBACK_FIXTURES' then raise notice 'rolled back fixtures'; else raise; end if;
end $$;
