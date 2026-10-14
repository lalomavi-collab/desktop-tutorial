-- Live-only table behind the lalum_v_admin_matters view (columns the view uses), for tests of migration 0044.
create table if not exists public.lalum_intake_routings (
  matter_id uuid primary key, practice_area text, partner_response text default 'PENDING_REVIEW',
  dispatched_at timestamptz default now(), first_viewed_at timestamptz, assigned_firm_id uuid, conflict_status text
);
