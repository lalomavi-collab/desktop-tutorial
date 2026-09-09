# 12 — LALUM Executive WhatsApp Interface

## 1. What this is

An inbound WhatsApp channel for the LALUM office: a visitor writes to the
firm's WhatsApp Business number, and `lalum-whatsapp-webhook` (a Supabase Edge
Function) triages the message, answers from the firm's own two areas, opens a
CRM lead, reports on an open item, or escalates to a human, then replies on
the same thread through the WhatsApp Cloud API.

It reuses the voice pipeline's contact directory (`public.lalum_contacts`,
introduced in `0003_voice_call_sync.sql`) so a phone number that has called
and a phone number that writes on WhatsApp resolve to the same contact.

## 2. Flow

```
WhatsApp Cloud API ──(webhook POST, signed)──► lalum-whatsapp-webhook
                                                       │
                                     verify X-Hub-Signature-256
                                                       │
                              lalum_whatsapp_log_message (upsert contact,
                                idempotent message log by wa_message_id)
                                                       │
                              load last 12 messages for this contact
                                                       │
                              Claude (claude-haiku-4-5), with tools:
                                query_knowledge_base / crm_route_lead /
                                case_status_lookup / escalate_to_human
                                                       │
                              WhatsApp Cloud API ◄── reply text
                                                       │
                              lalum_whatsapp_log_message (log the reply)
```

`GET` on the same function is Meta's webhook verification handshake
(`hub.mode` / `hub.verify_token` / `hub.challenge`).

## 3. Data

New in `0007_whatsapp_intake.sql`:

- `lalum_whatsapp_messages`: the conversation log, unique on `wa_message_id`
  so a Meta webhook retry never double-processes or double-replies.
- `lalum_whatsapp_tasks`: one row per lead or escalation raised over
  WhatsApp. Kept separate from `lalum_crm_tasks` (the voice pipeline's table)
  because that table's `call_id` is a required unique reference to a
  completed call and does not fit a channel with no call record.
- Four `security definer` functions, revoked from `anon`/`authenticated` the
  same way `lalum_ingest_call` is in `0003`: `lalum_whatsapp_log_message`,
  `lalum_whatsapp_route_lead`, `lalum_whatsapp_case_status`,
  `lalum_whatsapp_escalate`.

Both new tables carry the same RLS posture as the voice tables: the
edge function's service-role key bypasses RLS, and an admin (via the existing
`lalum_is_admin()`) gets read-only access; no `anon`/`authenticated` policy
exists for either.

## 4. Persona and guardrails

The system prompt lives in `lalum-whatsapp-webhook/index.ts` rather than a
separate config file, mirroring `lalum-assistant`. It carries:

- The two focus areas only (real estate and urban renewal, and AI); mediation
  and arbitration are mentioned only as an existing service, never led with.
- No binding opinions, no numeric odds on a claim, no final contract text:
  every substantive answer is framed as a principled overview.
- No fabricated case law, statute, or date: a gap in the tool's knowledge
  produces "the matter needs a case-specific check", not a guess.
- A first message from a new lead always carries the informational-only
  disclaimer, enforced in code (appended when `created_lead` comes back true
  from `lalum_whatsapp_log_message`), not left to the model to remember.
- A short refusal for prompt-injection attempts ("this channel is for
  professional inquiries and coordination with the LALUM office only").
- Replies capped at a handful of short paragraphs (`max_tokens: 500`, and the
  prompt itself asks for at most three short paragraphs).

## 5. Deploy

```bash
supabase functions deploy lalum-whatsapp-webhook --no-verify-jwt
```

Secrets (`supabase secrets set NAME=value`), beyond `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, which are injected automatically:

| Secret | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude calls for the agent loop |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | already set for `test-whatsapp-connection.yml`; reused to send replies |
| `WHATSAPP_VERIFY_TOKEN` | must match the value entered in the Meta app's webhook configuration |
| `WHATSAPP_APP_SECRET` | Meta app secret; the function fails closed (`401`) on every POST until this is set |
| `RESEND_API_KEY`, `LALUM_FROM_EMAIL`, `LALUM_NOTIFY_TO` | escalation email, same convention as `lalum-notify` |

In the Meta app, point the WhatsApp product's webhook at the deployed
function URL, subscribe to the `messages` field, and set the verify token to
the same value as `WHATSAPP_VERIFY_TOKEN`.

## 6. Known gaps (next steps, not started here)

- Only `text` message types are handled; other types (image, audio, buttons)
  are acknowledged and dropped.
- `query_knowledge_base` returns firm methodology only (RECIR, SRME), never
  case law. Wiring it to the verified rulings corpus
  (`lalum-app/src/data/rulings.json`) is future work, not part of this change.
- No admin UI reads `lalum_whatsapp_messages` / `lalum_whatsapp_tasks` yet;
  today they are reachable only by an admin querying Supabase directly, the
  same starting point the voice tables had before `0004_calls_admin_read.sql`.
