# 09 — Monetization Strategy

## 1. Philosophy
- **Free core, paid leverage.** The trust + knowledge + referral core is free for
  individual attorneys — that drives the network effect. We charge for
  *amplification* (reach, AI, enterprise, settlement).
- **Never tax the client.** Clients pay no commission to find an attorney; the
  Client Marketplace monetizes the attorney side. This is a core promise.
- **Align revenue with value delivered:** a completed referral or a won client is
  where we can ethically capture value.

## 2. Revenue streams

### 2.1 Freemium (individual attorney) — `Free`
- Profile, verification, feed, Q&A, search, basic referrals, reputation.
- Goal: maximize verified-attorney adoption and engagement.

### 2.2 Premium subscription (individual) — `Premium`
Monthly/annual per attorney. Includes:
- Knowledge libraries (documents, precedents, contracts, case law)
- Escrow milestones + dual-signature referrals
- Secure DM / inbox, advanced profile (analytics, featured placement)
- Higher search visibility weighting (within reputation bounds — never "pay to
  fake reputation")
- Quote submission in the Client Marketplace (or pay-per-lead, see 2.4)

### 2.3 AI subscription — `AI`
- Credit/quota-based tiers on top of Free or Premium.
- Summaries, semantic search, drafting, contract analysis, legal Q&A assistant.
- Metered by tokens/credits at the AI gateway (doc 07 §8); overage packs.

### 2.4 Referral & client commissions — usage-based
- **Referral fee commission (P2):** when real settlement runs through the
  platform's PSP-backed escrow, take a small % of the **platform-facilitated fee
  split** — only on money that actually moves through us, only where fee-splitting
  is lawful in the jurisdiction.
- **Client Marketplace (P1):** attorney-side monetization via either
  *pay-per-qualified-lead* or *quote-submission* included in Premium. Client pays
  nothing.

### 2.5 Enterprise / law-firm accounts — `Enterprise`
Per-seat or per-firm annual contracts. Includes:
- Firm tenant: private knowledge base, member management, RBAC
- Firm analytics (referrals in/out, knowledge ROI, reputation)
- SSO/SCIM, audit export, data-residency options, priority support, SLA
- Volume AI credits

## 3. Packaging overview
| Tier | Audience | Headline value | Pricing model |
|---|---|---|---|
| Free | Individual attorney | Trust + knowledge + basic referrals | $0 |
| Premium | Active/solo/boutique | Libraries, escrow, visibility, marketplace quotes | per-seat sub |
| AI | Any paid user | AI assistant + credits | per-seat sub + credits |
| Enterprise | Law firms | Private tenant, RBAC, analytics, compliance | annual contract |
| Usage | Referrals/clients | Commission on settled fee splits; leads | % / per-lead |

## 4. Pricing principles
- Reputation and verification are **never** for sale. You can buy reach and tools,
  not trust. This protects the north-star asset.
- Transparent commissions, shown before a settlement is initiated.
- Jurisdiction-aware: commission/fee-split features auto-disable where unlawful.
- Annual discount; firm volume tiers; intern/early-career concessions to seed the
  funnel.

## 5. Unit economics & levers
- **Acquisition:** organic via verified-attorney invites + knowledge SEO (public,
  anonymized Q&A indexed) → low CAC.
- **Activation:** signup → verified → first contribution/referral (track funnel).
- **Monetization triggers:** hitting AI quota, needing escrow/settlement, wanting
  marketplace quotes, firm onboarding.
- **Retention:** referral income + knowledge value + reputation lock-in.
- **Expansion:** Free → AI/Premium → (for firm members) Enterprise.

## 6. Sequencing (aligned to roadmap, doc 10)
1. **P0–P1:** Free everything; start AI subscription once AI v1 ships.
2. **P1:** Premium (libraries, escrow, marketplace quotes).
3. **P2:** Referral settlement commissions (PSP) where lawful; Enterprise pilots.
4. **P3:** Enterprise GA; international pricing; marketplace scale.

## 7. Guardrails & ethics
- Comply with bar-association advertising/fee-splitting rules per jurisdiction;
  legal review before enabling commissions in any new country.
- No dark patterns; clear cancellation; no selling of user/client data, ever.
