// lalum-discussion-submit: PUBLIC submission (no login) for the Discussions
// panel. Records a pending row in lalum_discussions and notifies the firm.
// Nothing here is visible to the public: RLS on lalum_discussions only opens
// a row to anonymous readers once its status is 'answered', so the question
// stays private until Dr. Lalum reviews and replies from the portal.
//
// verify_jwt is intentionally false so anonymous visitors can ask from the
// Discussions panel on the real-estate and AI pillar pages.
//
// Deploy: supabase functions deploy lalum-discussion-submit --no-verify-jwt
// Uses: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), and for email:
//   RESEND_API_KEY, LALUM_FROM_EMAIL, LALUM_NOTIFY_TO.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const TOPICS = new Set(["real-estate", "ai-governance"]);
const TOPIC_LABEL: Record<string, string> = { "real-estate": "נדל\"ן והתחדשות עירונית", "ai-governance": "בינה מלאכותית וממשל סיכונים" };

async function send(apiKey: string, from: string, to: string, subject: string, html: string, replyTo?: string) {
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  let body: { topic?: string; question?: string; name?: string; email?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const topic = (body.topic ?? "").toString().trim();
  const question = (body.question ?? "").toString().trim().slice(0, 1500);
  const name = (body.name ?? "").toString().trim().slice(0, 120);
  const email = (body.email ?? "").toString().trim().slice(0, 200);
  if (!TOPICS.has(topic)) return json(400, { code: "bad_topic" });
  if (!question) return json(400, { code: "missing_question" });
  if (email && !emailOk(email)) return json(400, { code: "bad_email" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });
  const admin = createClient(url, serviceKey);
  const { error } = await admin.from("lalum_discussions").insert({
    topic, question, asker_name: name || null, asker_email: email || null,
  });
  if (error) return json(500, { code: "insert_failed" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>";
  const notifyTo = Deno.env.get("LALUM_NOTIFY_TO") ?? "avraham@lalum.co";
  if (apiKey) {
    const firmHtml =
      `<p style="font-family:Arial,sans-serif;">שאלה חדשה לדיונים, ${esc(TOPIC_LABEL[topic] ?? topic)}.</p>` +
      `<p style="font-family:Arial,sans-serif;">${esc(name || "(ללא שם)")}${email ? ` &middot; ${esc(email)}` : ""}</p>` +
      `<p style="font-family:Arial,sans-serif;white-space:pre-wrap;">${esc(question)}</p>` +
      `<p style="font-family:Arial,sans-serif;color:#86807a;font-size:12px;">מענה דרך לוח הבקרה, לא דרך תשובה למייל זה.</p>`;
    await send(apiKey, from, notifyTo, "שאלה חדשה בדיונים", firmHtml, email || undefined);
    if (email) {
      const askerHtml =
        `<p style="font-family:Arial,sans-serif;color:#55514a;">השאלה שלכם התקבלה ותיבחן בהקדם. ברגע שתיענה, תפורסם בפאנל הדיונים בתחום ${esc(TOPIC_LABEL[topic] ?? topic)}.</p>` +
        `<p style="font-family:Arial,sans-serif;color:#86807a;font-size:12px;">זהו אישור קבלה, לא ייעוץ משפטי.</p>`;
      await send(apiKey, from, email, "השאלה שלכם התקבלה", askerHtml, notifyTo);
    }
  }

  return json(200, { ok: true });
});
