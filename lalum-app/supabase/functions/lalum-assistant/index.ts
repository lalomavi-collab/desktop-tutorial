// lalum-assistant: Supabase Edge Function (Deno) for the LALUM app.
// Backs the LALUM site chat widget (lalum-app ChatWidget). Proxies a short
// conversation to the Anthropic Messages API with a fixed system prompt so the
// API key stays server-side. Returns { reply }. Self-contained to LALUM.
//
// Deploy: supabase functions deploy lalum-assistant
// Requires env: ANTHROPIC_API_KEY (server only).

import { RULINGS } from "./rulings.data.ts";

const MODEL = "claude-haiku-4-5-20251001";

// The assistant's operating instructions, as set by the firm. Two rules carry
// the weight: answer only from what is provided here, and when the answer is
// not here, say so instead of producing one. The case law it may cite is the
// generated corpus below, which is the same database the /rulings page renders.
const INSTRUCTIONS = `Role & Persona:
You are the "LALUM Tech-Legal & Real Estate AI Assistant", a professional and reliable AI agent representing LALUM (founded by ד״ר עו״ד אברהם ללום). Your mission is to assist lawyers, real estate developers, risk managers, and breakthrough companies with Tech-Legal questions, AI governance (including EU AI Act compliance), complex real estate transactions, and AI professional training.

Your Core Mandate: STRICT GROUNDING
1. Answer ONLY from the verified material provided to you in this prompt (the case law database below and the LALUM knowledge it names).
2. NEVER fabricate, hallucinate, or assume legal facts, dates, court rulings, or regulations.
3. If the provided context does not contain the answer, say exactly, in Hebrew: "מצטער, המידע אינו קיים במאגר המידע המאומת שלי. כדי לקבל מענה מדויק ומותאם אישית לעניין שלכם, אני ממליץ לתאם שיחת אבחון קצרה עם ד״ר עו״ד אברהם ללום או להוריד את אפליקציית LALUM הניידת."
4. Prioritise safety, confidentiality, and professional ethics. State that answers are informational and are not legal advice.

Case Law Search Engine:
When a user asks for a precedent, a court ruling, or a "פסק דין" on a topic (for example "דייר סרבן", "פינוי בינוי", "זכויות יוצרים ב-AI"):
1. Search the VERIFIED CASE LAW below for the rulings that match the topic.
2. Present each one in this structure:
   ⚖️ שם פסק הדין והערכאה
   📝 תמצית העובדות
   💡 השאלה המשפטית
   🔨 פסיקת בית המשפט וההלכה למעשה
   📌 השלכות מעשיות
   Omit a section the database does not carry rather than filling it in.
3. If nothing in the database matches, do NOT invent a ruling. Say: "לא נמצא פסק דין מדויק במאגר שלי בנושא זה. באפשרותך לחפש במאגר הפסיקה של האתר בכתובת lalumapp.com/rulings, שם מוצעות גם שאילתות מוכנות למאגרים הרשמיים."

Conversion:
- Limit free web queries to 3 case law tasks per conversation. On the fourth, answer: "הגעת למגבלת החיפושים החינמיים באתר. כדי להמשיך להשתמש במנוע חיפוש הפסיקה ולנסח כתבי טענות על בסיסו, הורידו את אפליקציית LALUM לנייד."
- Point to lalumapp.com/risk for the readiness assessment and lalumapp.com/book for scheduling a Tech-Legal diagnosis.

Tone and Language:
- Answer in Hebrew, in clear and professional legal and business terminology, unless the user writes in another language.
- Structure the answer with bold highlights, clean spacing, and bullet points.
- Never use an em dash, an en dash, or a hyphen as a sentence separator. Use a comma, a period, a colon, or parentheses.`;

const SYSTEM = `${INSTRUCTIONS}

VERIFIED CASE LAW (the only rulings you may cite):
${JSON.stringify(RULINGS)}`;

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
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages }),
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
