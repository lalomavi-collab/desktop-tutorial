// analyze-contract: Supabase Edge Function (Deno) for the LALUM app.
// The strict citation engine behind LEX (LALUM LEGAL OS, /os) /contracts review:
// takes a contract's extracted text and returns a structured findings list, not
// prose. Public (no login), same as lalum-assistant and lalum-book: LEX itself
// is a public-facing engine, not a /portal-gated one.
//
// Anti-hallucination guardrail, in two layers:
//   1. The model must answer through a forced tool call against a fixed JSON
//      schema (Anthropic tool_choice), not free text it might wrap around an
//      invented answer or drop a field from.
//   2. Every exact_quote this function returns is checked here, in code,
//      against the contract text the caller actually submitted. A quote that
//      does not appear verbatim is still returned (dropping a real finding is
//      its own failure) but is marked quote_verified: false, so a reviewer
//      distrusts it on sight instead of treating an unverifiable citation as
//      confirmed. This mirrors the site's own publishing rule (rulings.json):
//      a citation nobody can trace does not get to look like a checked one.
//
// Deploy: supabase functions deploy analyze-contract --no-verify-jwt
// Requires env: ANTHROPIC_API_KEY (server only, already set for lalum-assistant).

const MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 8192;
// Generous, but bounded: a public, unauthenticated endpoint should not accept
// an unbounded body. ~150k characters comfortably covers a long commercial
// contract with room left for the model's own reasoning and output.
const MAX_CONTRACT_CHARS = 150_000;
const MIN_CONTRACT_CHARS = 50;

const SEVERITIES = new Set(["red", "yellow", "green"]);

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const DISCLAIMER =
  "המידע לעיל הופק על ידי מנוע בינה מלאכותית לצורכי ייעול וסיוע ראשוני בלבד, אינו ייעוץ משפטי, ואינו יוצר יחסי עורך דין לקוח. אין להסתמך עליו לפני בדיקה ואישור של עורך דין מוסמך.";

// The model's only operating instructions. Mirrors the STRICT GROUNDING
// mandate already in lalum-assistant's system prompt, narrowed to the one job
// this function does: extract findings from a document, never author facts
// the document does not contain.
const SYSTEM = `אתה מנוע ניתוח החוזים של LEX, מנוע LALUM LEGAL OS. תפקידך היחיד: לקרוא את טקסט החוזה שסופק לך, ולהחזיר ממצאים דרך הכלי return_contract_findings בלבד. אינך משוחח, ואינך מוסיף טקסט חופשי.

חובת יסוד, אינה ניתנת לוויתור:
1. שדה exact_quote חייב להיות העתקה מילולית, תו במקום תו, מתוך טקסט החוזה שסופק. לעולם אל תנסח מחדש, תשלים מהזיכרון, או תמציא ציטוט שנשמע סביר.
2. אם סעיף מהותי שהיה אמור להופיע בחוזה מסוג זה חסר לגמרי (למשל: ערבות, תנאי מתלה, מועד מסירה, פיצוי מוסכם, מנגנון יישוב סכסוכים), צור ממצא עם is_missing_clause: true, ואל תמלא clause_number או exact_quote, השאר אותם null. אל תמציא מספר סעיף כדי "לעגן" ממצא על היעדר.
3. אם אינך בטוח שממצא מבוסס על הטקסט שסופק, אל תכלול אותו.

דירוג חומרה:
- red: חשיפה משפטית או כלכלית מהותית, חד-צדדיות בולטת, היעדר הגנה חיונית, או אחריות בלתי מוגבלת.
- yellow: ניסוח הראוי לתשומת לב, ניתן למשא ומתן, אינו קריטי בפני עצמו.
- green: סעיף תקין וסטנדרטי, נכלל רק כשבאמת נבדק ונמצא תקין, לא כברירת מחדל.

proposed_revision: הצע ניסוח חלופי מחוזק בעברית כאשר החומרה red או yellow ויש הצעה קונקרטית וממוקדת. השאר null כאשר אין הצעת ניסוח רלוונטית, כולל לרוב עבור green.

לעולם אל תשתמש בקו מפריד (מקף כסימן פיסוק) בטקסט שאתה מייצר. השתמש בפסיק, בנקודה, או בסוגריים.`;

const FINDINGS_TOOL = {
  name: "return_contract_findings",
  description: "Return the structured list of findings extracted from the submitted contract text.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            finding_id: { type: "string", description: "Short stable id, e.g. f1, f2." },
            clause_number: { type: ["string", "null"], description: "The clause/section number as it appears in the document, or null if is_missing_clause." },
            clause_title: { type: "string" },
            severity: { type: "string", enum: ["red", "yellow", "green"] },
            issue_summary: { type: "string" },
            exact_quote: { type: ["string", "null"], description: "Verbatim substring of the submitted contract text, or null if is_missing_clause." },
            page_hint: { type: ["string", "null"] },
            legal_risk_rationale: { type: "string" },
            proposed_revision: { type: ["string", "null"] },
            is_missing_clause: { type: "boolean" },
          },
          required: ["finding_id", "clause_title", "severity", "issue_summary", "legal_risk_rationale", "is_missing_clause"],
        },
      },
    },
    required: ["findings"],
  },
};

type RawFinding = {
  finding_id?: unknown;
  clause_number?: unknown;
  clause_title?: unknown;
  severity?: unknown;
  issue_summary?: unknown;
  exact_quote?: unknown;
  page_hint?: unknown;
  legal_risk_rationale?: unknown;
  proposed_revision?: unknown;
  is_missing_clause?: unknown;
};

// Whitespace-insensitive verbatim check: the model copies from a document that
// went through PDF/DOCX text extraction, where line breaks and repeated
// spaces are not meaningful, so requiring a byte-exact match would fail
// genuine quotes on formatting alone. Anything beyond whitespace must match.
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function sanitizeFinding(raw: RawFinding, index: number, contractNormalized: string): Record<string, unknown> | null {
  const clauseTitle = typeof raw.clause_title === "string" ? raw.clause_title.trim() : "";
  const severity = typeof raw.severity === "string" ? raw.severity : "";
  const issueSummary = typeof raw.issue_summary === "string" ? raw.issue_summary.trim() : "";
  const rationale = typeof raw.legal_risk_rationale === "string" ? raw.legal_risk_rationale.trim() : "";
  const isMissing = raw.is_missing_clause === true;

  // Drop, rather than guess-fill, a finding missing a field the schema
  // requires: fabricating a plausible value here would be the same failure
  // this function exists to prevent, just moved one step downstream.
  if (!clauseTitle || !SEVERITIES.has(severity) || !issueSummary || !rationale) return null;

  const exactQuote = typeof raw.exact_quote === "string" && raw.exact_quote.trim() ? raw.exact_quote.trim() : null;
  const quoteVerified = isMissing ? null : exactQuote !== null && contractNormalized.includes(normalize(exactQuote));

  return {
    finding_id: typeof raw.finding_id === "string" && raw.finding_id.trim() ? raw.finding_id.trim() : `f${index + 1}`,
    clause_number: isMissing ? null : typeof raw.clause_number === "string" ? raw.clause_number.trim() || null : null,
    clause_title: clauseTitle,
    severity,
    issue_summary: issueSummary,
    exact_quote: isMissing ? null : exactQuote,
    page_hint: typeof raw.page_hint === "string" && raw.page_hint.trim() ? raw.page_hint.trim() : null,
    legal_risk_rationale: rationale,
    proposed_revision: typeof raw.proposed_revision === "string" && raw.proposed_revision.trim() ? raw.proposed_revision.trim() : null,
    is_missing_clause: isMissing,
    // Not part of the requested schema, added on top of it: the caller gets a
    // concrete signal for "this citation was checked against your own text
    // and confirmed" versus "the model said so." Missing-clause findings have
    // no quote to check, so this is null rather than a meaningless false.
    quote_verified: quoteVerified,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { code: "not_configured" });

  let body: { contract_text?: string; document_name?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const contractText = typeof body.contract_text === "string" ? body.contract_text.trim() : "";
  const documentName = typeof body.document_name === "string" ? body.document_name.trim().slice(0, 200) : "";
  if (contractText.length < MIN_CONTRACT_CHARS) return json(400, { code: "contract_too_short" });
  if (contractText.length > MAX_CONTRACT_CHARS) return json(400, { code: "contract_too_long", max_chars: MAX_CONTRACT_CHARS });

  const userMessage = documentName
    ? `שם המסמך: ${documentName}\n\nטקסט החוזה:\n${contractText}`
    : `טקסט החוזה:\n${contractText}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM,
        tools: [FINDINGS_TOOL],
        tool_choice: { type: "tool", name: FINDINGS_TOOL.name },
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) return json(502, { code: "upstream_error", status: res.status });
    const data = await res.json();

    const toolUse = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string; name?: string }) => b?.type === "tool_use" && b?.name === FINDINGS_TOOL.name)
      : null;
    const rawFindings: RawFinding[] = Array.isArray(toolUse?.input?.findings) ? toolUse.input.findings : [];

    const contractNormalized = normalize(contractText);
    const findings = rawFindings
      .map((f, i) => sanitizeFinding(f, i, contractNormalized))
      .filter((f): f is Record<string, unknown> => f !== null);

    const verifiedCount = findings.filter((f) => f.quote_verified === true).length;
    const unverifiedCount = findings.filter((f) => f.quote_verified === false).length;

    return json(200, {
      findings,
      disclaimer: DISCLAIMER,
      model: MODEL,
      generated_at: new Date().toISOString(),
      verified_count: verifiedCount,
      unverified_count: unverifiedCount,
    });
  } catch {
    return json(502, { code: "fetch_failed" });
  }
});
