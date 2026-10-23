// lalum-draft-reply: admin-only. Drafts a suggested reply to a client message
// with Anthropic. Stores the draft on the message and returns it. Never sends
// anything to the client; approval + sending is a separate, human step.
// PII: the LLM call goes ONLY through the LALUM PII Gateway (pii-gateway).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5-20251001";
const SYSTEM =
  "You are the assistant to Dr. Avraham Lalum at LALUM, a Tech-Legal law firm in " +
  "Herzliya, Israel (IP protection, AI regulation and the EU AI Act, contract " +
  "governance, real estate, and Decision-Oriented Mediation). Draft a polite, " +
  "professional reply to a client's message, to be reviewed and edited by the " +
  "attorney before it is sent. Write in the same language as the client's " +
  "message. Be warm but concise. Do not give definitive legal advice or quote " +
  "fees; where a specific legal answer is needed, offer to schedule a " +
  "consultation. Meetings by Zoom, phone, or at the Herzliya office can be " +
  "arranged directly; meetings elsewhere are coordinated with the attorney in " +
  "advance. Sign as 'LALUM'. Output only the reply body, no subject line.";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

async function isAdmin(admin: ReturnType<typeof createClient>, userId: string, email: string | undefined) {
  if (email && email.toLowerCase() === "avraham@lalum.co") return true;
  const { data } = await admin.from("lalum_profiles").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = serviceKey; // PII gateway credential
  if (!apiKey || !url || !serviceKey) return json(500, { code: "not_configured" });
  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });
  const admin = createClient(url, serviceKey);
  if (!(await isAdmin(admin, user.id, user.email))) return json(403, { code: "forbidden" });
  let body: { message_id?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const id = (body.message_id ?? "").toString();
  if (!id) return json(400, { code: "missing_id" });
  const { data: msg, error: msgErr } = await admin.from("lalum_messages").select("category, subject, body").eq("id", id).maybeSingle();
  if (msgErr || !msg) return json(404, { code: "not_found" });
  const clientMsg = `Topic: ${msg.category}\n` + (msg.subject ? `Subject: ${msg.subject}\n` : "") + `Message:\n${msg.body}`;
  try {
    const res = await fetch(`${url}/functions/v1/pii-gateway/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "x-lalum-surface": "lalum-draft-reply", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages: [{ role: "user", content: clientMsg }] }),
    });
    if (!res.ok) { console.log("UPSTREAM " + res.status); return json(502, { code: "upstream_error", status: res.status }); }
    const data = await res.json();
    const draft = Array.isArray(data?.content) ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("").trim() : "";
    await admin.from("lalum_messages").update({ ai_draft: draft }).eq("id", id);
    return json(200, { draft });
  } catch (e) { console.log("FETCHERR " + String(e).slice(0, 200)); return json(502, { code: "fetch_failed" }); }
});
