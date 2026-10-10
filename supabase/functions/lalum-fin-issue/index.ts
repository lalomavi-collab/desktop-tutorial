// lalum-fin-issue: issues a ledger draft as a legally numbered tax document through Invoice4U, and
// reconciles a document whose issuing outcome is uncertain (a timeout is not proof that nothing
// was issued). Invoice4U owns the numbering and the allocation number; the ledger stores the result.
//
// POST { document_id, action?: "issue" | "reconcile" }   (default "issue")
//
// Env (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected):
//   INVOICE4U_API_KEY   PRODUCTION organization API key (GUID); passed as `token` per the Invoice4U docs.
//                       Used only when FIN_INVOICE4U_ENV is "prod". It is never sent to the QA host.
//   FIN_INVOICE4U_QA_KEY  key of the Invoice4U QA account. Required in qa mode; without it the function refuses.
//   FIN_INVOICE4U_ENV   "qa" (default) or "prod". Separate from the clearing flow's INVOICE4U_ENV on purpose,
//                       so live payments cannot switch the books to live. Documents issued in qa are stamped is_test and
//                       never count in reports, so a rehearsal cannot pollute the books.
//
// Access: the draft is read with the caller's own JWT, so the same row level security that guards
// the ledger (firm partner or admin, MFA) decides who may issue. Writes use the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const DOC_TYPE: Record<string, number> = { PROFORMA: 5, INVOICE: 1, RECEIPT: 2, INVOICE_RECEIPT: 3, CREDIT: 4 };
const PAY_TYPE: Record<string, number> = { CARD: 1, CHEQUE: 2, TRANSFER: 3, CASH: 4, BIT: 8, PAYBOX: 9 };
const DOCUMENT_ALREADY_CREATED = 134;

type Obj = Record<string, unknown>;
interface I4uError { ID?: number; Error?: string }

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

  let body: { document_id?: string; action?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  const docId = String(body.document_id ?? "");
  const action = body.action === "reconcile" ? "reconcile" : "issue";
  if (!docId) return json(400, { code: "missing_document" });

  // RLS decides: only a firm partner or admin with MFA can read the row at all.
  const { data: doc } = await asUser.from("lalum_fin_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) return json(404, { code: "not_found" });
  const admin = createClient(url, serviceKey);

  async function call(op: string, payload: Obj): Promise<{ d: Obj; errors: I4uError[] }> {
    const res = await fetch(`${base}/${op}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, token: apiKey }),
    });
    const text = await res.text();
    let parsed: Obj = {};
    try { parsed = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON`); }
    const d = ((parsed.d as Obj) ?? parsed) as Obj;
    // Invoice4U reports business errors as HTTP 200 with a non-empty Errors array.
    return { d, errors: Array.isArray(d.Errors) ? (d.Errors as I4uError[]) : [] };
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
      const { d, errors } = await call("GetDocumentByApiIdentifier", {
        apiIdentifier: doc.api_identifier, docType: DOC_TYPE[doc.doc_type],
      });
      if (errors.length || !(typeof d.DocumentNumber === "number" && d.DocumentNumber > 0)) {
        return json(200, { ok: false, code: "not_found_at_provider", status: doc.status });
      }
      await store({
        ...fromDoc(d), status: "ISSUED", is_test: !prod, last_error: null,
        issued_at: doc.issued_at ?? new Date().toISOString(), issued_by: doc.issued_by ?? user.id,
      });
      return json(200, { ok: true, doc_number: d.DocumentNumber, allocation_number: d.AllocationNumber ?? null });
    }

    if (doc.status !== "DRAFT") return json(409, { code: "already_issued" });

    const { data: cust } = await asUser.from("lalum_fin_customers").select("*").eq("id", doc.customer_id).maybeSingle();
    if (!cust) return json(404, { code: "customer_not_found" });

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

    // Link the ledger customer to an Invoice4U customer, creating one only when none is linked.
    let clientId = cust.i4u_customer_id as number | null;
    if (!clientId) {
      const { d, errors } = await call("CreateCustomer", {
        cu: {
          Name: cust.name, UniqueID: cust.tax_id ?? "", Email: cust.email ?? "", Phone: cust.phone ?? "",
          Address: cust.address ?? "", City: cust.city ?? "", Active: true, PayTerms: 0, Retainer: false,
        },
      });
      const id = Number(d.ID);
      if (errors.length || !(id > 0)) {
        // A duplicate name is the expected case for a customer that already exists in Invoice4U.
        await store({ last_error: redact(`CUSTOMER_SYNC ${JSON.stringify(errors)} id=${d.ID}`, apiKey) });
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
      ClientID: clientId,
      Currency: "ILS",
      TaxIncluded: doc.tax_included,
      IssueDate: wcfDate(doc.issue_date),
      ApiIdentifier: `lalum-fin-${doc.id}`,
      Language: 1,
    };
    // A receipt carries no VAT of its own; the VAT sits on the invoice it settles.
    if (doc.doc_type !== "RECEIPT") invoiceDoc.TaxPercentage = Number(doc.vat_rate);
    if (doc.due_date) invoiceDoc.PaymentDueDate = wcfDate(doc.due_date);
    if (doc.doc_type !== "RECEIPT") invoiceDoc.Items = items;
    if (payments && (doc.doc_type === "RECEIPT" || doc.doc_type === "INVOICE_RECEIPT")) invoiceDoc.Payments = payments;
    if (related) {
      invoiceDoc.Invoices = [{ ID: related.i4u_doc_id, ReceiptAmount: payAmount }];
      invoiceDoc.DocumentReffType = DOC_TYPE[String(related.doc_type)];
    }
    if (doc.send_email && cust.email) invoiceDoc.AssociatedEmails = [{ Mail: cust.email, IsUserMail: false }];

    // Persist the idempotency key BEFORE the call: if the response is lost, reconcile can still find it.
    await store({ api_identifier: `lalum-fin-${doc.id}`, last_error: null });

    let result: { d: Obj; errors: I4uError[] };
    try {
      result = await call("CreateDocumentWithIdentifierValidation", { doc: invoiceDoc });
    } catch (e) {
      await store({ last_error: redact(`UNCERTAIN ${String(e)}`, apiKey) });
      return json(502, { code: "outcome_uncertain", hint: "reconcile" });
    }
    const { d, errors } = result;
    const alreadyCreated = errors.length > 0 && errors.every((x) => x.ID === DOCUMENT_ALREADY_CREATED)
      && typeof d.DocumentNumber === "number" && d.DocumentNumber > 0;
    if (errors.length && !alreadyCreated) {
      await store({ last_error: redact(`I4U_ERRORS ${JSON.stringify(errors)}`, apiKey) });
      return json(422, { code: "invoice4u_rejected", errors: errors.map((x) => ({ id: x.ID, error: x.Error })) });
    }

    // The document now legally exists. A mismatch with our own total is flagged, never hidden.
    const mismatch = typeof d.Total === "number" && Math.abs(d.Total - Number(doc.total)) > 0.01;
    await store({
      ...fromDoc(d), status: "ISSUED", is_test: !prod, issued_at: new Date().toISOString(), issued_by: user.id,
      last_error: mismatch ? `TOTAL_MISMATCH ledger=${doc.total} invoice4u=${d.Total}` : null,
    });
    return json(200, {
      ok: true, doc_number: d.DocumentNumber, allocation_number: d.AllocationNumber ?? null,
      pdf_url: d.PrintOriginalPDFLink ?? null, is_test: !prod, total_mismatch: mismatch,
    });
  } catch (e) {
    console.log("FIN_ISSUE_ERR " + redact(String(e), apiKey));
    return json(502, { code: "fetch_failed" });
  }
});
