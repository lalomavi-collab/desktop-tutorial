# 10 — 24-Month Roadmap

Phased from the working Israel pilot to a global Legal OS. Each phase has a theme,
exit criteria, and the metric it moves. Timeboxes are indicative.

```
P0  Foundation & Trust        Months 0–3    ── verified core, MVP live
P1  Knowledge + Marketplace   Months 3–8    ── Q&A depth, clients, AI v1
P2  Monetize + Enterprise     Months 8–15   ── settlement, firms, AI v2
P3  Scale + Internationalize  Months 15–24  ── new jurisdictions, agentic AI
```

---

## P0 — Foundation & Trust (Months 0–3)
**Theme:** make "verified attorney" 100% true and ship the MVP core.
- Bar-registry **ingestion + auto-verification** pipeline (doc 11) — *the "כן"*.
- Harden RLS on all tables; RBAC roles (`platform_admin`, `trust_team`).
- MVP completeness: Profile, Verification, Specializations/Jurisdictions/
  Languages; Posts/Questions/Answers/Upvotes/Expert badges; Referrals
  (create/search/accept/track); Search (lawyers/knowledge/posts); Reputation
  (ratings, completed referrals, expertise score).
- `audit_logs` (append-only) + reputation_events ledger.
- **Exit:** an attorney can verify against the registry, ask→get an accepted
  answer, and complete a referral end-to-end, all audited.
- **Metric:** verified-attorney activation rate; first completed referrals.

## P1 — Knowledge depth + Client Marketplace + AI v1 (Months 3–8)
**Theme:** become the daily knowledge surface and open the demand side.
- Topic taxonomy/ontology; threaded discussions; accepted-answer bounties.
- **Client Marketplace:** need posting → matching → shortlist → quotes
  (attorney-side monetization; client pays nothing).
- **AI v1** (gateway + RAG): document/thread summarization, semantic search,
  expert finder, with citations and confidentiality guardrails.
- Email notifications + weekly digest; faceted search; map discovery polish.
- Start **AI subscription** and **Premium** (libraries beta, escrow milestones).
- **Exit:** weekly active verified attorneys growing; first marketplace matches;
  AI adoption measurable.
- **Metric:** WAU; questions with accepted answer <24h; match acceptance rate.

## P2 — Monetize + Enterprise + AI v2 (Months 8–15)
**Theme:** turn trust and referrals into revenue; land law firms.
- **Referral settlement** via regulated PSP; **lawful fee-split engine**
  (jurisdiction-aware) + dispute resolution.
- **Enterprise/firm accounts:** firm tenant, member management, RBAC console,
  firm analytics, private firm knowledge base; SSO (P2→P3).
- **AI v2:** draft generation, contract analysis, grounded legal Q&A assistant.
- Knowledge libraries GA (documents, precedents, contracts, case law).
- GDPR DSAR tooling GA; security pen-test; SOC2-readiness program kickoff.
- **Exit:** recurring revenue from subs + first settled-fee commissions; paying
  firm pilots.
- **Metric:** MRR; completed referrals/month (north-star); enterprise pipeline.

## P3 — Scale + Internationalization (Months 15–24)
**Theme:** the world's leading attorney platform.
- **New jurisdictions:** per-country registry ingestion + verification adapters;
  localization; jurisdiction-aware fee-split rules; cross-border referral GA.
- **Agentic AI** workflows (multi-step, tool-using, human-in-the-loop).
- Mobile apps (P2 groundwork → GA).
- Scale infra: read replicas, dedicated search/vector if needed, per-tenant
  isolation for large enterprises.
- Compliance maturity: SOC2/ISO 27001, regional data residency GA.
- **Exit:** multi-jurisdiction network with cross-border referral liquidity.
- **Metric:** cross-border completed referrals; international WAU; enterprise ARR.

---

## Cross-cutting workstreams (every phase)
- **Trust & Safety:** verification accuracy, moderation, anti-gaming.
- **Security & Compliance:** audits, DSAR, retention, sub-processor DPAs.
- **Reliability:** SLOs on login/verify/referral; incident runbooks.
- **Data/Analytics:** north-star + funnels; experiment platform (P1+).

## Sequencing rationale
Trust before knowledge before marketplace before monetization before scale.
Each layer is only as valuable as the verified-attorney trust beneath it, so we
never monetize or internationalize ahead of the trust and quality that make those
features credible.

## Key risks & mitigations
| Risk | Mitigation |
|---|---|
| Registry data unavailable/stale for auto-verify | Manual review fallback always on; periodic re-ingest; per-jurisdiction adapters |
| Fee-splitting unlawful in a market | Rules engine disables it per jurisdiction; legal review gate |
| Cold-start (empty network) | Seed via invites, anonymized public Q&A SEO, concierge referrals |
| AI hallucination/confidentiality | Grounding + citations + guardrails; AI non-critical-path |
| Enterprise isolation demands | Schema/DB-per-tenant escalation path for specific customers |
