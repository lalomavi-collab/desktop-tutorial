# lalum-esign — external e-signature bridge (DocuSeal)

Hands a signing request prepared in the cockpit to [DocuSeal](https://www.docuseal.com)
(open source, free, self-hostable). DocuSeal emails the signer a link, the signer
signs on DocuSeal's hosted page, and a webhook reports the outcome and the signed
PDF back into `lalum_signature_requests`.

The function is deployed and inert until the secrets below are set. Portal signing
(the built-in flow) keeps working regardless.

## Activation

1. **Create a DocuSeal account** at docuseal.com (cloud) or self-host it
   (`docker run docuseal/docuseal`). Self-hosting keeps the signed documents on
   infrastructure the firm controls.
2. **Get the API key** in DocuSeal → Settings → API.
3. **Set the Edge Function secrets** (Supabase dashboard → Project Settings →
   Edge Functions → Secrets). Values never pass through the app or the assistant:
   - `DOCUSEAL_API_KEY` — the DocuSeal API key.
   - `DOCUSEAL_WEBHOOK_SECRET` — any long random string you choose.
   - `DOCUSEAL_BASE_URL` — only for self-hosting, e.g. `https://sign.yourfirm.co.il/api`.
     Omit to use the DocuSeal cloud (`https://api.docuseal.com`).
4. **Configure the DocuSeal webhook** (DocuSeal → Settings → Webhooks) to:
   `https://<project-ref>.functions.supabase.co/lalum-esign?action=webhook&secret=<DOCUSEAL_WEBHOOK_SECRET>`
   Subscribe to `form.viewed`, `form.completed`, `form.declined`.
5. **Verify** from the cockpit: open a matter, "החתמת לקוח" → "בדיקת חיבור DocuSeal".

## Routes

All POST, action chosen by `?action=` or an `action` field in the JSON body.

- `status` — firm member. Reports whether the provider is configured and reachable.
- `send` — firm member. Body `{ request_id }`. Creates a DocuSeal template from the
  request's content and a submission for the signer, then marks the request SENT.
- `webhook` — DocuSeal → us, authenticated by `?secret=`. Updates the request to
  VIEWED / SIGNED / DECLINED and stores the signed document URL.

The DocuSeal REST calls (`POST /templates/html`, `POST /submissions`, the webhook
payload fields) target DocuSeal's current HTML + Submissions API and are isolated
in the `ds()` helper and the webhook handler, so they are easy to adjust if the
provider's API changes.
