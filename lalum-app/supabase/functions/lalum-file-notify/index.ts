// lalum-file-notify: when a logged-in client uploads a document to the private
// client-files bucket, email the firm a time-limited signed download link.
// The client uploads directly via RLS; this only handles the notification.
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
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !serviceKey) return json(500, { code: "not_configured" });
  const asUser = createClient(url, serviceKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user?.email) return json(401, { code: "unauthorized" });
  let body: { path?: string; name?: string; size?: number };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const path = (body.path ?? "").toString();
  const name = esc((body.name ?? "file").toString()).slice(0, 300);
  const size = Number(body.size ?? 0);
  // The path must live inside the caller's own folder.
  if (!path || path.split("/")[0] !== user.id) return json(403, { code: "forbidden_path" });
  const admin = createClient(url, serviceKey);
  const { data: signed, error: signErr } = await admin.storage
    .from("client-files")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr) return json(502, { code: "sign_failed", detail: signErr.message });
  const link = signed?.signedUrl ?? "";
  const kb = size > 0 ? ` (${Math.max(1, Math.round(size / 1024))} KB)` : "";
  const firmHtml =
    `<h2 style=\"font-family:Georgia,serif;color:#1a1815;\">New client file</h2>` +
    `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">From: <strong>${esc(user.email)}</strong></p>` +
    `<p style=\"font-family:Arial,sans-serif;color:#55514a;\">File: <strong>${name}</strong>${kb}</p>` +
    `<p style=\"font-family:Arial,sans-serif;\"><a href=\"${link}\" style=\"color:#a8482a;\">Download the file</a> (link valid for 7 days)</p>` +
    `<p style=\"font-family:Arial,sans-serif;color:#86807a;font-size:12px;margin-top:16px;\">Reply to this email to respond to the client.</p>`;
  const okFirm = await sendEmail(apiKey, from, notifyTo, "New client file shared", firmHtml, user.email);
  if (!okFirm) return json(502, { code: "send_failed" });
  return json(200, { sent: true });
});
