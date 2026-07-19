# 01 — Product Requirements Document (PRD)

## 1. Vision

Build the **Legal Operating System**: one place where licensed attorneys ask
professional questions, get expert answers, share legal knowledge, refer cases
and clients, find specialists in complementary fields, win new clients, build
professional reputation, and use AI purpose-built for legal work.

We are not building a social network that happens to host lawyers. We are
building the daily operating surface for a legal practice, with a trust layer
strong enough that an attorney will stake their reputation on a referral made
through it.

## 2. Problem

A practicing attorney's professional life is fragmented across:

- WhatsApp/Telegram groups for quick questions (no provenance, no reputation)
- Forums and Facebook groups for knowledge (noisy, unverified, not searchable)
- LinkedIn for presence (not legal-specific, no referral mechanics)
- Ad-hoc personal networks for referrals (opaque, no tracking, trust-by-luck)
- Generic AI tools not grounded in legal context or confidentiality rules

The cost is wasted time, missed referral revenue, and decisions made on
unverified information. No single trusted system consolidates this.

## 3. Target users (personas)

| Persona | Goal on LAWDin | Primary modules |
|---|---|---|
| **Solo / boutique attorney** | Knowledge, referrals in/out, new clients, reputation | Q&A, Referrals, Client Marketplace, Profile |
| **Specialist** (e.g. tax, IP) | Inbound referrals in their niche, thought leadership | Expert badges, Referrals, Feed |
| **Cross-border attorney** | Partner in another jurisdiction, fee split | Referral Marketplace, Directory, Map |
| **Intern (מתמחה)** | Learn, build early reputation | Q&A (ask), Feed, limited referrals |
| **Law-firm admin** | Manage firm members, compliance, analytics | Enterprise console, Audit, RBAC |
| **Client (private/business)** | Find the right verified attorney without commission | Client Marketplace |
| **Platform admin / trust team** | Verify licenses, moderate, resolve disputes | Admin, Verification, Audit |

## 4. Goals & non-goals

**Goals**
- Make "verified attorney" a claim that is 100% true (see doc 11).
- Make referrals trackable, accountable, and (where lawful) fee-split-enabled.
- Make legal knowledge searchable, attributable, and reputation-weighted.
- Provide an AI layer that is grounded, cited, and confidentiality-safe.

**Non-goals (for now)**
- Acting as a law firm or providing legal advice ourselves.
- Holding client funds beyond a controlled escrow ledger (real money settlement
  is integrated via a regulated PSP, not custodied by us).
- Replacing case-management/practice-management software (we integrate, later).

## 5. Success metrics

**North-star metric:** *number of completed, mutually-confirmed referrals per
month* — it captures trust, network density, and revenue intent in one number.

Supporting metrics:
- Verified-attorney activation rate (signup → verified → first contribution)
- Weekly active verified attorneys (WAU)
- Questions with an accepted expert answer within 24h (%)
- Referral completion rate (created → accepted → completed)
- Client-marketplace match acceptance rate
- AI-assisted action adoption (summaries/drafts per active user)
- NPS among verified attorneys

## 6. MVP scope (must-ship before anything else)

The MVP is the trust + knowledge + referral core. Everything else waits.

### 6.1 Users & Profile
- Account (email+password, later SSO/firm SSO)
- Lawyer profile: display name, photo, headline, bio
- **Verification** (license + identity → verified badge; see doc 11)
- Specializations (practice areas), jurisdictions, languages, experience tier

### 6.2 Community / Knowledge
- Posts (professional feed)
- Questions (structured Q&A)
- Comments / Answers
- Upvotes
- Expert badges (earned per practice area)

### 6.3 Referrals
- Create referral (brief, jurisdiction, fee, milestones)
- Search lawyer (by area/jurisdiction/tier/reputation)
- Accept referral
- Referral tracking (status lifecycle + audit trail)

### 6.4 Search
- Search lawyers
- Search knowledge (questions/answers/docs)
- Search posts

### 6.5 Reputation
- Ratings
- Completed referrals (count + outcome)
- Expertise score (per practice area)

**MVP exit criteria:** a verified attorney can ask a question and get an expert
answer, find and complete a referral with another verified attorney, and have
their reputation reflect both — end-to-end, with full audit.

## 7. Post-MVP (in priority order)
1. Client Marketplace (need posting → matching → quotes)
2. AI layer v1 (summaries, smart search, draft assistance) — doc 07
3. Knowledge libraries (documents, precedents, contracts, case law) — doc 02
4. Enterprise/firm accounts (multi-tenant console, RBAC, analytics) — doc 05
5. Real fee settlement via PSP + cross-border fee-split rules engine
6. Internationalization beyond Israel (new jurisdictions) — doc 10

## 8. Constraints & assumptions
- Attorney–client confidentiality is sacred: client-identifying data must never
  be required for knowledge sharing; case validation uses anonymized briefs.
- Fee-splitting legality varies by jurisdiction — the referral engine must be
  jurisdiction-aware and block unlawful splits (doc 06 §Referrals).
- GDPR + Israeli Privacy Protection Law compliance from day one (doc 08).
- The platform must be multi-tenant-ready even while the pilot is single-tenant.

## 9. Open questions (tracked, not blocking MVP)
- Do interns get referral-receive rights or only referral-assist?
- Is reputation global or per-jurisdiction (lean: per-practice-area, global)?
- Client identity verification depth for the Client Marketplace (KYC level)?
- Dispute-resolution authority for referral fee disputes (arbitration partner)?
