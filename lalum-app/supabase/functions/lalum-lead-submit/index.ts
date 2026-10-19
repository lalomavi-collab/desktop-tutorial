// lalum-lead-submit: PUBLIC submission (no login) of contact details by a site visitor.
// Stores one row in lalum_site_leads (migration 0050) and sends a MINIMAL Telegram update to the firm.
//
// Privacy by design:
//   * explicit consent is required (consent === true) and recorded with the notice version shown;
//   * only name, phone or email, an area of interest and a short optional note are accepted;
//   * the visitor's IP is never stored (it is hashed only for the abuse limiter, like the other public functions);
//   * Telegram is a third party outside the firm's database, so the update carries the first name and the
//     area only. The phone, the email and the note stay in the table;
//   * rows are deleted by the daily job after delete_after (default one year, see 0050).
//
// verify_jwt is intentionally false so anonymous visitors can submit.
// Deploy: supabase functions deploy lalum-lead-submit --no-verify-jwt
// Uses: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto). Optional: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// (without them the row is still saved and notified_at stays empty).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// Bump when the privacy notice or the consent wording changes, so each row proves which text was accepted.
const CONSENT_VERSION = "2026-10-v1";
const INTERESTS = new Set(["real-estate", "ai-governance", "other"]);
const INTEREST_LABEL: Record<string, string> = { "real-estate": "נדל״ן והתחדשות עירונית", "ai-governance": "AI וממשל", other: "אחר" };
const LANGS = new Set(["he", "en", "ar", "es", "fr"]);
const SOURCES = new Set(["site", "chat", "signup"]);
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Same abuse guard as the other public functions: a hashed key per route, counted in Postgres. Fails open.
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

async function telegram(text: string): Promise<boolean> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) console.error(`lalum-lead-submit: telegram ${r.status}`);
    return r.ok;
  } catch (e) {
    console.error(`lalum-lead-submit: telegram_failed ${String(e).slice(0, 120)}`);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const str = (k: string, max: number) => String(body[k] ?? "").trim().slice(0, max);

  // Honeypot: a real visitor never fills this hidden field. Answer as if it worked so a bot learns nothing.
  if (str("website", 50)) return json(200, { ok: true });

  // Consent is the legal basis, so it is required and never defaulted.
  if (body.consent !== true) return json(400, { code: "consent_required" });

  const name = str("name", 120);
  const phone = str("phone", 30).replace(/[^\d+]/g, "");
  const email = str("email", 200).toLowerCase();
  const note = str("note", 500);
  const interest = INTERESTS.has(str("interest", 20)) ? str("interest", 20) : "other";
  const lang = LANGS.has(str("lang", 4)) ? str("lang", 4) : "he";
  const source = SOURCES.has(str("source", 10)) ? str("source", 10) : "site";

  if (!name) return json(400, { code: "missing_name" });
  if (!phone && !email) return json(400, { code: "missing_contact" });
  if (phone && (phone.length < 6 || phone.length > 20)) return json(400, { code: "bad_phone" });
  if (email && !emailOk(email)) return json(400, { code: "bad_email" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });
  const admin = createClient(url, serviceKey);

  // Five submissions an hour per client, two per hour per contact (a double click, not a flood).
  if (!(await allowed(admin, `lead:ip:${await sha(clientIp(req))}`, 5, 3600))) return json(429, { code: "rate_limited" });
  const contactKey = await sha(email || phone);
  if (!(await allowed(admin, `lead:contact:${contactKey}`, 2, 3600))) return json(200, { ok: true });

  const { data, error } = await admin.from("lalum_site_leads").insert({
    full_name: name, phone: phone || null, email: email || null, interest, note: note || null,
    lang, source, consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION,
  }).select("id").single();
  if (error || !data) { console.error(`lalum-lead-submit: insert_failed ${error?.code ?? ""}`); return json(500, { code: "insert_failed" }); }

  const firstName = name.split(/\s+/)[0];
  const sent = await telegram(
    `${source === "signup" ? "הרשמה חדשה לאתר" : "ליד חדש מהאתר"}\nתחום: ${INTEREST_LABEL[interest]}\n${source === "signup" ? "" : `שם פרטי: ${firstName}\n`}שפה: ${lang}\nהפרטים המלאים בטבלה (lalum_site_leads).`,
  );
  if (sent) await admin.from("lalum_site_leads").update({ notified_at: new Date().toISOString() }).eq("id", data.id);

  return json(200, { ok: true });
});
