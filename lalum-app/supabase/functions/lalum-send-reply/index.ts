// lalum-send-reply: admin-only. Sends the attorney-approved reply to the client
// by email and marks the message handled. The reply text is whatever the
// attorney approved (AI draft, edited, or written from scratch).
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

async function isAdmin(admin: ReturnType<typeof createClient>, userId: string, email: string | undefined) {
  if (email && email.toLowerCase() === "avraham@lalum.co") return true;
  const { data } = await admin.from("lalum_profiles").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
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
  const replyTo = Deno.env.get("LALUM_REPLY_TO") ?? "avraham@lalum.co";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !serviceKey) return json(500, { code: "not_configured" });
  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });
  const admin = createClient(url, serviceKey);
  if (!(await isAdmin(admin, user.id, user.email))) return json(403, { code: "forbidden" });
  let body: { message_id?: string; reply?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const id = (body.message_id ?? "").toString();
  const reply = (body.reply ?? "").toString().trim();
  if (!id || !reply) return json(400, { code: "missing_fields" });
  const { data: msg, error: msgErr } = await admin.from("lalum_messages").select("user_id, user_email, subject").eq("id", id).maybeSingle();
  if (msgErr || !msg) return json(404, { code: "not_found" });
  // Authoritative client email from auth, falling back to the stored one.
  let clientEmail = (msg.user_email as string | null) ?? "";
  const { data: authUser } = await admin.auth.admin.getUserById(msg.user_id as string);
  if (authUser?.user?.email) clientEmail = authUser.user.email;
  if (!clientEmail) return json(422, { code: "no_recipient" });
  const subject = msg.subject ? `Re: ${esc(String(msg.subject))}` : "A reply from LALUM";
  const replyHtml = esc(reply).replace(/\n/g, "<br />");
  const html =
    `<h2 style=\"font-family:Georgia,serif;color:#1a1815;\">A reply from LALUM</h2>` +
    `<div style=\"font-family:Arial,sans-serif;color:#1a1815;border-inline-start:3px solid #a8482a;padding:8px 14px;\">${replyHtml}</div>` +
    `<p style=\"font-family:Arial,sans-serif;color:#86807a;font-size:12px;margin-top:16px;\">You can reply to this email or continue the conversation in your LALUM client portal.</p>`;
  const ok = await sendEmail(apiKey, from, clientEmail, subject, html, replyTo);
  if (!ok) return json(502, { code: "send_failed" });
  await admin.from("lalum_messages").update({ reply, replied_at: new Date().toISOString(), handled: true }).eq("id", id);
  return json(200, { sent: true });
});
