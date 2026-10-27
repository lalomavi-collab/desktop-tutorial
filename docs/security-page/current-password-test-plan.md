# Require current password: test plan (separate Supabase project only)

Status: prepared, not run. The client change in this branch sends `current_password` to `auth.updateUser` only when the change form already verified it. Nothing is enabled on the production project, and nothing here may be run against it.

## Why a separate project

The setting "Require current password when updating" changes what the server accepts from every signed in user, including the recovery session after a reset by code. Whether the recovery session is exempt is not documented, and a wrong guess locks users out of the reset flow. That is a question for a scratch project, not for production.

## Setup

1. Create a throwaway Supabase project (Free plan is enough). Apply the project's migrations only if the page under test needs them; the password flows need none.
2. Create two test users with passwords, one with a TOTP factor and one without. Use addresses on a domain you control.
3. Point a local `lalum-app` build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) at the throwaway project. Never at production.

## Cases (setting OFF, then ON)

| # | Case | Setting off | Setting on |
|---|------|-------------|------------|
| 1 | Change password in /settings/security with the right current password | succeeds | succeeds |
| 2 | Same call with `current_password` removed (direct API call) | succeeds | must fail |
| 3 | Same call with a wrong `current_password` (direct API call) | succeeds or ignored, record which | must fail |
| 4 | Reset by 8 digit code, then set a new password on /reset-password (no current password exists) | succeeds | record: succeeds or fails |
| 5 | User with TOTP: change password after AAL2 | succeeds | succeeds |
| 6 | After 1, other sessions of the same user are signed out | yes | yes |

Case 4 with the setting on is the one that decides whether the setting can ever be switched on. If the recovery session is not exempt, do not enable it: the reset flow would break.

## Decision rule

Enable on production only if every "must fail" case fails, case 4 succeeds, and case 1 and case 5 succeed. Otherwise leave the setting off and keep the existing protections (the form's own server side verification of the current password, the lockout backoff, and sign out of other sessions). Enabling is a Supabase dashboard change made by the owner, with Chrome in Claude instructions prepared separately.

## Record

Write the result of each case in `docs/security-page/verified-claims.md` only with the evidence (log line or response), and add a claim to the security page only after that.
