-- Stand in for lalum_invoices and its read policy as they are live before 0075 (created in 0019, which needs the whole billing schema).
create table public.lalum_invoices (id uuid primary key default gen_random_uuid(), firm_id uuid not null, invoice_no text, status text default 'ISSUED');
alter table public.lalum_invoices enable row level security;
grant select on public.lalum_invoices to authenticated;
create policy lalum_invoices_read on public.lalum_invoices for select to authenticated
  using (((firm_id = public.lalum_my_firm_id()) and (public.lalum_my_role() = any (array['FIRM_PARTNER','ADMIN']))) or public.lalum_is_admin());
