// lalum-fin-report-mail: sends the income report to the SIGNED IN user's own e-mail address, as a test. It never sends to anyone
// else: the recipient is read from the caller's session, not from the request. Sending to the accountant is a separate step that
// needs the owner's approval of a test message first.
//
// POST { subject, html, csv_name?, csv_text? }
// Env: RESEND_API_KEY, LALUM_FROM_EMAIL (injected secrets shared with the other functions).
// Access: finance level 1 or higher with MFA (lalum_fin_can(firm, 1)), decided by the database with the caller's own JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const b64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  const resend = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("LALUM_FROM_EMAIL") ?? "avraham@lalum.co";
  if (!url || !anon) return json(500, { code: "not_configured" });
  if (!resend) return json(500, { code: "mail_not_configured" });

  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user?.email) return json(401, { code: "unauthorized" });
  const { data: firmId } = await asUser.rpc("lalum_my_firm_id");
  const { data: allowed } = firmId ? await asUser.rpc("lalum_fin_can", { p_firm: firmId, p_min: 1 }) : { data: false };
  if (!firmId || allowed !== true) return json(403, { code: "forbidden" });

  let body: { subject?: string; html?: string; csv_name?: string; csv_text?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const subject = String(body.subject ?? "").slice(0, 200), html = String(body.html ?? "");
  if (!subject || !html || html.length > 400_000) return json(400, { code: "bad_content" });
  const csv = body.csv_text ? String(body.csv_text) : "";
  if (csv.length > 1_500_000) return json(400, { code: "bad_content" });
  const name = String(body.csv_name ?? "report.csv").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${resend}`, "content-type": "application/json" },
    body: JSON.stringify({
      from, to: [user.email], subject: `[בדיקה] ${subject}`,
      html: `<div dir="rtl" lang="he" style="font-family:Arial,sans-serif">${html}</div>`,
      attachments: csv ? [{ filename: name, content: b64(csv) }] : undefined,
    }),
  });
  if (!res.ok) { console.log("FIN_REPORT_MAIL_ERR " + res.status); return json(502, { code: "mail_failed" }); }
  return json(200, { ok: true, to: user.email });
});
