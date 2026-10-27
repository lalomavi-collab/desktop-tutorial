// lalum-message: client customer-service message. Stores nothing itself (client
// inserts via RLS) and forwards the message to the firm inbox + confirms to the
// client, all through Resend. Mirrors lalum-notify's auth + email pattern.
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

const CATEGORIES: Record<string, string> = {
  general: "General inquiry",
  booking: "Meeting / scheduling",
  documents: "Documents",
  billing: "Billing",
};

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
  const replyTo = Deno.env.get("LALUM_REPLY_TO") ?? "avraham@lalum.co";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !serviceKey) return json(500, { code: "not_configured" });
  const asUser = createClient(url, serviceKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user?.email) return json(401, { code: "unauthorized" });
  let body: { category?: string; subject?: string; body?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const catKey = (body.category ?? "general").toString();
  const catLabel = CATEGORIES[catKey] ?? CATEGORIES.general;
  const subject = esc((body.subject ?? "").toString()).slice(0, 200);
  const message = esc((body.body ?? "").toString()).slice(0, 8000);
  if (!message.trim()) return json(400, { code: "empty_message" });
  const clientEmail = user.email;
  const messageHtml = message.replace(/\n/g, "<br />");
  const firmHtml =
    `<h2 style=\"font-family:Georgia,serif;color:#1a1815;\">New client message</h2>` +
    `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">From: <strong>${esc(clientEmail)}</strong></p>` +
    `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">Category: ${esc(catLabel)}</p>` +
    (subject ? `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">Subject: <strong>${subject}</strong></p>` : "") +
    `<div style=\"font-family:Arial,sans-serif;color:#1a1815;border-inline-start:3px solid #a8482a;padding:8px 14px;margin-top:10px;\">${messageHtml}</div>` +
    `<p style=\"font-family:Arial,sans-serif;color:#86807a;font-size:12px;margin-top:16px;\">Reply to this email to respond to the client directly.</p>`;
  const clientHtml =
    `<h2 style=\"font-family:Georgia,serif;color:#1a1815;\">We received your message</h2>` +
    `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">Thank you for contacting LALUM. Our team will get back to you shortly.</p>` +
    (subject ? `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">Subject: <strong>${subject}</strong></p>` : "") +
    `<div style=\"font-family:Arial,sans-serif;color:#1a1815;border-inline-start:3px solid #a8482a;padding:8px 14px;margin-top:10px;\">${messageHtml}</div>` +
    `<p style=\"font-family:Arial,sans-serif;color:#86807a;font-size:12px;margin-top:16px;\">This confirms receipt of a message, not legal advice.</p>`;
  const okFirm = await sendEmail(apiKey, from, notifyTo, `New client message: ${catLabel}`, firmHtml, clientEmail);
  const okClient = await sendEmail(apiKey, from, clientEmail, "We received your message", clientHtml, replyTo);
  if (!okFirm && !okClient) return json(502, { code: "send_failed" });
  return json(200, { sent: true, firm: okFirm, client: okClient });
});
