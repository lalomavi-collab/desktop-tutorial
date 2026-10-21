// lalum-fin-doc-send: sends one ISSUED finance document, or one history archive document, to the customer by e-mail, on a partner's explicit action.
//
// POST { document_id | archive_id, include_customer?: boolean, extra?: string | string[], copy_to_me?: boolean, subject?, body? }
//  * The customer's address is read from the customer record, never from the request. Extra addresses (up to 6 recipients in all) are
//    typed by the partner and each one is validated. The partner's own copy goes as bcc.
//  * An archive document (archive_id) has its customer found through the provider's client number, and its PDF link is asked of
//    lalum-fin-archive-pdf with the caller's own token. When that function has no link the call fails with archive_link_unavailable
//    and nothing is reserved or sent.
//  * The document must be ISSUED and have a PDF link. A TEST document (trial environment) can only be sent to the partner's own address.
//  * The PDF is attached when it can be fetched (https, up to 8 MB, 10 seconds). When it cannot, the mail still goes out with the link
//    and the reply says attached:false. The link is always in the body.
//  * The send record is kept by the database (lalum_fin_doc_send_reserve / lalum_fin_doc_send_finish): a row is reserved BEFORE sending,
//    so a double click cannot send twice, and marked SENT or FAILED after.
//  * WhatsApp is not sent from here. The screen opens WhatsApp with the message prepared and logs it through the same two functions,
//    because a business initiated WhatsApp text outside the 24 hour window must be an approved template (see lalum-fin-dunning-send).
//
// Env: RESEND_API_KEY, LALUM_FROM_EMAIL, LALUM_REPLY_TO. SUPABASE_URL and SUPABASE_ANON_KEY are injected.
// Access: finance level 3 with MFA, decided by the database with the caller's own JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ARCHIVE_TYPE, cleanSubject, defaultSubject, docEmailHtml, MAX_ATTACHMENT_BYTES, resolveRecipients, safeFilename } from "../_shared/docSend.ts";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? undefined;

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

  let b: { document_id?: string; archive_id?: string; include_customer?: boolean; extra?: unknown; copy_to_me?: boolean; subject?: string; body?: string };
  try { b = await req.json(); } catch { return json(400, { code: "bad_json" }); }
  if (!b.document_id === !b.archive_id) return json(400, { code: "bad_request" });
  const body = String(b.body ?? "").trim();
  if (body.length > 2000) return json(400, { code: "bad_content" });
  if (!env("RESEND_API_KEY")) return json(500, { code: "mail_not_configured" });

  // ---- the document: a ledger document, or an archive document with its link asked of the archive function ----
  interface Target { id: string; docType: string; docNumber: number | null; pdfUrl: string; isTest: boolean; customerEmail: string | null }
  let t: Target;
  if (b.document_id) {
    const { data: d } = await asUser.from("lalum_fin_documents").select("id, firm_id, customer_id, doc_type, status, doc_number, pdf_url, is_test").eq("id", b.document_id).maybeSingle();
    if (!d || d.firm_id !== firmId) return json(404, { code: "not_found" });
    if (d.status !== "ISSUED") return json(409, { code: "not_issued" });
    if (!d.pdf_url) return json(409, { code: "no_pdf" });
    const { data: c } = await asUser.from("lalum_fin_customers").select("id, firm_id, email").eq("id", d.customer_id).maybeSingle();
    if (!c || c.firm_id !== firmId) return json(404, { code: "customer_not_found" });
    t = { id: d.id, docType: d.doc_type, docNumber: d.doc_number, pdfUrl: d.pdf_url, isTest: d.is_test === true, customerEmail: c.email ?? null };
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
    try {
      const res = await fetch(`${url}/functions/v1/lalum-fin-archive-pdf`, {
        method: "POST", headers: { authorization: req.headers.get("Authorization") ?? "", apikey: anon, "content-type": "application/json" },
        body: JSON.stringify({ archive_id: a.id }),
      });
      const j = await res.json().catch(() => ({})) as { ok?: boolean; url?: string };
      link = j.ok && typeof j.url === "string" ? j.url : null;
    } catch { link = null; }
    if (!link) return json(409, { code: "archive_link_unavailable" });
    t = { id: a.id, docType: ARCHIVE_TYPE[Number(a.i4u_doc_type)] ?? "", docNumber: a.doc_number ?? null, pdfUrl: link, isTest: false, customerEmail };
  }

  const r = resolveRecipients({
    customerEmail: t.customerEmail, includeCustomer: b.include_customer !== false, extra: b.extra, copyToMe: b.copy_to_me === true,
    ownEmail: user.email ?? null, testOnly: t.isTest,
  });
  if ("error" in r) return json(422, { code: r.error });

  const subject = `${t.isTest ? "[בדיקה] " : ""}${cleanSubject(b.subject, defaultSubject(t.docType, t.docNumber))}`;
  const recipientText = [...r.to, ...r.bcc.map((a) => `${a} (עותק)`)].join(", ");

  // ---- reserve (double click guard + record) ----
  const { data: rowId, error: re } = b.document_id
    ? await asUser.rpc("lalum_fin_doc_send_reserve", { p_document: t.id, p_channel: "EMAIL", p_recipient: recipientText, p_subject: subject, p_body: body })
    : await asUser.rpc("lalum_fin_doc_send_reserve_archive", { p_archive: t.id, p_channel: "EMAIL", p_recipient: recipientText, p_subject: subject, p_body: body });
  if (re) {
    const m = re.message ?? "";
    const code = ["DUPLICATE_SEND", "FORBIDDEN", "NOT_ISSUED", "NO_RECIPIENT", "BAD_CHANNEL"].find((k) => m.includes(k)) ?? "reserve_failed";
    return json(code === "DUPLICATE_SEND" ? 409 : code === "FORBIDDEN" ? 403 : 400, { code: code.toLowerCase() });
  }

  // ---- send ----
  const pdf = await fetchPdf(t.pdfUrl);
  let ok = false, ref: string | null = null, err: string | null = null;
  try {
    const from = env("LALUM_FROM_EMAIL") ?? "LALUM <no-reply@lalumapp.com>", replyTo = env("LALUM_REPLY_TO") ?? "avraham@lalum.co";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        from, reply_to: replyTo, to: r.to, ...(r.bcc.length ? { bcc: r.bcc } : {}), subject, html: docEmailHtml(body, t.pdfUrl, pdf !== null),
        ...(pdf ? { attachments: [{ filename: safeFilename(t.docType, t.docNumber), content: pdf }] } : {}),
      }),
    });
    const j = await res.json().catch(() => ({}));
    ok = res.ok; ref = (j as { id?: string }).id ?? null; if (!ok) err = `resend ${res.status}`;
  } catch (e) { err = `network ${(e as Error).name}`; }

  // ---- record the outcome. If this fails after a send, say so: the mail did go out. ----
  const { error: fe } = await asUser.rpc("lalum_fin_doc_send_finish", { p_id: rowId as string, p_ok: ok, p_ref: ref, p_error: err });
  if (fe) { console.log("FIN_DOC_SEND_FINISH_ERR " + (fe.message ?? "").slice(0, 120)); if (ok) return json(200, { ok: true, count: r.to.length + r.bcc.length, attached: pdf !== null, warning: "log_incomplete" }); }
  if (!ok) { console.log("FIN_DOC_SEND_ERR " + err); return json(502, { code: "send_failed", detail: err }); }
  return json(200, { ok: true, count: r.to.length + r.bcc.length, attached: pdf !== null });
});
