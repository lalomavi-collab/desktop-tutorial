// lalum-notify: Supabase Edge Function (Deno) for the LALUM app.
// Sends transactional email through Resend (https://resend.com). Used to confirm
// a booking to the signed-in client and to notify the firm inbox. The Resend API
// key stays server-side; the caller only supplies booking details.
//
// Deploy: supabase functions deploy lalum-notify
// Secrets:
//   supabase secrets set RESEND_API_KEY=...
//   supabase secrets set LALUM_FROM_EMAIL="LALUM <no-reply@lalumapp.com>"
//   supabase secrets set LALUM_NOTIFY_TO="avraham@lalum.co"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string, replyTo?: string) {
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>";
  const notifyTo = Deno.env.get("LALUM_NOTIFY_TO") ?? "avraham@lalum.co";
  // Replies land in the firm's existing lalum.co inbox (lalumapp.com receives no mail).
  const replyTo = Deno.env.get("LALUM_REPLY_TO") ?? "avraham@lalum.co";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !serviceKey) return json(500, { code: "not_configured" });

  // Authenticate the caller; we only email their own verified address.
  const asUser = createClient(url, serviceKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user?.email) return json(401, { code: "unauthorized" });

  let body: { day?: string; slot?: string; topic?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const day = esc((body.day ?? "").toString());
  const slot = esc((body.slot ?? "").toString());
  const topic = esc((body.topic ?? "").toString());
  const clientEmail = user.email;

  const clientHtml =
    `<h2 style="font-family:Georgia,serif;color:#1a1815;">Your LALUM session is booked</h2>` +
    `<p style="font-family:Arial,sans-serif;color:#55514a;">Requested slot: <strong>${day} ${slot}</strong></p>` +
    (topic ? `<p style="font-family:Arial,sans-serif;color:#55514a;">Topic: ${topic}</p>` : "") +
    `<p style="font-family:Arial,sans-serif;color:#55514a;">We will confirm within one business hour.</p>` +
    `<p style="font-family:Arial,sans-serif;color:#86807a;font-size:12px;">This is a confirmation of a request, not legal advice.</p>`;

  const firmHtml =
    `<p style="font-family:Arial,sans-serif;">New diagnostics request from ${esc(clientEmail)}.</p>` +
    `<p style="font-family:Arial,sans-serif;">Slot: ${day} ${slot}${topic ? ` &middot; ${topic}` : ""}</p>`;

  // Client can reply to the firm; the firm can reply straight to the client.
  const okClient = await sendEmail(apiKey, from, clientEmail, "Your LALUM diagnostics session", clientHtml, replyTo);
  const okFirm = await sendEmail(apiKey, from, notifyTo, "New diagnostics request", firmHtml, clientEmail);

  if (!okClient && !okFirm) return json(502, { code: "send_failed" });
  return json(200, { sent: true, client: okClient, firm: okFirm });
});
