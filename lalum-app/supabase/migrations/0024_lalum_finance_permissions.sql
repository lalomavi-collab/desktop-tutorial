-- Finance permission levels, so staff can be added later without redesign (decision 11 October 2026).
-- Levels: 0 none, 1 view, 2 draft (drafts and customers), 3 issue (issue, payments, expenses), 4 admin (settings, series,
-- imports, permissions, trust and audit data). A partner or admin member with no explicit row is level 4, so nothing changes
-- for the owner. An explicit row overrides the default. Every level needs the second factor when the firm requires it.
-- lalum_fin_can(firm) keeps its old meaning (admin) and still guards the tables not mentioned here. Applied to project
-- meoymkcotomoluwlwues as "lalum_finance_permissions_*".

create table if not exists public.lalum_fin_permissions (
  firm_id    uuid not null references public.lalum_firms(id) on delete cascade,
  user_id    uuid not null,
  level      smallint not null check (level between 0 and 4),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);
alter table public.lalum_fin_permissions enable row level security;
revoke all on public.lalum_fin_permissions from anon, authenticated;
grant select on public.lalum_fin_permissions to authenticated;

create or replace function public.lalum_fin_level(p_firm uuid) returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce(case when p_firm is not null and p_firm = public.lalum_my_firm_id() and public.lalum_mfa_ok() then
      coalesce((select p.level::integer from public.lalum_fin_permissions p where p.firm_id = p_firm and p.user_id = auth.uid()),
               case when public.lalum_my_role() in ('FIRM_PARTNER','ADMIN') then 4 else 0 end)
    end, 0) $$;
revoke execute on function public.lalum_fin_level(uuid) from public, anon;
grant execute on function public.lalum_fin_level(uuid) to authenticated;

create or replace function public.lalum_fin_can(p_firm uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_fin_level(p_firm) >= 4 $$;
create or replace function public.lalum_fin_can(p_firm uuid, p_min integer) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.lalum_fin_level(p_firm) >= p_min $$;
revoke execute on function public.lalum_fin_can(uuid, integer) from public, anon;
grant execute on function public.lalum_fin_can(uuid, integer) to authenticated;

create policy lalum_fin_permissions_read on public.lalum_fin_permissions for select
  using (user_id = (select auth.uid()) or (select public.lalum_fin_can(firm_id)));

-- Admin only. p_level null resets the user to the role default. The last effective admin cannot be demoted.
create or replace function public.lalum_fin_set_level(p_user uuid, p_level integer) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_firm uuid := public.lalum_my_firm_id(); v_admins integer; v_was boolean;
begin
  if v_firm is null or not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
  if p_level is not null and p_level not between 0 and 4 then raise exception 'BAD_LEVEL'; end if;
  if not exists (select 1 from public.lalum_firm_members where firm_id = v_firm and user_id = p_user) then raise exception 'NOT_A_MEMBER'; end if;
  with eff as (
    select m.user_id, coalesce((select p.level from public.lalum_fin_permissions p where p.firm_id = v_firm and p.user_id = m.user_id),
                               case when m.role in ('FIRM_PARTNER','ADMIN') then 4 else 0 end) as lvl
    from public.lalum_firm_members m where m.firm_id = v_firm)
  select count(*) filter (where lvl = 4), coalesce(bool_or(lvl = 4 and user_id = p_user), false) into v_admins, v_was from eff;
  if v_was and coalesce(p_level, (select case when role in ('FIRM_PARTNER','ADMIN') then 4 else 0 end from public.lalum_firm_members
                                  where firm_id = v_firm and user_id = p_user)) < 4 and v_admins <= 1 then raise exception 'LAST_ADMIN'; end if;
  if p_level is null then
    delete from public.lalum_fin_permissions where firm_id = v_firm and user_id = p_user;
  else
    insert into public.lalum_fin_permissions (firm_id, user_id, level, updated_by) values (v_firm, p_user, p_level, auth.uid())
    on conflict (firm_id, user_id) do update set level = excluded.level, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform public.lalum_audit_write(v_firm, 'FIN_PERMISSION_SET', 'lalum_fin_permissions', p_user::text, jsonb_build_object('level', p_level));
end $$;
revoke execute on function public.lalum_fin_set_level(uuid, integer) from public, anon;
grant execute on function public.lalum_fin_set_level(uuid, integer) to authenticated;

-- Table policies by level. Reads from 1, drafts and customers from 2, money records from 3. The existing "all" policies are
-- altered in place (no drop) to the write level, and a separate read policy opens reading from level 1.
alter policy lalum_fin_customers_all on public.lalum_fin_customers using ((select public.lalum_fin_can(firm_id, 2))) with check ((select public.lalum_fin_can(firm_id, 2)));
create policy lalum_fin_customers_read on public.lalum_fin_customers for select using ((select public.lalum_fin_can(firm_id, 1)));
alter policy lalum_fin_payments_all on public.lalum_fin_payments using ((select public.lalum_fin_can(firm_id, 3))) with check ((select public.lalum_fin_can(firm_id, 3)));
create policy lalum_fin_payments_read on public.lalum_fin_payments for select using ((select public.lalum_fin_can(firm_id, 1)));
alter policy lalum_fin_expenses_all on public.lalum_fin_expenses using ((select public.lalum_fin_can(firm_id, 3))) with check ((select public.lalum_fin_can(firm_id, 3)));
create policy lalum_fin_expenses_read on public.lalum_fin_expenses for select using ((select public.lalum_fin_can(firm_id, 1)));
alter policy lalum_fin_documents_read on public.lalum_fin_documents using ((select public.lalum_fin_can(firm_id, 1)));

-- RPC gates: drafts from level 2.
-- lalum_fin_delete_draft keeps the admin gate (lalum_fin_can(firm) is level 4): the migration tool does not apply it, and
-- deleting a draft is rare. Lower it to level 2 in the SQL editor if staff should delete their own drafts.

create or replace function public.lalum_fin_save_draft(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id();
  v_id uuid := p_id; v_lines jsonb := coalesce(p->'lines', '[]'::jsonb);
  v_type text := p->>'doc_type'; v_vat numeric := coalesce((p->>'vat_rate')::numeric, 18);
  v_inc boolean := coalesce((p->>'tax_included')::boolean, false);
  t record; l jsonb; v_cust uuid := (p->>'customer_id')::uuid; v_casual boolean;
begin
  if not public.lalum_fin_can(v_firm, 2) then raise exception 'FORBIDDEN'; end if;
  if v_type not in ('PROFORMA','INVOICE','RECEIPT','INVOICE_RECEIPT','CREDIT') then raise exception 'BAD_TYPE'; end if;
  select is_casual into v_casual from public.lalum_fin_customers where id = v_cust and firm_id = v_firm;
  if not found then raise exception 'BAD_CUSTOMER'; end if;
  if v_casual and v_type not in ('INVOICE_RECEIPT','CREDIT') then raise exception 'CASUAL_NOT_ALLOWED'; end if;
  if jsonb_array_length(v_lines) not between 1 and 60 then raise exception 'BAD_LINES'; end if;
  for l in select * from jsonb_array_elements(v_lines) loop
    if length(btrim(coalesce(l->>'name',''))) = 0 or length(l->>'name') > 200 then raise exception 'BAD_LINE_NAME'; end if;
    if coalesce((l->>'qty')::numeric, 0) <= 0 or coalesce((l->>'price')::numeric, 0) <= 0 then raise exception 'BAD_LINE_AMOUNT'; end if;
  end loop;
  select * into t from public.lalum_fin_totals(v_lines, v_vat, v_inc);
  if v_id is null then
    insert into public.lalum_fin_documents (firm_id, customer_id, doc_type, subject, tax_included, vat_rate, lines,
        subtotal, vat_amount, total, issue_date, due_date, payment_method, payment_ref, related_doc_id, send_email, created_by, internal_note, matter_ref)
    values (v_firm, v_cust, v_type, coalesce(p->>'subject',''), v_inc, v_vat, v_lines, t.subtotal, t.vat_amount, t.total,
        coalesce((p->>'issue_date')::date, current_date), (p->>'due_date')::date, nullif(p->>'payment_method',''),
        nullif(p->>'payment_ref',''), (p->>'related_doc_id')::uuid, coalesce((p->>'send_email')::boolean, false), auth.uid(),
        nullif(btrim(p->>'internal_note'),''), nullif(btrim(p->>'matter_ref'),''))
    returning id into v_id;
  else
    update public.lalum_fin_documents set customer_id = v_cust, doc_type = v_type, subject = coalesce(p->>'subject',''),
        tax_included = v_inc, vat_rate = v_vat, lines = v_lines, subtotal = t.subtotal, vat_amount = t.vat_amount, total = t.total,
        issue_date = coalesce((p->>'issue_date')::date, current_date), due_date = (p->>'due_date')::date,
        payment_method = nullif(p->>'payment_method',''), payment_ref = nullif(p->>'payment_ref',''),
        related_doc_id = (p->>'related_doc_id')::uuid, send_email = coalesce((p->>'send_email')::boolean, false), last_error = null,
        internal_note = nullif(btrim(p->>'internal_note'),''), matter_ref = nullif(btrim(p->>'matter_ref'),'')
    where id = v_id and firm_id = v_firm and status = 'DRAFT';
    if not found then raise exception 'NOT_A_DRAFT'; end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.lalum_fin_save_draft(uuid, jsonb) from public, anon;
grant execute on function public.lalum_fin_save_draft(uuid, jsonb) to authenticated;



-- Retainer drafts need level 2.
create or replace function public.lalum_fin_generate_retainer_drafts(p_period text) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id(); c record; n integer := 0; t record; v_lines jsonb;
begin
  if not public.lalum_fin_can(v_firm, 2) then raise exception 'FORBIDDEN'; end if;
  if p_period is null or p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'BAD_PERIOD'; end if;
  for c in select id, retainer_description, retainer_amount from public.lalum_fin_customers
           where firm_id = v_firm and retainer_active and not archived and not is_casual loop
    v_lines := jsonb_build_array(jsonb_build_object('name', c.retainer_description, 'qty', 1, 'price', c.retainer_amount));
    select * into t from public.lalum_fin_totals(v_lines, 18, false);
    insert into public.lalum_fin_documents (firm_id, customer_id, doc_type, subject, tax_included, vat_rate, lines,
        subtotal, vat_amount, total, issue_date, retainer_period, created_by)
    values (v_firm, c.id, 'INVOICE', 'שכר טרחה חודשי ' || substr(p_period, 6, 2) || '/' || substr(p_period, 1, 4), false, 18, v_lines,
        t.subtotal, t.vat_amount, t.total, (now() at time zone 'Asia/Jerusalem')::date, p_period, auth.uid())
    on conflict (firm_id, customer_id, retainer_period) where retainer_period is not null do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.lalum_fin_generate_retainer_drafts(text) from public, anon;
grant execute on function public.lalum_fin_generate_retainer_drafts(text) to authenticated;
