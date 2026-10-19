-- lalum_practice_playbooks (the firm's contract review rules) was readable by every signed-in user. Sign-up is
-- open, so that meant anyone. Reads now require an admin or a firm member. The pipeline reads with the service
-- role and the analysis RPCs are SECURITY DEFINER, so neither depends on this policy. Applied to production on
-- 2026-10-19 with ALTER POLICY.
alter policy lalum_playbooks_read on public.lalum_practice_playbooks
  using (public.lalum_is_admin() or public.lalum_my_firm_id() is not null);
