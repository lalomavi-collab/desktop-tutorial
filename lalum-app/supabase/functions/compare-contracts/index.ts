// compare-contracts: Supabase Edge Function (Deno) for the LALUM app.
// Module 1.1 (Vault) behind LALUM LEX (/os): compares two to five submitted
// contract texts side by side, topic by topic, instead of reviewing one
// document alone (analyze-contract's job).
//
// Deliberately stateless: this function receives document text in the
// request body and returns a comparison, nothing is written to Storage or a
// database table. /os has no login (see analyze-contract's own header
// comment), so there is no account boundary that could scope a persisted
// document to the person who uploaded it. Building a "vault" that stores
// arbitrary submitted contracts with no owner would be a public, anonymous
// document store, a bigger exposure than the feature is worth. If LEX later
// grows real accounts, persistence can be added behind that boundary instead
// of ahead of it.
//
// Same two-layer anti-hallucination guardrail as analyze-contract:
//   1. Forced tool call against a fixed schema.
//   2. Every exact_quote checked here against the specific document it
//      claims to come from (by document_index), not just against the
//      concatenation of all of them.
//
// Deploy: supabase functions deploy compare-contracts --no-verify-jwt
// Requires env: ANTHROPIC_API_KEY (server only, already set for lalum-assistant).

const MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 8192;
const MAX_DOC_CHARS = 60_000;
const MIN_DOC_CHARS = 50;
const MIN_DOCS = 2;
const MAX_DOCS = 5;

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const DISCLAIMER =
  "המידע לעיל הופק על ידי מנוע בינה מלאכותית לצורכי ייעול וסיוע ראשוני בלבד, אינו ייעוץ משפטי, ואינו יוצר יחסי עורך דין לקוח. אין להסתמך עליו לפני בדיקה ואישור של עורך דין מוסמך.";

const SYSTEM = `אתה מנוע השוואת החוזים של LALUM LEX. קיבלת מספר מסמכי חוזה, ותפקידך היחיד: לאתר את הנושאים המרכזיים המשותפים או הרלוונטיים לחלק מהם, ולהחזיר טבלת השוואה דרך הכלי return_comparison_matrix בלבד. אינך משוחח, ואינך מוסיף טקסט חופשי.

חובת יסוד, אינה ניתנת לוויתור:
1. שדה exact_quote בכל תא חייב להיות העתקה מילולית, תו במקום תו, מתוך המסמך שאליו הוא משויך לפי document_index. לעולם אל תעתיק ציטוט ממסמך אחד ותייחס אותו למסמך אחר, ולעולם אל תמציא ציטוט.
2. אם נושא לא מופיע במסמך מסוים, סמן present: false עבור אותו מסמך, והשאר exact_quote כ null. אל תמציא נוכחות שאינה קיימת.
3. topics צריך לכסות את הנושאים המהותיים ביותר להשוואה בין המסמכים (למשל: תקופת ההתקשרות, מנגנון סיום, שיפוי ואחריות, ריבית או תמורה, ביטחונות), לא כל משפט במסמך.
4. materially_differs מסומן true רק כאשר יש הבדל מהותי בין המסמכים באותו נושא, לא הבדל ניסוחי בלבד.

לעולם אל תשתמש בקו מפריד (מקף כסימן פיסוק) בטקסט שאתה מייצר. השתמש בפסיק, בנקודה, או בסוגריים.`;

const MATRIX_TOOL = {
  name: "return_comparison_matrix",
  description: "Return the topic by topic comparison matrix across the submitted documents.",
  input_schema: {
    type: "object",
    properties: {
      topics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            materially_differs: { type: "boolean" },
            comparison_note: { type: "string", description: "Why the documents differ or align on this topic." },
            cells: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  document_index: { type: "integer" },
                  present: { type: "boolean" },
                  summary: { type: "string" },
                  exact_quote: { type: ["string", "null"] },
                },
                required: ["document_index", "present", "summary"],
              },
            },
          },
          required: ["topic", "materially_differs", "comparison_note", "cells"],
        },
      },
    },
    required: ["topics"],
  },
};

type RawCell = {
  document_index?: unknown;
  present?: unknown;
  summary?: unknown;
  exact_quote?: unknown;
};
type RawTopic = {
  topic?: unknown;
  materially_differs?: unknown;
  comparison_note?: unknown;
  cells?: unknown;
};

// Same whitespace-insensitive verbatim check as analyze-contract: the model
// copies from text that went through client-side PDF/DOCX extraction, where
// line breaks and repeated spaces carry no meaning.
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function sanitizeTopic(raw: RawTopic, docsNormalized: string[]): Record<string, unknown> | null {
  const topic = typeof raw.topic === "string" ? raw.topic.trim() : "";
  const note = typeof raw.comparison_note === "string" ? raw.comparison_note.trim() : "";
  if (!topic || !note || !Array.isArray(raw.cells)) return null;

  type SanitizedCell = {
    document_index: number;
    present: boolean;
    summary: string;
    exact_quote: string | null;
    quote_verified: boolean | null;
  };
  const cells = (raw.cells as RawCell[])
    .map((c): SanitizedCell | null => {
      const docIndex = typeof c.document_index === "number" ? c.document_index : -1;
      if (docIndex < 0 || docIndex >= docsNormalized.length) return null;
      const summary = typeof c.summary === "string" ? c.summary.trim() : "";
      if (!summary) return null;
      const present = c.present === true;
      const exactQuote = typeof c.exact_quote === "string" && c.exact_quote.trim() ? c.exact_quote.trim() : null;
      const quoteVerified = exactQuote === null ? null : docsNormalized[docIndex].includes(normalize(exactQuote));
      return {
        document_index: docIndex,
        present,
        summary,
        exact_quote: exactQuote,
        quote_verified: quoteVerified,
      };
    })
    .filter((c): c is SanitizedCell => c !== null);

  if (cells.length === 0) return null;

  return {
    topic,
    materially_differs: raw.materially_differs === true,
    comparison_note: note,
    cells,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { code: "not_configured" });

  let body: { documents?: { name?: string; text?: string }[]; playbook_criteria?: string; playbook_label?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const rawDocs = Array.isArray(body.documents) ? body.documents : [];
  if (rawDocs.length < MIN_DOCS) return json(400, { code: "too_few_documents", min: MIN_DOCS });
  if (rawDocs.length > MAX_DOCS) return json(400, { code: "too_many_documents", max: MAX_DOCS });

  const documents = rawDocs.map((d, i) => ({
    name: typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 200) : `מסמך ${i + 1}`,
    text: typeof d.text === "string" ? d.text.trim() : "",
  }));
  for (const d of documents) {
    if (d.text.length < MIN_DOC_CHARS) return json(400, { code: "document_too_short" });
    if (d.text.length > MAX_DOC_CHARS) return json(400, { code: "document_too_long", max_chars: MAX_DOC_CHARS });
  }

  const playbookCriteria = typeof body.playbook_criteria === "string" ? body.playbook_criteria.trim().slice(0, 4000) : "";
  const playbookLabel = typeof body.playbook_label === "string" ? body.playbook_label.trim().slice(0, 100) : "";
  const system = playbookCriteria
    ? `${SYSTEM}\n\nבנוסף, הופעלה תבנית בדיקה משרדית${playbookLabel ? ` (${playbookLabel})` : ""}. תן משקל מיוחד בהשוואה לנושאים הבאים, מבלי לוותר על נושאים מהותיים אחרים:\n${playbookCriteria}`
    : SYSTEM;

  const userMessage = documents
    .map((d, i) => `מסמך ${i} (document_index=${i}), שם קובץ: ${d.name}\n\n${d.text}`)
    .join("\n\n---\n\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        tools: [MATRIX_TOOL],
        tool_choice: { type: "tool", name: MATRIX_TOOL.name },
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      // Log the upstream body server-side only: this is a public,
      // unauthenticated endpoint, so an anonymous caller never sees more
      // than a status code and a generic error.
      const errBody = await res.text();
      console.error(`compare-contracts: upstream ${res.status} ${errBody.slice(0, 500)}`);
      return json(502, { code: "upstream_error", status: res.status });
    }
    const data = await res.json();

    const toolUse = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string; name?: string }) => b?.type === "tool_use" && b?.name === MATRIX_TOOL.name)
      : null;
    const rawTopics: RawTopic[] = Array.isArray(toolUse?.input?.topics) ? toolUse.input.topics : [];

    const docsNormalized = documents.map((d) => normalize(d.text));
    const topics = rawTopics
      .map((t) => sanitizeTopic(t, docsNormalized))
      .filter((t): t is Record<string, unknown> => t !== null);

    return json(200, {
      document_names: documents.map((d) => d.name),
      topics,
      disclaimer: DISCLAIMER,
      model: MODEL,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`compare-contracts: fetch_failed ${String(e).slice(0, 200)}`);
    return json(502, { code: "fetch_failed" });
  }
});
