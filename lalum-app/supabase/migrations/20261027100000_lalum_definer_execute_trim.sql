-- Security day, step 14 (27.10.2026): the advisor lists every SECURITY DEFINER function a signed in user can
-- call (138 on 23.10, 140 on 27.10). All were read; these four have no caller outside the database: no policy, no view, no RPC from
-- the app or a function, and every function that calls them is itself SECURITY DEFINER, so it runs as the
-- owner and keeps working. A direct call from a session only answered questions about other customers and
-- matters (is this customer locked for collections, was a reminder sent, why can this matter not be purged).
--
-- Not lalum_matter_firm: invoker triggers on hours and messages call it, and revoking it would break them.
-- The SQL tests call lalum_bookkeeper_gaps after `reset role`, as the owner, so they are not affected.
revoke execute on function public.lalum_bookkeeper_gaps() from authenticated;
revoke execute on function public.lalum_fin_collections_blocked(uuid) from authenticated;
revoke execute on function public.lalum_fin_dunning_blocked(uuid) from authenticated;
revoke execute on function public.lalum_purge_blocker(uuid) from authenticated;

-- The three functions the advisor flags for a mutable search_path. Their bodies use only public objects
-- and built in functions, so pinning the path changes nothing they do.
alter function public.lalum_bookkeeper_allowed(text) set search_path = public;
alter function public.lalum_export_classification() set search_path = public;
alter function public.lalum_tax_retention_until(date) set search_path = public;
