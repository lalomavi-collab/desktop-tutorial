-- Own document engine: seed lalum_fin_series from the Invoice4U archive, so a type's series continues
-- from the last real number instead of starting at 1 (confirmed requirement, 2026-10-10, see
-- lalum-app/docs/finance-engine-design.md). Callable, not run automatically here: a partner runs it once
-- the archive import for a firm is complete, and it is safe to run again later (it only ever raises a
-- series, never lowers one), for example after a further import catches up more history.
--
-- Invoice4U numeric doc type to our doc_type, same mapping as I4U_TYPE in src/lib/cockpit/finance.ts:
--   1 חשבונית מס -> INVOICE, 2 קבלה -> RECEIPT, 3 חשבונית מס קבלה -> INVOICE_RECEIPT,
--   4 חשבונית זיכוי -> CREDIT, 5 חשבון עסקה -> PROFORMA. Types 6 to 13 are not used by this practice's
--   account and are skipped (logged in the returned count, not silently dropped).
create or replace function public.lalum_fin_seed_series_from_archive(p_firm uuid)
returns table (doc_type text, seeded_to bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.lalum_fin_can(p_firm) then raise exception 'FORBIDDEN'; end if;

  return query
  with mapped as (
    select case a.i4u_doc_type
             when 1 then 'INVOICE' when 2 then 'RECEIPT' when 3 then 'INVOICE_RECEIPT'
             when 4 then 'CREDIT'  when 5 then 'PROFORMA'
           end as mapped_type,
           a.doc_number
    from public.lalum_fin_archive a
    where a.firm_id = p_firm
  ),
  per_type as (
    select mapped_type, max(doc_number) as max_number
    from mapped
    where mapped_type is not null
    group by mapped_type
  ),
  upserted as (
    insert into public.lalum_fin_series (firm_id, doc_type, last_number)
    select p_firm, per_type.mapped_type, per_type.max_number from per_type
    on conflict (firm_id, doc_type) do update
      set last_number = greatest(public.lalum_fin_series.last_number, excluded.last_number),
          updated_at = now()
    returning public.lalum_fin_series.doc_type, public.lalum_fin_series.last_number
  )
  select upserted.doc_type, upserted.last_number from upserted;
end $$;
revoke execute on function public.lalum_fin_seed_series_from_archive(uuid) from public, anon;
grant execute on function public.lalum_fin_seed_series_from_archive(uuid) to authenticated;
