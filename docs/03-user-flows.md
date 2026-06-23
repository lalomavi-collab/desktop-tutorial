# 03 — User Flows

Primary journeys. Each is written as numbered steps with system actions in
*italics*. Edge cases noted under "⚠".

---

## 3.1 Onboarding & Verification (attorney)
1. Visit landing → "הרשמה חינם".
2. Sign up (name, email, password). *System creates `auth.users` + `ldr_profiles` row, status `unverified`.*
3. Onboarding: pick jurisdictions, practice areas, languages, experience tier. *Profile updated.*
4. Verification gate (hard gate): enter full name + license number; optionally upload license scan. *Status → `pending`; a `verification_request` is created.*
5. *System runs registry match (doc 11): exact name+license match in `bar_registry` → auto-verify; else queued for trust-team review.*
6a. **Auto-verified:** *status → `verified`*, gate lifts, full app unlocked, welcome state.
6b. **Manual review:** trust team approves/rejects in Admin console. *On approve → `verified`; on reject → `rejected` with reason.*
7. Verified attorney lands on Feed.

⚠ Admins bypass the gate. ⚠ Rejected users can resubmit with corrections. ⚠ A name/license mismatch never silently passes — it always routes to manual review.

## 3.2 Ask a question → get an expert answer
1. Verified attorney opens Q&A → "+ שאלה חדשה".
2. Enter title, body, practice area, jurisdiction. *Question row created; indexed for search; AI tags suggested (P1).*
3. *System notifies attorneys holding the relevant Expert badge (P1) and surfaces the question in matching feeds.*
4. Experts post answers; community upvotes.
5. Asker marks an **accepted answer**. *Answer author gains reputation + progress toward Expert badge in that area.*

⚠ Self-answer cannot be accepted for reputation. ⚠ Answers from higher-Authority-Tier experts are ranked higher but never hidden.

## 3.3 Create & complete a referral (attorney → attorney)
1. Attorney A opens Referrals → "+ בקשת הפניה".
2. Selects provider B (via search/specialist finder), sets jurisdiction, brief (anonymized), fee, currency, and milestones.
3. *System validates fee-split legality for B's jurisdiction (P2). If unlawful split → block with explanation.*
4. *Referral created, status `proposed`; B notified; immutable audit entry written.*
5. B reviews → **accepts** (`in_progress`) or declines (`cancelled`).
6. Work proceeds against milestones. For each milestone: B marks done → both A and B sign digitally → milestone `released`.
7. When all milestones released → status `completed`. *Both reputations updated; A's "completed referrals" and B's expertise score increment.*
8. (P2) Real settlement triggered via PSP per fee-split terms.

⚠ Escrow is a ledger of intent + signatures in MVP; real money settlement is P2 via a regulated PSP — we never custody funds ourselves. ⚠ Either party can open a dispute (P2) which freezes releases.

## 3.4 Find a specialist / cross-border partner
1. Attorney opens Directory or Map.
2. Filters by practice area, jurisdiction, experience tier, language.
3. *Results ranked by reputation/Authority Tier; verified-only.*
4. Opens a profile → "🤝 בקש שיתוף פעולה" (connect) or starts a referral.

⚠ Demo/illustrative profiles are clearly labeled and not connectable.

## 3.5 Client posts a need → matched to attorneys (Client Marketplace, P1)
1. Client (private/business) posts a legal need: category, jurisdiction, budget, description.
2. *System verifies client intent (anti-spam, P2) and computes match scores against verified attorneys.*
3. Client sees a ranked shortlist of relevant attorneys (reputation-weighted).
4. Attorneys submit quotes/proposals (Premium/lead-fee).
5. Client selects → contact is brokered. *No commission charged to the client; monetization is attorney-side.*

⚠ Client-identifying details are minimized and access-controlled. ⚠ Reviews open only after a confirmed engagement.

## 3.6 AI-assisted work (P1+)
1. Attorney uploads a document or opens a long thread → "Summarize".
2. *Request routes through the AI gateway with confidentiality guardrails (doc 07): PII/client-data handling policy applied, tenant isolation enforced.*
3. AI returns a grounded, **cited** summary; sources link back to in-platform knowledge where applicable.
4. (P2) "Draft" / "Analyze contract" produce editable artifacts with risk flags.

⚠ AI output is labeled assistive, never "legal advice". ⚠ No client data leaves the tenant boundary unless the user explicitly opts a document into a shared context.

## 3.7 Firm admin manages members (Enterprise, P2)
1. Firm admin invites members (email/SSO).
2. Assigns roles (admin, member, viewer) via RBAC.
3. Views firm analytics: referrals in/out, knowledge contribution, reputation.
4. Manages private firm knowledge base (own tenant).

## 3.8 Trust team verifies & moderates (platform)
1. Admin opens verification queue (filter: pending).
2. Reviews submitted name/license/scan against the registry result.
3. Approves (→ verified) or rejects (with reason). *Audit entry written.*
4. Handles reports/moderation from a separate queue (P1).
