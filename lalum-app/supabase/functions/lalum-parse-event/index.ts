// lalum-parse-event: admin-only. Turns a natural-language Hebrew/English line
// ("Lecture on Aug 20 at 18:00 on algorithm risks") into a structured event.
// Returns JSON only; the client performs the conflict-checked calendar insert.
// PII: the LLM call goes ONLY through the LALUM PII Gateway (pii-gateway).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5-20251001";
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
  let body: { text?: string; now?: string; offset?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const text = (body.text ?? "").toString().trim();
  if (!text) return json(400, { code: "empty" });
  const now = (body.now ?? "").toString();
  const offset = (body.offset ?? "+03:00").toString();
  const system =
    "You convert a single natural-language scheduling line (Hebrew or English) into a JSON event. " +
    `The current local date-time is ${now} and the local UTC offset is ${offset}. ` +
    "Resolve relative and absolute dates against that. Output ONLY a JSON object, no prose, with keys: " +
    "title (string, concise, in the input language), kind (one of lecture, meeting, zoom, phone, block), " +
    "location (string or null; a physical place like 'Herzliya' or an address, null for zoom/phone/online), " +
    `starts_at (ISO 8601 with the ${offset} offset), ends_at (ISO 8601), reminders (array of integers = minutes before). ` +
    "If no duration is stated, use 90 minutes for a lecture, 60 for a meeting, 30 for zoom/phone, 60 for a block. " +
    "If no reminders are stated, use [1440, 120, 30]. If a time is given without a date, assume the next occurrence. " +
    "Infer kind from words like lecture/הרצאה, meeting/פגישה, zoom/זום, phone/call/טלפון.";
  try {
    const res = await fetch(`${url}/functions/v1/pii-gateway/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "x-lalum-surface": "lalum-parse-event", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [{ role: "user", content: text }] }),
    });
    if (!res.ok) { console.log("UPSTREAM " + res.status); return json(502, { code: "upstream_error", status: res.status }); }
    const data = await res.json();
    const raw = Array.isArray(data?.content) ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("").trim() : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return json(422, { code: "parse_failed", raw: raw.slice(0, 200) });
    let event: Record<string, unknown>;
    try { event = JSON.parse(match[0]); } catch { return json(422, { code: "json_invalid", raw: match[0].slice(0, 200) }); }
    return json(200, { event });
  } catch (e) { console.log("FETCHERR " + String(e).slice(0, 200)); return json(502, { code: "fetch_failed" }); }
});
