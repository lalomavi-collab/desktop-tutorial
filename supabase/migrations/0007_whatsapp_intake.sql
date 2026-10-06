-- 0007_whatsapp_intake.sql
-- WhatsApp intake for the LALUM executive interface: message log, per-contact
-- follow-up tasks (leads and escalations), and the four transactional
-- operations the webhook's Claude tool loop calls (log message, route lead,
-- read case status, escalate to a human).
--
-- Reuses public.lalum_contacts (phone-keyed, shared with the voice pipeline in
-- 0003_voice_call_sync.sql) so a caller and a WhatsApp sender at the same
-- number resolve to one contact. Follow-up work gets its own table
-- (lalum_whatsapp_tasks) rather than lalum_crm_tasks, because that table's
-- call_id is a required unique reference to a completed call and is not a fit
-- for a channel with no call record.

-- ── Message log (idempotent per WhatsApp message id) ──────────────────────────
create table if not exists public.lalum_whatsapp_messages (
  id             uuid primary key default gen_random_uuid(),
  wa_message_id  text not null unique,
  contact_id     uuid not null references public.lalum_contacts(id) on delete cascade,
  phone          text not null,
  direction      text not null check (direction in ('in','out')),
  body           text not null,
  created_at     timestamptz not null default now()
);

create index if not exists lalum_whatsapp_messages_contact_idx
  on public.lalum_whatsapp_messages (contact_id, created_at);

-- ── Follow-up tasks (leads and escalations raised over WhatsApp) ─────────────
create table if not exists public.lalum_whatsapp_tasks (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.lalum_contacts(id) on delete cascade,
  title         text not null,
  practice_area text,
  priority      text not null default 'Medium' check (priority in ('High','Medium','Low')),
  status        text not null default 'open' check (status in ('open','done','cancelled')),
  escalated     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists lalum_whatsapp_tasks_contact_idx
  on public.lalum_whatsapp_tasks (contact_id, created_at desc);

-- ── RLS: service-role only, admin read (mirrors 0003/0004) ───────────────────
alter table public.lalum_whatsapp_messages enable row level security;
alter table public.lalum_whatsapp_tasks    enable row level security;

create policy "admin_read_whatsapp_messages" on public.lalum_whatsapp_messages
  for select to authenticated using (public.lalum_is_admin());

create policy "admin_read_whatsapp_tasks" on public.lalum_whatsapp_tasks
  for select to authenticated using (public.lalum_is_admin());

-- ── Log an inbound or outbound message, resolving/creating the contact ───────
-- Idempotent on wa_message_id: a Meta webhook retry (or a re-sent outbound id)
-- returns the same contact_id without inserting a duplicate row.
create or replace function public.lalum_whatsapp_log_message(
  p_wa_message_id text,
  p_phone         text,
  p_full_name     text,
  p_direction     text,
  p_body          text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id   uuid;
  v_created_lead boolean := false;
  v_inserted     boolean := true;
begin
  select id into v_contact_id from public.lalum_contacts where phone = p_phone;

  if v_contact_id is null then
    insert into public.lalum_contacts (phone, full_name, is_lead)
    values (p_phone, p_full_name, true)
    returning id into v_contact_id;
    v_created_lead := true;
  elsif p_full_name is not null then
    update public.lalum_contacts
       set full_name = p_full_name
     where id = v_contact_id and full_name is null;
  end if;

  insert into public.lalum_whatsapp_messages (wa_message_id, contact_id, phone, direction, body)
  values (p_wa_message_id, v_contact_id, p_phone, p_direction, p_body)
  on conflict (wa_message_id) do nothing;
  if not found then
    v_inserted := false;
  end if;

  return jsonb_build_object(
    'contact_id', v_contact_id,
    'created_lead', v_created_lead,
    'inserted', v_inserted
  );
end;
$$;

-- ── Route a qualified lead to the CRM ─────────────────────────────────────────
create or replace function public.lalum_whatsapp_route_lead(
  p_contact_id    uuid,
  p_full_name     text,
  p_practice_area text,
  p_summary       text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  if p_full_name is not null then
    update public.lalum_contacts
       set full_name = p_full_name
     where id = p_contact_id and full_name is null;
  end if;

  insert into public.lalum_whatsapp_tasks (contact_id, title, practice_area, priority)
  values (p_contact_id, coalesce(p_summary, 'פנייה חדשה בוואטסאפ'), p_practice_area, 'Medium')
  returning id into v_task_id;

  return jsonb_build_object('task_id', v_task_id);
end;
$$;

-- ── Read the most recent open item for a contact ──────────────────────────────
create or replace function public.lalum_whatsapp_case_status(
  p_contact_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'found', true,
        'title', title,
        'practice_area', practice_area,
        'priority', priority,
        'status', status,
        'escalated', escalated,
        'created_at', created_at
      )
      from public.lalum_whatsapp_tasks
      where contact_id = p_contact_id
      order by created_at desc
      limit 1
    ),
    jsonb_build_object('found', false)
  );
$$;

-- ── Escalate to a human (urgent matters, frustrated clients, no confident answer) ──
create or replace function public.lalum_whatsapp_escalate(
  p_contact_id uuid,
  p_reason     text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
  v_phone   text;
  v_name    text;
begin
  insert into public.lalum_whatsapp_tasks (contact_id, title, priority, escalated)
  values (p_contact_id, coalesce(p_reason, 'הסלמה מוואטסאפ'), 'High', true)
  returning id into v_task_id;

  select phone, full_name into v_phone, v_name from public.lalum_contacts where id = p_contact_id;

  return jsonb_build_object('task_id', v_task_id, 'phone', v_phone, 'full_name', v_name);
end;
$$;

-- Lock the SECURITY DEFINER functions down to the service role only, same as
-- lalum_ingest_call in 0003: without this, anon/authenticated could call them
-- directly and write CRM rows or spoof escalations under any contact_id.
revoke all on function public.lalum_whatsapp_log_message(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.lalum_whatsapp_route_lead(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.lalum_whatsapp_case_status(uuid) from public, anon, authenticated;
revoke all on function public.lalum_whatsapp_escalate(uuid, text) from public, anon, authenticated;
