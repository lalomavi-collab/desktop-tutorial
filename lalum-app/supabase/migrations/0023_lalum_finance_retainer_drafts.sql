-- Monthly retainer drafts. The practice issues a tax invoice for a fixed fee each month; the customer card carries the template
-- (retainer_active, retainer_description, retainer_amount, migration 0022). This function creates the DRAFTS for one month.
-- It never issues anything: a partner reviews and issues each draft. It is idempotent per customer and month through
-- retainer_period, so pressing the button twice cannot create a second draft. Applied as "lalum_finance_retainer_drafts_*".

alter table public.lalum_fin_documents
  add column if not exists retainer_period text check (retainer_period is null or retainer_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
create unique index if not exists lalum_fin_documents_retainer_once
  on public.lalum_fin_documents (firm_id, customer_id, retainer_period) where retainer_period is not null;

create or replace function public.lalum_fin_generate_retainer_drafts(p_period text) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_firm uuid := public.lalum_my_firm_id(); c record; n integer := 0; t record; v_lines jsonb;
begin
  if not public.lalum_fin_can(v_firm) then raise exception 'FORBIDDEN'; end if;
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
