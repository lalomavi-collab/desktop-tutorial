begin;
-- A day's closing balance from its bank lines, whatever order they were stored in. Each line with a running balance says where the
-- balance stood after it (balance_after) and so where it stood before it (balance_after - amount). Over one day those are one chain,
-- opening to closing, so the closing is the one "after" value that no line of the day starts from. Lines loaded in one statement
-- share one created_at, so "the newest line" is not an order: on 28.10 it showed 21,768.02 for a day that closed at 30,618.02.
--
-- p_lines is one day of one account: [{amount, balance_after}, ...]. A line without balance_after is left out (a Financy line has
-- none). When the chain does not give exactly one closing (a day that ends where it began, or a broken chain), the last line's balance
-- in the array's order stands. On 29.10 all 44 days of the Leumi file (72 lines) give exactly one.
--
-- Pure: reads no table. Used by lalum_fin_bank_lines_merge and its backfill (20261029100100) and by the snapshot (20261029100200).
-- Paste in the SQL editor as one block. Undo: drop function public.lalum_fin_bank_closing(jsonb).

create or replace function public.lalum_fin_bank_closing(p_lines jsonb)
returns numeric
language sql
immutable
set search_path = pg_catalog
as $$
  with l as (
    select x.ord, (x.e ->> 'balance_after')::numeric as post, (x.e ->> 'balance_after')::numeric - (x.e ->> 'amount')::numeric as pre
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as x(e, ord)
     where x.e ->> 'balance_after' is not null and x.e ->> 'amount' is not null),
  open_end as (
    select s.v, sum(s.n) as n from (select post as v, 1 as n from l union all select pre, -1 from l) s group by s.v having sum(s.n) > 0)
  select case when (select sum(n) from open_end) = 1 then (select v from open_end)
              else (select post from l order by ord desc limit 1) end
$$;
revoke all on function public.lalum_fin_bank_closing(jsonb) from public, anon;
grant execute on function public.lalum_fin_bank_closing(jsonb) to authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('20261029100000', 'lalum_fin_bank_closing') on conflict (version) do nothing;
commit;
