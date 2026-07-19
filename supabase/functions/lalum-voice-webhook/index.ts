// lalum-voice-webhook
// Supabase Edge Function that receives completed-call webhooks from a hosted
// voice platform (Vapi or Retell), extracts intent with Claude, computes
// billing (net rate + VAT, rounded up to the billing increment), and syncs to
// Supabase in one transaction via the lalum_ingest_call RPC.
//
// Mirrors the Python service in /voice-webhook. Deploy with verify_jwt=false so
// the platforms can call it; auth is via the optional VOICE_WEBHOOK_SECRET
// header instead.
//
// Env (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically):
//   LLM_PROVIDER ("anthropic" default, or "openai")
//   OPENAI_API_KEY, OPENAI_MODEL (default gpt-4o-mini)
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL
//   STANDARD_HOURLY_RATE, BILLING_VAT_RATE, BILLING_CURRENCY,
//   BILLING_INCREMENT_MINUTES, VOICE_WEBHOOK_SECRET

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// LLM provider for post-call analysis: "anthropic" (default) or "openai".
// The analysis is one small call per completed call, so cost is negligible
// either way; set LLM_PROVIDER=openai + OPENAI_API_KEY to run it on gpt-4o-mini.
const LLM_PROVIDER = (Deno.env.get("LLM_PROVIDER") ?? "anthropic").toLowerCase();
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
const HOURLY_RATE = Number(Deno.env.get("STANDARD_HOURLY_RATE") ?? "1000");
const VAT_RATE = Number(Deno.env.get("BILLING_VAT_RATE") ?? "0.18");
const CURRENCY = Deno.env.get("BILLING_CURRENCY") ?? "ILS";
const INCREMENT_MIN = Number(Deno.env.get("BILLING_INCREMENT_MINUTES") ?? "15");
const WEBHOOK_SECRET = Deno.env.get("VOICE_WEBHOOK_SECRET") ?? "";

interface CallData {
  callSid: string;
  callerPhone: string;
  durationSeconds: number;
  transcript: string;
}

interface Extraction {
  client_intent: "Inquiry" | "Consultation" | "Dispute" | "Support";
  summary: string;
  suggested_task: { title: string; priority: "High" | "Medium" | "Low"; due_days_offset: number };
  is_billable: boolean;
}

// ── billing ────────────────────────────────────────────────────────────────
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function billableHours(seconds: number, incMin = INCREMENT_MIN): number {
  if (seconds <= 0) return 0;
  const blocks = Math.ceil(seconds / (incMin * 60));
  return round2(blocks * (incMin / 60));
}

function billing(seconds: number) {
  const hours = billableHours(seconds);
  const net = round2(hours * HOURLY_RATE);
  const vat = round2(net * VAT_RATE);
  const gross = round2(net + vat);
  return { hours, net, vat, gross };
}

// ── platform adapters ────────────────────────────────────────────────────────
function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function parseVapi(p: any): CallData | null {
  const m = p?.message ?? {};
  if (m.type !== "end-of-call-report") return null;
  const call = m.call ?? {};
  const customer = m.customer ?? call.customer ?? {};
  let duration = m.durationSeconds;
  if (duration == null && m.startedAt && m.endedAt) {
    duration = (Number(m.endedAt) - Number(m.startedAt)) / 1000;
  }
  return {
    callSid: String(call.id ?? m.id ?? "unknown"),
    callerPhone: String(customer.number ?? "unknown"),
    durationSeconds: toInt(duration),
    transcript: String(m.artifact?.transcript ?? m.transcript ?? ""),
  };
}

function parseRetell(p: any): CallData | null {
  if (p?.event !== "call_ended") return null;
  const call = p.call ?? {};
  let duration: number | undefined;
  if (call.duration_ms != null) duration = Number(call.duration_ms) / 1000;
  else if (call.start_timestamp && call.end_timestamp) {
    duration = (Number(call.end_timestamp) - Number(call.start_timestamp)) / 1000;
  }
  return {
    callSid: String(call.call_id ?? "unknown"),
    callerPhone: String(call.from_number ?? "unknown"),
    durationSeconds: toInt(duration),
    transcript: String(call.transcript ?? ""),
  };
}

function parsePayload(p: any): CallData | null {
  if (p?.message) return parseVapi(p);
  if (p?.event) return parseRetell(p);
  // Native shape (same as the Python /webhook/livekit/ended).
  if (p?.call_sid) {
    return {
      callSid: String(p.call_sid),
      callerPhone: String(p.caller_phone ?? "unknown"),
      durationSeconds: toInt(p.duration_seconds),
      transcript: String(p.transcript ?? ""),
    };
  }
  return null;
}

// ── Claude extraction ────────────────────────────────────────────────────────
const TOOL = {
  name: "record_call_analysis",
  description: "Record the structured analysis of a completed client phone call.",
  input_schema: {
    type: "object",
    properties: {
      client_intent: { type: "string", enum: ["Inquiry", "Consultation", "Dispute", "Support"] },
      summary: { type: "string", description: "Under 100 words." },
      suggested_task: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
          due_days_offset: { type: "integer", minimum: 0, maximum: 365 },
        },
        required: ["title", "priority", "due_days_offset"],
      },
      is_billable: { type: "boolean" },
    },
    required: ["client_intent", "summary", "suggested_task", "is_billable"],
  },
};

const SYSTEM_PROMPT =
  "You are a legal-intake analyst for a boutique law firm. Read the transcript " +
  "of a completed client phone call and record a structured analysis by calling " +
  "record_call_analysis. Judge is_billable strictly: true only when substantive " +
  "professional or legal advice was actually discussed. Keep the summary under 100 words.";

function validateExtraction(e: any): Extraction {
  if (!e || !e.client_intent || !e.summary || typeof e.is_billable !== "boolean") {
    throw new Error("invalid extraction payload");
  }
  // Normalize the task: models occasionally return it partial. Fill safe
  // defaults instead of failing the whole call, and never leave undefined
  // (JSON.stringify drops undefined keys, breaking the RPC signature).
  const t = e.suggested_task ?? {};
  e.suggested_task = {
    title: typeof t.title === "string" && t.title.trim() ? t.title : "מעקב שיחה נכנסת",
    priority: ["High", "Medium", "Low"].includes(t.priority) ? t.priority : "Medium",
    due_days_offset: Number.isFinite(Number(t.due_days_offset))
      ? Math.min(365, Math.max(0, Math.round(Number(t.due_days_offset))))
      : 3,
  };
  return e as Extraction;
}

const USER_MSG = (t: string) => `Analyse this completed call transcript:\n\n${t}`;

async function extract(transcript: string): Promise<Extraction> {
  if (!transcript.trim()) throw new Error("empty transcript");
  return LLM_PROVIDER === "anthropic"
    ? extractAnthropic(transcript)
    : extractOpenAI(transcript);
}

async function extractOpenAI(transcript: string): Promise<Extraction> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_MSG(transcript) },
      ],
      tools: [{
        type: "function",
        function: { name: TOOL.name, description: TOOL.description, parameters: TOOL.input_schema },
      }],
      tool_choice: { type: "function", function: { name: TOOL.name } },
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) throw new Error("no tool call in OpenAI response");
  return validateExtraction(JSON.parse(tc.function.arguments));
}

async function extractAnthropic(transcript: string): Promise<Extraction> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_call_analysis" },
      messages: [{ role: "user", content: USER_MSG(transcript) }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const block = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!block) throw new Error("no tool call in Claude response");
  return validateExtraction(block.input);
}

// ── Supabase RPC ─────────────────────────────────────────────────────────────
async function ingest(args: Record<string, unknown>): Promise<any> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lalum_ingest_call`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!resp.ok) throw new Error(`RPC HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
}

function baseArgs(c: CallData) {
  return {
    p_call_sid: c.callSid,
    p_caller_phone: c.callerPhone,
    p_duration_seconds: c.durationSeconds,
    p_transcript: c.transcript,
    p_currency: CURRENCY,
  };
}

// ── handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-vapi-secret") ?? req.headers.get("x-webhook-secret");
    if (provided !== WEBHOOK_SECRET) return json({ error: "invalid webhook secret" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const call = parsePayload(payload);
  if (!call) return json({ status: "ignored", processed: false });

  try {
    const e = await extract(call.transcript);
    const b = e.is_billable ? billing(call.durationSeconds) : null;
    const result = await ingest({
      ...baseArgs(call),
      p_summary: e.summary,
      p_client_intent: e.client_intent,
      p_is_billable: e.is_billable,
      p_is_processed: true,
      p_process_error: null,
      p_task_title: e.suggested_task.title,
      p_task_priority: e.suggested_task.priority,
      p_due_days_offset: e.suggested_task.due_days_offset,
      p_billed_hours: b?.hours ?? null,
      p_hourly_rate: b ? HOURLY_RATE : null,
      p_net_amount: b?.net ?? null,
      p_vat_rate: b ? VAT_RATE : null,
      p_vat_amount: b?.vat ?? null,
      p_amount: b?.gross ?? null,
    });
    return json({
      status: "processed",
      call_sid: call.callSid,
      processed: true,
      client_id: result.client_id ?? null,
      call_id: result.call_id ?? null,
      created_lead: result.created_lead ?? null,
      is_billable: e.is_billable,
      billed_hours: b?.hours ?? null,
      net_amount: b?.net ?? null,
      vat_amount: b?.vat ?? null,
      amount: b?.gross ?? null,
    });
  } catch (err) {
    // Resiliency: store the raw call for a later retry instead of failing.
    const reason = String((err as any)?.message ?? err);
    const result = await ingest({
      ...baseArgs(call),
      p_summary: null,
      p_client_intent: null,
      p_is_billable: false,
      p_is_processed: false,
      p_process_error: reason,
      p_task_title: null,
      p_task_priority: null,
      p_due_days_offset: null,
      p_billed_hours: null,
      p_hourly_rate: null,
      p_net_amount: null,
      p_vat_rate: null,
      p_vat_amount: null,
      p_amount: null,
    });
    return json({
      status: "stored_unprocessed",
      call_sid: call.callSid,
      processed: false,
      client_id: result.client_id ?? null,
      call_id: result.call_id ?? null,
      created_lead: result.created_lead ?? null,
      detail: reason,
    });
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
