-- Finance: client trust funds ledger (כספי נאמנות).
-- Money held for a client is not the firm's money: it is never revenue and never enters the revenue or VAT
-- summaries. It is an append-only list of movements per customer:
--   DEPOSIT       money received into trust for the client (adds to the balance)
--   RELEASE_FIRM  moved from trust to the firm against an issued invoice (reduces the balance; the revenue is
--                 recognised by that invoice, not by this row)
--   REFUND        returned to the client or paid out on the client's instruction (reduces the balance)
-- A movement is never edited or deleted. A mistake is corrected by a reversing movement, so the history stays
-- reconstructable. A movement that would take a customer's balance below zero is refused by the database.
-- NOT YET APPLIED to the project: apply with the Supabase MCP / CLI after review.

create table if not exists public.lalum_fin_trust_entries (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  customer_id uuid not null references public.lalum_fin_customers(id),
  entry_type  text not null check (entry_type in ('DEPOSIT','RELEASE_FIRM','REFUND')),
  amount      numeric(14,2) not null check (amount > 0),
  entry_date  date not null default current_date,
  matter_ref  text check (matter_ref is null or length(matter_ref) <= 100),
  reference   text check (reference is null or length(reference) <= 200),
  note        text check (note is null or length(note) <= 2000),
  document_id uuid references public.lalum_fin_documents(id),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  check (entry_type <> 'RELEASE_FIRM' or document_id is not null)
);
create index if not exists lalum_fin_trust_firm_idx on public.lalum_fin_trust_entries (firm_id, customer_id, entry_date desc);

alter table public.lalum_fin_trust_entries enable row level security;
create policy lalum_fin_trust_read on public.lalum_fin_trust_entries for select
  using ((select public.lalum_fin_can(firm_id)));
create policy lalum_fin_trust_insert on public.lalum_fin_trust_entries for insert
  with check ((select public.lalum_fin_can(firm_id)));
revoke all on public.lalum_fin_trust_entries from anon, authenticated;
grant select, insert on public.lalum_fin_trust_entries to authenticated;

-- The customer and the optional document must belong to the same firm as the entry.
create or replace function public.lalum_fin_trust_guard() returns trigger
language plpgsql set search_path to 'public' as $$
declare bal numeric;
begin
  if tg_op <> 'INSERT' then raise exception 'TRUST_ENTRY_IMMUTABLE'; end if;
  if not exists (select 1 from public.lalum_fin_customers c where c.id = new.customer_id and c.firm_id = new.firm_id) then
    raise exception 'BAD_CUSTOMER';
  end if;
  if new.document_id is not null and not exists
     (select 1 from public.lalum_fin_documents d where d.id = new.document_id and d.firm_id = new.firm_id) then
    raise exception 'BAD_DOCUMENT';
  end if;
  if new.entry_type <> 'DEPOSIT' then
    -- serialise movements of one customer so two concurrent releases cannot both pass the balance check
    perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));
    select coalesce(sum(case when entry_type = 'DEPOSIT' then amount else -amount end), 0) into bal
      from public.lalum_fin_trust_entries where customer_id = new.customer_id;
    if bal - new.amount < 0 then raise exception 'TRUST_OVERDRAW'; end if;
  end if;
  return new;
end $$;
create trigger lalum_fin_trust_guard_ins before insert on public.lalum_fin_trust_entries
  for each row execute function public.lalum_fin_trust_guard();
create trigger lalum_fin_trust_guard_upd before update or delete on public.lalum_fin_trust_entries
  for each row execute function public.lalum_fin_trust_guard();
