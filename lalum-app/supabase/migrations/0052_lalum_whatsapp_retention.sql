-- WhatsApp assistant data minimisation (AIA_lalum-whatsapp-webhook_2026-10-19, owner approval 2026-10-19).
-- 1. Message bodies are blanked after 30 days; the metadata row (who, when, direction) stays.
-- 2. A contact, with its messages and tasks, can be erased on request (messages and tasks cascade).
-- Both are callable by the service role only.

create or replace function public.lalum_whatsapp_purge_bodies()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update public.lalum_whatsapp_messages
     set body = ''
   where body <> '' and created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.lalum_whatsapp_erase_contact(p_phone text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer; t integer;
begin
  -- Messages and tasks for this number always go. The contact row goes only if it is a bare lead created by the
  -- WhatsApp channel; a contact that is also a client record in the CRM is kept.
  delete from public.lalum_whatsapp_tasks where contact_id in (select id from public.lalum_contacts where phone = p_phone);
  get diagnostics t = row_count;
  delete from public.lalum_whatsapp_messages where phone = p_phone;
  get diagnostics n = row_count;
  delete from public.lalum_contacts where phone = p_phone and is_lead;
  return n + t;
end;
$$;

revoke all on function public.lalum_whatsapp_purge_bodies() from public, anon, authenticated;
revoke all on function public.lalum_whatsapp_erase_contact(text) from public, anon, authenticated;
grant execute on function public.lalum_whatsapp_purge_bodies() to service_role;
grant execute on function public.lalum_whatsapp_erase_contact(text) to service_role;

select cron.schedule('lalum-whatsapp-body-purge', '17 3 * * *', 'select public.lalum_whatsapp_purge_bodies()');
