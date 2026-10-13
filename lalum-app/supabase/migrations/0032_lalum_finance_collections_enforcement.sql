-- Finance: enforce the collections billing lock on time entries and timers.
-- Applied to project meoymkcotomoluwlwues as "lalum_finance_collections_enforcement". Builds on 0031 (the lock flag and its decision record).
--
--  * A customer whose lock is on (is_collections_locked) cannot get NEW time entries or a NEW running timer on any matter whose
--    fee record (lalum_matter_fees.fin_customer_id) points at that customer. Existing entries are untouched: they can still be
--    edited, submitted, approved and billed, because work already done is how the receivable gets collected.
--  * A matter with no fee record, or a fee record with no ledger customer, is not blocked: there is no customer to look up.
--  * A partner (finance level 4) can override the lock for 1 to 30 days with a written reason. The override is dated, it
--    expires on its own, and unlocking or re-locking the customer clears it.
--  * Like lalum_time_entries_guard, the check is skipped when there is no signed-in user (service role, migrations, imports).
--  * The error is the code BILLING_LOCKED, with the sentence below as its detail.

alter table public.lalum_fin_customers
  add column if not exists collections_override_until  date,
  add column if not exists collections_override_by     uuid,
  add column if not exists collections_override_at     timestamptz,
  add column if not exists collections_override_reason text check (collections_override_reason is null or length(collections_override_reason) <= 500);

-- True when new time on this matter is currently blocked.
create or replace function public.lalum_fin_collections_blocked(p_matter uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from public.lalum_matter_fees f
    join public.lalum_fin_customers c on c.id = f.fin_customer_id
    where f.matter_id = p_matter
      and c.is_collections_locked
      and not (c.collections_override_until is not null
               and c.collections_override_until >= (now() at time zone 'Asia/Jerusalem')::date)
  ) $$;
revoke execute on function public.lalum_fin_collections_blocked(uuid) from public, anon;
grant execute on function public.lalum_fin_collections_blocked(uuid) to authenticated;

create or replace function public.lalum_collections_lock_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return new; end if;
  if public.lalum_fin_collections_blocked(new.matter_id) then
    raise exception 'BILLING_LOCKED' using detail = 'Billing is locked for this client due to overdue receivables exceeding 60 days.';
  end if;
  return new;
end $$;
revoke execute on function public.lalum_collections_lock_guard() from public, anon, authenticated;

-- Created only when absent, so the migration can be re-run without a notice from DROP ... IF EXISTS.
do $do$
begin
  if not exists (select 1 from pg_trigger where tgname = 'lalum_collections_lock_t' and tgrelid = 'public.lalum_time_entries'::regclass) then
    create trigger lalum_collections_lock_t before insert on public.lalum_time_entries
      for each row execute function public.lalum_collections_lock_guard();
  end if;
  -- A timer is blocked when it starts, so nobody works an hour and then fails to save it.
  if not exists (select 1 from pg_trigger where tgname = 'lalum_collections_lock_t' and tgrelid = 'public.lalum_time_timers'::regclass) then
    create trigger lalum_collections_lock_t before insert on public.lalum_time_timers
      for each row execute function public.lalum_collections_lock_guard();
  end if;
end $do$;

-- Lock or unlock (0031), now also clearing any override: a new decision starts clean.
create or replace function public.lalum_fin_set_collections_lock(p_customer uuid, p_locked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid;
begin
  select firm_id into v_firm from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_locked and length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'LOCK_REASON_REQUIRED'; end if;
  update public.lalum_fin_customers set
    is_collections_locked = p_locked,
    collections_locked_at = case when p_locked then now() else null end,
    collections_locked_by = case when p_locked then auth.uid() else null end,
    collections_lock_reason = case when p_locked then left(btrim(p_reason), 500) else null end,
    collections_override_until = null, collections_override_by = null, collections_override_at = null, collections_override_reason = null
  where id = p_customer;
end $$;

-- Partner override: allow new time for p_days days (1 to 30) although the lock stays on. p_days = 0 ends an override.
create or replace function public.lalum_fin_override_collections_lock(p_customer uuid, p_days int, p_reason text default null)
returns date language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_locked boolean; v_until date;
begin
  select firm_id, is_collections_locked into v_firm, v_locked from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if not v_locked then raise exception 'NOT_LOCKED'; end if;
  if p_days is null or p_days not between 0 and 30 then raise exception 'BAD_DAYS'; end if;
  if p_days = 0 then
    update public.lalum_fin_customers set collections_override_until = null, collections_override_by = null,
      collections_override_at = null, collections_override_reason = null where id = p_customer;
    return null;
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
  v_until := (now() at time zone 'Asia/Jerusalem')::date + p_days;
  update public.lalum_fin_customers set collections_override_until = v_until, collections_override_by = auth.uid(),
    collections_override_at = now(), collections_override_reason = left(btrim(p_reason), 500) where id = p_customer;
  return v_until;
end $$;
revoke execute on function public.lalum_fin_override_collections_lock(uuid, int, text) from public, anon;
grant execute on function public.lalum_fin_override_collections_lock(uuid, int, text) to authenticated;
