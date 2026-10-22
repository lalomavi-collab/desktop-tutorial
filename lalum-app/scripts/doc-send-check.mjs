// Checks the helpers behind sending a finance document, attaching a PDF by hand and tracking it (supabase/functions/_shared/docSend.ts, resendEvents.ts and src/lib/cockpit/financeSend.ts).
// Run with: npm run doc-send-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createHmac } from "node:crypto";
import { resolveRecipients, splitAddresses, cleanSubject, docEmailHtml, safeFilename, defaultSubject as srvSubject, ARCHIVE_TYPE, validPdfBase64, MAX_UPLOAD_BYTES } from "../../supabase/functions/_shared/docSend.ts";
import { verifySvix, mapEvent, TRACKED_EVENTS } from "../../supabase/functions/_shared/resendEvents.ts";
import { normalizeIsraeliPhone } from "../../supabase/functions/_shared/dunning.ts";

const t = async (name, fn) => { await fn(); console.log(`[PASS] ${name}`); };

// The client helpers import ./finance, so transpile both into one temp folder.
const dir = mkdtempSync(join(tmpdir(), "docsend-"));
for (const f of ["finance", "financeSend"]) {
  const src = readFileSync(new URL(`../src/lib/cockpit/${f}.ts`, import.meta.url), "utf8");
  writeFileSync(join(dir, `${f}.js`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText.replace(/from "\.\/finance"/g, 'from "./finance.js"'));
}
const c = await import(pathToFileURL(join(dir, "financeSend.js")).href);

const base = { customerEmail: "Client@Example.com", includeCustomer: true, extra: "", copyToMe: false, ownEmail: "me@lalum.co", testOnly: false };
await t("the customer address comes from the record, lower cased, and nothing else is added", () => {
  assert.deepEqual(resolveRecipients(base), { to: ["client@example.com"], bcc: [] });
});
await t("an own copy goes as bcc, and is not repeated when it is already a recipient", () => {
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true }), { to: ["client@example.com"], bcc: ["me@lalum.co"] });
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true, extra: "me@lalum.co" }), { to: ["client@example.com", "me@lalum.co"], bcc: [] });
});
await t("extra addresses split on commas, spaces and semicolons, and duplicates collapse", () => {
  assert.deepEqual(splitAddresses("a@b.co, c@d.co;e@f.co\ng@h.co"), ["a@b.co", "c@d.co", "e@f.co", "g@h.co"]);
  assert.deepEqual(resolveRecipients({ ...base, extra: "x@y.co, CLIENT@example.com" }).to, ["client@example.com", "x@y.co"]);
});
await t("a bad extra address is refused, even when the rest is fine", () => {
  assert.deepEqual(resolveRecipients({ ...base, extra: "x@y.co, nope" }), { error: "bad_address" });
});
await t("no customer address and nothing else chosen is an error, not a silent send", () => {
  assert.deepEqual(resolveRecipients({ ...base, customerEmail: null }), { error: "no_email" });
  assert.deepEqual(resolveRecipients({ ...base, includeCustomer: false }), { error: "no_recipient" });
  assert.deepEqual(resolveRecipients({ ...base, includeCustomer: false, copyToMe: true }), { to: ["me@lalum.co"], bcc: [] });
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true, ownEmail: null }), { error: "no_own_email" });
});
await t("more than six recipients are refused", () => {
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true, extra: "a@b.co,c@d.co,e@f.co,g@h.co,i@j.co,k@l.co" }), { error: "too_many" });
  assert.equal(resolveRecipients({ ...base, extra: "a@b.co,c@d.co,e@f.co,g@h.co,i@j.co" }).to.length, 6);
});
await t("a test document can only go to the partner's own address, whatever was asked", () => {
  assert.deepEqual(resolveRecipients({ ...base, testOnly: true, extra: "x@y.co", copyToMe: true }), { to: ["me@lalum.co"], bcc: [] });
  assert.deepEqual(resolveRecipients({ ...base, testOnly: true, ownEmail: null }), { error: "no_own_email" });
});
await t("the subject is one line, capped, with a fallback", () => {
  assert.equal(cleanSubject("a\r\nBcc: x@y.co", "f"), "a Bcc: x@y.co");
  assert.equal(cleanSubject("   ", "fallback"), "fallback");
  assert.equal(cleanSubject("x".repeat(500), "f").length, 150);
});
await t("the body is escaped and the link is only an https link", () => {
  const h = docEmailHtml("שלום\n\n<img src=x onerror=alert(1)>", "https://example.com/a.pdf?x=1&y=2", true);
  assert.ok(!h.includes("<img")); assert.ok(h.includes("&lt;img")); assert.ok(h.includes('dir="rtl"')); assert.ok(h.includes("x=1&amp;y=2"));
  assert.ok(!docEmailHtml("שלום", "javascript:alert(1)", false).includes("<a "));
  assert.ok(!docEmailHtml("שלום", "http://example.com/a.pdf", false).includes("<a "));
  assert.ok(!docEmailHtml("שלום", null, false).includes("<a "));
});
await t("the attachment name is plain ASCII", () => {
  assert.equal(safeFilename("INVOICE_RECEIPT", 70145), "tax-invoice-receipt-70145.pdf");
  assert.ok(/^[\x20-\x7e]+$/.test(safeFilename("WHATEVER", null)));
});
await t("server and screen build the same default subject", () => {
  for (const type of ["PROFORMA", "INVOICE", "RECEIPT", "INVOICE_RECEIPT", "CREDIT"]) assert.equal(c.defaultSubject({ doc_type: type, doc_number: 10012 }), srvSubject(type, 10012));
});
await t("the screen and the server agree on what a WhatsApp mobile is", () => {
  for (const raw of ["052-1234567", "+972 52 123 4567", "00972521234567", "03-1234567", "+12025550123", "0521234", "", null]) assert.equal(c.waNumber(raw), normalizeIsraeliPhone(raw), String(raw));
});
await t("the WhatsApp link carries the encoded message, and opens the contact picker without a valid mobile", () => {
  const text = "שלום & להתראות\nhttps://x.co/a.pdf?q=1";
  const withPhone = c.whatsappUrl("052-1234567", text);
  assert.ok(withPhone.startsWith("https://wa.me/972521234567?text=")); assert.equal(decodeURIComponent(withPhone.split("?text=")[1]), text);
  assert.ok(c.whatsappUrl("03-1234567", text).startsWith("https://wa.me/?text="));
  assert.ok(c.whatsappUrl(null, text).startsWith("https://wa.me/?text="));
});
await t("only an issued document with a PDF link can be sent", () => {
  assert.equal(c.canSend({ status: "ISSUED", pdf_url: "https://x" }), true);
  assert.equal(c.canSend({ status: "ISSUED", pdf_url: null }), false);
  assert.equal(c.canSend({ status: "DRAFT", pdf_url: "https://x" }), false);
});
await t("the send summary counts only successful sends, per channel, newest day", () => {
  const s = [
    { channel: "EMAIL", status: "FAILED", created_at: "2026-10-20T10:00:00Z" },
    { channel: "EMAIL", status: "SENT", created_at: "2026-10-18T10:00:00Z" },
    { channel: "EMAIL", status: "SENT", created_at: "2026-10-19T10:00:00Z" },
    { channel: "WHATSAPP", status: "PENDING", created_at: "2026-10-21T10:00:00Z" },
  ];
  assert.deepEqual(c.sendSummary(s), { email: "2026-10-19" });
});
await await t("the default texts name the document and never a customer", () => {
  const b = c.defaultBody({ doc_type: "INVOICE", doc_number: 90094 });
  assert.ok(b.includes("חשבונית מס מספר 90094")); assert.ok(b.includes("ד״ר עו״ד אברהם ללום")); assert.ok(!/[—–]/.test(b));
});

// ---- delivery and open status, and the archive ----
const secretRaw = Buffer.from("a-test-secret-of-some-length-0123456789").toString("base64");
const secret = `whsec_${secretRaw}`;
const sign = (id, ts, body, sec = secretRaw) => `v1,${createHmac("sha256", Buffer.from(sec, "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;
const NOW = 1_800_000_000;
const body = JSON.stringify({ type: "email.opened", created_at: "2026-10-22T10:00:00.000Z", data: { email_id: "abc-123" } });

await t("a correctly signed webhook verifies, with or without the whsec_ prefix", async () => {
  const h = { id: "msg_1", timestamp: String(NOW), signature: sign("msg_1", NOW, body) };
  assert.equal(await verifySvix(secret, h, body, NOW), true);
  assert.equal(await verifySvix(secretRaw, h, body, NOW), true);
});
await t("a changed body, id, timestamp or secret does not verify", async () => {
  const h = { id: "msg_1", timestamp: String(NOW), signature: sign("msg_1", NOW, body) };
  assert.equal(await verifySvix(secret, h, body + " ", NOW), false);
  assert.equal(await verifySvix(secret, { ...h, id: "msg_2" }, body, NOW), false);
  assert.equal(await verifySvix(secret, { ...h, timestamp: String(NOW + 1) }, body, NOW), false);
  assert.equal(await verifySvix(`whsec_${Buffer.from("another-secret-0123456789").toString("base64")}`, h, body, NOW), false);
});
await t("an old capture is not accepted again (replay), a small clock difference is", async () => {
  const h = { id: "msg_1", timestamp: String(NOW), signature: sign("msg_1", NOW, body) };
  assert.equal(await verifySvix(secret, h, body, NOW + 299), true);
  assert.equal(await verifySvix(secret, h, body, NOW + 301), false);
  assert.equal(await verifySvix(secret, h, body, NOW - 301), false);
});
await t("missing headers, an empty secret or a malformed signature never verify", async () => {
  const good = sign("msg_1", NOW, body);
  assert.equal(await verifySvix(secret, { id: null, timestamp: String(NOW), signature: good }, body, NOW), false);
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: null, signature: good }, body, NOW), false);
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: String(NOW), signature: null }, body, NOW), false);
  assert.equal(await verifySvix("", { id: "msg_1", timestamp: String(NOW), signature: good }, body, NOW), false);
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: "soon", signature: good }, body, NOW), false);
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: String(NOW), signature: "v2," + good.slice(3) }, body, NOW), false);
  assert.equal(await verifySvix(secret, { id: "msg_1", timestamp: String(NOW), signature: "v1," }, body, NOW), false);
});
await t("during a secret rotation either signature in the header verifies", async () => {
  const old = sign("msg_1", NOW, body, Buffer.from("old-secret-0123456789").toString("base64"));
  const h = { id: "msg_1", timestamp: String(NOW), signature: `${old} ${sign("msg_1", NOW, body)}` };
  assert.equal(await verifySvix(secret, h, body, NOW), true);
});
await t("only the four tracked events map, and each needs a message id and a time", () => {
  assert.deepEqual([...TRACKED_EVENTS], ["email.delivered", "email.opened", "email.bounced", "email.complained"]);
  assert.deepEqual(mapEvent({ type: "email.opened", created_at: "2026-10-22T10:00:00.000Z", data: { email_id: "abc" } }), { ref: "abc", event: "email.opened", at: "2026-10-22T10:00:00.000Z" });
  assert.equal(mapEvent({ type: "email.delivered", data: { email_id: "abc", created_at: "2026-10-22T10:00:00Z" } }).at, "2026-10-22T10:00:00.000Z");
  for (const bad of [null, "x", {}, { type: "email.sent", created_at: "2026-10-22T10:00:00Z", data: { email_id: "a" } }, { type: "email.clicked", created_at: "2026-10-22T10:00:00Z", data: { email_id: "a" } },
    { type: "email.opened", created_at: "2026-10-22T10:00:00Z", data: {} }, { type: "email.opened", created_at: "2026-10-22T10:00:00Z" }, { type: "email.opened", created_at: "not a date", data: { email_id: "a" } },
    { type: "email.opened", created_at: "2026-10-22T10:00:00Z", data: { email_id: "x".repeat(201) } }]) assert.equal(mapEvent(bad), null, JSON.stringify(bad));
});
await t("the delivery state names the strongest known fact, and never says not opened", () => {
  const base = { id: "1", document_id: "d", archive_id: null, channel: "EMAIL", recipient: "a@b.co", subject: null, status: "SENT", error: null, created_at: "2026-10-22T10:00:00Z", delivered_at: null, opened_at: null, bounced_at: null, complained_at: null };
  assert.deepEqual(c.deliveryState(base), { text: "נשלח", tone: "green" });
  assert.equal(c.deliveryState({ ...base, delivered_at: "2026-10-22T10:01:00Z" }).text, "נמסר");
  assert.equal(c.deliveryState({ ...base, delivered_at: "2026-10-22T10:01:00Z", opened_at: "2026-10-22T11:00:00Z" }).text, "נפתח");
  assert.deepEqual(c.deliveryState({ ...base, delivered_at: "x", bounced_at: "2026-10-22T10:02:00Z" }), { text: "חזר, לא נמסר", tone: "red" });
  assert.equal(c.deliveryState({ ...base, complained_at: "2026-10-22T10:02:00Z" }).tone, "red");
  assert.equal(c.deliveryState({ ...base, status: "FAILED" }).tone, "red");
  assert.equal(c.deliveryState({ ...base, status: "PENDING" }).tone, "yellow");
  assert.equal(c.deliveryState({ ...base, channel: "WHATSAPP" }).text, "נפתח ב-WhatsApp");
  for (const s of [base, { ...base, delivered_at: "x" }]) assert.ok(!c.deliveryState(s).text.includes("לא נפתח"));
});
await t("the summary carries the latest known open and a bounce, only from successful sends", () => {
  const row = (o) => ({ channel: "EMAIL", status: "SENT", created_at: "2026-10-18T10:00:00Z", opened_at: null, bounced_at: null, ...o });
  assert.deepEqual(c.sendSummary([row({ opened_at: "2026-10-19T09:00:00Z" }), row({ opened_at: "2026-10-20T09:00:00Z" })]), { email: "2026-10-18", opened: "2026-10-20" });
  assert.deepEqual(c.sendSummary([row({ bounced_at: "2026-10-18T10:05:00Z" })]), { email: "2026-10-18", bounced: true });
  assert.deepEqual(c.sendSummary([row({ status: "FAILED", opened_at: "2026-10-19T09:00:00Z" })]), {});
});
await t("the archive's provider type codes mean the same on the server and on the screen, and unknown codes read as a plain document", () => {
  for (const n of [1, 2, 3, 4, 5]) assert.equal(c.ARCHIVE_DOC_TYPE[n], ARCHIVE_TYPE[n]);
  assert.equal(c.ARCHIVE_DOC_TYPE[9], undefined);
  assert.equal(c.defaultSubject({ doc_type: null, doc_number: 7 }), "מסמך מספר 7 מ-LALUM");
  assert.ok(c.defaultBody({ doc_type: null, doc_number: null }).includes("מצורף מסמך."));
  assert.ok(c.waText({ doc_type: "INVOICE", doc_number: 5 }, "https://x.co/a.pdf").endsWith("https://x.co/a.pdf"));
});

// ---- a PDF attached by hand to an archive document ----
const pdfOf = (n) => { const b = Buffer.alloc(n, 0x20); b.write("%PDF-1.7\n", 0); return b.toString("base64"); };
await t("a real small PDF passes, and the exact size limit passes while one byte more does not", () => {
  assert.equal(validPdfBase64(pdfOf(2000)), true);
  assert.equal(validPdfBase64(pdfOf(MAX_UPLOAD_BYTES)), true);
  assert.equal(validPdfBase64(pdfOf(MAX_UPLOAD_BYTES + 1)), false);
});
await t("anything that is not a base64 PDF is refused: other formats, bad characters, bad length, empty, wrong type", () => {
  assert.equal(validPdfBase64(Buffer.from("\x89PNG\r\n\x1a\n-----").toString("base64")), false);
  assert.equal(validPdfBase64(Buffer.from("<html><script>alert(1)</script>").toString("base64")), false);
  assert.equal(validPdfBase64(pdfOf(100).slice(0, -1)), false, "length not a multiple of 4");
  assert.equal(validPdfBase64(pdfOf(100) + "!!"), false);
  assert.equal(validPdfBase64("data:application/pdf;base64," + pdfOf(100)), false, "a data URL is not base64 alone");
  assert.equal(validPdfBase64(pdfOf(100).replace(/./, " ")), false);
  for (const bad of ["", "JVBERi0", null, undefined, 123, {}, ["JVBERi0xLjc="]]) assert.equal(validPdfBase64(bad), false, String(bad));
});
await t("an oversized string is rejected by length alone, without decoding it", () => {
  const t0 = Date.now();
  assert.equal(validPdfBase64("A".repeat(50_000_000)), false);
  assert.ok(Date.now() - t0 < 200);
});
await t("the screen refuses a file before upload for the same reasons", () => {
  assert.equal(c.pdfFileProblem({ name: "x.pdf", type: "application/pdf", size: 1000 }), null);
  assert.equal(c.pdfFileProblem({ name: "x.PDF", type: "", size: 1000 }), null, "a PDF with no reported type");
  assert.ok(c.pdfFileProblem({ name: "x.png", type: "image/png", size: 1000 }));
  assert.ok(c.pdfFileProblem({ name: "x.pdf", type: "application/pdf", size: 0 }));
  assert.ok(c.pdfFileProblem({ name: "x.pdf", type: "application/pdf", size: c.UPLOAD_MAX_BYTES + 1 }));
  assert.equal(c.pdfFileProblem({ name: "x.pdf", type: "application/pdf", size: c.UPLOAD_MAX_BYTES }), null);
  assert.equal(c.UPLOAD_MAX_BYTES, MAX_UPLOAD_BYTES, "the screen and the function use the same limit");
});
