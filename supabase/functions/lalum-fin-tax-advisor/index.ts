// lalum-fin-tax-advisor: the AI tax advisor of the finance cockpit, in two modes. It never computes tax and never writes.
//   mode "classify": one expense in, a suggested tax category out. Rates come from the fixed table below, not from the
//     model, except for MIXED_CUSTOM where the model proposes rates and the answer is marked for review.
//   mode "audit": the figures of the deterministic engine (src/lib/cockpit/taxEngine.ts) in, a short Hebrew CFO report out.
//     The model is told to use only the numbers it is given.
//
// POST { firm_id, mode: "classify", supplier, description, total, vat_amount }
// POST { firm_id, mode: "audit", pnl, final }
//
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Access: finance level 3, like expenses.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// Keep equal to TAX_CATEGORY in src/lib/cockpit/taxEngine.ts. `npm run tax-check` compares the two.
const RATES: Record<string, { vatPct: number; itPct: number; review: boolean }> = {
  OPERATIONAL_100: { vatPct: 100, itPct: 100, review: false },
  VEHICLE_MAINTENANCE: { vatPct: 66.67, itPct: 45, review: false },
  VEHICLE_EV_CHARGING: { vatPct: 66.67, itPct: 45, review: true },
  OFFICE_REFRESHMENTS: { vatPct: 100, itPct: 80, review: false },
  CLIENT_GIFTS: { vatPct: 0, itPct: 100, review: true },
  PROFESSIONAL_ATTIRE: { vatPct: 0, itPct: 80, review: false },
  HOME_OFFICE: { vatPct: 100, itPct: 100, review: true },
  LOCAL_HOSPITALITY_NON_DEDUCTIBLE: { vatPct: 0, itPct: 0, review: false },
  FINES_NON_DEDUCTIBLE: { vatPct: 0, itPct: 0, review: false },
  MIXED_CUSTOM: { vatPct: 100, itPct: 100, review: true },
  FIXED_ASSET: { vatPct: 100, itPct: 0, review: true },
};

const SYSTEM = `אתה רואה חשבון ישראלי בכיר (CPA), יועץ מס מומחה ומנהל כספים ראשי (CFO), הפועל בתוך מערכת אוטומטית לניהול משרד וכספים.
החישוב המתמטי ומדרגות המס מתבצעים באופן דטרמיניסטי על ידי מנוע הקוד של המערכת. תפקידך הוא:
1. לסווג הוצאות והכנסות לפי פקודת מס הכנסה, תקנות מס הכנסה (ניכוי הוצאות מסוימות) וחוק מע"מ (אחוז הכרה במע"מ תשומות ואחוז הכרה למס הכנסה: רכב 45% מס הכנסה ו-2/3 או 25% מע"מ, כיבוד קל במשרד 80%, מתנות מוגבלות בתקרה, אירוח בארץ וקנסות 0%).
2. לבצע הבחנה קשיחה בין דוח רווח והפסד חשבונאי (לפני מס) לבין דוח התאמה למס (הכנסה חייבת במס לאחר תיאום הוצאות עודפות וניכוי 52% ביטוח לאומי וקרן השתלמות).
3. להציג לבעל המשרד תמונת "אפס חרדת מס" (מודל הכספות): כמה כסף מתוך היתרה בבנק שייך למע"מ, כמה צריך לשריין בצד להשלמת מקדמות מס הכנסה וביטוח לאומי, וכמה הוא ה"נטו האמיתי הפנוי למשיכה" (Safe-to-Spend).
4. להתריע באופן יזום על פער בין מקדמות ששולמו לבין חבות המס בפועל, ולהמליץ על פעולות אופטימיזציה (כגון השלמת הפקדות לקרן השתלמות ופנסיה או עדכון מקדמות למניעת ריבית והצמדה).
השב תמיד בעברית מקצועית, חדה, תמציתית ומבוססת נתונים בלבד.

כללי יסוד נוספים של המערכת:
א. השתמש אך ורק במספרים שנמסרו לך. לעולם אל תחשב מס מחדש, אל תמציא מספר ואל תשנה מספר שנמסר.
ב. אם נמסר שהפרמטרים הסטטוטוריים אינם מאומתים, פתח את הדוח באזהרה ברורה שהמספרים אינם סופיים.
ג. אם אינך בטוח בסיווג, אמור זאת והמלץ על בדיקה מול רואה החשבון. אל תנחש.
ד. אל תשתמש בקו מפריד (מקף כסימן פיסוק). השתמש בפסיק, בנקודה, בנקודתיים או בסוגריים.`;

const CLASSIFY_TOOL = {
  name: "return_classification",
  description: "Return the tax classification of one expense.",
  input_schema: {
    type: "object",
    properties: {
      expense_category: { type: "string", enum: Object.keys(RATES) },
      vat_recognition_pct: { type: "number", description: "Only used for MIXED_CUSTOM, 0 to 100." },
      income_tax_recognition_pct: { type: "number", description: "Only used for MIXED_CUSTOM, 0 to 100." },
      legal_reasoning_hebrew: { type: "string", description: "Two sentences at most, in Hebrew." },
    },
    required: ["expense_category", "legal_reasoning_hebrew"],
  },
};

const clamp = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : d);
async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY"), url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !anon || !serviceKey) return json(500, { code: "not_configured" });

  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(401, { code: "unauthorized" });

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const firmId = typeof body?.firm_id === "string" ? body.firm_id : "";
  if (!firmId) return json(400, { code: "missing_firm" });
  const { data: canWrite } = await asUser.rpc("lalum_fin_can", { p_firm: firmId, p_min: 3 });
  if (canWrite !== true) return json(403, { code: "forbidden" });
  try {
    const { data: ok } = await createClient(url, serviceKey).rpc("lalum_rate_limit", { p_key: `fin-tax-advisor:firm:${await sha(firmId)}`, p_max: 60, p_window_seconds: 3600 });
    if (ok === false) return json(429, { code: "too_many_requests" });
  } catch { /* the limiter failing must not block the practice */ }

  const call = async (payload: Record<string, unknown>) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, system: SYSTEM, ...payload }),
    });
    if (!res.ok) { console.error(`lalum-fin-tax-advisor: upstream ${res.status}`); return null; }
    return await res.json();
  };

  try {
    if (body.mode === "classify") {
      const total = Number(body.total), vat = Number(body.vat_amount ?? 0);
      const text = `ספק: ${String(body.supplier ?? "").slice(0, 200)}\nתיאור: ${String(body.description ?? "").slice(0, 400)}\nסכום כולל: ${Number.isFinite(total) ? total : "לא ידוע"}\nמע"מ: ${Number.isFinite(vat) ? vat : "לא ידוע"}\nסווג את ההוצאה.`;
      const data = await call({ max_tokens: 400, tools: [CLASSIFY_TOOL], tool_choice: { type: "tool", name: CLASSIFY_TOOL.name }, messages: [{ role: "user", content: text }] });
      if (!data) return json(502, { code: "upstream_error" });
      const tu = Array.isArray(data.content) ? data.content.find((b: { type?: string }) => b?.type === "tool_use") : null;
      const cat = tu?.input?.expense_category;
      if (typeof cat !== "string" || !(cat in RATES)) return json(200, { classification: null });
      const r = RATES[cat];
      const custom = cat === "MIXED_CUSTOM";
      return json(200, { classification: {
        expense_category: cat,
        vat_recognition_pct: custom ? clamp(tu.input.vat_recognition_pct, r.vatPct) : r.vatPct,
        income_tax_recognition_pct: custom ? clamp(tu.input.income_tax_recognition_pct, r.itPct) : r.itPct,
        needs_review: r.review,
        legal_reasoning_hebrew: String(tu.input.legal_reasoning_hebrew ?? "").slice(0, 600),
      } });
    }
    if (body.mode === "audit") {
      const figures = JSON.stringify(body.pnl ?? {}).slice(0, 8000);
      const status = body.final === true ? "הפרמטרים הסטטוטוריים אומתו." : "הפרמטרים הסטטוטוריים אינם מאומתים, המספרים אינם סופיים.";
      const data = await call({ max_tokens: 900, messages: [{ role: "user", content: `${status}\nהנה תוצאות מנוע המס הדטרמיניסטי בשקלים (JSON):\n${figures}\nכתוב דוח מנהלים קצר: מצב הכספות, פער המקדמות, והמלצות אופטימיזציה אם יש.` }] });
      if (!data) return json(502, { code: "upstream_error" });
      const out = Array.isArray(data.content) ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n") : "";
      return json(200, { report: out.trim(), final: body.final === true, model: MODEL });
    }
    return json(400, { code: "bad_mode" });
  } catch (e) {
    console.error(`lalum-fin-tax-advisor: ${String(e).slice(0, 200)}`);
    return json(502, { code: "fetch_failed" });
  }
});
