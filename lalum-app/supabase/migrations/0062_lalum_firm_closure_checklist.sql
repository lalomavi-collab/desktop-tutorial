-- 0062: closing a firm, step 0: a read only checklist of what stands in the way.
--
-- A firm leaves the platform as a sequence (freeze, hand over, start the retention clock, revoke access, scrub after
-- retention, keep a tombstone), never as a DELETE of its row: about fifty tables cascade from lalum_firms, the audit
-- chain refuses row deletion, and stored originals are outside the foreign key graph. See docs/firm-closure.md.
-- This migration adds only the first tool of that procedure: one call that says whether closing can begin.
--
-- What it returns: counts and amounts, never a name, an id or a document. Each item has a severity.
--   BLOCKER  closing should not begin while this is non zero (client money held, a legal hold, a pending statutory
--            deadline, a signature in flight, a tax document mid issuance)
--   WARNING  settle or hand over first (open tasks, unhandled inquiries, unbilled work, unpaid platform invoices, a
--            purge that was started and not finished, drafts)
--   INFO     what closing will have to touch (matters, the bin, originals in storage, members, tax connections, the
--            intake token, and how many matters have no retention clock yet)
--
-- It writes nothing except one VIEWED_FINANCIALS row in the billing audit log, like the other financial views.
-- Who may call it: a partner or admin of that firm behind MFA (lalum_fin_can), or the platform admin with a second factor
-- session. Everyone else gets FORBIDDEN, including a user of another firm. The firm's status is reported, not changed.

create or replace function public.lalum_firm_closure_checklist(p_firm uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_status text; v_items jsonb; v_blockers integer; v_warnings integer;
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
    ('tax_connections',                  'INFO',    3, (select count(*) from public.lalum_tax_connections where firm_id = p_firm), null::numeric),
    ('intake_token_set',                 'INFO',    3, (select count(*) from lalum_private.firm_secrets where firm_id = p_firm and intake_token_hash is not null), null::numeric)
  )
  select jsonb_agg(jsonb_build_object('key', key, 'severity', severity, 'count', n, 'amount', amount) order by rank, key),
         count(*) filter (where severity = 'BLOCKER' and n > 0),
         count(*) filter (where severity = 'WARNING' and n > 0)
    into v_items, v_blockers, v_warnings
    from items;

  return jsonb_build_object('firm_status', v_status, 'can_begin_closing', v_blockers = 0, 'blockers', v_blockers, 'warnings', v_warnings, 'items', v_items);
end $$;
revoke execute on function public.lalum_firm_closure_checklist(uuid) from public, anon;
grant execute on function public.lalum_firm_closure_checklist(uuid) to authenticated;
