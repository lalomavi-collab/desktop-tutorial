-- Read-only archive of documents issued in Invoice4U, imported through the lalum-fin-import edge
-- function. The archive is a mirror for history, reconciliation and numbering continuity; it is
-- never the source of a new tax document. Rows are written only by the service role.
-- Access: firm partners and admins with MFA, through lalum_fin_can (migration 0014).

-- Applied to project meoymkcotomoluwlwues as migration "lalum_finance_archive".
create table if not exists public.lalum_fin_archive (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.lalum_firms(id) on delete cascade,
  source            text not null default 'INVOICE4U' check (source in ('INVOICE4U')),
  i4u_doc_id        text not null,
  i4u_doc_type      int  not null check (i4u_doc_type between 1 and 13),
  doc_number        bigint not null,
  issue_date        date not null,
  i4u_client_id     bigint,
  subject           text,
  currency          text not null default 'ILS',
  subtotal          numeric(14,2) not null default 0,
  vat_amount        numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  allocation_number text,
  status_id         int,
  paid              numeric(14,2),
  balance           numeric(14,2),
  raw               jsonb not null,
  imported_at       timestamptz not null default now(),
  imported_by       uuid,
  refreshed_at      timestamptz not null default now(),
  unique (firm_id, source, i4u_doc_id)
);
create index if not exists lalum_fin_archive_firm_idx on public.lalum_fin_archive (firm_id, i4u_doc_type, doc_number);
create index if not exists lalum_fin_archive_date_idx on public.lalum_fin_archive (firm_id, issue_date desc);

-- One row per import call, so every import can be reconciled against what Invoice4U returned.
create table if not exists public.lalum_fin_import_runs (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.lalum_firms(id) on delete cascade,
  kind        text not null check (kind in ('CUSTOMERS','DOCUMENTS')),
  date_from   date,
  date_to     date,
  fetched     int not null default 0,
  inserted    int not null default 0,
  updated     int not null default 0,
  skipped     int not null default 0,
  error       text,
  run_by      uuid,
  created_at  timestamptz not null default now()
);
create index if not exists lalum_fin_import_runs_firm_idx on public.lalum_fin_import_runs (firm_id, created_at desc);

alter table public.lalum_fin_archive enable row level security;
alter table public.lalum_fin_import_runs enable row level security;
create policy lalum_fin_archive_read on public.lalum_fin_archive for select
  using ((select public.lalum_fin_can(firm_id)));
create policy lalum_fin_import_runs_read on public.lalum_fin_import_runs for select
  using ((select public.lalum_fin_can(firm_id)));
revoke all on public.lalum_fin_archive, public.lalum_fin_import_runs from anon, authenticated;
grant select on public.lalum_fin_archive, public.lalum_fin_import_runs to authenticated;

-- A mirrored legal record: identity, number, date and amounts never change after the first import.
-- Balance, payment and allocation fields may be refreshed from the provider.
create or replace function public.lalum_fin_archive_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then raise exception 'ARCHIVE_IMMUTABLE'; end if;
  if new.i4u_doc_id is distinct from old.i4u_doc_id or new.i4u_doc_type is distinct from old.i4u_doc_type
     or new.doc_number is distinct from old.doc_number or new.issue_date is distinct from old.issue_date
     or new.total is distinct from old.total or new.subtotal is distinct from old.subtotal
     or new.vat_amount is distinct from old.vat_amount or new.firm_id is distinct from old.firm_id then
    raise exception 'ARCHIVE_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger lalum_fin_archive_guard_t before update or delete on public.lalum_fin_archive
  for each row execute function public.lalum_fin_archive_guard();
