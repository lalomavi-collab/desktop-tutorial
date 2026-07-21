-- 0003_voice_call_sync.sql
-- Voice AI call ingestion: stores completed calls from the LiveKit/Twilio
-- agent, the CRM follow-up task Claude suggests, and a billing line for
-- billable calls. All writes for one call happen inside a single function
-- (lalum_ingest_call) so they commit or roll back together.
--
-- Contacts vs profiles: lalum_profiles rows are registered auth users and have
-- no phone. Inbound callers are matched (and, when new, created as leads) in
-- lalum_contacts, keyed by phone. A contact optionally links to a real profile
-- once the lead becomes a client.

-- ── Contacts / leads directory ────────────────────────────────────────────────
create table if not exists public.lalum_contacts (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null unique,
  full_name    text,
  profile_id   uuid references public.lalum_profiles(id) on delete set null,
  is_lead      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── Call log ──────────────────────────────────────────────────────────────────
create table if not exists public.lalum_calls_meta (
  id              uuid primary key default gen_random_uuid(),
  call_sid        text not null unique,
  client_id       uuid references public.lalum_contacts(id) on delete set null,
  caller_phone    text not null,
  duration_seconds int not null default 0,
  transcript      text,
  summary         text,
  client_intent   text check (
                    client_intent is null
                    or client_intent in ('Inquiry','Consultation','Dispute','Support')
                  ),
  is_billable     boolean not null default false,
  is_processed    boolean not null default false,
  process_error   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists lalum_calls_meta_unprocessed_idx
  on public.lalum_calls_meta (is_processed, created_at);

-- ── CRM follow-up tasks (one per call) ────────────────────────────────────────
create table if not exists public.lalum_crm_tasks (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null unique references public.lalum_calls_meta(id) on delete cascade,
  client_id   uuid references public.lalum_contacts(id) on delete set null,
  title       text not null,
  priority    text not null check (priority in ('High','Medium','Low')),
  due_date    timestamptz not null,
  status      text not null default 'open' check (status in ('open','done','cancelled')),
  created_at  timestamptz not null default now()
);

-- ── Billing ledger (one per billable call) ────────────────────────────────────
-- amount is the gross total (net + VAT). Israeli legal fees carry VAT, so we
-- keep the net fee, the VAT rate and amount, and the gross separately.
create table if not exists public.lalum_billing_ledgers (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null unique references public.lalum_calls_meta(id) on delete cascade,
  client_id       uuid references public.lalum_contacts(id) on delete set null,
  duration_seconds int not null,
  billed_hours    numeric(6,2) not null,
  hourly_rate     numeric(10,2) not null,          -- net rate per hour
  net_amount      numeric(12,2) not null default 0,
  vat_rate        numeric(5,4) not null default 0, -- e.g. 0.18
  vat_amount      numeric(12,2) not null default 0,
  amount          numeric(12,2) not null,          -- gross total (net + VAT)
  currency        text not null default 'ILS',
  created_at      timestamptz not null default now()
);

-- ── RLS: service-role only ────────────────────────────────────────────────────
-- The backend uses the service-role key, which bypasses RLS. Enabling RLS with
-- no permissive policy means no anon/authenticated client can read or write
-- these tables directly.
alter table public.lalum_contacts        enable row level security;
alter table public.lalum_calls_meta      enable row level security;
alter table public.lalum_crm_tasks       enable row level security;
alter table public.lalum_billing_ledgers enable row level security;

-- ── Transactional ingest ──────────────────────────────────────────────────────
-- Resolves (or creates) the caller as a contact, upserts the call by call_sid,
-- and, when the call was successfully processed, (re)creates the follow-up task
-- and, if billable, the billing line. Idempotent per call_sid: a retry updates
-- the same rows instead of duplicating.
create or replace function public.lalum_ingest_call(
  p_call_sid         text,
  p_caller_phone     text,
  p_duration_seconds int,
  p_transcript       text,
  p_summary          text,
  p_client_intent    text,
  p_is_billable      boolean,
  p_is_processed     boolean,
  p_process_error    text,
  p_task_title       text,
  p_task_priority    text,
  p_due_days_offset  int,
  p_billed_hours     numeric,
  p_hourly_rate      numeric,
  p_net_amount       numeric,
  p_vat_rate         numeric,
  p_vat_amount       numeric,
  p_amount           numeric,
  p_currency         text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id    uuid;
  v_created_lead boolean := false;
  v_call_id      uuid;
begin
  -- 1) Map caller_phone -> contact, creating a lead when unknown.
  select id into v_client_id
    from public.lalum_contacts
   where phone = p_caller_phone;

  if v_client_id is null then
    insert into public.lalum_contacts (phone, is_lead)
    values (p_caller_phone, true)
    returning id into v_client_id;
    v_created_lead := true;
  end if;

  -- 2) Upsert the call log (idempotent on call_sid).
  insert into public.lalum_calls_meta (
    call_sid, client_id, caller_phone, duration_seconds, transcript,
    summary, client_intent, is_billable, is_processed, process_error, updated_at
  ) values (
    p_call_sid, v_client_id, p_caller_phone, coalesce(p_duration_seconds, 0),
    p_transcript, p_summary, p_client_intent, coalesce(p_is_billable, false),
    coalesce(p_is_processed, false), p_process_error, now()
  )
  on conflict (call_sid) do update set
    client_id       = excluded.client_id,
    caller_phone    = excluded.caller_phone,
    duration_seconds = excluded.duration_seconds,
    transcript      = excluded.transcript,
    summary         = excluded.summary,
    client_intent   = excluded.client_intent,
    is_billable     = excluded.is_billable,
    is_processed    = excluded.is_processed,
    process_error   = excluded.process_error,
    updated_at      = now()
  returning id into v_call_id;

  -- 3) Follow-up task + billing only when the call was fully processed.
  if coalesce(p_is_processed, false) and p_task_title is not null then
    insert into public.lalum_crm_tasks (
      call_id, client_id, title, priority, due_date
    ) values (
      v_call_id, v_client_id, p_task_title,
      coalesce(p_task_priority, 'Medium'),
      now() + make_interval(days => coalesce(p_due_days_offset, 0))
    )
    on conflict (call_id) do update set
      title    = excluded.title,
      priority = excluded.priority,
      due_date = excluded.due_date,
      status   = 'open';

    if coalesce(p_is_billable, false) and coalesce(p_billed_hours, 0) > 0 then
      insert into public.lalum_billing_ledgers (
        call_id, client_id, duration_seconds, billed_hours, hourly_rate,
        net_amount, vat_rate, vat_amount, amount, currency
      ) values (
        v_call_id, v_client_id, coalesce(p_duration_seconds, 0),
        p_billed_hours, p_hourly_rate, coalesce(p_net_amount, 0),
        coalesce(p_vat_rate, 0), coalesce(p_vat_amount, 0), p_amount,
        coalesce(p_currency, 'ILS')
      )
      on conflict (call_id) do update set
        duration_seconds = excluded.duration_seconds,
        billed_hours     = excluded.billed_hours,
        hourly_rate      = excluded.hourly_rate,
        net_amount       = excluded.net_amount,
        vat_rate         = excluded.vat_rate,
        vat_amount       = excluded.vat_amount,
        amount           = excluded.amount,
        currency         = excluded.currency;
    end if;
  end if;

  return jsonb_build_object(
    'call_id', v_call_id,
    'client_id', v_client_id,
    'created_lead', v_created_lead
  );
end;
$$;

-- Lock the function down: only the service role may execute it.
revoke all on function public.lalum_ingest_call(
  text, text, int, text, text, text, boolean, boolean, text, text, text,
  int, numeric, numeric, numeric, numeric, numeric, numeric, text
) from public, anon, authenticated;
