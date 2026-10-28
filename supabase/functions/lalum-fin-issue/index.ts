// lalum-fin-issue: issues a ledger draft as a legally numbered tax document through Invoice4U, and
// reconciles a document whose issuing outcome is uncertain (a timeout is not proof that nothing
// was issued). Invoice4U owns the numbering and the allocation number; the ledger stores the result.
//
// POST { document_id, action?: "issue" | "reconcile" }   (default "issue")
// POST { firm_id, action: "check" }   asks Invoice4U for today's tax invoices, a read only call, to prove the key is accepted.
//
// Env (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected):
//   INVOICE4U_API_KEY   PRODUCTION organization API key (GUID); passed as `token` per the Invoice4U docs.
//                       Used only when FIN_INVOICE4U_ENV is "prod". It is never sent to the QA host.
//   FIN_INVOICE4U_QA_KEY  key of the Invoice4U QA account. Required in qa mode; without it the function refuses.
//   FIN_INVOICE4U_ENV   "qa" (default) or "prod". Separate from the clearing flow's INVOICE4U_ENV on purpose,
//                       so live payments cannot switch the books to live. Documents issued in qa are stamped is_test and
//                       never count in reports, so a rehearsal cannot pollute the books.
//
// Delivery: the moment a document is issued (or found issued by reconcile) it is sent to the customer by itself, by e-mail to the address on
// the customer card and by WhatsApp when the card has a valid mobile and a recorded consent. The send goes through lalum-fin-doc-send with
// the caller's own token (auto: true), which keeps the once-only rule and the send log. The reply carries `delivery` per channel; a failed
// send never undoes the issue, which is final, and the document panel can resend. Invoice4U's own mail (AssociatedEmails) is never used, so
// the customer does not receive two. A customer card without a valid e-mail address stops the issue before anything is created (customer_no_email).
//
// Access: the draft is read with the caller's own JWT, so the same row level security that guards
// the ledger (firm partner or admin, MFA) decides who may issue. Writes use the service role.
//
// Fresh second factor (T04): issuing a tax document is final, so "issue" also needs a second factor typed in the last 120 seconds, not only an
// aal2 session. The JWT's amr claim lists each method with the time it was used, and a code verified again in the same session adds a new entry
// (the same reading as lalum_mfa_age_seconds, migration 0080). A browser driven by an agent has a signed-in tab but not the code, so it cannot issue.
// Reconcile only records a document that already exists, so it is not gated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autoSendPlan, documentTemplateName } from "../_shared/docSend.ts";
import { isEmail } from "../_shared/dunning.ts";
import { readReply, replyProblem } from "../_shared/invoice4u.ts";
import type { Obj, Reply } from "../_shared/invoice4u.ts";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const FRESH_FACTOR_SECONDS = 120;
const FACTOR_METHODS = new Set(["totp", "phone", "webauthn", "mfa/totp", "mfa/phone", "mfa/webauthn"]);

/** Seconds since the newest second factor in the JWT's amr claim, or null when the token is not aal2 or carries none. The gateway (verify_jwt)
 *  and getUser have already checked the signature; this only reads the payload. */
export function secondFactorAge(authHeader: string, nowSec = Math.floor(Date.now() / 1000)): number | null {
  try {
    const part = authHeader.replace(/^Bearer\s+/i, "").split(".")[1] ?? "";
    const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    if (claims?.aal !== "aal2" || !Array.isArray(claims.amr)) return null;
    const stamps = claims.amr
      .filter((e: unknown) => !!e && typeof e === "object" && FACTOR_METHODS.has(String((e as Obj).method)) && Number.isInteger((e as Obj).timestamp))
      .map((e: Obj) => Number(e.timestamp));
    return stamps.length ? nowSec - Math.max(...stamps) : null;
  } catch { return null; }
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const DOC_TYPE: Record<string, number> = { PROFORMA: 5, INVOICE: 1, RECEIPT: 2, INVOICE_RECEIPT: 3, CREDIT: 4 };
const PAY_TYPE: Record<string, number> = { CARD: 1, CHEQUE: 2, TRANSFER: 3, CASH: 4, BIT: 8, PAYBOX: 9 };
const DOCUMENT_ALREADY_CREATED = 134;
const numbered = (d: Obj) => typeof d.DocumentNumber === "number" && d.DocumentNumber > 0;

// Invoice4U echoes requests in some error bodies; never let the key reach a log or the database.
const redact = (s: string, key: string) => s.split(key).join("[REDACTED]").slice(0, 1500);
const wcfDate = (iso: string) => `/Date(${Date.parse(`${iso}T12:00:00Z`)})/`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const prod = (Deno.env.get("FIN_INVOICE4U_ENV") ?? "qa").toLowerCase().startsWith("prod");
  // The production key must never travel to the QA host, so each mode reads its own secret.
  const apiKey = (prod ? Deno.env.get("INVOICE4U_API_KEY") : Deno.env.get("FIN_INVOICE4U_QA_KEY"))?.trim();
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceKey) return json(500, { code: "not_configured" });
  if (!apiKey) return json(500, { code: prod ? "invoice4u_not_configured" : "qa_key_missing" });
  const base = prod ? "https://api.invoice4u.co.il/Services/ApiService.svc" : "https://apiqa.invoice4u.co.il/Services/ApiService.svc";

  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  let body: { document_id?: string; firm_id?: string; action?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const docId = String(body.document_id ?? "");
  const action = body.action === "reconcile" ? "reconcile" : body.action === "check" ? "check" : "issue";

  async function call(op: string, payload: Obj): Promise<Reply> {
    const res = await fetch(`${base}/${op}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, token: apiKey }),
    });
    // Invoice4U reports business errors as HTTP 200 with a non-empty Errors array.
    return readReply(op, res.status, await res.text());
  }

  // CHECK: the same people who may issue may see whether Invoice4U accepts the key. Nothing is created or stored.
  if (action === "check") {
    const firmId = String(body.firm_id ?? "");
    const { data: can } = firmId ? await asUser.rpc("lalum_fin_can", { p_firm: firmId, p_min: 3 }) : { data: false };
    if (can !== true) return json(403, { code: "forbidden" });
    const today = new Date().toISOString().slice(0, 10);
    try {
      const r = await call("GetDocuments", { dr: { DocumentType: DOC_TYPE.INVOICE, From: wcfDate(today), To: wcfDate(today) } });
      const problem = replyProblem(r) ?? (r.errors.length ? "invoice4u_rejected" : null);
      console.log(`FIN_KEY_CHECK ${problem ?? "ok"} env=${prod ? "prod" : "qa"} ${r.shape}`);
      return json(200, problem
        ? { ok: false, code: problem, env: prod ? "prod" : "qa", errors: r.errors.map((x) => ({ id: x.ID, error: x.Error })) }
        : { ok: true, env: prod ? "prod" : "qa" });
    } catch (e) {
      console.log("FIN_KEY_CHECK_ERR " + redact(String(e), apiKey));
      return json(502, { code: "fetch_failed" });
    }
  }

  if (!docId) return json(400, { code: "missing_document" });
  if (action === "issue") {
    const age = secondFactorAge(authHeader);
    if (age === null || age < -60 || age > FRESH_FACTOR_SECONDS) return json(403, { code: "fresh_second_factor", window_seconds: FRESH_FACTOR_SECONDS });
  }

  // RLS decides who can read the row at all (finance level 1 or higher, behind MFA).
  const { data: doc } = await asUser.from("lalum_fin_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) return json(404, { code: "not_found" });
  // Reading is allowed from level 1; issuing, reconciling and cancelling need level 3 (issue).
  const { data: canIssue } = await asUser.rpc("lalum_fin_can", { p_firm: doc.firm_id, p_min: 3 });
  if (canIssue !== true) return json(403, { code: "forbidden" });
  const admin = createClient(url, serviceKey);

  type Channel = { status: "sent" | "skipped" | "failed" | "unknown"; code?: string };
  /** Sends the issued document on every channel the customer card allows. Never throws: the document already exists whatever happens here. */
  async function deliver(customerId: string, pdfUrl: string | null, isTest: boolean): Promise<Record<"email" | "whatsapp", Channel>> {
    const out: Record<"email" | "whatsapp", Channel> = { email: { status: "skipped", code: "not_attempted" }, whatsapp: { status: "skipped", code: "not_attempted" } };
    try {
      const { data: c } = await asUser.from("lalum_fin_customers").select("email, phone, whatsapp_consent_at, whatsapp_consent_revoked_at").eq("id", customerId).maybeSingle();
      const plan = autoSendPlan({
        email: c?.email ?? null, phone: c?.phone ?? null, consent: !!c?.whatsapp_consent_at && !c?.whatsapp_consent_revoked_at,
        templateConfigured: !!documentTemplateName((k) => Deno.env.get(k) ?? undefined), pdfUrl, isTest,
      });
      for (const s of plan.skipped) out[s.channel === "EMAIL" ? "email" : "whatsapp"] = { status: "skipped", code: s.reason };
      await Promise.all(plan.send.map(async (ch) => {
        const key = ch === "EMAIL" ? "email" : "whatsapp";
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
        try {
          const res = await fetch(`${url}/functions/v1/lalum-fin-doc-send`, {
            method: "POST", signal: ctl.signal, headers: { authorization: authHeader, apikey: anon, "content-type": "application/json" },
            body: JSON.stringify({ document_id: docId, auto: true, channel: ch, include_customer: true, copy_to_me: ch === "EMAIL" }),
          });
          const j = await res.json().catch(() => ({})) as { ok?: boolean; code?: string };
          out[key] = j.ok ? { status: "sent" } : j.code === "already_sent" ? { status: "skipped", code: "already_sent" } : { status: "failed", code: j.code ?? "send_failed" };
        } catch {
          // A timeout is not proof that nothing was sent: the send record was reserved before sending, so the log shows the truth.
          out[key] = { status: "unknown", code: "fetch_failed" };
        } finally { clearTimeout(timer); }
      }));
    } catch (e) { console.log("FIN_AUTOSEND_ERR " + String(e).slice(0, 120)); out.email = { status: "unknown", code: "fetch_failed" }; }
    return out;
  }

  async function store(fields: Obj) {
    await admin.from("lalum_fin_documents").update(fields).eq("id", docId);
  }
  const fromDoc = (d: Obj) => ({
    i4u_doc_id: d.ID ? String(d.ID) : null,
    doc_number: typeof d.DocumentNumber === "number" ? d.DocumentNumber : null,
    allocation_number: d.AllocationNumber ? String(d.AllocationNumber) : null,
    pdf_url: d.PrintOriginalPDFLink ? String(d.PrintOriginalPDFLink) : null,
  });

  try {
    // RECONCILE: ask Invoice4U whether this identifier already produced a document.
    if (action === "reconcile") {
      if (!doc.api_identifier) return json(409, { code: "never_attempted" });
      const r = await call("GetDocumentByApiIdentifier", {
        apiIdentifier: doc.api_identifier, docType: DOC_TYPE[doc.doc_type],
      });
      const { d, errors } = r;
      // A refused key proves nothing about the document, so it must not read as "not found".
      if (replyProblem(r) === "invoice4u_unauthorized") return json(200, { ok: false, code: "invoice4u_unauthorized", status: doc.status });
      if (errors.length || !numbered(d)) {
        return json(200, { ok: false, code: "not_found_at_provider", status: doc.status });
      }
      await store({
        ...fromDoc(d), status: "ISSUED", is_test: !prod, last_error: null,
        issued_at: doc.issued_at ?? new Date().toISOString(), issued_by: doc.issued_by ?? user.id,
      });
      const delivery = await deliver(String(doc.customer_id), d.PrintOriginalPDFLink ? String(d.PrintOriginalPDFLink) : null, !prod);
      return json(200, { ok: true, doc_number: d.DocumentNumber, allocation_number: d.AllocationNumber ?? null, delivery });
    }

    if (doc.status !== "DRAFT") return json(409, { code: "already_issued" });

    const { data: cust } = await asUser.from("lalum_fin_customers").select("*").eq("id", doc.customer_id).maybeSingle();
    if (!cust) return json(404, { code: "customer_not_found" });
    // Every document goes to the customer by itself, so the card must carry an address that can receive it.
    if (!isEmail(cust.email)) return json(409, { code: "customer_no_email" });

    // The referenced document, for receipts and credit invoices.
    let related: Obj | null = null;
    if (doc.doc_type === "RECEIPT" || doc.doc_type === "CREDIT") {
      const { data: r } = doc.related_doc_id
        ? await asUser.from("lalum_fin_documents").select("*").eq("id", doc.related_doc_id).maybeSingle()
        : { data: null };
      const okType = doc.doc_type === "RECEIPT" ? r?.doc_type === "INVOICE" : ["INVOICE", "INVOICE_RECEIPT"].includes(r?.doc_type);
      if (!r || r.status !== "ISSUED" || !r.i4u_doc_id || r.customer_id !== doc.customer_id || !okType || r.is_test !== !prod) {
        return json(409, { code: "bad_related_document" });
      }
      related = r;
    }

    // A casual customer has no card in Invoice4U: the document carries a name and an optional id instead.
    // The practice's history shows this only on invoice-receipts and credits, so nothing else is allowed.
    const casual = cust.is_casual === true;
    if (casual && !["INVOICE_RECEIPT", "CREDIT"].includes(doc.doc_type)) return json(409, { code: "casual_not_allowed" });

    // Link the ledger customer to an Invoice4U customer, creating one only when none is linked.
    let clientId = cust.i4u_customer_id as number | null;
    if (!casual && !clientId) {
      const r = await call("CreateCustomer", {
        cu: {
          Name: cust.name, UniqueID: cust.tax_id ?? "", Email: cust.email ?? "", Phone: cust.phone ?? "",
          Address: cust.address ?? "", City: cust.city ?? "", Active: true, PayTerms: 0, Retainer: false,
        },
      });
      const { d, errors } = r;
      const id = Number(d.ID);
      if (errors.length || !(id > 0)) {
        // Only a reply that names an error is a refusal of this customer (a duplicate name is the expected case for one that already exists
        // in Invoice4U). A refused key or a reply with nothing in it says nothing about the customer, and linking would not help.
        const problem = replyProblem(r) ?? (errors.length ? null : "provider_unreadable");
        await store({ last_error: redact(`CUSTOMER_SYNC ${problem ?? "REJECTED"} ${JSON.stringify(errors)} ${r.shape}`, apiKey) });
        console.log(`FIN_CUSTOMER_SYNC ${problem ?? "rejected"} ${r.shape}`);
        if (problem) return json(502, { code: problem });
        return json(502, { code: "customer_sync_failed", detail: errors[0]?.Error ?? "unknown", hint: "link_existing_customer" });
      }
      clientId = id;
      await admin.from("lalum_fin_customers").update({ i4u_customer_id: id }).eq("id", cust.id);
    }

    const items = (doc.lines as Array<{ name: string; qty: number; price: number }>).map((l) => ({
      Name: l.name, Quantity: l.qty, Price: l.price,
    }));
    const payAmount = Number(doc.total);
    const payments = doc.payment_method
      ? [{ PaymentType: PAY_TYPE[doc.payment_method], Amount: payAmount, Date: wcfDate(doc.issue_date), NumberOfPayments: 1, PaymentNumber: doc.payment_ref ?? "" }]
      : undefined;

    const invoiceDoc: Obj = {
      DocumentType: DOC_TYPE[doc.doc_type],
      Subject: doc.subject || undefined,
      Currency: "ILS",
      TaxIncluded: doc.tax_included,
      IssueDate: wcfDate(doc.issue_date),
      ApiIdentifier: `lalum-fin-${doc.id}`,
      Language: 1,
    };
    if (casual) invoiceDoc.GeneralCustomer = { Name: String(cust.name), Identifier: cust.tax_id ?? "" };
    else invoiceDoc.ClientID = clientId;
    // A receipt carries no VAT of its own; the VAT sits on the invoice it settles.
    if (doc.doc_type !== "RECEIPT") invoiceDoc.TaxPercentage = Number(doc.vat_rate);
    if (doc.due_date) invoiceDoc.PaymentDueDate = wcfDate(doc.due_date);
    if (doc.doc_type !== "RECEIPT") invoiceDoc.Items = items;
    if (payments && (doc.doc_type === "RECEIPT" || doc.doc_type === "INVOICE_RECEIPT")) invoiceDoc.Payments = payments;
    if (related) {
      invoiceDoc.Invoices = [{ ID: related.i4u_doc_id, ReceiptAmount: payAmount }];
      invoiceDoc.DocumentReffType = DOC_TYPE[String(related.doc_type)];
    }
    // No AssociatedEmails: Invoice4U would mail the customer too. Delivery is ours (deliver below), once, with a log.

    // Persist the idempotency key BEFORE the call: if the response is lost, reconcile can still find it.
    await store({ api_identifier: `lalum-fin-${doc.id}`, last_error: null });

    let result: Reply;
    try {
      result = await call("CreateDocumentWithIdentifierValidation", { doc: invoiceDoc });
    } catch (e) {
      await store({ last_error: redact(`UNCERTAIN ${String(e)}`, apiKey) });
      return json(502, { code: "outcome_uncertain", hint: "reconcile" });
    }
    const { d, errors } = result;
    // A refused key creates nothing: the draft stays a draft and can be issued once the key is fixed.
    if (replyProblem(result) === "invoice4u_unauthorized") {
      await store({ last_error: redact(`I4U_UNAUTHORIZED ${JSON.stringify(errors)}`, apiKey) });
      return json(502, { code: "invoice4u_unauthorized" });
    }
    const alreadyCreated = errors.length > 0 && errors.every((x) => x.ID === DOCUMENT_ALREADY_CREATED) && numbered(d);
    if (errors.length && !alreadyCreated) {
      await store({ last_error: redact(`I4U_ERRORS ${JSON.stringify(errors)}`, apiKey) });
      return json(422, { code: "invoice4u_rejected", errors: errors.map((x) => ({ id: x.ID, error: x.Error })) });
    }
    // No error and no number is not proof either way. The row is never marked issued without its number; reconcile asks Invoice4U.
    if (!numbered(d)) {
      await store({ last_error: redact(`UNCERTAIN NO_NUMBER ${result.shape}`, apiKey) });
      console.log(`FIN_ISSUE_NO_NUMBER ${result.shape}`);
      return json(502, { code: "outcome_uncertain", hint: "reconcile" });
    }

    // The document now legally exists. A mismatch with our own total is flagged, never hidden.
    const mismatch = typeof d.Total === "number" && Math.abs(d.Total - Number(doc.total)) > 0.01;
    await store({
      ...fromDoc(d), status: "ISSUED", is_test: !prod, issued_at: new Date().toISOString(), issued_by: user.id,
      last_error: mismatch ? `TOTAL_MISMATCH ledger=${doc.total} invoice4u=${d.Total}` : null,
    });
    const delivery = await deliver(String(doc.customer_id), d.PrintOriginalPDFLink ? String(d.PrintOriginalPDFLink) : null, !prod);
    return json(200, {
      ok: true, doc_number: d.DocumentNumber, allocation_number: d.AllocationNumber ?? null,
      pdf_url: d.PrintOriginalPDFLink ?? null, is_test: !prod, total_mismatch: mismatch, delivery,
    });
  } catch (e) {
    console.log("FIN_ISSUE_ERR " + redact(String(e), apiKey));
    return json(502, { code: "fetch_failed" });
  }
});
