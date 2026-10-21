// lalum-fin-doc-send-webhook: receives the mail provider's events (delivered, opened, bounced, complained) and records them on the send log
// row that carries the same message id (lalum_fin_doc_sends.provider_ref), through lalum_fin_doc_send_event.
//
//  * No user logs in here, so the gateway JWT check is off (verify_jwt false). The request is trusted only when its Svix signature verifies
//    against RESEND_DOCSEND_WEBHOOK_SECRET and its timestamp is within 5 minutes. Anything else is refused before the body is read as JSON.
//  * The same provider account also sends other mail (reminders, reports). Events for a message id that is not in the send log match no row
//    and are acknowledged without effect.
//  * A database failure answers 500 so the provider retries; a bad signature answers 401 and is never retried into success.
//  * Writes with the service role, which is the only role allowed to call lalum_fin_doc_send_event.
//
// Env: RESEND_DOCSEND_WEBHOOK_SECRET (the webhook's signing secret, "whsec_..."). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapEvent, verifySvix } from "../_shared/resendEvents.ts";

const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? undefined;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const secret = env("RESEND_DOCSEND_WEBHOOK_SECRET"), url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !key) return json(500, { code: "not_configured" });

  const raw = await req.text();
  const ok = await verifySvix(secret, {
    id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature"),
  }, raw, Math.floor(Date.now() / 1000));
  if (!ok) return json(401, { code: "bad_signature" });

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json(400, { code: "bad_json" }); }
  const ev = mapEvent(payload);
  if (!ev) return json(200, { ok: true, ignored: true });

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("lalum_fin_doc_send_event", { p_ref: ev.ref, p_event: ev.event, p_at: ev.at });
  if (error) { console.log("FIN_DOC_EVENT_ERR " + (error.message ?? "").slice(0, 120)); return json(500, { code: "db_error" }); }
  return json(200, { ok: true, matched: Number(data ?? 0) });
});
