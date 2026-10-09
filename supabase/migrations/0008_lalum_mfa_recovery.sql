-- 0008_lalum_mfa_recovery.sql
-- One-time recovery codes for the TOTP second factor, so a lost phone does not
-- lock the only administrator out. Codes are stored as salted SHA-256 hashes
-- and are only ever read or written by the lalum-mfa-recovery edge function
-- (service role). RLS is enabled with no policies, so no client role can touch
-- these tables directly.

create table if not exists public.lalum_mfa_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
create index if not exists lalum_mfa_recovery_codes_user_idx on public.lalum_mfa_recovery_codes (user_id);
alter table public.lalum_mfa_recovery_codes enable row level security;

-- Throttle for wrong guesses: five misses lock redemption for fifteen minutes.
create table if not exists public.lalum_mfa_recovery_state (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  failed       int not null default 0,
  locked_until timestamptz
);
alter table public.lalum_mfa_recovery_state enable row level security;

revoke all on public.lalum_mfa_recovery_codes from anon, authenticated;
revoke all on public.lalum_mfa_recovery_state from anon, authenticated;
