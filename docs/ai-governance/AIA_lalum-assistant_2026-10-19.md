# AI impact assessment: lalum-assistant (website chat), sys-001

Date: 2026-10-19. Prepared for the owner (ד״ר עו״ד אברהם ללום). First assessment, no prior version. Draft for the owner's review, not a reviewed policy. Legal references are tagged `[verify]` and have not been checked against the instruments.

## 1. System
Chat widget on the site and in /os. Model: Claude Haiku 4.5 through the Anthropic API, behind a Supabase edge function with its own system prompt. Answers general questions on real estate and urban renewal and on AI governance, runs a bounded lookup in a corpus of 31 verified rulings, and points to a consultation. It does not give binding opinions.

Decisions made by owner on 2026-10-19:
- Sign-in is required. Anonymous requests are refused by the server.
- A new sign-up is stored as a lead (email, consent text shown, consent version) and reported to the owner on Telegram.
- Use is limited to 2 messages per person per day and 10 per day in total, counted per message, with a notice that the service is a pilot.

## 2. Role and tier
- Role: provider (own name, own prompt, third-party model) `[verify against current AI Act text]`.
- Tier: limited risk, transparency duty under Art. 50(1) `[verify]`. Not an Annex III use: it advises on nothing about a person's access to essential services, employment or justice, and no decision is made by it.
- EU nexus: "very few" EU clients (owner). Because sign-in is now required, exposure is limited to EU-resident registered users.

## 3. Data flows
| Data | Where it goes | Retention |
|---|---|---|
| Chat messages (up to the last 12 per request) | Sent to Anthropic for inference | Not stored by LALUM. Anthropic's retention and training terms: **not verified** (open item 5) |
| Sign-up email | Supabase (auth, lalum_site_leads) | Leads deleted by the daily job after one year (migration 0050) |
| Sign-up notice | Telegram: area and language only, no email, no name | Telegram's own |
| Usage counters | Postgres, hashed key | Purged after one day |

Red line from the practice profile: "storing the content of client chat conversations". The function does not store content. Satisfied on the code as read.

## 4. Risks and controls
| Risk | Control in place | Residual |
|---|---|---|
| User believes they are speaking to a person | Greeting states it is an AI (PR 992). Disclosure appears at the start of every chat | Low |
| Invented or wrong ruling | Citations only from the 31-ruling corpus; two-source rule for the corpus; case-law lookups capped | Medium: the model can still misstate law in free text. Disclaimer present. Keep red line active |
| Confidential data typed by a user | Chat is general-purpose; no upload path in the widget except the contract attachment, which is processed by Anthropic | Medium. On-screen warning added; the Anthropic terms check is still open |
| Abuse and cost | Sign-in, per person limit, total limit | Low |
| Unconsented marketing | Sign-up checkbox, consent version recorded, deletion on request | Low if the consent text is approved by the owner |
| Prompt injection from pasted text | Not assessed in code for this review; the function writes only usage counters | Unverified |
| Bias | Not a decision system | Not applicable |

## 5. Gaps found
1. Anthropic data terms are not verified: whether inputs train models, and retention. Blocks the final conclusion.
2. On-screen warning against entering confidential client information: added to the chat widget in five languages (2026-10-19). Wording not yet reviewed by a native speaker in ar, es, fr. The /os page does not carry it yet.
3. Chat messages are not logged, so a client claim about an AI error (a consult-immediately trigger) could not be reconstructed. This is a deliberate trade-off against the red line; the owner should confirm it.
4. The consent text for sign-up is drafted, not approved.

## 6. Conclusion
Acceptable to keep in production at limited risk, conditional on items 1 and 2 above. Re-assess on a model change, a change of vendor terms, removal of the sign-in requirement, or by 2027-01-18.

Not legal advice. Prepared as an internal working document.
