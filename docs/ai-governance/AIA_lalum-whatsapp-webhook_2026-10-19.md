# AI impact assessment: lalum-whatsapp-webhook (WhatsApp), sys-004

Date: 2026-10-19. Prepared for the owner (ד״ר עו״ד אברהם ללום). First assessment. Draft for the owner's review, not a reviewed policy. Legal references are tagged `[verify]` and have not been checked against the instruments. Facts below come from the function source (v30), the database schema and the scheduled jobs, read on this date. Message volume: the message table held 0 rows when read, so no live traffic has been observed.

## 1. System
Supabase edge function receiving the WhatsApp Business Cloud API webhook. Model: Claude Haiku 4.5 through the Anthropic API, with a fixed Hebrew system prompt and four tools: a methodology snippet lookup, lead routing into a tasks table, a case status lookup, and escalation to a human (task plus an email to the firm). It triages and answers at a principled level on the firm's two areas. It does not give binding opinions.

## 2. Role and tier
- Role: provider (own name, own prompt, third-party model) `[verify against current AI Act text]`.
- Tier: limited risk. It converses with people, so the Art. 50(1) transparency duty applies `[verify]`. Not an Annex III use.
- Disclosure: added in PR 1014 and live in v30. The first reply of every conversation opens with a statement that this is an AI assistant, not a person, and that a human can be requested. It is not yet tested with a live message.

## 3. Data flows
| Data | Where it goes | Retention |
|---|---|---|
| Sender's phone number and WhatsApp profile name | `lalum_contacts` (created as a lead on first message), `lalum_whatsapp_messages` | **No purge job covers these tables** |
| Full text of every inbound and outbound message | `lalum_whatsapp_messages.body` | **Indefinite** |
| Last 12 message bodies of the conversation | Sent to Anthropic for each reply | Anthropic terms **not verified** |
| Lead summary, practice area | `lalum_whatsapp_tasks` | Indefinite |
| Escalation reason, phone, name | Email to the firm through Resend | Mailbox policy |
| Message content to Meta | WhatsApp itself is operated by Meta | Outside the firm's control |

Access: the two tables allow read to authenticated admins only (row level security policies seen). Writes go through service role functions.

## 4. Findings
1. **Conflict with a stated red line.** The practice profile lists "storing the content of client chat conversations" as a red line. The site chat honours it. The WhatsApp channel stores the full text of every message, in both directions, with no deletion. This is the most important finding.
2. **No retention.** The existing purge jobs cover site leads, matter documents and the PII shield. None touches the WhatsApp tables. Under Israeli privacy law, keeping personal data longer than its purpose needs is itself a problem `[verify against current law]`.
3. **No privacy notice or consent step.** The first message from a person is stored, turns them into a lead record, and is sent to a third party for processing. The only notice is the AI disclosure and the "informational, not legal advice" line. Nothing says what is stored, for how long, or who processes it `[verify against current law]`.
4. **Lead created without any act of consent.** `is_lead` is set true on the first message. For comparison, site sign-ups now record explicit consent and a notice version.
5. **No deletion path.** There is no function to erase a contact and their messages on request.
6. **No per-sender cap.** The webhook verifies Meta's signature (fails closed), so only Meta can call it, but any WhatsApp user can send unlimited messages, each of which is a paid model call. The site assistant caps at 2 per person per day.
7. **Tools can write.** The model can create task rows and trigger an email to the firm. A malicious message could try to inject text into those. Impact is limited to noise and a misleading summary, not data loss or access. Low.
8. **Sensitive data in free text.** Senders may type ID numbers, addresses or case details. The channel has no warning like the one now on the site chat and /os.

## 5. Controls already in place
- Signature verification with the app secret, fail closed.
- AI disclosure in the first reply.
- System prompt forbids binding opinions, probability estimates and invented rulings, and routes uncertainty to a human.
- Escalation to a human for deadlines, injunctions and distressed senders.
- Admin-only read access, service role writes.

## 6. Recommendations, in order
1. Decide on retention for message bodies. Recommended: keep metadata, delete bodies after 30 days, with a daily job (the model only needs the last 12). Needs the owner's decision because it deletes data.
2. Add a short privacy line to the first reply: what is stored, for how long, who processes it, and how to ask for deletion. Wording to be approved by the owner.
3. Add a per-phone daily cap in the function, with a short "pilot, limited" reply, matching the site assistant.
4. Add a deletion function (contact plus messages plus tasks) and a documented way to invoke it.
5. Add one sentence to the first reply asking senders not to send ID numbers or confidential documents.
6. Verify Anthropic's data terms (shared open item with sys-001) and Meta's terms for the business account.

## 7. Conclusion
Acceptable to keep running at limited risk only if recommendations 1 and 2 are done. Until then the channel conflicts with the owner's own red line and lacks a privacy notice. Re-assess on a model change, a change of vendor terms, a new tool, or by 2027-01-18.

Not legal advice. Prepared as an internal working document.
