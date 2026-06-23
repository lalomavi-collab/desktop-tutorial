# 02 — Feature Map

Capabilities grouped by module. Each feature is tagged with a phase
(`MVP`, `P1`, `P2`, `P3`) aligned to the roadmap (doc 10), and a tier
(`Free`, `Premium`, `Enterprise`, `AI`) aligned to monetization (doc 09).

Legend: 🟢 MVP · 🔵 P1 · 🟣 P2 · ⚫ P3

---

## A. Identity & Trust
- 🟢 Email+password auth · `Free`
- 🟢 Lawyer profile (photo, headline, bio) · `Free`
- 🟢 License verification (Bar registry) · `Free` — doc 11
- 🟢 Specializations / jurisdictions / languages · `Free`
- 🟢 Experience tier · `Free`
- 🔵 Identity verification (ID match to license) · `Free`
- 🔵 Reputation & Authority Tier · `Free`
- 🔵 Endorsements / recommendations · `Free`
- 🟣 SSO + firm-managed identity · `Enterprise`
- 🟣 Verified credential portability (re-verify on jurisdiction change) · `Free`

## B. Knowledge Network
- 🟢 Posts (professional feed) · `Free`
- 🟢 Questions (structured Q&A) · `Free`
- 🟢 Answers / comments · `Free`
- 🟢 Upvotes · `Free`
- 🟢 Expert badges (per practice area) · `Free`
- 🔵 Professional discussions (threaded, topic-scoped) · `Free`
- 🔵 Accepted-answer + bounty (reputation bounty) · `Free`
- 🔵 Tagging & topic taxonomy (practice-area ontology) · `Free`
- 🟣 Document library (templates, checklists) · `Premium`
- 🟣 Precedent library (anonymized outcomes) · `Premium`
- 🟣 Contract library (clause bank) · `Premium`
- 🟣 Case-law library (citator integration) · `Premium`
- 🟣 Expert AMA / live sessions · `Premium`

## C. Referral Marketplace (growth engine)
- 🟢 Create referral (brief, jurisdiction, fee, milestones) · `Free`
- 🟢 Search lawyer for referral · `Free`
- 🟢 Accept / decline referral · `Free`
- 🟢 Referral tracking (lifecycle + audit) · `Free`
- 🔵 Request a professional partner (co-counsel) · `Free`
- 🔵 Specialist finder (complementary fields) · `Free`
- 🔵 Cross-jurisdiction referral (another country) · `Free`
- 🔵 Escrow milestones + dual digital signatures · `Premium`
- 🟣 Lawful fee-split engine (jurisdiction-aware) · `Premium` → commission
- 🟣 Real settlement via regulated PSP · commission
- 🟣 Referral dispute resolution · `Premium`

## D. Client Marketplace
- 🔵 Client posts a legal need · `Free` (client side)
- 🔵 Matching + match-score · `Free`
- 🔵 Show relevant attorneys · `Free`
- 🔵 Quotes / proposals · `Premium` (attorney side, lead fee or sub)
- 🟣 Client identity / intent verification (anti-spam KYC-lite) · platform
- 🟣 Client reviews (post-engagement, moderated) · `Free`

## E. Search & Discovery
- 🟢 Search lawyers · `Free`
- 🟢 Search knowledge · `Free`
- 🟢 Search posts · `Free`
- 🔵 Faceted filters (area/jurisdiction/tier/language) · `Free`
- 🟣 Semantic / vector search · `AI`
- 🟣 Map discovery (geo, Waze-style) · `Free` (exists in pilot)

## F. Reputation
- 🟢 Ratings · `Free`
- 🟢 Completed-referral count + outcome · `Free`
- 🟢 Expertise score (per practice area) · `Free`
- 🔵 Authority Tier ladder · `Free`
- 🔵 Achievement badges · `Free`
- 🟣 Reputation-weighted ranking in search/marketplace · `Free`
- 🟣 Anti-gaming / Sybil resistance signals · platform

## G. AI Layer (doc 07)
- 🔵 Document summarization · `AI`
- 🔵 Discussion / thread summarization · `AI`
- 🔵 Smart search across posts & knowledge (RAG) · `AI`
- 🔵 Expert finder (AI matches question → specialist) · `AI`
- 🟣 Draft generation (letters, motions, clauses) · `AI`
- 🟣 Contract analysis (risk flags, clause diff) · `AI`
- 🟣 Legal Q&A assistant (grounded + cited) · `AI`
- ⚫ Agentic workflows (multi-step, tool-using) · `AI` / `Enterprise`

## H. Enterprise / Firm
- 🟣 Firm account + member management · `Enterprise`
- 🟣 RBAC (roles & permissions) · `Enterprise`
- 🟣 Firm analytics (referrals in/out, knowledge ROI) · `Enterprise`
- 🟣 Shared firm knowledge base (private tenant) · `Enterprise`
- ⚫ SSO/SCIM provisioning · `Enterprise`
- ⚫ Audit export / eDiscovery support · `Enterprise`

## I. Platform / Trust Ops
- 🟢 Admin verification console · platform
- 🔵 Moderation queue + reporting · platform
- 🔵 Audit logs (immutable) · platform — doc 08
- 🟣 GDPR data-subject request tooling (export/erase) · platform
- 🟣 Feature flags + experimentation · platform

## J. Notifications & Engagement
- 🟢 In-app toasts · `Free`
- 🔵 Email notifications (referrals, answers, mentions) · `Free`
- 🔵 Digest (weekly knowledge + referral opportunities) · `Free`
- 🟣 Push / mobile · `Free`
- 🟣 Realtime presence & inboxing (secure DM) · `Premium`

---

### Module dependency order (for build sequencing)
```
Identity & Trust  ──►  Knowledge Network ──►  Reputation
       │                      │                  │
       └──────────►  Referral Marketplace ◄──────┘
                              │
                              ▼
                      Client Marketplace ──►  AI Layer ──►  Enterprise
```
Trust is the foundation; nothing meaningful ships before verification +
reputation exist, because every downstream module is trust-weighted.
