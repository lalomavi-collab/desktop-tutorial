-- Finance: the send record behind the reminder channel (edge function lalum-fin-dunning-send).
-- Not yet applied to the project. Builds on 0031 (lalum_fin_dunning_log and the 7 day cooldown).
--
--  * A send is RESERVED before the message goes out (status PENDING), then marked SENT or FAILED. The reservation takes the cooldown,
--    so two clicks cannot send twice. A FAILED send does not use the cooldown, and a PENDING row older than 10 minutes (the function
--    died) stops blocking.
--  * The recipient and the text are stored with the row: what a customer was sent is a record the firm may need.
--  * Manual entries (a call, a letter sent outside the system) keep working through lalum_fin_log_reminder and count as SENT.
--  * Needs finance level 3, like the rest of the collections work.

alter table public.lalum_fin_dunning_log
  add column if not exists status       text not null default 'SENT' check (status in ('PENDING','SENT','FAILED')),
  add column if not exists recipient    text check (recipient is null or length(recipient) <= 254),
  add column if not exists body         text check (body is null or length(body) <= 4000),
  add column if not exists provider_ref text check (provider_ref is null or length(provider_ref) <= 200),
  add column if not exists error        text check (error is null or length(error) <= 500);

-- Whether a reminder to this customer is still inside the cooldown.
create or replace function public.lalum_fin_dunning_blocked(p_customer uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.lalum_fin_dunning_log l
    where l.customer_id = p_customer
      and l.sent_on > (now() at time zone 'Asia/Jerusalem')::date - 7
      and (l.status = 'SENT' or (l.status = 'PENDING' and l.created_at > now() - interval '10 minutes'))
  ) $$;
revoke execute on function public.lalum_fin_dunning_blocked(uuid) from public, anon;

-- Manual log (0031) now uses the same rule.
create or replace function public.lalum_fin_log_reminder(p_customer uuid, p_tier int, p_channel text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_today date := (now() at time zone 'Asia/Jerusalem')::date; v_id uuid;
begin
  select firm_id into v_firm from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_tier not between 1 and 3 then raise exception 'BAD_TIER'; end if;
  perform pg_advisory_xact_lock(hashtext('lalum_fin_dunning:' || p_customer::text));
  if public.lalum_fin_dunning_blocked(p_customer) then raise exception 'COOLDOWN_ACTIVE'; end if;
  insert into public.lalum_fin_dunning_log (firm_id, customer_id, tier, channel, sent_on, note, created_by, status)
  values (v_firm, p_customer, p_tier, p_channel, v_today, nullif(btrim(p_note), ''), auth.uid(), 'SENT')
  on conflict (customer_id, tier, sent_on) do update set channel = excluded.channel, note = excluded.note, created_by = excluded.created_by,
    status = 'SENT', created_at = now()
  where public.lalum_fin_dunning_log.status = 'FAILED'
     or (public.lalum_fin_dunning_log.status = 'PENDING' and public.lalum_fin_dunning_log.created_at <= now() - interval '10 minutes')
  returning id into v_id;
  if v_id is null then raise exception 'COOLDOWN_ACTIVE'; end if;
  return v_id;
end $$;

-- Reserve a send. Returns the row to finish.
create or replace function public.lalum_fin_dunning_reserve(p_customer uuid, p_tier int, p_channel text, p_recipient text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_today date := (now() at time zone 'Asia/Jerusalem')::date; v_id uuid;
begin
  select firm_id into v_firm from public.lalum_fin_customers where id = p_customer;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if p_tier not between 1 and 3 then raise exception 'BAD_TIER'; end if;
  if p_channel not in ('EMAIL','WHATSAPP') then raise exception 'BAD_CHANNEL'; end if;
  if length(btrim(coalesce(p_recipient, ''))) = 0 then raise exception 'NO_RECIPIENT'; end if;
  perform pg_advisory_xact_lock(hashtext('lalum_fin_dunning:' || p_customer::text));
  if public.lalum_fin_dunning_blocked(p_customer) then raise exception 'COOLDOWN_ACTIVE'; end if;
  -- A failed or abandoned attempt for the same tier and day is reused for the retry (the unique key allows one row per tier and day).
  update public.lalum_fin_dunning_log set status = 'PENDING', channel = p_channel, created_by = auth.uid(), created_at = now(),
    recipient = left(btrim(p_recipient), 254), body = left(p_body, 4000), provider_ref = null, error = null
   where customer_id = p_customer and tier = p_tier and sent_on = v_today
     and (status = 'FAILED' or (status = 'PENDING' and created_at <= now() - interval '10 minutes'))
  returning id into v_id;
  if v_id is null then
    insert into public.lalum_fin_dunning_log (firm_id, customer_id, tier, channel, sent_on, created_by, status, recipient, body)
    values (v_firm, p_customer, p_tier, p_channel, v_today, auth.uid(), 'PENDING', left(btrim(p_recipient), 254), left(p_body, 4000))
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_dunning_reserve(uuid, int, text, text, text) from public, anon;
grant execute on function public.lalum_fin_dunning_reserve(uuid, int, text, text, text) to authenticated;

-- Close a reserved send.
create or replace function public.lalum_fin_dunning_finish(p_id uuid, p_ok boolean, p_ref text default null, p_error text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_status text;
begin
  select firm_id, status into v_firm, v_status from public.lalum_fin_dunning_log where id = p_id;
  if v_firm is null or not public.lalum_fin_can(v_firm, 3) then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'PENDING' then raise exception 'NOT_PENDING'; end if;
  update public.lalum_fin_dunning_log set status = case when p_ok then 'SENT' else 'FAILED' end,
    provider_ref = left(p_ref, 200), error = case when p_ok then null else left(coalesce(p_error, 'failed'), 500) end
  where id = p_id;
end $$;
revoke execute on function public.lalum_fin_dunning_finish(uuid, boolean, text, text) from public, anon;
grant execute on function public.lalum_fin_dunning_finish(uuid, boolean, text, text) to authenticated;
