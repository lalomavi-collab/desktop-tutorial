// lalum-lead: PUBLIC lead capture for the website (academy, services, diagnostics).
// verify_jwt is intentionally false so anonymous visitors can submit.
// Writes to public.lalum_leads with the service role, then notifies:
//   1. Telegram, immediate, MINIMAL payload (no phone, no email, no free text).
//   2. Email via Resend, full payload, durable record.
// A failure in one channel never blocks the other, and never fails the insert.
// Marketing consent is stored together with the exact wording shown at the time,
// so consent can be proven later.
//
// Abuse bounds (added 2026-10-19): every accepted lead sends a Telegram message and an email to the firm, so
// a loop that varies the contact details would flood both. Per client address 5 an hour and, across everyone,
// 100 a day, counted in Postgres (lalum_rate_limit). The limiter fails open.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://lalumapp.com",
  "https://www.lalumapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (v: unknown, max: number) => (v ?? "").toString().trim().slice(0, max);
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
// deno-lint-ignore no-explicit-any
async function allowed(admin: any, key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("lalum_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    return error ? true : data !== false;
  } catch { return true; }
}
const clientIp = (req: Request): string => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  // Honeypot: real users never fill this. Answer 200 so bots learn nothing.
  if (clean(body.company_website, 200)) return json(200, { ok: true });

  const fullName = clean(body.full_name, 120);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 200);
  const message = clean(body.message, 2000);
  const source = clean(body.source, 60) || "website";
  const programCode = clean(body.program_code, 40) || null;
  const profession = clean(body.profession, 80) || null;
  const challenge = clean(body.challenge, 120) || null;
  const pagePath = clean(body.page_path, 200) || null;
  const audienceRaw = clean(body.audience_type, 20);
  const audience = audienceRaw === "organization" || audienceRaw === "individual" ? audienceRaw : null;
  const consent = body.consent_marketing === true;
  const consentVersion = clean(body.consent_text_version, 40) || null;
  const consentText = clean(body.consent_text, 1000) || null;

  if (!fullName) return json(400, { code: "missing_name" });
  if (!phone && !email) return json(400, { code: "missing_contact" });
  if (email && !emailOk(email)) return json(400, { code: "bad_email" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });
  const admin = createClient(url, serviceKey);

  // Per client address and across everyone: see the note at the top.
  if (!(await allowed(admin, `lead:ip:${await sha(clientIp(req))}`, 5, 3600))) return json(429, { code: "too_many_requests" });
  if (!(await allowed(admin, "lead:all", 100, 86400))) return json(429, { code: "daily_cap" });

  // Light rate limit: three submissions from the same contact in five minutes is abuse.
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const dedupe = phone ? `phone.eq.${phone}` : `email.eq.${email}`;
  const { count: recent } = await admin
    .from("lalum_leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .or(dedupe);
  if ((recent ?? 0) >= 3) return json(429, { code: "too_many_requests" });

  const { data: inserted, error } = await admin
    .from("lalum_leads")
    .insert({
      source, program_code: programCode, audience_type: audience, profession, challenge,
      full_name: fullName, phone: phone || null, email: email || null,
      message: message || null, page_path: pagePath,
      consent_marketing: consent,
      consent_at: consent ? new Date().toISOString() : null,
      consent_text_version: consent ? consentVersion : null,
      consent_text: consent ? consentText : null,
    })
    .select("id, created_at")
    .single();
  if (error || !inserted) return json(500, { code: "insert_failed" });

  const errors: string[] = [];

  // Channel 1: Telegram. MINIMAL by design. Telegram is a third party processor,
  // so contact details stay in the database and in the email, never in the chat.
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (botToken && chatId) {
    const at = new Date(inserted.created_at as string).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    const firstName = fullName.split(/\s+/)[0];
    const lines = [
      "\u{1F514} ליד חדש באתר",
      `שם: ${firstName}`,
      `מקור: ${source}${programCode ? ` · ${programCode}` : ""}`,
      profession ? `תחום: ${profession}` : "",
      challenge ? `צורך: ${challenge}` : "",
      `התקבל: ${at}`,
      "",
      "פרטים מלאים במייל ובמסד הנתונים",
    ].filter(Boolean);
    try {
      const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), disable_web_page_preview: true }),
      });
      if (!tg.ok) errors.push(`telegram_${tg.status}`);
    } catch { errors.push("telegram_exception"); }
  } else {
    errors.push("telegram_not_configured");
  }

  // Channel 2: email, full record.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>";
  const notifyTo = Deno.env.get("LALUM_NOTIFY_TO") ?? "avraham@lalum.co";
  if (apiKey) {
    const rows: string[] = [
      `שם: ${esc(fullName)}`,
      phone ? `טלפון: ${esc(phone)}` : "",
      email ? `אימייל: ${esc(email)}` : "",
      `מקור: ${esc(source)}`,
      programCode ? `תוכנית: ${esc(programCode)}` : "",
      audience ? `סוג פונה: ${audience === "organization" ? "ארגון" : "יחיד"}` : "",
      profession ? `תחום: ${esc(profession)}` : "",
      challenge ? `צורך: ${esc(challenge)}` : "",
      pagePath ? `עמוד: ${esc(pagePath)}` : "",
      `דיוור: ${consent ? `אושר${consentVersion ? ` (נוסח ${esc(consentVersion)})` : ""}` : "לא אושר"}`,
      message ? `<br>הודעה:<br>${esc(message).replace(/\n/g, "<br>")}` : "",
    ].filter(Boolean);
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;color:#1a1815;">` +
      `<h2 style="font-family:Georgia,serif;">ליד חדש</h2>` +
      `<p>${rows.join("<br>")}</p>` +
      `<p style="color:#86807a;font-size:12px;">מזהה רשומה: ${inserted.id}</p></div>`;
    try {
      const payload: Record<string, unknown> = {
        from, to: notifyTo,
        subject: `ליד חדש: ${source}${programCode ? ` · ${programCode}` : ""}`,
        html,
      };
      if (email) payload.reply_to = email;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) errors.push(`resend_${r.status}`);
    } catch { errors.push("resend_exception"); }
  } else {
    errors.push("resend_not_configured");
  }

  await admin.from("lalum_leads").update({
    notified_at: new Date().toISOString(),
    notify_error: errors.length ? errors.join(",") : null,
  }).eq("id", inserted.id);

  // The visitor always sees success once the lead is stored.
  return json(200, { ok: true });
});
