// lalum-pay-create: generates an Invoice4U hosted clearing page for a billing
// milestone. A client may pay their own milestone (matched by uid or email);
// the firm may generate a link for any. On success Invoice4U charges via the
// configured terminal (Meshulam / UPay) and, with IsDocCreate, issues the tax
// document automatically.
//
// Env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected):
//   INVOICE4U_API_KEY        PRODUCTION organization API key (GUID). Read only when INVOICE4U_ENV is "prod"; never sent to the QA host.
//   FIN_INVOICE4U_QA_KEY     key of the Invoice4U QA account, the same secret lalum-fin-issue reads. Required in qa mode.
//   INVOICE4U_CLEARING_COMPANY  6 UPay | 7 Meshulam | 12 YaadSarig | 15 Cardcom (default 7)
//   INVOICE4U_ENV            "qa" (default) or "prod". Any other value is refused, so a stray paste cannot pick a host.
//   INVOICE4U_ALLOW_SANDBOX  "true" to permit a sandbox checkout URL (testing); otherwise sandbox links are blocked so real clients never reach a test page
//   LALUM_APP_URL            e.g. https://lalumapp.com
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// Never let the Invoice4U API key survive into logs or the database. Invoice4U
// echoes the whole request (key included) in its response, so redact it.
const redact = (s: string, key?: string) => {
  let out = s.replace(/"Invoice4UUserApiKey":"[^"]*"/g, '"Invoice4UUserApiKey":"[REDACTED]"');
  if (key) out = out.split(key).join("[REDACTED]");
  return out;
};

async function isAdmin(admin: ReturnType<typeof createClient>, userId: string, email: string | undefined) {
  if (email && email.toLowerCase() === "avraham@lalum.co") return true;
  const { data } = await admin.from("lalum_profiles").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const env = (Deno.env.get("INVOICE4U_ENV") ?? "qa").trim().toLowerCase();
  if (env !== "qa" && env !== "prod") return json(500, { code: "invoice4u_env_invalid", detail: "INVOICE4U_ENV must be qa or prod." });
  const prod = env === "prod";
  // The production key must never travel to the QA host, so each mode reads its own secret.
  // Trim: a trailing space or newline pasted into the secret would corrupt auth.
  const apiKey = (prod ? Deno.env.get("INVOICE4U_API_KEY") : Deno.env.get("FIN_INVOICE4U_QA_KEY"))?.trim();
  const clearingCompany = Number(Deno.env.get("INVOICE4U_CLEARING_COMPANY") ?? "7");
  const allowSandbox = Deno.env.get("INVOICE4U_ALLOW_SANDBOX") === "true";
  const appUrl = Deno.env.get("LALUM_APP_URL") ?? "https://lalumapp.com";
  // Shared secret that authenticates the Invoice4U callback to lalum-pay-webhook.
  const payWebhookSecret = Deno.env.get("PAY_WEBHOOK_SECRET")?.trim();
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });
  if (!apiKey) return json(500, prod
    ? { code: "invoice4u_not_configured", detail: "Set INVOICE4U_API_KEY." }
    : { code: "qa_key_missing", detail: "Set FIN_INVOICE4U_QA_KEY, the key of the Invoice4U QA account." });

  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  let body: { milestone_id?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const id = (body.milestone_id ?? "").toString();
  if (!id) return json(400, { code: "missing_milestone" });

  const admin = createClient(url, serviceKey);
  const { data: m, error: mErr } = await admin.from("billing_milestones").select("*").eq("id", id).maybeSingle();
  if (mErr || !m) return json(404, { code: "not_found" });

  const email = (user.email ?? "").toLowerCase();
  const ownByEmail = m.client_email && String(m.client_email).toLowerCase() === email;
  const allowed = m.client_id === user.id || ownByEmail || (await isAdmin(admin, user.id, user.email));
  if (!allowed) return json(403, { code: "forbidden" });
  if (m.status === "paid") return json(409, { code: "already_paid" });

  const base = prod
    ? "https://api.invoice4u.co.il/Services/ApiService.svc"
    : "https://apiqa.invoice4u.co.il/Services/ApiService.svc";
  const currency = String(m.currency ?? "ILS").toUpperCase() === "ILS" ? "NIS" : String(m.currency);

  const request = {
    Invoice4UUserApiKey: apiKey,
    Sum: Number(m.amount),
    CreditCardCompanyType: clearingCompany,
    Currency: currency,
    Type: 1,
    Description: m.title,
    IsQaMode: !prod,
    OrderIdClientUsage: id,
    Platform: "lalumapp",
    FullName: m.client_name || m.client_email || "לקוח ללום",
    Phone: m.client_phone || "",
    Email: m.client_email || "",
    IsAutoCreateCustomer: true,
    ReturnUrl: `${appUrl}/portal?pay=return`,
    // The callback is authenticated with a shared secret token: lalum-pay-webhook
    // rejects any call whose ?t= does not match PAY_WEBHOOK_SECRET, so a milestone
    // cannot be marked paid by anyone who merely knows its id.
    CallBackUrl: `${url}/functions/v1/lalum-pay-webhook${payWebhookSecret ? `?t=${encodeURIComponent(payWebhookSecret)}` : ""}`,
    IsDocCreate: true,
    DocHeadline: m.title,
    Language: "he",
    DocLanguage: "he",
  };

  // Diagnostic snapshot of the request config (never includes the API key).
  const cfg = `env=${env} company=${clearingCompany} sum=${Number(m.amount)} cur=${currency}`;

  try {
    const res = await fetch(`${base}/ProcessApiRequestV2`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request }),
    });
    const rawText = await res.text();
    let raw: unknown = {};
    try { raw = JSON.parse(rawText); } catch { raw = {}; }
    const data = (raw && typeof raw === "object" && "d" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).d : raw) as Record<string, unknown>;
    const errors = (data?.Errors as unknown[]) ?? [];
    const link = (data?.ClearingRedirectUrl as string) ?? "";
    const paymentId = (data?.PaymentId as string) ?? null;
    if (!res.ok || (Array.isArray(errors) && errors.length > 0) || !link) {
      const detailText = redact(`HTTP ${res.status} | ${cfg} | ${rawText}`, apiKey).slice(0, 2000);
      console.log("INVOICE4U_ERR " + detailText);
      await admin.from("billing_milestones").update({
        status: "failed",
        last_error: detailText,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      const first = Array.isArray(errors) && errors.length ? errors[0] : null;
      return json(502, { code: "invoice4u_error", status: res.status, detail: first });
    }
    // SAFETY GATE: never hand a real payer a sandbox checkout. If the returned
    // clearing URL is a sandbox terminal and sandbox is not explicitly allowed,
    // refuse. This protects clients if the production secrets are misconfigured.
    if (!allowSandbox && /sandbox/i.test(link)) {
      const detailText = `SANDBOX_BLOCKED | ${cfg} | ${link.slice(0, 120)}`;
      console.log(detailText);
      await admin.from("billing_milestones").update({
        status: "failed",
        last_error: detailText,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      return json(502, { code: "sandbox_blocked", detail: "A sandbox checkout was blocked in live mode. Set INVOICE4U_ENV=prod with the production API key and a production terminal, or set INVOICE4U_ALLOW_SANDBOX=true to test." });
    }
    await admin.from("billing_milestones").update({
      status: "sent",
      payment_intent_id: paymentId,
      hosted_url: link,
      provider: "invoice4u",
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return json(200, { url: link, payment_id: paymentId });
  } catch (e) {
    const detailText = redact(`FETCHERR | ${cfg} | ${String(e)}`, apiKey).slice(0, 2000);
    console.log(detailText);
    await admin.from("billing_milestones").update({
      status: "failed",
      last_error: detailText,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return json(502, { code: "fetch_failed" });
  }
});
