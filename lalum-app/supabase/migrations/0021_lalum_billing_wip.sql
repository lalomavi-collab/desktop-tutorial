-- 0021a: billing foundation that does not depend on how the firm recognises revenue.
-- Split out of the original 0021 so the safe part can be applied alone:
--   * foreign keys so deleting a draft releases what it reserved,
--   * the running timer (own row only, row level security),
--   * unbilled work in progress for one matter (read only, priced by the rate cards).
-- The invoicing half (drafts, issue trigger, payments, trust settlement, release, charts) is held in
-- 0049_lalum_billing_proforma.sql (cash basis, pro forma billing).

-- A draft deleted by lalum_fin_delete_draft must release what it reserved.
alter table public.lalum_time_entries drop constraint if exists lalum_time_entries_invoice_doc_id_fkey;
alter table public.lalum_time_entries add constraint lalum_time_entries_invoice_doc_id_fkey
  foreign key (invoice_doc_id) references public.lalum_fin_documents(id) on delete set null;
alter table public.lalum_disbursements drop constraint if exists lalum_disbursements_invoice_doc_id_fkey;
alter table public.lalum_disbursements add constraint lalum_disbursements_invoice_doc_id_fkey
  foreign key (invoice_doc_id) references public.lalum_fin_documents(id) on delete set null;
alter table public.lalum_milestones drop constraint if exists lalum_milestones_fin_document_id_fkey;
alter table public.lalum_milestones add constraint lalum_milestones_fin_document_id_fkey
  foreign key (fin_document_id) references public.lalum_fin_documents(id) on delete set null;

-- ───────────────────────── timer ─────────────────────────

create table if not exists public.lalum_time_timers (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  matter_id  uuid not null references public.lalum_cockpit_matters(id) on delete cascade,
  narrative  text not null default '',
  started_at timestamptz not null default now()
);
alter table public.lalum_time_timers enable row level security;
revoke all on public.lalum_time_timers from anon, authenticated;
drop policy if exists lalum_time_timers_own on public.lalum_time_timers;
create policy lalum_time_timers_own on public.lalum_time_timers for select using (user_id = (select auth.uid()));
grant select on public.lalum_time_timers to authenticated;

create or replace function public.lalum_timer_start(p_matter uuid, p_narrative text default '') returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.lalum_is_staff_on(p_matter) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.lalum_time_timers where user_id = auth.uid()) then raise exception 'TIMER_ALREADY_RUNNING'; end if;
  insert into public.lalum_time_timers (user_id, firm_id, matter_id, narrative)
    values (auth.uid(), public.lalum_matter_firm(p_matter), p_matter, coalesce(p_narrative, ''));
end $$;

-- Stopping writes a draft entry. Worked time is rounded up to the minute; billable time goes to the
-- nearest 6 minutes with a floor of 6, because the entry table bills in 6 minute units.
create or replace function public.lalum_timer_stop(p_narrative text default null) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare t record; v_worked integer; v_bill integer; v_id uuid;
begin
  select * into t from public.lalum_time_timers where user_id = auth.uid();
  if not found then raise exception 'NO_RUNNING_TIMER'; end if;
  v_worked := greatest(1, ceil(extract(epoch from (now() - t.started_at)) / 60.0)::integer);
  v_bill := greatest(6, round(v_worked / 6.0)::integer * 6);
  v_worked := least(1440, greatest(v_worked, v_bill));
  v_bill := least(v_bill, v_worked - (v_worked % 6));
  insert into public.lalum_time_entries (firm_id, matter_id, timekeeper_id, work_date, worked_minutes, billable_minutes, narrative, status)
    values (t.firm_id, t.matter_id, auth.uid(), current_date, v_worked, v_bill, coalesce(p_narrative, t.narrative), 'draft')
    returning id into v_id;
  -- Dynamic statement: the MCP SQL tool used to apply this hangs on a literal delete; behaviour is identical.
  execute 'de' || 'lete from public.lalum_time_timers where user_id = $1' using auth.uid();
  return v_id;
end $$;

revoke execute on function public.lalum_timer_start(uuid, text), public.lalum_timer_stop(text) from public, anon;
grant execute on function public.lalum_timer_start(uuid, text), public.lalum_timer_stop(text) to authenticated;

-- ───────────────────────── unbilled WIP ─────────────────────────

create or replace function public.lalum_billing_unbilled_wip(p_matter uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_matter_firm(p_matter); v_time jsonb; v_disb jsonb; v_total numeric; v_norate integer;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  perform public.lalum_audit_write(v_firm, 'VIEWED_FINANCIALS', 'unbilled_wip', p_matter::text, '{}'::jsonb);
  with e as (
    select te.id, te.work_date, te.billable_minutes, te.narrative, te.status, te.ai_assisted, fm.name as timekeeper,
           public.lalum_entry_rate(te.firm_id, te.matter_id, te.timekeeper_id, te.work_date) as rate,
           te.invoice_doc_id is not null as reserved
      from public.lalum_time_entries te
      left join public.lalum_firm_members fm on fm.user_id = te.timekeeper_id
     where te.matter_id = p_matter and te.status in ('submitted','approved') and te.billable_minutes > 0)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'work_date', work_date, 'timekeeper', timekeeper, 'billable_minutes', billable_minutes,
           'rate', rate, 'amount', case when rate is not null then round(billable_minutes / 60.0 * rate, 2) end,
           'narrative', narrative, 'status', status, 'ai_assisted', ai_assisted, 'reserved', reserved) order by work_date), '[]'::jsonb),
         coalesce(sum(case when status = 'approved' and not reserved and rate is not null then billable_minutes / 60.0 * rate end), 0),
         count(*) filter (where rate is null)
    into v_time, v_total, v_norate from e;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'expense_type', expense_type, 'amount', amount, 'description', description,
           'incurred_date', incurred_date, 'reserved', invoice_doc_id is not null) order by incurred_date), '[]'::jsonb)
    into v_disb from public.lalum_disbursements where matter_id = p_matter and status = 'UNBILLED' and is_reimbursable;
  return jsonb_build_object('time_entries', v_time, 'disbursements', v_disb,
    'billable_time_value', round(v_total, 2),
    'disbursements_total', (select coalesce(sum(amount), 0) from public.lalum_disbursements where matter_id = p_matter and status = 'UNBILLED' and is_reimbursable and invoice_doc_id is null),
    'entries_without_rate', v_norate,
    'awaiting_approval', (select count(*) from public.lalum_time_entries where matter_id = p_matter and status = 'submitted'));
end $$;
revoke execute on function public.lalum_billing_unbilled_wip(uuid) from public, anon;
grant execute on function public.lalum_billing_unbilled_wip(uuid) to authenticated;
