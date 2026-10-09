-- Removes four throwaway functions created while applying 0009 (they only probed which statements the SQL tool accepts).
drop function if exists public.lalum_tmp_probe();
drop function if exists public.lalum_tmp_probe3(uuid);
drop function if exists public.lalum_tmp_probe4(uuid);
drop function if exists public.lalum_tmp_probe5(uuid);
