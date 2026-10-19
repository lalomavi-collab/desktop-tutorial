# Vendor AI review, 2026-10-19

Prepared for the owner (ד״ר עו״ד אברהם ללום). Working document, not legal advice. Each statement below was read on its own vendor page on this date. Pages change; re-read before relying. Two sources are cited where they exist. Contract or account facts that only the owner can confirm are marked **OWNER**.

## 1. Anthropic (Claude API): sys-001, 002, 003, 004, 005, 007, 008, 010, 011
| Question | Finding | Source |
|---|---|---|
| Training on customer inputs and outputs | Commercial Terms, section B: "Anthropic may not train models on Customer Content from Services." The customer retains rights to Inputs and owns Outputs | https://www.anthropic.com/legal/commercial-terms |
| Same, second source | "We do not use API data for training (unless you have an agreement with us that states otherwise)" | https://privacy.claude.com/en/articles/7996875-can-you-delete-data-that-i-sent-via-api |
| Retention | API inputs and outputs are automatically deleted from the backend within 30 days, except longer-retention services the customer controls (e.g. Files API), agreed exceptions (e.g. zero data retention), Usage Policy enforcement, or legal compliance | https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data |
| Flagged content | Inputs and outputs of content flagged as violating the Usage Policy may be kept up to 2 years | same page |
| Deletion on request | Ad hoc deletion is not supported for paid API customers | https://privacy.claude.com/en/articles/7996875-can-you-delete-data-that-i-sent-via-api |
| Data processing terms | Data submitted is processed under Anthropic's Data Processing Addendum, incorporated into the Commercial Terms (section C) | commercial terms |
| Zero data retention | Available by agreement for eligible API features, requested through Anthropic sales; not available for the Covered Models (Fable and Mythos families) | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention |
| Contracting entity | Anthropic PBC for customers outside the EEA, Switzerland and UK | commercial terms |

Conclusion: if the key used by the functions belongs to an API organization under the Commercial Terms, inputs are not used for training and are deleted within 30 days. **OWNER**: confirm that `ANTHROPIC_API_KEY` belongs to a Console (API) organization and not a consumer plan. Consumer plans follow different terms. The privacy notice sent in WhatsApp ("30 days", "external AI provider") is consistent with this.

Gaps to decide: no ad hoc deletion at Anthropic means a deletion request to the firm cannot be extended to Anthropic's copy before the 30 days pass; the notice says 30 days, which matches. Whether to request zero data retention is a business choice.

## 2. Google (Gemini API): sys-009 invoice agent
- Gemini API Additional Terms, effective March 23, 2026: "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." (https://ai.google.dev/gemini-api/terms)
- The retention and training sections for paid and unpaid services were not read in full on this date. **Not concluded.**
- **OWNER**: confirm the agent is active and whether the Google key is on a paid plan. The agent reads invoices, which can hold third party personal data.

## 3. OpenAI: sys-005 (voice webhook, only if `LLM_PROVIDER=openai`)
- By default OpenAI does not train on inputs or outputs of business users, including the API (https://openai.com/business-data/; https://help.openai.com/en/articles/5722486-api-data-usage-policies).
- Abuse monitoring logs may contain prompts and responses and are retained up to 30 days by default (https://developers.openai.com/api/docs/guides/your-data).
- **OWNER**: confirm whether `OPENAI_API_KEY` is set and the provider switched. Default is Anthropic.

## 4. Synthesia: sys-013
- Not read on this date. **Not concluded.** The script sends text of daily reports and uses an avatar of the owner; confirm in the Synthesia account that the avatar is the owner's own, consented, and who may use it.

## 5. Meta (WhatsApp Business): sys-004
- Not read on this date. WhatsApp message content passes through Meta's infrastructure by the nature of the channel. **Not concluded.**

## 6. What this changes
- sys-001 assessment gap 1 (Anthropic data terms): resolved on the documents, subject to the **OWNER** account type confirmation.
- sys-004 assessment recommendation 6: Anthropic part resolved on the same condition; Meta part open.
- Fee agreement AI clause (open item 6) should say that client data is processed by Anthropic under commercial terms with no training and 30 day deletion, if the account type is confirmed. The clause text is still needed from the owner.
