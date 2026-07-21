// lalum-pay-webhook: server-to-server callback from Invoice4U after a clearing
// charge. Invoice4U POSTs here on both success and failure. We match the
// milestone by OrderIdClientUsage and mark it paid only on a clear success
// signal; every callback is logged so the exact field set can be confirmed
// against QA and the matching tightened if needed.
//
// Deployed with verify_jwt=false (Invoice4U cannot send a Supabase JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of Object.keys(obj)) {
    if (keys.some((want) => k.toLowerCase() === want.toLowerCase())) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).length) return String(v);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
  console.log("INVOICE4U_CALLBACK " + rawText.slice(0, 800));

  const milestoneId = pick(payload, ["OrderIdClientUsage", "more_info", "OrderId", "order_id"]);
  const paymentId = pick(payload, ["PaymentId", "payment_id", "ClearingConfirmationNumber", "TransactionId"]);
  const errorsRaw = payload["Errors"];
  const hasErrors = Array.isArray(errorsRaw) && errorsRaw.length > 0;
  const successFlag = pick(payload, ["IsSuccess", "Success", "IsPaid", "Status"]);
  const looksSuccessful = !hasErrors && (
    Boolean(paymentId) ||
    (successFlag !== null && ["true", "1", "success", "paid", "ok", "approved"].includes(successFlag.toLowerCase()))
  );

  if (url && serviceKey && milestoneId && looksSuccessful) {
    const admin = createClient(url, serviceKey);
    await admin.from("billing_milestones").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_intent_id: paymentId,
      updated_at: new Date().toISOString(),
    }).eq("id", milestoneId).neq("status", "paid");
  }

  // Always 200 so Invoice4U does not retry the callback.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
