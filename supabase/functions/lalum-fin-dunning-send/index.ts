// lalum-fin-dunning-send: sends one collections reminder to a customer, by e-mail or WhatsApp, on a partner's explicit action.
//
// POST { customer_id, tier: 1|2|3, channel: "EMAIL"|"WHATSAPP", body?, test?, name?, amount?, days? }
//  * The recipient is read from the customer record, never from the request.
//  * EMAIL: body is the partner's text (up to 2000 characters). With test:true it goes to the signed in partner's own address, is marked
//    [בדיקה], and is neither logged nor counted toward the cooldown.
//  * WHATSAPP: sent only as an approved template (WHATSAPP_DUNNING_TEMPLATE_1/2/3), because Meta rejects business-initiated free text outside
//    the 24 hour window. name, amount and days fill the template. Without a configured template the call fails with template_not_configured.
//  * The 7 day cooldown and the send record are kept by the database (lalum_fin_dunning_reserve / lalum_fin_dunning_finish): a row is
//    reserved BEFORE sending, so a double click cannot send twice, and marked SENT or FAILED after. A FAILED send does not use the cooldown.
//
// Env: RESEND_API_KEY, LALUM_FROM_EMAIL, LALUM_REPLY_TO, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_DUNNING_TEMPLATE_1..3,
//      WHATSAPP_DUNNING_LANG (default "he"). SUPABASE_URL and SUPABASE_ANON_KEY are injected.
// Access: finance level 3 with MFA, decided by the database with the caller's own JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUBJECT, emailHtml, isEmail, isTier, normalizeIsraeliPhone, templateName, templateParams } from "../_shared/dunning.ts";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const url = env("SUPABASE_URL"), anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) return json(500, { code: "not_configured" });

  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });
  const { data: firmId } = await asUser.rpc("lalum_my_firm_id");
  const { data: allowed } = firmId ? await asUser.rpc("lalum_fin_can", { p_firm: firmId, p_min: 3 }) : { data: false };
  if (!firmId || allowed !== true) return json(403, { code: "forbidden" });

  let b: { customer_id?: string; tier?: number; channel?: string; body?: string; test?: boolean; name?: string; amount?: number; days?: number };
  try { b = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const tier = b.tier;
  if (!b.customer_id || !isTier(tier) || (b.channel !== "EMAIL" && b.channel !== "WHATSAPP")) return json(400, { code: "bad_request" });
  const test = b.test === true;
  if (test && b.channel !== "EMAIL") return json(400, { code: "test_email_only" });

  const { data: c } = await asUser.from("lalum_fin_customers").select("id, firm_id, name, email, phone, archived").eq("id", b.customer_id).maybeSingle();
  if (!c || c.firm_id !== firmId) return json(404, { code: "customer_not_found" });
  if (c.archived) return json(409, { code: "customer_archived" });

  // ---- build the message and resolve the recipient before reserving anything ----
  let to = "", bodyText = "", waTemplate = "", waParams: string[] = [];
  if (b.channel === "EMAIL") {
    bodyText = String(b.body ?? "").trim();
    if (bodyText.length < 20 || bodyText.length > 2000) return json(400, { code: "bad_content" });
    to = test ? (user.email ?? "") : (c.email ?? "");
    if (!isEmail(to)) return json(422, { code: test ? "no_own_email" : "no_email" });
    if (!env("RESEND_API_KEY")) return json(500, { code: "mail_not_configured" });
  } else {
    const phone = normalizeIsraeliPhone(c.phone);
    if (!phone) return json(422, { code: "no_mobile" });
    const tpl = templateName(tier, env);
    if (!tpl) return json(422, { code: "template_not_configured" });
    const params = templateParams({ name: String(b.name ?? c.name), amount: Number(b.amount), days: Number(b.days) });
    if (!params) return json(400, { code: "bad_content" });
    if (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_PHONE_NUMBER_ID")) return json(500, { code: "whatsapp_not_configured" });
    to = phone; waTemplate = tpl; waParams = params;
    bodyText = `template ${tpl}: ${params.join(" | ")}`;
  }

  // ---- reserve (cooldown + record) ----
  let rowId: string | null = null;
  if (!test) {
    const { data: id, error } = await asUser.rpc("lalum_fin_dunning_reserve", { p_customer: c.id, p_tier: tier, p_channel: b.channel, p_recipient: to, p_body: bodyText });
    if (error) {
      const m = error.message ?? "";
      const code = ["COOLDOWN_ACTIVE", "FORBIDDEN", "BAD_TIER", "BAD_CHANNEL", "NO_RECIPIENT"].find((k) => m.includes(k)) ?? "reserve_failed";
      return json(code === "COOLDOWN_ACTIVE" ? 409 : code === "FORBIDDEN" ? 403 : 400, { code: code.toLowerCase() });
    }
    rowId = id as string;
  }

  // ---- send ----
  let ok = false, ref: string | null = null, err: string | null = null;
  try {
    if (b.channel === "EMAIL") {
      const from = env("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>", replyTo = env("LALUM_REPLY_TO") ?? "avraham@lalum.co";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
        body: JSON.stringify({ from, reply_to: replyTo, to: [to], subject: `${test ? "[בדיקה] " : ""}${SUBJECT[tier]}`, html: emailHtml(bodyText) }),
      });
      const j = await res.json().catch(() => ({}));
      ok = res.ok; ref = (j as { id?: string }).id ?? null; if (!ok) err = `resend ${res.status}`;
    } else {
      const res = await fetch(`https://graph.facebook.com/v21.0/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to, type: "template",
          template: { name: waTemplate, language: { code: env("WHATSAPP_DUNNING_LANG") ?? "he" }, components: [{ type: "body", parameters: waParams.map((text) => ({ type: "text", text })) }] },
        }),
      });
      const j = await res.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } };
      ok = res.ok; ref = j.messages?.[0]?.id ?? null; if (!ok) err = `whatsapp ${res.status} ${j.error?.code ?? ""}`.trim();
    }
  } catch (e) { err = `network ${(e as Error).name}`; }

  // ---- record the outcome. If this fails after a send, say so: the message did go out. ----
  if (rowId) {
    const { error: fe } = await asUser.rpc("lalum_fin_dunning_finish", { p_id: rowId, p_ok: ok, p_ref: ref, p_error: err });
    if (fe) { console.log("FIN_DUNNING_FINISH_ERR " + (fe.message ?? "").slice(0, 120)); if (ok) return json(200, { ok: true, to, warning: "log_incomplete" }); }
  }
  if (!ok) { console.log("FIN_DUNNING_SEND_ERR " + err); return json(502, { code: "send_failed", detail: err }); }
  return json(200, { ok: true, to, test });
});
