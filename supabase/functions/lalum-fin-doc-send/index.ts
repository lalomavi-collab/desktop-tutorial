// lalum-fin-doc-send: sends one ISSUED finance document, or one history archive document, to the customer by e-mail, on a partner's explicit action.
//
// POST { document_id | archive_id, include_customer?: boolean, extra?: string | string[], copy_to_me?: boolean, subject?, body?, pdf_base64? }
//  * The customer's address is read from the customer record, never from the request. Extra addresses (up to 6 recipients in all) are
//    typed by the partner and each one is validated. The partner's own copy goes as bcc.
//  * An archive document (archive_id) has its customer found through the provider's client number, and its PDF link is asked of
//    lalum-fin-archive-pdf with the caller's own token. When that function has no link the call fails with archive_link_unavailable
//    and nothing is reserved or sent.
//  * pdf_base64 (archive documents only, up to 4 MB, must start with the PDF signature) is a PDF the partner downloaded from the history
//    system and attached by hand. It replaces the link lookup, so a history document can be sent while the provider returns no link. The
//    mail then carries the file and no link. A file on a ledger document is refused.
//  * The document must be ISSUED and have a PDF link. A TEST document (trial environment) can only be sent to the partner's own address.
//  * The PDF is attached when it can be fetched (https, up to 8 MB, 10 seconds). When it cannot, the mail still goes out with the link
//    and the reply says attached:false. The link is always in the body.
//  * The send record is kept by the database (lalum_fin_doc_send_reserve / lalum_fin_doc_send_finish): a row is reserved BEFORE sending,
//    so a double click cannot send twice, and marked SENT or FAILED after.
//  * WhatsApp is not sent from here. The screen opens WhatsApp with the message prepared and logs it through the same two functions,
//    because a business initiated WhatsApp text outside the 24 hour window must be an approved template (see lalum-fin-dunning-send).
//
// Automatic delivery (called by lalum-fin-issue the moment a document is issued, with the issuing partner's own token):
// POST { document_id, auto: true, channel?: "EMAIL" | "WHATSAPP", copy_to_me? }
//  * auto reserves through lalum_fin_doc_send_reserve_auto: once only per document and channel (a second call answers already_sent and sends
//    nothing), and WhatsApp needs the customer's recorded consent. The subject and the text are the defaults, never typed by anyone.
//  * channel WHATSAPP (auto only) sends the approved template WHATSAPP_DOCUMENT_TEMPLATE with the document type, number and link. Without a
//    configured template, a valid Israeli mobile, a link, or the customer's consent, nothing is reserved and the reply says why.
//  * A manual click on the screen still works as before, and a WhatsApp click is still the wa.me hand off.
//
// Delivery test (a partner proving the channels work, with Invoice4U and the ledger out of the picture):
// POST { test: true, channel?: "EMAIL" | "WHATSAPP", customer_id? }
//  * EMAIL goes to the signed in partner's own address only, marked [בדיקה], with a sample one page PDF attached.
//  * WHATSAPP (needs customer_id) sends the approved document template with sample values to the mobile on that customer's card, and only
//    with the customer's recorded consent. Point it at a card that carries your own mobile.
//  * Nothing is issued, reserved or logged, and no document or customer is created or changed. Hence nothing to delete afterwards.
//
// Env: RESEND_API_KEY, LALUM_FROM_EMAIL, LALUM_REPLY_TO, and for automatic WhatsApp WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//      WHATSAPP_DOCUMENT_TEMPLATE, WHATSAPP_DOCUMENT_LANG (default "he"). SUPABASE_URL and SUPABASE_ANON_KEY are injected.
// Access: finance level 3 with MFA, decided by the database with the caller's own JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ARCHIVE_TYPE, autoBody, cleanSubject, defaultSubject, docEmailHtml, documentTemplateName, documentTemplateParams, MAX_ATTACHMENT_BYTES, resolveRecipients, safeFilename, SAMPLE_PDF_BASE64, testEmailBody, testTemplateParams, validPdfBase64 } from "../_shared/docSend.ts";
import { isEmail, normalizeIsraeliPhone } from "../_shared/dunning.ts";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? undefined;

interface Sent { ok: boolean; ref: string | null; err: string | null }
/** One mail through Resend. The sender and reply address come from the environment, as for every mail from this function. */
async function postMail(msg: { to: string[]; bcc?: string[]; subject: string; html: string; attachments?: Array<{ filename: string; content: string }> }): Promise<Sent> {
  try {
    const from = env("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>", replyTo = env("LALUM_REPLY_TO") ?? "avraham@lalum.co";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ from, reply_to: replyTo, ...msg }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok, ref: (j as { id?: string }).id ?? null, err: res.ok ? null : `resend ${res.status}` };
  } catch (e) { return { ok: false, ref: null, err: `network ${(e as Error).name}` }; }
}
/** One approved template message through the WhatsApp Cloud API. */
async function postTemplate(to: string, name: string, params: string[]): Promise<Sent> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: { name, language: { code: env("WHATSAPP_DOCUMENT_LANG") ?? "he" }, components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }] },
      }),
    });
    const j = await res.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { code?: number } };
    return { ok: res.ok, ref: j.messages?.[0]?.id ?? null, err: res.ok ? null : `whatsapp ${res.status} ${j.error?.code ?? ""}`.trim() };
  } catch (e) { return { ok: false, ref: null, err: `network ${(e as Error).name}` }; }
}

function toBase64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The PDF as base64, or null when it is not https, too large, slow, or not a PDF. */
async function fetchPdf(url: string): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_ATTACHMENT_BYTES) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_ATTACHMENT_BYTES) return null;
    // %PDF
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) return null;
    return toBase64(buf);
  } catch { return null; } finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });
  const url = env("SUPABASE_URL"), anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) return json(500, { code: "not_configured" });

  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });
  const { data: firmId } = await asUser.rpc("lalum_my_firm_id");
  const { data: allowed } = firmId ? await asUser.rpc("lalum_fin_can", { p_firm: firmId, p_min: 3 }) : { data: false };
  if (!firmId || allowed !== true) return json(403, { code: "forbidden" });

  let b: { test?: boolean; customer_id?: string; auto?: boolean; channel?: string; document_id?: string; archive_id?: string; include_customer?: boolean; extra?: unknown; copy_to_me?: boolean; subject?: string; body?: string; pdf_base64?: string };
  try { b = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  // ---- delivery test: nothing is issued, reserved or logged ----
  if (b.test === true) {
    if (b.channel === "WHATSAPP") {
      if (!b.customer_id) return json(400, { code: "bad_request" });
      if (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_PHONE_NUMBER_ID")) return json(500, { code: "whatsapp_not_configured" });
      const { data: c } = await asUser.from("lalum_fin_customers").select("id, firm_id, phone, whatsapp_consent_at, whatsapp_consent_revoked_at").eq("id", b.customer_id).maybeSingle();
      if (!c || c.firm_id !== firmId) return json(404, { code: "customer_not_found" });
      if (!c.whatsapp_consent_at || c.whatsapp_consent_revoked_at) return json(422, { code: "no_whatsapp_consent" });
      const phone = normalizeIsraeliPhone(c.phone);
      if (!phone) return json(422, { code: "no_mobile" });
      const tpl = documentTemplateName(env);
      if (!tpl) return json(422, { code: "template_not_configured" });
      const r = await postTemplate(phone, tpl, testTemplateParams());
      if (!r.ok) { console.log("FIN_TEST_WA_ERR " + r.err); return json(502, { code: "send_failed", detail: r.err }); }
      return json(200, { ok: true, channel: "WHATSAPP", test: true, count: 1 });
    }
    if (!env("RESEND_API_KEY")) return json(500, { code: "mail_not_configured" });
    if (!isEmail(user.email)) return json(422, { code: "no_own_email" });
    const r = await postMail({
      to: [user.email.toLowerCase()], subject: "[בדיקה] בדיקת שליחה אוטומטית של מסמכים מ-LALUM",
      html: docEmailHtml(testEmailBody(), null, true), attachments: [{ filename: "lalum-delivery-test.pdf", content: SAMPLE_PDF_BASE64 }],
    });
    if (!r.ok) { console.log("FIN_TEST_MAIL_ERR " + r.err); return json(502, { code: "send_failed", detail: r.err }); }
    return json(200, { ok: true, channel: "EMAIL", test: true, count: 1, attached: true });
  }

  if (!b.document_id === !b.archive_id) return json(400, { code: "bad_request" });
  const auto = b.auto === true;
  const channel = b.channel === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
  // WhatsApp through the API is only the automatic path. A click on the screen opens WhatsApp itself (wa.me).
  if (auto && !b.document_id) return json(400, { code: "bad_request" });
  if (channel === "WHATSAPP" && !auto) return json(400, { code: "bad_request" });
  const body = String(b.body ?? "").trim();
  if (body.length > 2000) return json(400, { code: "bad_content" });
  // A hand attached PDF is only for archive documents, and only a real, small PDF.
  const hasUpload = b.pdf_base64 !== undefined && b.pdf_base64 !== null && b.pdf_base64 !== "";
  if (hasUpload && !b.archive_id) return json(400, { code: "bad_request" });
  if (hasUpload && !validPdfBase64(b.pdf_base64)) return json(400, { code: "bad_pdf" });
  if (channel === "EMAIL" && !env("RESEND_API_KEY")) return json(500, { code: "mail_not_configured" });
  if (channel === "WHATSAPP" && (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_PHONE_NUMBER_ID"))) return json(500, { code: "whatsapp_not_configured" });

  // ---- the document: a ledger document, or an archive document with its link asked of the archive function ----
  interface Target { id: string; docType: string; docNumber: number | null; pdfUrl: string | null; isTest: boolean; customerEmail: string | null; phone: string | null; consent: boolean }
  let t: Target;
  if (b.document_id) {
    const { data: d } = await asUser.from("lalum_fin_documents").select("id, firm_id, customer_id, doc_type, status, doc_number, pdf_url, is_test").eq("id", b.document_id).maybeSingle();
    if (!d || d.firm_id !== firmId) return json(404, { code: "not_found" });
    if (d.status !== "ISSUED") return json(409, { code: "not_issued" });
    if (!d.pdf_url) return json(409, { code: "no_pdf" });
    const { data: c } = await asUser.from("lalum_fin_customers").select("id, firm_id, email, phone, whatsapp_consent_at, whatsapp_consent_revoked_at").eq("id", d.customer_id).maybeSingle();
    if (!c || c.firm_id !== firmId) return json(404, { code: "customer_not_found" });
    t = { id: d.id, docType: d.doc_type, docNumber: d.doc_number, pdfUrl: d.pdf_url, isTest: d.is_test === true, customerEmail: c.email ?? null, phone: c.phone ?? null, consent: !!c.whatsapp_consent_at && !c.whatsapp_consent_revoked_at };
  } else {
    const { data: a } = await asUser.from("lalum_fin_archive").select("id, firm_id, i4u_doc_type, doc_number, i4u_client_id").eq("id", b.archive_id).maybeSingle();
    if (!a || a.firm_id !== firmId) return json(404, { code: "not_found" });
    // The archive keeps the provider's client number. A casual customer has none, so the partner types the address.
    let customerEmail: string | null = null;
    if (a.i4u_client_id) {
      const { data: c } = await asUser.from("lalum_fin_customers").select("email").eq("firm_id", firmId).eq("i4u_customer_id", a.i4u_client_id).maybeSingle();
      customerEmail = c?.email ?? null;
    }
    let link: string | null = null;
    // With a hand attached PDF the provider is not asked at all.
    if (!hasUpload) try {
      const res = await fetch(`${url}/functions/v1/lalum-fin-archive-pdf`, {
        method: "POST", headers: { authorization: req.headers.get("Authorization") ?? "", apikey: anon, "content-type": "application/json" },
        body: JSON.stringify({ archive_id: a.id }),
      });
      const j = await res.json().catch(() => ({})) as { ok?: boolean; url?: string };
      link = j.ok && typeof j.url === "string" ? j.url : null;
    } catch { link = null; }
    if (!hasUpload && !link) return json(409, { code: "archive_link_unavailable" });
    t = { id: a.id, docType: ARCHIVE_TYPE[Number(a.i4u_doc_type)] ?? "", docNumber: a.doc_number ?? null, pdfUrl: link, isTest: false, customerEmail, phone: null, consent: false };
  }

  const subject = `${t.isTest ? "[בדיקה] " : ""}${cleanSubject(b.subject, defaultSubject(t.docType, t.docNumber))}`;
  const text = auto && !body ? autoBody(t.docType, t.docNumber) : body;

  // ---- who gets it, decided before anything is reserved ----
  let to: string[] = [], bcc: string[] = [], waTo = "", waParams: string[] = [], waTemplate = "";
  if (channel === "EMAIL") {
    const r = resolveRecipients({
      customerEmail: t.customerEmail, includeCustomer: b.include_customer !== false, extra: b.extra, copyToMe: b.copy_to_me === true,
      ownEmail: user.email ?? null, testOnly: t.isTest,
    });
    if ("error" in r) return json(422, { code: r.error });
    to = r.to; bcc = r.bcc;
  } else {
    if (t.isTest) return json(422, { code: "test_document" });
    if (!t.consent) return json(422, { code: "no_whatsapp_consent" });
    const phone = normalizeIsraeliPhone(t.phone);
    if (!phone) return json(422, { code: "no_mobile" });
    const tpl = documentTemplateName(env);
    if (!tpl) return json(422, { code: "template_not_configured" });
    const params = documentTemplateParams(t.docType, t.docNumber, t.pdfUrl);
    if (!params) return json(422, { code: "no_pdf" });
    waTo = phone; waTemplate = tpl; waParams = params;
  }
  const recipientText = channel === "EMAIL" ? [...to, ...bcc.map((a) => `${a} (עותק)`)].join(", ") : `+${waTo}`;
  const logBody = channel === "EMAIL" ? text : `template ${waTemplate}: ${waParams.join(" | ")}`;

  // ---- reserve (double click guard + record) ----
  const { data: rowId, error: re } = auto
    ? await asUser.rpc("lalum_fin_doc_send_reserve_auto", { p_document: t.id, p_channel: channel, p_recipient: recipientText, p_subject: channel === "EMAIL" ? subject : null, p_body: logBody })
    : b.document_id
      ? await asUser.rpc("lalum_fin_doc_send_reserve", { p_document: t.id, p_channel: "EMAIL", p_recipient: recipientText, p_subject: subject, p_body: body })
      : await asUser.rpc("lalum_fin_doc_send_reserve_archive", { p_archive: t.id, p_channel: "EMAIL", p_recipient: recipientText, p_subject: subject, p_body: body });
  if (re) {
    const m = re.message ?? "";
    const code = ["DUPLICATE_SEND", "ALREADY_SENT", "FORBIDDEN", "NOT_ISSUED", "NO_RECIPIENT", "BAD_CHANNEL", "NO_WHATSAPP_CONSENT", "TEST_DOCUMENT"].find((k) => m.includes(k)) ?? "reserve_failed";
    return json(["DUPLICATE_SEND", "ALREADY_SENT"].includes(code) ? 409 : code === "FORBIDDEN" ? 403 : code === "NO_WHATSAPP_CONSENT" || code === "TEST_DOCUMENT" ? 422 : 400, { code: code.toLowerCase() });
  }

  // ---- send ----
  const pdf = channel !== "EMAIL" ? null : hasUpload ? (b.pdf_base64 as string) : t.pdfUrl ? await fetchPdf(t.pdfUrl) : null;
  const sent = channel === "EMAIL"
    ? await postMail({
      to, ...(bcc.length ? { bcc } : {}), subject, html: docEmailHtml(text, hasUpload ? null : t.pdfUrl, pdf !== null),
      ...(pdf ? { attachments: [{ filename: safeFilename(t.docType, t.docNumber), content: pdf }] } : {}),
    })
    : await postTemplate(waTo, waTemplate, waParams);
  const { ok, ref, err } = sent;

  // ---- record the outcome. If this fails after a send, say so: the mail did go out. ----
  const { error: fe } = await asUser.rpc("lalum_fin_doc_send_finish", { p_id: rowId as string, p_ok: ok, p_ref: ref, p_error: err });
  if (fe) { console.log("FIN_DOC_SEND_FINISH_ERR " + (fe.message ?? "").slice(0, 120)); if (ok) return json(200, { ok: true, channel, count: to.length + bcc.length || 1, attached: pdf !== null, warning: "log_incomplete" }); }
  if (!ok) { console.log("FIN_DOC_SEND_ERR " + err); return json(502, { code: "send_failed", detail: err }); }
  return json(200, { ok: true, channel, count: to.length + bcc.length || 1, attached: pdf !== null });
});
