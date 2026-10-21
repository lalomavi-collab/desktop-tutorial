/* 0073: an external bookkeeper role (BOOKKEEPER, "הנהלת חשבונות"): the bookkeeping system and nothing else.
   What it adds:
   - the role itself, in the members check constraint and in lalum_set_member_role;
   - lalum_add_bookkeeper(email, name): an administrator attaches an EXISTING sign in (created first in Supabase Auth, by invitation)
     to the firm as BOOKKEEPER. It never creates a login and never takes an e-mail into the audit chain (only the user id);
   - a restrictive policy on every other table, so the role is denied by default (defence in depth: today a new role already sees no
     matter, because matter visibility is assignment based, but a future policy must not open the legal side to her by accident).
     Tables she needs are on an allowlist inside lalum_bookkeeper_allowed(); lalum_bookkeeper_gaps() lists tables that have row level
     security, are not allowed, and carry no restrictive policy yet (the test fails on a non empty list, so a new table cannot slip through);
   - finance level: the role defaults to 0 (nothing) until an administrator sets a level in the Permissions tab (3 recommended; 4 only if she
     must manage settings, permissions, trust and audit), and a BOOKKEEPER always needs a second factor session, whatever the firm setting;
   - she may reveal client names with a logged reason (she needs them to issue invoices): lalum_can_see_client_names includes the role.
   Limit, stated plainly: she can read what the finance tables hold for her level. Names inside bookkeeping rows are masked by the
   interface until she reveals with a reason; this is not removal from the payload (see 0044).
   Not applied to production until approved. */

alter table public.lalum_firm_members drop constraint if exists lalum_firm_members_role_check;
alter table public.lalum_firm_members add constraint lalum_firm_members_role_check
  check (role in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER','ADMIN','BOOKKEEPER'));

create or replace function public.lalum_set_member_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid; v_prev text;
begin
  select firm_id, role into v_firm, v_prev from public.lalum_firm_members where user_id = p_user;
  if v_firm is null then raise exception 'not a firm member'; end if;
  if not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  if p_role not in ('FIRM_PARTNER','ATTORNEY','COMPLIANCE_OFFICER','ADMIN','BOOKKEEPER') then raise exception 'invalid role'; end if;
  if v_prev = 'ADMIN' and p_role <> 'ADMIN'
     and (select count(*) from public.lalum_firm_members where firm_id = v_firm and role = 'ADMIN') <= 1 then
    raise exception 'cannot remove the last administrator';
  end if;
  update public.lalum_firm_members set role = p_role where user_id = p_user;
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_ROLE_SET', null,
    jsonb_build_object('user', p_user, 'role', p_role, 'prev_role', v_prev));
end $$;
revoke execute on function public.lalum_set_member_role(uuid, text) from public, anon;
grant execute on function public.lalum_set_member_role(uuid, text) to authenticated;

-- Attach an existing sign in to the caller's firm as BOOKKEEPER. Administrator only (same gate as role changes).
create or replace function public.lalum_add_bookkeeper(p_email text, p_name text) returns uuid
language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_uid uuid; v_email text := lower(btrim(coalesce(p_email, ''))); v_name text := btrim(coalesce(p_name, ''));
begin
  if v_firm is null or not public.lalum_admin_ok(v_firm) then raise exception 'not allowed'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad email'; end if;
  if char_length(v_name) < 2 then raise exception 'name required'; end if;
  select id into v_uid from auth.users where lower(email) = v_email limit 1;
  if v_uid is null then raise exception 'no sign in for this e-mail'; end if;
  if exists (select 1 from public.lalum_firm_members where user_id = v_uid) then raise exception 'already a member'; end if;
  insert into public.lalum_firm_members (firm_id, user_id, name, email, role) values (v_firm, v_uid, v_name, v_email, 'BOOKKEEPER');
  perform public.lalum_append_audit(v_firm, null, auth.uid(), 'MEMBER_ADDED', null, jsonb_build_object('user', v_uid, 'role', 'BOOKKEEPER'));
  return v_uid;
end $$;
revoke execute on function public.lalum_add_bookkeeper(text, text) from public, anon;
grant execute on function public.lalum_add_bookkeeper(text, text) to authenticated;

-- Default level 0 for the role, and a second factor session always. Everything else is as in 0024.
create or replace function public.lalum_fin_level(p_firm uuid) returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce(case when p_firm is not null and p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok()
                        and (public.lalum_my_role() is distinct from 'BOOKKEEPER' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2') then
      coalesce((select p.level::integer from public.lalum_fin_permissions p where p.firm_id = p_firm and p.user_id = auth.uid()),
               case when public.lalum_my_role() in ('FIRM_PARTNER','ADMIN') then 4 else 0 end)
    end, 0) $$;
revoke execute on function public.lalum_fin_level(uuid) from public, anon;
grant execute on function public.lalum_fin_level(uuid) to authenticated;

-- She may reveal client names (with the logged reason of 0072).
create or replace function public.lalum_can_see_client_names() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_is_admin() or (
    public.lalum_my_firm_id() is not null and public.lalum_mfa_ok()
    and public.lalum_my_role() in ('FIRM_PARTNER','ATTORNEY','BOOKKEEPER')
  );
$$;
revoke execute on function public.lalum_can_see_client_names() from public, anon;
grant execute on function public.lalum_can_see_client_names() to authenticated;

-- The tables the role may read through their own policies (those policies still decide by finance level).
create or replace function public.lalum_bookkeeper_allowed(p_table text) returns boolean
language sql immutable as $$
  select p_table like 'lalum\_fin\_%' or p_table like 'lalum\_trust\_%'
      or p_table in ('lalum_cash_forecast_items','lalum_invoices','lalum_matter_fees','lalum_subscription_plans',
                     'lalum_tier_change_requests','lalum_firm_members','lalum_firms','lalum_audit_log','lalum_profiles') $$;

-- Deny the role everywhere else: one restrictive policy per table that has row level security and is not allowed.
create or replace function public.lalum_bookkeeper_apply() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare r record; n integer := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and not public.lalum_bookkeeper_allowed(c.relname)
             and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'lalum_no_bookkeeper') loop
    execute format('create policy lalum_no_bookkeeper on public.%I as restrictive for all to authenticated using (public.lalum_my_role() is distinct from %L) with check (public.lalum_my_role() is distinct from %L)',
                   r.relname, 'BOOKKEEPER', 'BOOKKEEPER');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.lalum_bookkeeper_apply() from public, anon, authenticated;

create or replace function public.lalum_bookkeeper_gaps() returns table(table_name text)
language sql stable security definer set search_path to 'public' as $$
  select c.relname::text from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and not public.lalum_bookkeeper_allowed(c.relname)
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'lalum_no_bookkeeper')
  order by 1 $$;
revoke execute on function public.lalum_bookkeeper_gaps() from public, anon;
grant execute on function public.lalum_bookkeeper_gaps() to authenticated;

select public.lalum_bookkeeper_apply();
