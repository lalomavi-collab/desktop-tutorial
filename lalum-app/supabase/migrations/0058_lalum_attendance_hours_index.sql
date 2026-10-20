-- Hours index: an attendance clock per firm member and the partner report that sets presence against
-- hours logged on matters and hours that are billable.
--
-- What this answers, and what it does not
--  * Presence (clock in, clock out) is a firm level fact. It says nothing about which matter an hour
--    went to. Hours per matter come only from time entries and the running timer (0019, 0021a).
--    The report therefore shows three separate numbers per person and never spreads presence over matters:
--      attendance  = closed clock sessions
--      logged      = worked minutes on time entries (every status)
--      billable    = billable minutes on entries that were submitted, approved or billed
--    The gap between attendance and logged is time not allocated to any matter. It is shown as a gap.
--  * An entry is never rejected because the person was not clocked in. A day on which logged time
--    exceeds attendance, or logged time on a day with no attendance, is counted and flagged for the partner.
--
-- Design rules
--  * Additive only. No existing table, policy or function is changed.
--  * Sessions are written only through the functions below (no direct insert, update or delete for end users).
--  * A forgotten clock out is not guessed. A session open for more than 24 hours cannot be closed by its
--    owner; a partner corrects it with a reason, and the correction is audited with the old and new values.
--  * Days are Israel local days (Asia/Jerusalem). A session belongs to the day it started.
--  * The report is partner and admin only, behind MFA, and every view is written to the audit log.

create table if not exists public.lalum_attendance (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.lalum_firms(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete restrict,
  clock_in      timestamptz not null default now(),
  clock_out     timestamptz,
  adjusted_by   uuid,
  adjust_reason text,
  created_at    timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in),
  check (clock_out is null or clock_out - clock_in <= interval '24 hours'),
  check ((adjusted_by is null) = (adjust_reason is null))
);
create unique index if not exists lalum_attendance_one_open on public.lalum_attendance (user_id) where clock_out is null;
create index if not exists lalum_attendance_firm_idx on public.lalum_attendance (firm_id, clock_in desc);
create index if not exists lalum_attendance_user_idx on public.lalum_attendance (user_id, clock_in desc);

alter table public.lalum_attendance enable row level security;
revoke all on public.lalum_attendance from anon, authenticated;
drop policy if exists lalum_attendance_read on public.lalum_attendance;
create policy lalum_attendance_read on public.lalum_attendance for select
  using ((select public.lalum_fin_can(firm_id))
         or (user_id = (select auth.uid()) and firm_id = (select public.lalum_my_firm_id()) and (select public.lalum_mfa_ok())));
grant select on public.lalum_attendance to authenticated;

-- Same audit trail as the other billing tables, but only for what a partner wrote or changed: an ordinary
-- punch is not an audit event, a correction (old and new row, who, why) or a deletion is.
drop trigger if exists lalum_audit_t on public.lalum_attendance;
drop trigger if exists lalum_audit_ins_t on public.lalum_attendance;
create trigger lalum_audit_ins_t after insert on public.lalum_attendance
  for each row when (new.adjusted_by is not null) execute function public.lalum_billing_audit_trg();
drop trigger if exists lalum_audit_upd_t on public.lalum_attendance;
create trigger lalum_audit_upd_t after update on public.lalum_attendance
  for each row when (new.adjusted_by is not null) execute function public.lalum_billing_audit_trg();
drop trigger if exists lalum_audit_del_t on public.lalum_attendance;
create trigger lalum_audit_del_t after delete on public.lalum_attendance
  for each row execute function public.lalum_billing_audit_trg();

-- ───────────────────────── punch ─────────────────────────

create or replace function public.lalum_clock_in() returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_id uuid;
begin
  if auth.uid() is null or v_firm is null or not public.lalum_mfa_ok() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.lalum_attendance where user_id = auth.uid() and clock_out is null) then raise exception 'ALREADY_CLOCKED_IN'; end if;
  insert into public.lalum_attendance (firm_id, user_id) values (v_firm, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.lalum_clock_out() returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  if auth.uid() is null or not public.lalum_mfa_ok() then raise exception 'FORBIDDEN'; end if;
  select * into a from public.lalum_attendance where user_id = auth.uid() and clock_out is null for update;
  if not found then raise exception 'NOT_CLOCKED_IN'; end if;
  if now() - a.clock_in > interval '24 hours' then raise exception 'SESSION_TOO_LONG_NEEDS_CORRECTION'; end if;
  update public.lalum_attendance set clock_out = greatest(now(), a.clock_in + interval '1 second') where id = a.id;
  return a.id;
end $$;

-- ───────────────────────── partner corrections ─────────────────────────

-- Shared validation for a closed session written by a partner.
create or replace function public.lalum_attendance_check(p_user uuid, p_in timestamptz, p_out timestamptz, p_reason text, p_except uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_in is null or p_out is null or p_out <= p_in then raise exception 'BAD_TIMES'; end if;
  if p_out - p_in > interval '24 hours' then raise exception 'SESSION_TOO_LONG'; end if;
  if p_out > now() + interval '1 minute' then raise exception 'FUTURE_TIME'; end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then raise exception 'REASON_REQUIRED'; end if;
  if exists (select 1 from public.lalum_attendance x
              where x.user_id = p_user and x.id is distinct from p_except
                and tstzrange(x.clock_in, coalesce(x.clock_out, 'infinity'::timestamptz)) && tstzrange(p_in, p_out)) then
    raise exception 'OVERLAP';
  end if;
end $$;

create or replace function public.lalum_attendance_correct(p_id uuid, p_in timestamptz, p_out timestamptz, p_reason text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from public.lalum_attendance where id = p_id for update;
  if not found or not public.lalum_fin_can(a.firm_id) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_attendance_check(a.user_id, p_in, p_out, p_reason, p_id);
  update public.lalum_attendance set clock_in = p_in, clock_out = p_out, adjusted_by = auth.uid(), adjust_reason = btrim(p_reason) where id = p_id;
end $$;

create or replace function public.lalum_attendance_add(p_user uuid, p_in timestamptz, p_out timestamptz, p_reason text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_id uuid;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.lalum_firm_members where firm_id = v_firm and user_id = p_user) then raise exception 'NOT_A_MEMBER'; end if;
  perform public.lalum_attendance_check(p_user, p_in, p_out, p_reason, null);
  insert into public.lalum_attendance (firm_id, user_id, clock_in, clock_out, adjusted_by, adjust_reason)
    values (v_firm, p_user, p_in, p_out, auth.uid(), btrim(p_reason)) returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.lalum_clock_in(), public.lalum_clock_out(),
  public.lalum_attendance_check(uuid, timestamptz, timestamptz, text, uuid),
  public.lalum_attendance_correct(uuid, timestamptz, timestamptz, text),
  public.lalum_attendance_add(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.lalum_clock_in(), public.lalum_clock_out(),
  public.lalum_attendance_correct(uuid, timestamptz, timestamptz, text),
  public.lalum_attendance_add(uuid, timestamptz, timestamptz, text) to authenticated;

-- ───────────────────────── the report ─────────────────────────

-- One call, one jsonb: people (presence against logged against billable), matters, and the
-- person by matter split. Value is the billable time priced by the rate cards on matters that bill by the hour;
-- entries without a rate are counted, not guessed.
create or replace function public.lalum_hours_index(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_people jsonb; v_matters jsonb; v_split jsonb;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'BAD_RANGE'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'hours_index', null, jsonb_build_object('from', p_from, 'to', p_to));

  with att as (
    select a.user_id, (a.clock_in at time zone 'Asia/Jerusalem')::date as d,
           sum(extract(epoch from (a.clock_out - a.clock_in)) / 60.0) as mins
      from public.lalum_attendance a
     where a.firm_id = v_firm and a.clock_out is not null
       and (a.clock_in at time zone 'Asia/Jerusalem')::date between p_from and p_to
     group by 1, 2
  ), te as (
    select t.*, f.fee_model,
           case when t.status in ('submitted','approved','billed') then t.billable_minutes else 0 end as bill_min
      from public.lalum_time_entries t
      left join public.lalum_matter_fees f on f.matter_id = t.matter_id
     where t.firm_id = v_firm and t.work_date between p_from and p_to
  ), day_log as (
    select timekeeper_id as user_id, work_date as d, sum(worked_minutes) as mins from te group by 1, 2
  ), day_gap as (
    select coalesce(a.user_id, l.user_id) as user_id,
           count(*) filter (where a.user_id is null) as days_no_attendance,
           count(*) filter (where a.user_id is not null and coalesce(l.mins, 0) > a.mins) as days_over
      from att a full join day_log l on l.user_id = a.user_id and l.d = a.d
     group by 1
  ), p_att as (
    select user_id, round(sum(mins))::integer as att_min, count(*)::integer as att_days from att group by 1
  ), p_open as (
    select user_id, count(*)::integer as open_n from public.lalum_attendance where firm_id = v_firm and clock_out is null group by 1
  ), p_log as (
    select timekeeper_id as user_id,
           sum(worked_minutes)::integer as logged,
           sum(bill_min)::integer as billable,
           coalesce(sum(billable_minutes) filter (where status = 'billed'), 0)::integer as billed,
           coalesce(sum(worked_minutes) filter (where status = 'draft'), 0)::integer as draft,
           coalesce(sum(worked_minutes) filter (where status = 'written_off'), 0)::integer as written_off,
           round(coalesce(sum(case when bill_min > 0 and fee_model in ('hourly','capped','hybrid')
                  then bill_min / 60.0 * public.lalum_entry_rate(firm_id, matter_id, timekeeper_id, work_date) end), 0), 2) as value,
           count(*) filter (where bill_min > 0 and fee_model in ('hourly','capped','hybrid')
                  and public.lalum_entry_rate(firm_id, matter_id, timekeeper_id, work_date) is null)::integer as without_rate
      from te group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', fm.name, 'role', fm.role,
           'attendance_minutes', coalesce(pa.att_min, 0), 'attendance_days', coalesce(pa.att_days, 0),
           'open_sessions', coalesce(po.open_n, 0),
           'logged_minutes', coalesce(pl.logged, 0), 'billable_minutes', coalesce(pl.billable, 0), 'billed_minutes', coalesce(pl.billed, 0),
           'draft_minutes', coalesce(pl.draft, 0), 'written_off_minutes', coalesce(pl.written_off, 0),
           'value', coalesce(pl.value, 0), 'entries_without_rate', coalesce(pl.without_rate, 0),
           'days_over', coalesce(dg.days_over, 0), 'days_no_attendance', coalesce(dg.days_no_attendance, 0)
         ) order by fm.name), '[]'::jsonb)
    into v_people
    from public.lalum_firm_members fm
    left join p_att pa on pa.user_id = fm.user_id
    left join p_open po on po.user_id = fm.user_id
    left join p_log pl on pl.user_id = fm.user_id
    left join day_gap dg on dg.user_id = fm.user_id
   where fm.firm_id = v_firm;

  with te as (
    select t.*, f.fee_model,
           case when t.status in ('submitted','approved','billed') then t.billable_minutes else 0 end as bill_min
      from public.lalum_time_entries t
      left join public.lalum_matter_fees f on f.matter_id = t.matter_id
     where t.firm_id = v_firm and t.work_date between p_from and p_to
  ), m as (
    select matter_id, max(fee_model) as fee_model, count(distinct timekeeper_id)::integer as people,
           sum(worked_minutes)::integer as logged, sum(bill_min)::integer as billable,
           coalesce(sum(billable_minutes) filter (where status = 'billed'), 0)::integer as billed,
           coalesce(sum(worked_minutes) filter (where status = 'written_off'), 0)::integer as written_off,
           round(coalesce(sum(case when bill_min > 0 and fee_model in ('hourly','capped','hybrid')
                  then bill_min / 60.0 * public.lalum_entry_rate(firm_id, matter_id, timekeeper_id, work_date) end), 0), 2) as value
      from te group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'matter_id', m.matter_id, 'matter_code', cm.matter_code, 'title', cm.title, 'fee_model', m.fee_model,
           'people', m.people, 'logged_minutes', m.logged, 'billable_minutes', m.billable, 'billed_minutes', m.billed,
           'written_off_minutes', m.written_off, 'value', m.value) order by m.logged desc), '[]'::jsonb)
    into v_matters
    from m join public.lalum_cockpit_matters cm on cm.id = m.matter_id;

  select coalesce(jsonb_agg(x order by (x ->> 'logged_minutes')::integer desc), '[]'::jsonb) into v_split from (
    select jsonb_build_object('matter_id', t.matter_id, 'name', fm.name,
             'logged_minutes', sum(t.worked_minutes)::integer,
             'billable_minutes', sum(case when t.status in ('submitted','approved','billed') then t.billable_minutes else 0 end)::integer) as x
      from public.lalum_time_entries t
      left join public.lalum_firm_members fm on fm.user_id = t.timekeeper_id
     where t.firm_id = v_firm and t.work_date between p_from and p_to
     group by t.matter_id, t.timekeeper_id, fm.name
     order by sum(t.worked_minutes) desc limit 500) s;

  return jsonb_build_object('from', p_from, 'to', p_to, 'people', v_people, 'matters', v_matters, 'split', v_split);
end $$;
revoke execute on function public.lalum_hours_index(date, date) from public, anon;
grant execute on function public.lalum_hours_index(date, date) to authenticated;
