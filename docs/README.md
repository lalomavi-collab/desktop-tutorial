# LAWDin — Legal Operating System

> The professional operating system for attorneys: a trust-first network for
> knowledge sharing, professional collaboration, case & client referrals, and
> AI-assisted legal work. **Not** "Facebook for lawyers" — an OS for the practice
> of law.

This folder is the product & engineering source of truth. It is written to be
read top-to-bottom by a new engineer, investor, or partner.

## Documents

| # | Document | What it answers |
|---|----------|-----------------|
| 00 | This README | Vision, scope, how the docs fit together |
| 01 | [Product Requirements (PRD)](./01-PRD.md) | Who, what, why, success metrics, MVP scope |
| 02 | [Feature Map](./02-feature-map.md) | Every capability, grouped into modules & tiers |
| 03 | [User Flows](./03-user-flows.md) | Step-by-step journeys for each persona |
| 04 | [Database Schema](./04-database-schema.md) | Tables, relations, RLS model |
| 05 | [System Architecture](./05-system-architecture.md) | Components, data flow, multi-tenancy, scale |
| 06 | [API Design](./06-api-design.md) | REST/RPC surface, conventions, examples |
| 07 | [AI Architecture](./07-ai-architecture.md) | The AI layer: RAG, agents, guardrails |
| 08 | [Security Architecture](./08-security-architecture.md) | RBAC, audit, GDPR, attorney–client privilege |
| 09 | [Monetization Strategy](./09-monetization.md) | Freemium, subscriptions, referral & AI revenue |
| 10 | [24-Month Roadmap](./10-roadmap-24mo.md) | Phased plan from MVP to global platform |
| 11 | [Bar-Registry Verification](./11-verification-bar-registry.md) | How we make "verified attorney" 100% true |

## North-star principle: **Trust First**

Every architectural and product decision is filtered through one question:
*does this increase or decrease the trust an attorney can place in the network?*
Trust outranks any single feature. A smaller network of genuinely verified,
reputable attorneys is worth more than a large unverified one.

## Current state (as of this brief)

A working pilot exists (Israel) on this stack:

- **Frontend:** React + Vite + TypeScript (`ldr/web`)
- **Backend:** Supabase — Postgres + Row-Level Security, Auth (email+password),
  Storage (license scans)
- **Live modules:** Auth/landing, Onboarding, Verification gate, Admin verify,
  Feed, Q&A, Decision Room (case validation), Directory, Waze-style Map,
  Legal Gigs, Escrow Referrals, Leaderboard / Authority Tier, Profile

These docs describe how to evolve that pilot into the enterprise-grade Legal OS.

## Naming conventions

- Existing pilot tables are prefixed `ldr_`. The target schema (doc 04) keeps
  this prefix for continuity and namespaces new domains clearly.
- "Attorney", "lawyer", "עו״ד" are used interchangeably; "intern" = מתמחה.
- "Tenant" = an isolated org boundary (law firm, or the global public tenant).
