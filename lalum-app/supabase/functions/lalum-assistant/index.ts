// lalum-assistant: Supabase Edge Function (Deno) for the LALUM app.
// Backs the LALUM site chat widget (lalum-app ChatWidget). Proxies a short
// conversation to the Anthropic Messages API with a fixed system prompt so the
// API key stays server-side. Returns { reply }. Self-contained to LALUM.
//
// Deploy: supabase functions deploy lalum-assistant
// Requires env: ANTHROPIC_API_KEY (server only).

const MODEL = "claude-sonnet-5";

const SYSTEM =
  "You are LALUM's AI legal assistant. LALUM is a Tech-Legal boutique serving " +
  "startups, technology companies, and real-estate ventures, focused on IP " +
  "protection, AI regulation (including the EU AI Act), contract governance, and " +
  "Decision-Oriented Mediation (DOM). Give clear, concise general legal " +
  "information relevant to Israel and the EU. You are NOT a substitute for a " +
  "lawyer: never give definitive legal advice on a specific case, always add a " +
  "short disclaimer, and suggest booking a consultation with LALUM for anything " +
  "specific. Reply in the same language the user writes in. Keep answers under " +
  "150 words.";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { code: "not_configured" });

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));
  if (!messages.length) return json(400, { code: "no_messages" });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages }),
    });
    if (!res.ok) return json(502, { code: "upstream_error", status: res.status });
    const data = await res.json();
    const reply = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("").trim()
      : "";
    return json(200, { reply });
  } catch {
    return json(502, { code: "fetch_failed" });
  }
});
