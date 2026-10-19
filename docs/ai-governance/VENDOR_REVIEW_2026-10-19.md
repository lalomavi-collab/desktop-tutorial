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
| Question | Finding | Source |
|---|---|---|
| Paid services | Google does not use prompts or responses to improve its products; processing under its Data Processing Addendum. Prompts and responses are logged for a limited period solely to detect violations of the Prohibited Use Policy | https://ai.google.dev/gemini-api/terms |
| Abuse monitoring retention | Prompts, context and outputs retained 55 days; reviewed by authorized staff only if flagged; not used to train models other than policy enforcement | https://ai.google.dev/gemini-api/docs/usage-policies |
| Unpaid services | Content and responses are used to improve Google products; human reviewers may read them. "Do not submit sensitive, confidential, or personal information" | terms page |
| Europe | Only Paid Services may be used for API clients available to users in the EEA, Switzerland or the UK; for those regions the paid-services data terms apply to all services | terms page |
| Zero data retention | Not available on the Gemini Developer API; Vertex AI is the route for guaranteed ZDR | https://ai.google.dev/gemini-api/docs/zdr |

**OWNER**: confirm whether the agent is active and whether its Google key belongs to a Cloud project with active billing (paid). If it is unpaid, invoices (third party personal data) would be used to improve Google products. Treat as not acceptable until confirmed.

## 3. OpenAI: sys-005 (voice webhook, only if `LLM_PROVIDER=openai`)
- By default OpenAI does not train on inputs or outputs of business users, including the API (https://openai.com/business-data/; https://help.openai.com/en/articles/5722486-api-data-usage-policies).
- Abuse monitoring logs may contain prompts and responses and are retained up to 30 days by default (https://developers.openai.com/api/docs/guides/your-data).
- **OWNER**: confirm whether `OPENAI_API_KEY` is set and the provider switched. Default is Anthropic.

## 4. Synthesia: sys-013
- Synthesia states it does not use customer data, including inputs or outputs, to pre-train its AI components; fine-tuning on customer data happens only on the customer's written instruction (https://www.synthesia.io/legal/ai-governance-practices; https://www.synthesia.io/ai-governance).
- Avatar creation processes biometric data (face and voice) with explicit consent; it is kept while the avatar exists or as the customer instructs (https://www.synthesia.io/legal/privacy-policy).
- **Conflict to resolve**: the Data Processing Agreement dated 2023-01-25 lists "improving the content ... by including the Data in the AI training dataset" as part of the processing, with deletion at termination (https://www.synthesia.io/terms/data-processing-agreement-2023-01-25). The newer pages say customer data is not used for pre-training. Which text governs depends on the agreement the firm accepted and its date.
- **OWNER**: confirm which terms and DPA version apply to the account, and that the avatar is the owner's own and consented.

## 5. Meta (WhatsApp Business): sys-004
- Meta Terms for WhatsApp Business: https://www.whatsapp.com/legal/meta-terms-whatsapp-business. The contracting entity is Meta Platforms Ireland Limited, except for the United States, Canada and Brazil.
- WhatsApp Business Data Processing Terms (22 August 2025): where the Business Terms say WhatsApp processes personal information in customer data as the business's processor, it does so on the business's instructions, with security measures, breach notification and assistance with data subject requests. WhatsApp may use sub-processors, including in the US (https://www.whatsapp.com/legal/business-data-processing-terms/; sub-processor list https://www.whatsapp.com/legal/business-subprocessors).
- Not found in this check: a stated retention period for message content at Meta. **Not concluded** on retention.
- **OWNER**: confirm the WhatsApp Business account type and which contracting entity applies.

## 6. What this changes
- sys-001 assessment gap 1 (Anthropic data terms): resolved on the documents, subject to the **OWNER** account type confirmation.
- sys-004 assessment recommendation 6: Anthropic part resolved on the same condition; Meta processor terms read, retention at Meta not established.
- Fee agreement AI clause (open item 6) should say that client data is processed by Anthropic under commercial terms with no training and 30 day deletion, if the account type is confirmed. The clause text is still needed from the owner.
