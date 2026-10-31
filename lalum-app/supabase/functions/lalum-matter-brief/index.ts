// lalum-matter-brief: the deep pass of the intake brief (phase 2, owner 31.10.2026, after Clio Work's matter view). Reads
// every document of one matter as the signed-in member may see them (RLS and MFA apply, since the read runs with the
// member's own token), and asks Claude, through the LALUM PII Gateway, for a structured matter map: facts and claims,
// risks, gaps, a timeline and up to three more closed questions. The documents are already masked by the pipeline, file
// names are not sent at all, and the gateway masks again on the way out.
//
// Anti-hallucination, as in analyze-contract: a forced tool call against a fixed schema, and every quote checked here in
// code against the stored text. A quote that is not verbatim is kept (dropping a real point is its own failure) but is
// marked quote_ok: false, so the screen shows it as unverified.
//
// The result is cached per matter in lalum_matter_briefs together with the ids of the documents it read, so opening the
// brief again costs nothing, and a new document makes the cached map visibly stale rather than silently wrong.
//
// Deploy: supabase functions deploy lalum-matter-brief (verify_jwt on).
// Env (automatic): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 6000;
// Enough for a matter of several long documents; beyond it each document is cut in proportion and the cut is said.
const MAX_CHARS = 90_000;
const MIN_DOC_CHARS = 2_000;

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const SYSTEM = `אתה עוזר משפטי בכיר במשרד עורכי דין בישראל. לפניך כל המסמכים של תיק אחד, אחרי הסתרת פרטים מזהים. החזר תמונת תיק מסודרת דרך הכלי matter_map בלבד.
כללים:
1. כתוב בעברית, במשפטים קצרים וברורים לעורך דין עסוק.
2. אל תמציא עובדה, תאריך, סכום או סעיף. כל עובדה, טענה, סיכון ואירוע נשען על ציטוט מילה במילה מהמסמך בשדה quote, ועל מספר המסמך בשדה doc.
3. ערכים בסוגריים מרובעים, כמו [CLIENT_NAME_1], הם פרטים מוסתרים. השאר אותם בדיוק כפי שהם ואל תנחש מה מאחוריהם.
4. אל תשתמש בקו מפריד כסימן פיסוק. השתמש בפסיק, בנקודה או בנקודתיים.
5. בפערים: כתוב מה חסר ולמה זה חשוב לתיק, בלי לנחש את התשובה.
6. בשאלות: עד שלוש שאלות שרק עורך הדין או הלקוח יכולים לענות עליהן ושישנו את הניתוח. לכל שאלה שתיים עד חמש תשובות קצרות לבחירה. אל תשאל על מטרת הלקוח, על הצד שאנחנו מייצגים או על שלב העסקה, כי אלה כבר נשאלים.
7. זה חומר עבודה לעורך הדין, לא ייעוץ משפטי סופי.`;

const ITEM = { text: { type: "string" }, doc: { type: "integer", description: "מספר המסמך, מ-1" }, quote: { type: "string", description: "ציטוט מילה במילה מהמסמך" } };
const TOOL = {
  name: "matter_map",
  description: "Structured map of one legal matter, grounded in verbatim quotes from its documents.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "שתיים עד שלוש שורות: במה עוסק התיק ואיפה הדברים עומדים" },
      facts: { type: "array", maxItems: 8, items: { type: "object", properties: { kind: { type: "string", enum: ["fact", "claim"] }, side: { type: "string", enum: ["client", "adverse", "neutral", "unknown"] }, ...ITEM }, required: ["kind", "text", "doc", "quote"] } },
      risks: { type: "array", maxItems: 6, items: { type: "object", properties: { severity: { type: "string", enum: ["high", "medium", "low"] }, ...ITEM }, required: ["severity", "text", "doc", "quote"] } },
      gaps: { type: "array", maxItems: 6, items: { type: "object", properties: { text: { type: "string" }, why: { type: "string" } }, required: ["text", "why"] } },
      timeline: { type: "array", maxItems: 12, items: { type: "object", properties: { date: { type: "string", description: "התאריך כפי שהוא כתוב במסמך" }, event: { type: "string" }, doc: ITEM.doc, quote: ITEM.quote }, required: ["date", "event", "doc", "quote"] } },
      questions: { type: "array", maxItems: 3, items: { type: "object", properties: { ask: { type: "string" }, why: { type: "string" }, options: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } } }, required: ["ask", "why", "options"] } },
    },
    required: ["summary", "facts", "risks", "gaps", "timeline", "questions"],
  },
};

// Abuse and cost guard, the same limiter analyze-contract uses. Fails open: a limiter error never blocks a member.
// deno-lint-ignore no-explicit-any
async function allowed(admin: any, key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("lalum_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    return error ? true : data !== false;
  } catch { return true; }
}

const norm = (s: string) => s.replace(/[״"]/g, '"').replace(/[׳']/g, "'").replace(/\s+/g, " ").trim();
// House rule: no dash as punctuation in anything the cockpit shows. Quotes stay verbatim; only the model's own words are cleaned.
const clean = (s: unknown, max = 400): string => String(s ?? "").replace(/\s[-–—]\s/g, ", ").replace(/[–—]/g, ",").replace(/\s+/g, " ").trim().slice(0, max);
const arr = <T,>(v: unknown, max: number): T[] => (Array.isArray(v) ? v.slice(0, max) : []) as T[];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json(500, { code: "not_configured" });

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  let body: { matter_id?: string; refresh?: boolean };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const matterId = String(body.matter_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(matterId)) return json(400, { code: "missing_matter" });

  // Read as the member: a matter or document the member may not see simply does not come back.
  const { data: matter } = await asUser.from("lalum_cockpit_matters").select("id, firm_id, practice_area").eq("id", matterId).maybeSingle();
  if (!matter) return json(404, { code: "not_found" });
  const { data: docRows } = await asUser.from("lalum_matter_documents").select("id, editor_content, doc_type, doc_origin, doc_date").eq("matter_id", matterId).order("created_at");
  const docs = ((docRows ?? []) as Array<{ id: string; editor_content: string | null; doc_type: string | null; doc_origin: string | null; doc_date: string | null }>).filter((d) => (d.editor_content ?? "").trim());
  if (!docs.length) return json(400, { code: "no_documents" });
  const docIds = docs.map((d) => d.id);

  const admin = createClient(url, serviceKey);
  const { data: cached } = await admin.from("lalum_matter_briefs").select("map, doc_ids, created_at").eq("matter_id", matterId).maybeSingle();
  const same = !!cached && cached.doc_ids.length === docIds.length && docIds.every((id: string) => cached.doc_ids.includes(id));
  if (cached && same && !body.refresh) return json(200, { map: cached.map, doc_ids: cached.doc_ids, created_at: cached.created_at, cached: true });

  if (!(await allowed(admin, `matter-brief:user:${user.id}`, 20, 3600))) return json(429, { code: "too_many_requests" });
  if (!(await allowed(admin, "matter-brief:all", 200, 86400))) return json(429, { code: "daily_cap" });

  const total = docs.reduce((n, d) => n + (d.editor_content ?? "").length, 0);
  let truncated = false;
  const parts = docs.map((d, i) => {
    const text = d.editor_content ?? "";
    const budget = total > MAX_CHARS ? Math.max(MIN_DOC_CHARS, Math.floor(MAX_CHARS * text.length / total)) : text.length;
    if (budget < text.length) truncated = true;
    const attrs = [d.doc_type && `type="${d.doc_type}"`, d.doc_origin && `origin="${d.doc_origin}"`, d.doc_date && `date="${d.doc_date}"`].filter(Boolean).join(" ");
    return `<document index="${i + 1}" ${attrs}>\n${text.slice(0, budget)}${budget < text.length ? "\n[המסמך קוצר]" : ""}\n</document>`;
  });
  const prompt = `תחום התיק: ${matter.practice_area}. מספר מסמכים: ${docs.length}.\n\n${parts.join("\n\n")}`;

  let input: Record<string, unknown>;
  try {
    const res = await fetch(`${url}/functions/v1/pii-gateway/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": serviceKey, "anthropic-version": "2023-06-01", "x-lalum-surface": "lalum-matter-brief", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_OUTPUT_TOKENS, system: SYSTEM, tools: [TOOL], tool_choice: { type: "tool", name: "matter_map" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) { console.log("UPSTREAM " + res.status); return json(502, { code: "upstream_error", status: res.status }); }
    const data = await res.json();
    const block = Array.isArray(data?.content) ? data.content.find((b: { type?: string }) => b?.type === "tool_use") : null;
    if (!block?.input) return json(502, { code: "no_tool_output" });
    input = block.input as Record<string, unknown>;
  } catch (e) { console.log("FETCHERR " + String(e).slice(0, 200)); return json(502, { code: "fetch_failed" }); }

  // Every quote is checked against the document it names, then against any document of the matter.
  const texts = docs.map((d) => norm(d.editor_content ?? ""));
  const check = (doc: unknown, quote: unknown) => {
    const q = norm(String(quote ?? ""));
    const i = Number(doc) - 1;
    const ok = q.length >= 4 && ((texts[i] ?? "").includes(q) || texts.some((t) => t.includes(q)));
    return { doc: Number.isInteger(i + 1) && i >= 0 && i < docs.length ? i + 1 : 0, quote: String(quote ?? "").slice(0, 400), quote_ok: ok };
  };
  // deno-lint-ignore no-explicit-any
  type Raw = Record<string, any>;
  const map = {
    summary: clean(input.summary, 600),
    facts: arr<Raw>(input.facts, 8).map((f) => ({ kind: f.kind === "claim" ? "claim" : "fact", side: ["client", "adverse", "neutral"].includes(f.side) ? f.side : "unknown", text: clean(f.text), ...check(f.doc, f.quote) })),
    risks: arr<Raw>(input.risks, 6).map((r) => ({ severity: ["high", "medium", "low"].includes(r.severity) ? r.severity : "medium", text: clean(r.text), ...check(r.doc, r.quote) })),
    gaps: arr<Raw>(input.gaps, 6).map((g) => ({ text: clean(g.text), why: clean(g.why) })),
    timeline: arr<Raw>(input.timeline, 12).map((t) => ({ date: clean(t.date, 40), event: clean(t.event), ...check(t.doc, t.quote) })),
    // Closed answers with ids the answers table accepts (^[a-z0-9_]+$); "not known yet" is always offered.
    questions: arr<Raw>(input.questions, 3).map((q, i) => ({
      id: `ai_${i + 1}`, ask: clean(q.ask, 200), why: clean(q.why, 300),
      options: [...arr<unknown>(q.options, 5).map((o, j) => ({ id: `o${j + 1}`, label: clean(o, 60) })).filter((o) => o.label), { id: "unknown", label: "לא ידוע עדיין" }],
    })).filter((q) => q.ask && q.options.length >= 3),
    truncated,
  };

  const createdAt = new Date().toISOString();
  const { error: saveErr } = await admin.from("lalum_matter_briefs").upsert({ matter_id: matterId, firm_id: matter.firm_id, map, doc_ids: docIds, model: MODEL, created_by: user.id, created_at: createdAt });
  if (saveErr) console.log("SAVEERR " + saveErr.code);
  return json(200, { map, doc_ids: docIds, created_at: createdAt, cached: false });
});
