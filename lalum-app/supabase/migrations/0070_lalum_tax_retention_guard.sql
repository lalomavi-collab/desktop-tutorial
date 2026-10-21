-- 0070: tax retention of the firm's accounting records, enforced.
--
-- The duty (verified 2026-10-20 against two independent sources each, see docs/firm-closure.md): accounting records are kept 7 years from the end
-- of the tax year, or 6 years from the filing of the return, whichever is later (Income Tax Instructions (Bookkeeping) 1973, instruction 25(c)).
-- The platform does not know the filing date, so what it can enforce is only the floor: the end of the calendar tax year of the record plus 7
-- years. A firm whose return was filed late may owe a longer period; that stays the firm's to know. The floor is never shorter than the law.
--
-- What was already protected: an issued tax document (lalum_fin_documents, 0014) and the Invoice4U mirror (lalum_fin_archive, 0015) cannot be
-- deleted at all, by their own triggers, even after the period (stricter than the law; relaxing it is a product decision, not made here).
-- What was not: payments and expenses are accounting records too, and any user with financial permission could delete them the next day.
--
-- This migration adds:
--   lalum_tax_retention_until(date)   the last day a record of that date must be kept (31 December of year + 7)
--   a delete guard on lalum_fin_payments and lalum_fin_expenses: refused (TAX_RETENTION) until that day has passed. A row the platform recorded
--     in the last 24 hours may still be removed, so that a mistaken entry can be undone; the date of a kept row cannot be moved, which would move
--     its clock. Edits of amounts are not blocked: a correction is not a deletion, and the audit of corrections is a separate question.
--   a delete guard on lalum_firms: a firm that holds accounting records still in retention (or any issued document or archive row) cannot be
--     deleted, with a message that names the cause instead of the cascade failing on whichever child trigger fires first.
--   lalum_firm_closure_checklist (0062, re-created): one more INFO item, accounting_records (a count), and a top level accounting_retained_until
--     (the latest day among them, or null). Closing a firm does not remove these records; the checklist now says so.
-- No data changes. Nothing is backfilled.

create or replace function public.lalum_tax_retention_until(p_date date) returns date
language sql immutable as $$ select make_date(extract(year from p_date)::int + 8, 1, 1) - 1 $$;
revoke execute on function public.lalum_tax_retention_until(date) from public, anon;
grant execute on function public.lalum_tax_retention_until(date) to authenticated;

create or replace function public.lalum_fin_record_retention_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_old date; v_new date;
begin
  if tg_table_name = 'lalum_fin_expenses' then v_old := old.spent_on; else v_old := old.paid_on; end if;
  -- a record the platform took in during the last day is an entry that can still be undone
  if old.created_at >= now() - interval '24 hours' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if current_date > public.lalum_tax_retention_until(coalesce(v_old, current_date)) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'TAX_RETENTION: this record must be kept until the end of %', public.lalum_tax_retention_until(coalesce(v_old, current_date)); end if;
  if tg_table_name = 'lalum_fin_expenses' then v_new := new.spent_on; else v_new := new.paid_on; end if;
  if v_new is distinct from v_old or new.firm_id is distinct from old.firm_id then raise exception 'TAX_RETENTION_DATE_LOCKED'; end if;
  return new;
end $$;
revoke execute on function public.lalum_fin_record_retention_guard() from public, anon, authenticated;
create trigger lalum_fin_expenses_retention_t before update or delete on public.lalum_fin_expenses for each row execute function public.lalum_fin_record_retention_guard();
create trigger lalum_fin_payments_retention_t before update or delete on public.lalum_fin_payments for each row execute function public.lalum_fin_record_retention_guard();

create or replace function public.lalum_firm_retention_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if exists (select 1 from public.lalum_fin_documents where firm_id = old.id and status <> 'DRAFT')
     or exists (select 1 from public.lalum_fin_archive where firm_id = old.id)
     or exists (select 1 from public.lalum_fin_payments where firm_id = old.id and current_date <= public.lalum_tax_retention_until(coalesce(paid_on, current_date)) and created_at < now() - interval '24 hours')
     or exists (select 1 from public.lalum_fin_expenses where firm_id = old.id and current_date <= public.lalum_tax_retention_until(coalesce(spent_on, current_date)) and created_at < now() - interval '24 hours') then
    raise exception 'TAX_RETENTION_FIRM: the firm holds accounting records that must be kept; close it (CANCELED) instead of deleting it';
  end if;
  return old;
end $$;
revoke execute on function public.lalum_firm_retention_guard() from public, anon, authenticated;
create trigger lalum_firms_retention_t before delete on public.lalum_firms for each row execute function public.lalum_firm_retention_guard();

create or replace function public.lalum_firm_closure_checklist(p_firm uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_status text; v_items jsonb; v_blockers integer; v_warnings integer; v_until date;
  v_admin boolean := coalesce(public.lalum_is_admin(), false) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
begin
  -- coalesce: lalum_fin_can can be null for a caller with no firm, and "not null" would not raise
  if auth.uid() is null or not (v_admin or coalesce(public.lalum_fin_can(p_firm), false)) then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.lalum_firms where id = p_firm;
  if v_status is null then raise exception 'NOT_FOUND'; end if;
  perform public.lalum_audit_write(p_firm, 'VIEWED_FINANCIALS', 'closure_checklist', null, '{}'::jsonb);

  with m as (
    select id, legal_hold, handling_ended_at, deleted_at, purge_requested_at
      from public.lalum_cockpit_matters where firm_id = p_firm and purged_at is null
  ), trust as (
    select matter_id, sum(amount) as bal from public.lalum_trust_ledger where firm_id = p_firm group by matter_id having sum(amount) <> 0
  ), items(key, severity, rank, n, amount) as (values
    ('trust_balance_nonzero',            'BLOCKER', 1, (select count(*) from trust),                                                         (select coalesce(sum(abs(bal)), 0) from trust)),
    ('legal_hold_active',                'BLOCKER', 1, (select count(*) from m where legal_hold),                                            null::numeric),
    ('deadlines_pending',                'BLOCKER', 1, (select count(*) from public.lalum_deadlines d join m on m.id = d.matter_id where d.status = 'PENDING'),
                                                       (select count(*) from public.lalum_deadlines d join m on m.id = d.matter_id where d.status = 'PENDING' and d.due_date <= current_date + 30)),
    ('signatures_in_flight',             'BLOCKER', 1, (select count(*) from public.lalum_signature_requests where firm_id = p_firm and status in ('SENT','VIEWED')), null::numeric),
    ('fin_documents_mid_issuance',       'BLOCKER', 1, (select count(*) from public.lalum_fin_documents where firm_id = p_firm and status in ('SEALING','ALLOCATED')), null::numeric),
    ('fin_documents_draft',              'WARNING', 2, (select count(*) from public.lalum_fin_documents where firm_id = p_firm and status = 'DRAFT'), null::numeric),
    ('signature_drafts',                 'WARNING', 2, (select count(*) from public.lalum_signature_requests where firm_id = p_firm and status = 'DRAFT'), null::numeric),
    ('tasks_open',                       'WARNING', 2, (select count(*) from public.lalum_matter_tasks t join m on m.id = t.matter_id where t.status = 'OPEN'), null::numeric),
    ('inquiries_unhandled',              'WARNING', 2, (select count(*) from public.lalum_matter_inquiries where firm_id = p_firm and status in ('NEW','SEEN')), null::numeric),
    ('unbilled_time_entries',            'WARNING', 2, (select count(*) from public.lalum_time_entries where firm_id = p_firm and status in ('draft','submitted','approved')),
                                                       (select coalesce(sum(billable_minutes), 0) from public.lalum_time_entries where firm_id = p_firm and status in ('draft','submitted','approved'))),
    ('unbilled_disbursements',           'WARNING', 2, (select count(*) from public.lalum_disbursements where firm_id = p_firm and status = 'UNBILLED'), null::numeric),
    ('platform_invoices_unpaid',         'WARNING', 2, (select count(*) from public.lalum_invoices where firm_id = p_firm and status = 'ISSUED'),
                                                       (select coalesce(sum(net_amount + vat_amount), 0) from public.lalum_invoices where firm_id = p_firm and status = 'ISSUED')),
    ('purge_started_not_finished',       'WARNING', 2, (select count(*) from m where purge_requested_at is not null), null::numeric),
    ('matters_live',                     'INFO',    3, (select count(*) from m where deleted_at is null), null::numeric),
    ('matters_in_bin',                   'INFO',    3, (select count(*) from m where deleted_at is not null), null::numeric),
    ('matters_without_retention_clock',  'INFO',    3, (select count(*) from m where handling_ended_at is null), null::numeric),
    ('originals_in_storage',             'INFO',    3, (select count(*) from public.lalum_matter_documents where firm_id = p_firm and original_path is not null), null::numeric),
    ('members',                          'INFO',    3, (select count(*) from public.lalum_firm_members where firm_id = p_firm), null::numeric),
    ('accounting_records',               'INFO',    3, (select (select count(*) from public.lalum_fin_documents where firm_id = p_firm and status <> 'DRAFT') + (select count(*) from public.lalum_fin_archive where firm_id = p_firm)
                                                              + (select count(*) from public.lalum_fin_payments where firm_id = p_firm) + (select count(*) from public.lalum_fin_expenses where firm_id = p_firm)), null::numeric),
    ('tax_connections',                  'INFO',    3, (select count(*) from public.lalum_tax_connections where firm_id = p_firm), null::numeric),
    ('intake_token_set',                 'INFO',    3, (select count(*) from lalum_private.firm_secrets where firm_id = p_firm and intake_token_hash is not null), null::numeric)
  )
  select jsonb_agg(jsonb_build_object('key', key, 'severity', severity, 'count', n, 'amount', amount) order by rank, key),
         count(*) filter (where severity = 'BLOCKER' and n > 0),
         count(*) filter (where severity = 'WARNING' and n > 0)
    into v_items, v_blockers, v_warnings
    from items;

  select max(public.lalum_tax_retention_until(d)) into v_until from (
    select issue_date d from public.lalum_fin_documents where firm_id = p_firm and status <> 'DRAFT'
    union all select issue_date from public.lalum_fin_archive where firm_id = p_firm
    union all select paid_on from public.lalum_fin_payments where firm_id = p_firm
    union all select spent_on from public.lalum_fin_expenses where firm_id = p_firm) x;

  return jsonb_build_object('firm_status', v_status, 'can_begin_closing', v_blockers = 0, 'blockers', v_blockers, 'warnings', v_warnings, 'items', v_items, 'accounting_retained_until', v_until);
end $$;
revoke execute on function public.lalum_firm_closure_checklist(uuid) from public, anon;
grant execute on function public.lalum_firm_closure_checklist(uuid) to authenticated;
