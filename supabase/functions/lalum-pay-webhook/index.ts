// lalum-pay-webhook: server-to-server callback from Invoice4U after a clearing
// charge. Invoice4U POSTs here on both success and failure. We match the
// milestone by OrderIdClientUsage and mark it paid only on a clear success
// signal; every callback is logged so the exact field set can be confirmed
// against QA and the matching tightened if needed.
//
// Deployed with verify_jwt=false (Invoice4U cannot send a Supabase JWT). Because
// there is no JWT, the callback is authenticated with a shared secret token that
// lalum-pay-create bakes into the CallBackUrl query string (?t=SECRET). Without
// it, anyone who learns a milestone id could POST here and flip an invoice to
// "paid" without paying. The endpoint is fail-closed: if PAY_WEBHOOK_SECRET is
// unset, or the token does not match, the request is rejected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Constant-time comparison over SHA-256 digests, so neither the secret's
// content nor its length leaks through timing.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da), y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of Object.keys(obj)) {
    if (keys.some((want) => k.toLowerCase() === want.toLowerCase())) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).length) return String(v);
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

// A payment that was not applied, or applied without its amount checked, has to
// reach a person: the function log is gone after a day. The note goes on the
// milestone (shown on the payments screen) and into the firm's audit log, with
// amounts and ids only, never the payer's details.
async function flag(admin: Admin, milestoneId: string, action: "PAY_AMOUNT_MISMATCH" | "PAY_AMOUNT_UNVERIFIED", meta: Record<string, string | number | null>) {
  const note = `${action} ${Object.entries(meta).map(([k, v]) => `${k}=${v ?? "?"}`).join(" ")}`.slice(0, 300);
  const { data: ms } = await admin.from("billing_milestones").update({ last_error: note, updated_at: new Date().toISOString() })
    .eq("id", milestoneId).select("created_by").maybeSingle();
  // Milestones carry no firm; the firm is the one of the member who created it.
  const createdBy = (ms as { created_by?: string | null } | null)?.created_by;
  if (!createdBy) return;
  const { data: m } = await admin.from("lalum_firm_members").select("firm_id").eq("user_id", createdBy).limit(1).maybeSingle();
  const firm = (m as { firm_id?: string } | null)?.firm_id;
  if (!firm) return;
  const { error } = await admin.rpc("lalum_append_audit", {
    p_firm: firm, p_matter: null, p_actor: null, p_action: action, p_ai_hash: null, p_meta: { milestone_id: milestoneId, ...meta },
  });
  if (error) console.log(`PAY_AUDIT_FAILED milestone=${milestoneId}`);
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Authenticate the callback with the shared secret before doing anything.
  const secret = Deno.env.get("PAY_WEBHOOK_SECRET")?.trim();
  const provided = new URL(req.url).searchParams.get("t") ?? req.headers.get("x-webhook-token") ?? "";
  if (!secret || !(await safeEqual(provided, secret))) {
    console.log("PAY_WEBHOOK_UNAUTHORIZED");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Accept JSON or form-encoded bodies.
  let payload: Record<string, unknown> = {};
  const rawText = await req.text().catch(() => "");
  try {
    payload = JSON.parse(rawText);
  } catch {
    try {
      payload = Object.fromEntries(new URLSearchParams(rawText));
    } catch { /* leave empty */ }
  }
  if (payload && typeof payload === "object" && "d" in payload) {
    payload = (payload as Record<string, unknown>).d as Record<string, unknown>;
  }

  const milestoneId = pick(payload, ["OrderIdClientUsage", "more_info", "OrderId", "order_id"]);
  const paymentId = pick(payload, ["PaymentId", "payment_id", "ClearingConfirmationNumber", "TransactionId"]);
  const errorsRaw = payload["Errors"];
  const hasErrors = Array.isArray(errorsRaw) && errorsRaw.length > 0;
  const successFlag = pick(payload, ["IsSuccess", "Success", "IsPaid", "Status"]);
  const looksSuccessful = !hasErrors && (
    Boolean(paymentId) ||
    (successFlag !== null && ["true", "1", "success", "paid", "ok", "approved"].includes(successFlag.toLowerCase()))
  );

  // Log only non-PII identifiers, never the raw payload (it carries the payer's
  // name, phone and email).
  console.log(`INVOICE4U_CALLBACK milestone=${milestoneId ?? "?"} ok=${looksSuccessful}`);

  if (url && serviceKey && milestoneId && looksSuccessful) {
    const admin = createClient(url, serviceKey);

    // Cross-check the amount against the milestone when the callback carries
    // one. A callback with a valid token but a different sum is not a payment
    // of this milestone. When the callback carries no amount field we proceed
    // as before and log it, so a real payment is never blocked by a field name
    // we have not seen.
    const paidRaw = pick(payload, ["Sum", "Amount", "TotalSum", "Total", "PaidSum"]);
    if (paidRaw !== null) {
      const { data: ms } = await admin.from("billing_milestones").select("amount, currency").eq("id", milestoneId).maybeSingle();
      const paid = Number(paidRaw.replace(/,/g, ""));
      if (!ms || !Number.isFinite(paid) || Math.abs(paid - Number(ms.amount)) > 0.01) {
        console.log(`PAY_AMOUNT_MISMATCH milestone=${milestoneId}`);
        if (ms) {
          await flag(admin, milestoneId, "PAY_AMOUNT_MISMATCH", {
            received: Number.isFinite(paid) ? paid : null, expected: Number(ms.amount), currency: ms.currency ?? null, payment: paymentId,
          });
        }
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    } else {
      console.log(`PAY_AMOUNT_UNVERIFIED milestone=${milestoneId}`);
    }
    const { data: updated } = await admin.from("billing_milestones").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_intent_id: paymentId,
      updated_at: new Date().toISOString(),
    }).eq("id", milestoneId).neq("status", "paid").select("id");
    // Only the callback that actually marked it paid is flagged, so a repeated callback adds no second entry.
    if (paidRaw === null && updated?.length) await flag(admin, milestoneId, "PAY_AMOUNT_UNVERIFIED", { payment: paymentId });
  }

  // Always 200 so Invoice4U does not retry the callback.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
