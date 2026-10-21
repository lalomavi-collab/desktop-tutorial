-- Stand in for the one finance table that 0073 reads (the real one is created in 0024, which needs the whole finance schema).
create table public.lalum_fin_permissions (firm_id uuid, user_id uuid, level int, primary key (firm_id, user_id));
grant select on public.lalum_fin_permissions to authenticated;
