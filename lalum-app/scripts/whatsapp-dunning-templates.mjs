// Prints, checks or submits the WhatsApp templates to Meta: the three reminders (lalum_dunning_1..3) and the one that carries an issued
// document to the customer (lalum_document_sent, sent automatically at issue by lalum-fin-doc-send).
//
//   node scripts/whatsapp-dunning-templates.mjs            prints the payloads (nothing is sent)
//   node scripts/whatsapp-dunning-templates.mjs --status   lists the templates Meta already has and their approval status
//   node scripts/whatsapp-dunning-templates.mjs --submit   creates the templates that Meta does not have yet
//
// --status and --submit need two environment variables, never stored in the repo:
//   WHATSAPP_TOKEN                   a token allowed to manage templates (permission whatsapp_business_management)
//   WHATSAPP_BUSINESS_ACCOUNT_ID     the WhatsApp Business Account id (not the phone number id)
// Meta reviews each template: usually minutes, sometimes a day. Only an APPROVED template can be sent. Meta may also change the category.
import { readFileSync } from "node:fs";
import { templateParams } from "../../supabase/functions/_shared/dunning.ts";
import { documentTemplateParams } from "../../supabase/functions/_shared/docSend.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const spec = JSON.parse(readFileSync(new URL("./whatsapp-dunning-templates.json", import.meta.url), "utf8"));

/** Example values Meta shows its reviewers, produced by the same function the sender uses, so they match what a customer receives. */
export const EXAMPLE = templateParams({ name: "חברת דוגמה בע\"מ", amount: 1000, days: 35 });

/** The same for the document template, produced by the function the sender uses. */
export const DOC_EXAMPLE = documentTemplateParams("INVOICE_RECEIPT", 70145, "https://newview.invoice4u.co.il/Views/PDF.aspx?cipher=abc123");
export const documentTemplate = spec.document;
export function documentPayload() {
  return { name: documentTemplate.name, language: spec.language, category: spec.category, components: [{ type: "BODY", text: documentTemplate.body, example: { body_text: [DOC_EXAMPLE] } }] };
}

export function payload(t) {
  return {
    name: t.name, language: spec.language, category: spec.category,
    components: [{ type: "BODY", text: t.body, example: { body_text: [EXAMPLE] } }],
  };
}
export const templates = spec.templates;
export const meta = { language: spec.language, category: spec.category };

async function main() {
  const mode = process.argv[2] ?? "";
  if (!mode) { for (const t of spec.templates) console.log(JSON.stringify(payload(t), null, 2)); console.log(JSON.stringify(documentPayload(), null, 2)); return; }
  const token = process.env.WHATSAPP_TOKEN, waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !waba) { console.error("Set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID first."); process.exit(2); }
  const auth = { Authorization: `Bearer ${token}` };
  const list = await fetch(`${GRAPH}/${waba}/message_templates?fields=name,status,category,language&limit=200`, { headers: auth });
  const lj = await list.json();
  if (!list.ok) { console.error("Meta refused the request:", lj.error?.message ?? list.status); process.exit(1); }
  const have = new Map((lj.data ?? []).filter((x) => x.name.startsWith("lalum_dunning_") || x.name === documentTemplate.name).map((x) => [`${x.name}/${x.language}`, x]));
  if (mode === "--status") {
    for (const t of [...spec.templates, documentTemplate]) { const h = have.get(`${t.name}/${spec.language}`); console.log(`${t.name}: ${h ? `${h.status} (${h.category})` : "not created"}`); }
    return;
  }
  if (mode === "--submit") {
    for (const t of [...spec.templates, documentTemplate]) {
      if (have.has(`${t.name}/${spec.language}`)) { console.log(`${t.name}: already exists (${have.get(`${t.name}/${spec.language}`).status}), skipped`); continue; }
      const r = await fetch(`${GRAPH}/${waba}/message_templates`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(t === documentTemplate ? documentPayload() : payload(t)) });
      const j = await r.json();
      console.log(`${t.name}: ${r.ok ? `submitted, status ${j.status ?? "PENDING"}` : `refused: ${j.error?.error_user_msg ?? j.error?.message ?? r.status}`}`);
    }
    return;
  }
  console.error("Unknown option. Use no option, --status or --submit.");
  process.exit(2);
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
