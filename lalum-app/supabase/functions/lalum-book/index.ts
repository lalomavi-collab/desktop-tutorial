// lalum-book: PUBLIC booking (no login) for the LALUM app. Records a request in
// lalum_booking_requests and emails the firm plus a confirmation to the visitor.
// verify_jwt is intentionally false so anonymous visitors can book from /book.
//
// Deploy: supabase functions deploy lalum-book --no-verify-jwt
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

  let body: { full_name?: string; email?: string; day?: string; slot?: string; topic?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const fullName = (body.full_name ?? "").toString().trim().slice(0, 120);
  const email = (body.email ?? "").toString().trim().slice(0, 200);
  const day = (body.day ?? "").toString().trim().slice(0, 20);
  const slot = (body.slot ?? "").toString().trim().slice(0, 20);
  const topic = (body.topic ?? "").toString().trim().slice(0, 1000);
  if (!emailOk(email) || !day || !slot) return json(400, { code: "missing_fields" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });
  const admin = createClient(url, serviceKey);
  const { error } = await admin.from("lalum_booking_requests").insert({
    full_name: fullName || null, email, requested_day: day, requested_slot: slot, topic: topic || null,
  });
  if (error) return json(500, { code: "insert_failed" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>";
  const notifyTo = Deno.env.get("LALUM_NOTIFY_TO") ?? "avraham@lalum.co";
  if (apiKey) {
    const firmHtml =
      `<p style="font-family:Arial,sans-serif;">New consultation request.</p>` +
      `<p style="font-family:Arial,sans-serif;">Name: ${esc(fullName || "(not given)")}<br>Email: ${esc(email)}<br>Slot: ${esc(day)} ${esc(slot)}${topic ? `<br>Topic: ${esc(topic)}` : ""}</p>`;
    const clientHtml =
      `<h2 style="font-family:Georgia,serif;color:#1a1815;">Your LALUM session request is in</h2>` +
      `<p style="font-family:Arial,sans-serif;color:#55514a;">Requested slot: <strong>${esc(day)} ${esc(slot)}</strong></p>` +
      `<p style="font-family:Arial,sans-serif;color:#55514a;">We will confirm within one business hour.</p>` +
      `<p style="font-family:Arial,sans-serif;color:#86807a;font-size:12px;">This is a confirmation of a request, not legal advice.</p>`;
    await send(apiKey, from, notifyTo, "New consultation request", firmHtml, email);
    await send(apiKey, from, email, "Your LALUM session request", clientHtml, notifyTo);
  }

  return json(200, { ok: true });
});
