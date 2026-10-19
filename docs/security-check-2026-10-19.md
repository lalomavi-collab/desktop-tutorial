# Integrity and security check, 2026-10-19

Run on `main` at `7a00b2c` and on the live Supabase project `meoymkcotomoluwlwues`. Read only, except as noted. Nothing was changed by this check.

## Passed
- `npm run build` and the repository checks: 17 pass, 0 fail.
- No secrets found in tracked files (patterns for Anthropic, Supabase, JWT, AWS, GitHub, Slack keys, private keys).
- Open pull requests: one (#1023, a draft video tooling PR from another session, not part of this work).
- `lalum-assistant` live (v63): `rulings` 31, `rulingsSha` and `systemSha` equal the repository hashes. An anonymous POST returns `login_required`, so the model is not reached.
- Supabase security advisors: no ERROR level findings. The new functions and tables are not flagged.
- New functions `lalum_whatsapp_purge_bodies` and `lalum_whatsapp_erase_contact`: executable by `service_role` only (anon and authenticated both false).
- Tables holding conversations and leads (`lalum_whatsapp_messages`, `lalum_whatsapp_tasks`, `lalum_site_leads`, `lalum_leads`, `lalum_contacts`): read policies require admin.
- Privilege escalation through sign-up: `lalum_profiles.is_admin` is writable by column grant, but the trigger `lalum_guard_profile_admin` rejects any change of `is_admin` from an end-user session. Sound as read.
- Response headers on the site: HSTS, CSP (no inline script), `nosniff`, `X-Frame-Options`, referrer and permissions policies.
- Scheduled jobs present for site lead purge and WhatsApp body blanking.

## Findings, not fixed
1. **Internal playbooks readable by any signed-in user.** `lalum_practice_playbooks` (38 rows: rule names, patterns, fallback clauses) has a read policy `true` for the `authenticated` role. Sign-up is open and is now required to use the chat, so anyone can register and read them. `lalum_subscription_plans` is also readable by every signed-in user (price list, likely fine). Decision for the owner: restrict the playbooks to firm members, which needs a check of what `/os` and the cockpit read.
2. **Leaked password protection is off in Supabase Auth** (advisor). The app compensates with its own breached password check at sign-up (`pwnedpasswords`), which can be bypassed by calling the Auth API directly. Enabling it is a dashboard setting.
3. **Many `SECURITY DEFINER` functions are executable by any signed-in user** (advisor, about 100 functions). Many are by design RPCs that check roles inside. Each should be reviewed because sign-up is public. Not reviewed one by one in this check.
4. **`pg_net` extension is installed in `public`** (advisor, warning).
5. **Public AI endpoints without a global cap.** `analyze-contract` and `compare-contracts` have no login and limit per client per hour only. A distributed abuse pattern is bounded by cost only. The site assistant has a daily total of 10; these two do not.
6. **Dependencies:** `npm audit --omit=dev` reports 3 moderate findings, all via `mammoth` (`argparse`, `sprintf-js` unbounded precision, denial of service). No fix available without a breaking change.
7. **Verified live is not the same as tested end to end:** the WhatsApp function in production is still v30 (no privacy line, no sender cap) until it is deployed from the repository.

## Recommended order
1. Deploy the WhatsApp function.
2. Decide on finding 1.
3. Turn on leaked password protection (finding 2).
4. Review the `SECURITY DEFINER` list (finding 3), starting with functions that return client data.
5. Add a daily total to the two contract endpoints (finding 5).

## Follow up, same day (owner approval)
- Finding 1 fixed in production: reads of `lalum_practice_playbooks` now require an admin or a firm member (migration 0053). Tested with a signed-in stranger: 0 rows; service role still sees 38. `lalum_subscription_plans` left readable.
- Finding 5 fixed in code: `analyze-contract` and `compare-contracts` now also stop at 30 calls per day across all callers (HTTP 429, code `daily_cap`). Takes effect when the two functions are deployed. The page still shows its hourly limit message for any 429.
- Owner account check: `avraham@lalum.co` is registered and confirmed, so nobody else can register that address (the admin helper also admits it by email).
- Database tooling note: statements containing `drop` or `delete` hung in this session's SQL tool; policy and function changes were applied with `alter policy` and dynamic SQL.
