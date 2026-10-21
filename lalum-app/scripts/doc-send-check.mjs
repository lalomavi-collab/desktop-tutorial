// Checks the helpers behind sending an issued finance document (supabase/functions/_shared/docSend.ts and src/lib/cockpit/financeSend.ts).
// Run with: npm run doc-send-check
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { resolveRecipients, splitAddresses, cleanSubject, docEmailHtml, safeFilename, defaultSubject as srvSubject } from "../../supabase/functions/_shared/docSend.ts";
import { normalizeIsraeliPhone } from "../../supabase/functions/_shared/dunning.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

// The client helpers import ./finance, so transpile both into one temp folder.
const dir = mkdtempSync(join(tmpdir(), "docsend-"));
for (const f of ["finance", "financeSend"]) {
  const src = readFileSync(new URL(`../src/lib/cockpit/${f}.ts`, import.meta.url), "utf8");
  writeFileSync(join(dir, `${f}.js`), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText.replace(/from "\.\/finance"/g, 'from "./finance.js"'));
}
const c = await import(pathToFileURL(join(dir, "financeSend.js")).href);

const base = { customerEmail: "Client@Example.com", includeCustomer: true, extra: "", copyToMe: false, ownEmail: "me@lalum.co", testOnly: false };
t("the customer address comes from the record, lower cased, and nothing else is added", () => {
  assert.deepEqual(resolveRecipients(base), { to: ["client@example.com"], bcc: [] });
});
t("an own copy goes as bcc, and is not repeated when it is already a recipient", () => {
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true }), { to: ["client@example.com"], bcc: ["me@lalum.co"] });
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true, extra: "me@lalum.co" }), { to: ["client@example.com", "me@lalum.co"], bcc: [] });
});
t("extra addresses split on commas, spaces and semicolons, and duplicates collapse", () => {
  assert.deepEqual(splitAddresses("a@b.co, c@d.co;e@f.co\ng@h.co"), ["a@b.co", "c@d.co", "e@f.co", "g@h.co"]);
  assert.deepEqual(resolveRecipients({ ...base, extra: "x@y.co, CLIENT@example.com" }).to, ["client@example.com", "x@y.co"]);
});
t("a bad extra address is refused, even when the rest is fine", () => {
  assert.deepEqual(resolveRecipients({ ...base, extra: "x@y.co, nope" }), { error: "bad_address" });
});
t("no customer address and nothing else chosen is an error, not a silent send", () => {
  assert.deepEqual(resolveRecipients({ ...base, customerEmail: null }), { error: "no_email" });
  assert.deepEqual(resolveRecipients({ ...base, includeCustomer: false }), { error: "no_recipient" });
  assert.deepEqual(resolveRecipients({ ...base, includeCustomer: false, copyToMe: true }), { to: ["me@lalum.co"], bcc: [] });
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true, ownEmail: null }), { error: "no_own_email" });
});
t("more than six recipients are refused", () => {
  assert.deepEqual(resolveRecipients({ ...base, copyToMe: true, extra: "a@b.co,c@d.co,e@f.co,g@h.co,i@j.co,k@l.co" }), { error: "too_many" });
  assert.equal(resolveRecipients({ ...base, extra: "a@b.co,c@d.co,e@f.co,g@h.co,i@j.co" }).to.length, 6);
});
t("a test document can only go to the partner's own address, whatever was asked", () => {
  assert.deepEqual(resolveRecipients({ ...base, testOnly: true, extra: "x@y.co", copyToMe: true }), { to: ["me@lalum.co"], bcc: [] });
  assert.deepEqual(resolveRecipients({ ...base, testOnly: true, ownEmail: null }), { error: "no_own_email" });
});
t("the subject is one line, capped, with a fallback", () => {
  assert.equal(cleanSubject("a\r\nBcc: x@y.co", "f"), "a Bcc: x@y.co");
  assert.equal(cleanSubject("   ", "fallback"), "fallback");
  assert.equal(cleanSubject("x".repeat(500), "f").length, 150);
});
t("the body is escaped and the link is only an https link", () => {
  const h = docEmailHtml("שלום\n\n<img src=x onerror=alert(1)>", "https://example.com/a.pdf?x=1&y=2", true);
  assert.ok(!h.includes("<img")); assert.ok(h.includes("&lt;img")); assert.ok(h.includes('dir="rtl"')); assert.ok(h.includes("x=1&amp;y=2"));
  assert.ok(!docEmailHtml("שלום", "javascript:alert(1)", false).includes("<a "));
  assert.ok(!docEmailHtml("שלום", "http://example.com/a.pdf", false).includes("<a "));
  assert.ok(!docEmailHtml("שלום", null, false).includes("<a "));
});
t("the attachment name is plain ASCII", () => {
  assert.equal(safeFilename("INVOICE_RECEIPT", 70145), "tax-invoice-receipt-70145.pdf");
  assert.ok(/^[\x20-\x7e]+$/.test(safeFilename("WHATEVER", null)));
});
t("server and screen build the same default subject", () => {
  for (const type of ["PROFORMA", "INVOICE", "RECEIPT", "INVOICE_RECEIPT", "CREDIT"]) assert.equal(c.defaultSubject({ doc_type: type, doc_number: 10012 }), srvSubject(type, 10012));
});
t("the screen and the server agree on what a WhatsApp mobile is", () => {
  for (const raw of ["052-1234567", "+972 52 123 4567", "00972521234567", "03-1234567", "+12025550123", "0521234", "", null]) assert.equal(c.waNumber(raw), normalizeIsraeliPhone(raw), String(raw));
});
t("the WhatsApp link carries the encoded message, and opens the contact picker without a valid mobile", () => {
  const text = "שלום & להתראות\nhttps://x.co/a.pdf?q=1";
  const withPhone = c.whatsappUrl("052-1234567", text);
  assert.ok(withPhone.startsWith("https://wa.me/972521234567?text=")); assert.equal(decodeURIComponent(withPhone.split("?text=")[1]), text);
  assert.ok(c.whatsappUrl("03-1234567", text).startsWith("https://wa.me/?text="));
  assert.ok(c.whatsappUrl(null, text).startsWith("https://wa.me/?text="));
});
t("only an issued document with a PDF link can be sent", () => {
  assert.equal(c.canSend({ status: "ISSUED", pdf_url: "https://x" }), true);
  assert.equal(c.canSend({ status: "ISSUED", pdf_url: null }), false);
  assert.equal(c.canSend({ status: "DRAFT", pdf_url: "https://x" }), false);
});
t("the send summary counts only successful sends, per channel, newest day", () => {
  const s = [
    { channel: "EMAIL", status: "FAILED", created_at: "2026-10-20T10:00:00Z" },
    { channel: "EMAIL", status: "SENT", created_at: "2026-10-18T10:00:00Z" },
    { channel: "EMAIL", status: "SENT", created_at: "2026-10-19T10:00:00Z" },
    { channel: "WHATSAPP", status: "PENDING", created_at: "2026-10-21T10:00:00Z" },
  ];
  assert.deepEqual(c.sendSummary(s), { email: "2026-10-19" });
});
t("the default texts name the document and never a customer", () => {
  const b = c.defaultBody({ doc_type: "INVOICE", doc_number: 90094 });
  assert.ok(b.includes("חשבונית מס מספר 90094")); assert.ok(b.includes("ד״ר עו״ד אברהם ללום")); assert.ok(!/[—–]/.test(b));
});
