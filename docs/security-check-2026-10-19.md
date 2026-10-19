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

## Second pass: SECURITY DEFINER review and wider checks (owner approval)

### SECURITY DEFINER functions executable by signed-in users (about 100)
- None is executable by `anon`.
- Writers: 7 financial functions lack a role helper by name in my first pattern, but each calls `lalum_fin_can(firm)`. `lalum_fin_can` goes through `lalum_fin_level`, which requires the caller to be a member of that firm, MFA verified, and at the required level. Sound as read.
- Six read-only helpers have no check of their own (`lalum_matter_firm`, `lalum_original_referenced`, `lalum_original_slot_ok`, `lalum_purge_blocker`, `lalum_fin_collections_blocked`, `lalum_fin_dunning_blocked`). They return a uuid or a boolean for an id the caller must already know. They are used inside RLS policies, so revoking execute would break those policies. Left as is. Low.
- Open item: `lalum_trust_post` with type REVERSAL looks up the reversed ledger row by id without checking that it belongs to the same firm or matter. With one firm today this has no effect. It matters when a second firm joins. Fix before then.

### Fixed in this pass
- **Group chat open to every signed-in user** (`lalum_group_chat_messages`): read and post policies now require an admin, a firm member, or a client with a matter access grant (migration 0054, applied). A signed-in stranger sees 0 rows. The room had 1 message and 1 author.
- **`lalum-lead`** (course sign-up, deployed but never committed to the repository): had no per-address or overall limit, and every accepted lead sends a Telegram message and an email to the firm. Now 5 per address per hour and 100 per day overall. The source is now in the repository (`lalum-app/supabase/functions/lalum-lead/index.ts`). Needs deploy.
- **`lalum-lead-submit`**: daily ceiling of 100 across everyone added. Needs deploy.

### Checked and sound
- No table in `public` without row level security. All four storage buckets are private with size limits. The one view uses `security_invoker`.
- Anonymous role holds broad table privileges (Supabase default), but every table is RLS protected and the only anonymous policy is the intentional public read of `lalum_playbooks` (3 rows) and answered discussions.
- Deployed functions with JWT verification off, read from the deployed source: `lalum-diag` (retired, returns "disabled"), `lalum-daily-report`, `lalum-newsletter-daily` (database held key, newsletters only send an item a human approved), `lalum-dispatch-worker` (worker key header), `lalum-inquiry-email` (Svix signature plus per firm limit), `lalum-pay-webhook` (shared secret, fail closed, constant time compare), `lalum-voice-webhook`, `lalum-esign`, `lalum-whatsapp-webhook` (Meta signature, fail closed).
- Front end: no `dangerouslySetInnerHTML`, `eval` or dynamic function construction in `src`.

### Remaining, for the owner
1. `pii-gateway`: the unauthenticated `/health` answers, and `/health?deep=1` returns the audit log row count and whether keys and the upstream key are configured. Low, but it should require the gateway token. The source is generated from another package and is not in this repository.
2. Leaked password protection in Supabase Auth (dashboard setting).
3. About 100 `SECURITY DEFINER` functions are visible to signed-in users by design; a periodic review of new ones is advisable.
4. Deploy list (from the repository): `analyze-contract`, `compare-contracts`, `lalum-lead`, `lalum-lead-submit`, `lalum-whatsapp-webhook`.
