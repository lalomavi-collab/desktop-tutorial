// lalum-fin-receipt-scan: reads a photographed or scanned expense receipt/invoice, or a PDF invoice, and returns a
// draft. It never writes to the ledger itself. The Expenses form saves a draft after a person looks at it, and the
// automatic intake (ExpenseIntake, rules in src/lib/cockpit/expenseIntake.ts) books one only when every figure was read
// clearly and adds up, so a misread number is left for review rather than written.
//
// POST { firm_id, image_base64, media_type }   (media_type: image/jpeg | image/png | image/webp | image/gif | application/pdf)
//
// Env: ANTHROPIC_API_KEY (server only, already set for analyze-contract/lalum-assistant),
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (all auto-injected).
// Access: the caller's own JWT must carry finance level 3 (the same level ExpensesTab's Gate
// requires to write an expense) for the firm named in firm_id.
//
// Source kept in the repository from 30.10.2026; version 29 was deployed without it. Changes from 29: PDF documents are
// accepted (sent to the model as a document block), and the draft carries the currency of the printed amounts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 1024;
// A clear phone photo of one receipt is well under 4 MB before base64 inflation (~1.37x); this
// leaves headroom for a scanned page or a short PDF while still bounding an authenticated endpoint's body.
const MAX_BASE64_CHARS = 7_000_000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const CATEGORY_KEYS = new Set([
  "OFFICE", "SOFTWARE", "PROFESSIONAL", "TRAVEL", "VEHICLE", "COMMUNICATION", "MARKETING", "FEES", "EDUCATION", "OTHER",
]);

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
// deno-lint-ignore no-explicit-any
async function allowed(admin: any, key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("lalum_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    return error ? true : data !== false;
  } catch { return true; }
}

const SYSTEM = `אתה קורא חשבונית, קבלה או חשבונית מס קבלה אחת (תמונה או קובץ PDF), ומחזיר טיוטת הוצאה דרך הכלי return_expense_draft בלבד. אינך משוחח, ואינך מוסיף טקסט חופשי.

חובת יסוד, אינה ניתנת לוויתור:
1. דווח אך ורק את מה שכתוב בפועל במסמך. לעולם אל תנחש, תעריך או תמציא מספר, תאריך או שם שאינך יכול לקרוא בבירור.
2. אם שדה אינו קריא או אינו מופיע במסמך, החזר null עבורו, ואל תמלא ערך "סביר".
3. כל שדה שבו אינך בטוח במאת האחוזים (כתב יד, טשטוש, חיתוך בקצה התמונה) חייב להופיע ברשימת low_confidence_fields, גם אם בכל זאת דיווחת עליו ערך.
4. category_guess הוא הצעה בלבד להקלה על המשתמש; המשתמש הוא זה שמאשר אותה. בחר את הקרוב ביותר מתוך הרשימה הנתונה, או null אם אין התאמה סבירה.
5. total הוא הסכום הכולל כולל מע"מ כפי שמופיע במסמך. vat_amount הוא סכום המע"מ בלבד אם הוא מצוין בנפרד; אם לא מצוין בנפרד, החזר null ואל תחשב אותו לבד.
6. spent_on הוא תאריך המסמך, בפורמט YYYY-MM-DD.
7. currency הוא קוד המטבע של הסכומים כפי שמופיע במסמך (ILS לשקלים, USD לדולר, EUR לאירו), או null אם המסמך אינו מציין.
8. אם במסמך כמה עמודים, הסכום הכולל הוא הסכום לתשלום של המסמך כולו, לא של עמוד אחד.

לעולם אל תשתמש בקו מפריד (מקף כסימן פיסוק) בטקסט שאתה מייצר. השתמש בפסיק, בנקודה, או בסוגריים.`;

const DRAFT_TOOL = {
  name: "return_expense_draft",
  description: "Return the expense draft extracted from the submitted receipt/invoice image or PDF.",
  input_schema: {
    type: "object",
    properties: {
      spent_on: { type: ["string", "null"], description: "Document date as YYYY-MM-DD, or null if unreadable." },
      supplier: { type: ["string", "null"] },
      category_guess: { type: ["string", "null"], description: "One of: " + [...CATEGORY_KEYS].join(", ") + ", or null." },
      description: { type: ["string", "null"] },
      total: { type: ["number", "null"], description: "Total including VAT, exactly as printed." },
      vat_amount: { type: ["number", "null"], description: "VAT amount only if shown separately on the document, else null." },
      supplier_doc_ref: { type: ["string", "null"], description: "The supplier's own document/invoice number, if printed." },
      currency: { type: ["string", "null"], description: "ISO 4217 code of the printed amounts (ILS for shekels), or null if the document does not say." },
      low_confidence_fields: { type: "array", items: { type: "string" } },
    },
    required: ["low_confidence_fields"],
  },
};

type RawDraft = {
  spent_on?: unknown; supplier?: unknown; category_guess?: unknown; description?: unknown;
  total?: unknown; vat_amount?: unknown; supplier_doc_ref?: unknown; currency?: unknown; low_confidence_fields?: unknown;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const isoDate = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
const currency = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (s === "NIS" || s === "₪" || s === "ש\"ח" || s === "ש״ח") return "ILS";
  return /^[A-Z]{3}$/.test(s) ? s : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !anon || !serviceKey) return json(500, { code: "not_configured" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(401, { code: "unauthorized" });

  let body: { firm_id?: string; image_base64?: string; media_type?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const firmId = typeof body.firm_id === "string" ? body.firm_id : "";
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
  const mediaType = typeof body.media_type === "string" ? body.media_type : "";
  if (!firmId) return json(400, { code: "missing_firm" });
  if (!ALLOWED_MEDIA.has(mediaType)) return json(400, { code: "bad_media_type" });
  if (imageBase64.length < 100) return json(400, { code: "image_too_small" });
  if (imageBase64.length > MAX_BASE64_CHARS) return json(400, { code: "image_too_large" });

  // Same gate ExpensesTab's own Gate component requires to write an expense (level 3): reading an
  // image into a pre-filled draft is pointless for someone who could not save it anyway, and this
  // keeps the check in one place, under RLS, rather than trusted to the caller's own UI state.
  const { data: canWrite } = await asUser.rpc("lalum_fin_can", { p_firm: firmId, p_min: 3 });
  if (canWrite !== true) return json(403, { code: "forbidden" });

  const admin = createClient(url, serviceKey);
  // Per firm, not per caller: a shared bound on how many scans the practice runs an hour, generous
  // for genuine invoice intake, bounded against a runaway loop driving up the model bill.
  if (!(await allowed(admin, `fin-receipt-scan:firm:${await sha(firmId)}`, 40, 3600))) {
    return json(429, { code: "too_many_requests" });
  }

  const source = { type: "base64", media_type: mediaType, data: imageBase64 };
  const block = mediaType === "application/pdf" ? { type: "document", source } : { type: "image", source };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM,
        tools: [DRAFT_TOOL],
        tool_choice: { type: "tool", name: DRAFT_TOOL.name },
        messages: [{
          role: "user",
          content: [
            block,
            { type: "text", text: "קרא את החשבונית או הקבלה, והחזר טיוטת הוצאה." },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`lalum-fin-receipt-scan: upstream ${res.status} ${errBody.slice(0, 500)}`);
      return json(502, { code: "upstream_error", status: res.status });
    }
    const data = await res.json();
    const toolUse = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string; name?: string }) => b?.type === "tool_use" && b?.name === DRAFT_TOOL.name)
      : null;
    const raw: RawDraft = (toolUse?.input as RawDraft) ?? {};

    const categoryGuess = str(raw.category_guess);
    const lowConfidence = Array.isArray(raw.low_confidence_fields)
      ? raw.low_confidence_fields.filter((f): f is string => typeof f === "string").slice(0, 10)
      : [];

    return json(200, {
      draft: {
        spent_on: isoDate(raw.spent_on),
        supplier: str(raw.supplier),
        // An unrecognized guess is dropped rather than passed through: the client's <select> only
        // offers the known keys, and a stray value there would silently fail to select anything.
        category: categoryGuess && CATEGORY_KEYS.has(categoryGuess) ? categoryGuess : null,
        description: str(raw.description),
        total: num(raw.total),
        vat_amount: num(raw.vat_amount),
        supplier_doc_ref: str(raw.supplier_doc_ref),
        currency: currency(raw.currency),
      },
      low_confidence_fields: lowConfidence,
      model: MODEL,
    });
  } catch (e) {
    console.error(`lalum-fin-receipt-scan: fetch_failed ${String(e).slice(0, 200)}`);
    return json(502, { code: "fetch_failed" });
  }
});
