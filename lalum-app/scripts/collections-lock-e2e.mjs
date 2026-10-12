// Browser test of the collections billing lock screens, in real Chromium against the real app, with the backend mocked.
// Run with: npm run collections-lock-e2e
//
// WHAT THIS PROVES: the partner's flow on the "גיול חובות" tab works in a browser. A debtor past 60 days is offered a lock, the lock needs a
// reason, an override needs days and a reason, the screen shows the lock and the override date after the data reloads, a finance level 3
// user does not get the override button, and the server's error codes come out as Hebrew messages.
//
// WHAT IT DOES NOT PROVE: that the database refuses a time entry for a locked customer. The backend here is a mock of the network, so the
// BILLING_LOCKED trigger and the NO_WHATSAPP_CONSENT check are not exercised, and the app has no screen that creates a time entry. That rule is verified against the database
// itself (migration 0032, rolled back transaction). A test against a live project needs a real partner account with a TOTP factor.
//
// The app runs from the Vite dev server with a fake Supabase URL; every request to it is answered in this file.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()[0];
    if (dir) { const bin = join(root, dir, "chrome-linux", "chrome"); if (existsSync(bin)) return bin; }
  } catch { /* fall through to Playwright's own resolution */ }
  return undefined;
}

const API = "https://e2e.supabase.co";
process.env.VITE_SUPABASE_URL = API;
process.env.VITE_SUPABASE_ANON_KEY = "e2e-anon-key";

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const NOW = Math.floor(Date.now() / 1000);
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "partner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const TOKEN = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: USER.id, email: USER.email, aal: "aal2", role: "authenticated", aud: "authenticated", exp: NOW + 3600, amr: [{ method: "totp", timestamp: NOW }] })}.sig`;
const SESSION = { access_token: TOKEN, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: NOW + 3600, user: USER };

const FIRM = "22222222-2222-4222-8222-222222222222";
const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const fmt = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };

// ---- the mock backend ----
const state = { level: 4, calls: [], customers: [], unmatched: [] };
function reset(level) {
  state.level = level; state.calls = [];
  state.customers = [
    { id: "c1", firm_id: FIRM, name: "חברת אלפא נדל\"ן", tax_id: "510000001", email: "alpha@example.test", phone: "0521234567", address: null, city: null, notes: null, archived: false, i4u_customer_id: null, is_casual: false,
      retainer_active: false, retainer_description: null, retainer_amount: null, is_collections_locked: false, collections_lock_reason: null, collections_override_until: null,
      whatsapp_consent_at: null, whatsapp_consent_basis: null, whatsapp_consent_note: null, whatsapp_consent_revoked_at: null },
    { id: "c2", firm_id: FIRM, name: "בטא בע\"מ", tax_id: "510000002", email: "beta@example.test", phone: "0501234567", address: null, city: null, notes: null, archived: false, i4u_customer_id: null, is_casual: false,
      retainer_active: false, retainer_description: null, retainer_amount: null, is_collections_locked: false, collections_lock_reason: null, collections_override_until: null,
      whatsapp_consent_at: null, whatsapp_consent_basis: null, whatsapp_consent_note: null, whatsapp_consent_revoked_at: null },
  ];
}
// Open pro formas are the receivable on the cash basis (ACCOUNTING_BASIS), so the debt is expressed as pro formas.
const proforma = (id, customer, total, dueOffset) => ({
  id, firm_id: FIRM, customer_id: customer, doc_type: "PROFORMA", status: "ISSUED", subject: "", currency: "ILS", tax_included: false, vat_rate: 18, lines: [],
  subtotal: total, vat_amount: 0, total, issue_date: isoDay(dueOffset - 30), due_date: isoDay(dueOffset), payment_method: null, payment_ref: null, related_doc_id: null,
  source_proforma_id: null, send_email: false, doc_number: Number(id.slice(1)), i4u_doc_id: null, allocation_number: null, pdf_url: null, is_test: false, last_error: null, issued_at: null,
});
const DOCS = [proforma("d1", "c1", 38000, -72), proforma("d2", "c2", 4000, -10)];

const todayIso = () => isoDay(0);
function rpc(name, body) {
  if (name === "lalum_fin_level") return { ok: state.level };
  if (name === "lalum_is_admin") return { ok: false };
  const c = state.customers.find((x) => x.id === body?.p_customer);
  if (name === "lalum_fin_set_collections_lock") {
    if (state.level < 3) return { err: "FORBIDDEN" };
    if (body.p_locked && !String(body.p_reason ?? "").trim()) return { err: "LOCK_REASON_REQUIRED" };
    Object.assign(c, { is_collections_locked: body.p_locked, collections_lock_reason: body.p_locked ? body.p_reason : null, collections_override_until: null });
    return { ok: null };
  }
  if (name === "lalum_fin_override_collections_lock") {
    if (state.level < 4) return { err: "FORBIDDEN" };
    if (!c.is_collections_locked) return { err: "NOT_LOCKED" };
    if (body.p_days < 0 || body.p_days > 30) return { err: "BAD_DAYS" };
    if (body.p_days === 0) { c.collections_override_until = null; return { ok: null }; }
    if (!String(body.p_reason ?? "").trim()) return { err: "OVERRIDE_REASON_REQUIRED" };
    c.collections_override_until = isoDay(body.p_days); return { ok: c.collections_override_until };
  }
  if (name === "lalum_fin_set_whatsapp_consent") {
    if (state.level < 3) return { err: "FORBIDDEN" };
    if (body.p_given) {
      if (!["AGREEMENT", "WRITTEN", "VERBAL", "FORM"].includes(body.p_basis)) return { err: "BAD_BASIS" };
      Object.assign(c, { whatsapp_consent_at: new Date().toISOString(), whatsapp_consent_basis: body.p_basis, whatsapp_consent_note: body.p_note || null, whatsapp_consent_revoked_at: null });
    } else {
      if (!c.whatsapp_consent_at) return { err: "NO_CONSENT" };
      c.whatsapp_consent_revoked_at = new Date().toISOString();
    }
    return { ok: null };
  }
  return { ok: null };
}
function table(name) {
  switch (name) {
    case "lalum_firm_members": return [{ firm_id: FIRM, name: "שותף", role: "FIRM_PARTNER", lalum_firms: { firm_name: "משרד בדיקה", status: "ACTIVE", subscription_tier: "PRO", monthly_fee: 0, seat_limit: 5, require_mfa: true } }];
    case "lalum_fin_customers": return state.customers;
    case "lalum_fin_documents": return DOCS;
    default: return [];
  }
}

async function install(context) {
  await context.route(`${API}/**`, async (route) => {
    const req = route.request(), u = new URL(req.url()), path = u.pathname;
    const json = (status, data) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(data) });
    if (req.method() === "OPTIONS") return json(200, {});
    if (path === "/auth/v1/user") return json(200, USER);
    if (path.startsWith("/auth/v1/")) return json(200, {});
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop(); let body = {}; try { body = req.postDataJSON() ?? {}; } catch { /* no body */ }
      state.calls.push({ rpc: name, body });
      const r = rpc(name, body);
      return r.err ? json(400, { code: "P0001", message: r.err, details: null, hint: null }) : json(200, r.ok);
    }
    if (path.startsWith("/rest/v1/")) {
      const name = path.slice("/rest/v1/".length);
      if (req.method() === "GET" || req.method() === "HEAD") {
        const rows = table(name);
        if (!["lalum_firm_members", "lalum_fin_customers", "lalum_fin_documents"].includes(name)) state.unmatched.push(name);
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` }, body: JSON.stringify(rows) });
      }
      state.calls.push({ write: req.method(), table: name });
      return json(200, []);
    }
    return json(200, {});
  });
}

// ---- the test ----
const t = async (name, fn) => { await fn(); console.log(`[PASS] ${name}`); };
const server = await createServer({ server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch({ executablePath: resolveChromium() });
let failed = false;
try {
  async function open(level) {
    reset(level);
    const context = await browser.newContext({ locale: "he-IL", viewport: { width: 1400, height: 1000 } });
    await context.addInitScript(([key, session, consent]) => {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem("lalum-cookie-consent", consent);
    }, ["sb-e2e-auth-token", SESSION, JSON.stringify({ analytics: false, ts: Date.now() })]);
    await install(context);
    const page = await context.newPage();
    const dialogs = [];
    page.on("dialog", async (d) => {
      const next = pending.shift();
      dialogs.push({ type: d.type(), message: d.message() });
      if (next === null) await d.dismiss(); else await d.accept(next ?? "");
    });
    const pending = [];
    page.queue = (...answers) => pending.push(...answers);
    page.dialogs = dialogs;
    await page.goto(`${base}/settings/billing`);
    await page.getByRole("tab", { name: "גיול חובות" }).click({ timeout: 20000 });
    await page.getByText("חברת אלפא נדל\"ן").first().waitFor({ timeout: 20000 });
    return { context, page };
  }
  const row = (page, name) => page.locator("tr", { hasText: name });
  const settle = (page) => page.waitForTimeout(400);

  {
    const { context, page } = await open(4);
    await t("a debtor past 60 days is a lock candidate; one inside the limit is not", async () => {
      await row(page, "חברת אלפא").getByText("מועמד לחסימה").waitFor();
      assert.equal(await row(page, "בטא").getByText("מועמד לחסימה").count(), 0);
    });
    await t("locking needs a reason: an empty reason is refused with a Hebrew message and nothing changes", async () => {
      page.queue("");
      await row(page, "חברת אלפא").getByRole("button", { name: "חסימת חיוב" }).click();
      await page.getByText("חסימת חיוב דורשת סיבה.").waitFor();
      assert.equal(state.customers[0].is_collections_locked, false);
    });
    await t("locking with a reason sends the right call and the screen shows the lock after it reloads", async () => {
      page.queue("יתרה פתוחה מעל 60 יום");
      await row(page, "חברת אלפא").getByRole("button", { name: "חסימת חיוב" }).click();
      await row(page, "חברת אלפא").getByText("חיוב חסום").waitFor();
      const call = state.calls.filter((c) => c.rpc === "lalum_fin_set_collections_lock").pop();
      assert.deepEqual(call.body, { p_customer: "c1", p_locked: true, p_reason: "יתרה פתוחה מעל 60 יום" });
      await row(page, "חברת אלפא").getByRole("button", { name: "שחרור חסימה" }).waitFor();
    });
    await t("a partner (level 4) can grant a dated override; a bad number of days is refused in Hebrew", async () => {
      page.queue("40", "x");
      await row(page, "חברת אלפא").getByRole("button", { name: "אישור חריג" }).click();
      await page.getByText("מספר הימים לחריג הוא בין 1 ל-30.").waitFor();
      page.queue("7", "הסדר תשלומים הוסכם");
      await row(page, "חברת אלפא").getByRole("button", { name: "אישור חריג" }).click();
      await row(page, "חברת אלפא").getByText(`חריג עד ${fmt(isoDay(7))}`).waitFor();
      const call = state.calls.filter((c) => c.rpc === "lalum_fin_override_collections_lock").pop();
      assert.deepEqual(call.body, { p_customer: "c1", p_days: 7, p_reason: "הסדר תשלומים הוסכם" });
    });
    await t("cancelling the override puts the lock back in force", async () => {
      page.queue("");
      await row(page, "חברת אלפא").getByRole("button", { name: "ביטול חריג" }).click();
      await row(page, "חברת אלפא").getByText("חיוב חסום").waitFor();
      assert.equal(await row(page, "חברת אלפא").getByText(/חריג עד/).count(), 0);
      assert.deepEqual(state.calls.filter((c) => c.rpc === "lalum_fin_override_collections_lock").pop().body.p_days, 0);
    });
    await t("declining the unlock confirmation keeps the customer locked; accepting releases it", async () => {
      page.queue(null);
      await row(page, "חברת אלפא").getByRole("button", { name: "שחרור חסימה" }).click();
      await settle(page);
      assert.equal(state.customers[0].is_collections_locked, true);
      page.queue("");
      await row(page, "חברת אלפא").getByRole("button", { name: "שחרור חסימה" }).click();
      await row(page, "חברת אלפא").getByRole("button", { name: "חסימת חיוב" }).waitFor();
      assert.equal(state.customers[0].is_collections_locked, false);
    });
    await context.close();
  }

  {
    const { context, page } = await open(4);
    const wa = () => page.getByRole("button", { name: "שליחה ב-WhatsApp" });
    await t("WhatsApp sending is blocked until the customer's consent is recorded, and blocked again when it is withdrawn", async () => {
      await row(page, "חברת אלפא").getByRole("button", { name: "טיוטת תזכורת" }).click();
      await wa().waitFor();
      assert.equal(await wa().isDisabled(), true);
      await page.getByRole("tab", { name: "לקוחות" }).click();
      await row(page, "חברת אלפא").getByRole("button", { name: "עריכה" }).click();
      await page.getByTestId("wa-consent").getByText("לא נרשמה. שליחת WhatsApp חסומה עד שתירשם הסכמה.").waitFor();
      page.queue("1", "בהסכם מיום 1.1");
      await page.getByTestId("wa-consent").getByRole("button", { name: "רישום הסכמה" }).click();
      await page.getByTestId("wa-consent").getByText(/ניתנה, הסכם שכר טרחה: בהסכם מיום 1.1/).waitFor();
      assert.deepEqual(state.calls.filter((c) => c.rpc === "lalum_fin_set_whatsapp_consent").pop().body, { p_customer: "c1", p_given: true, p_basis: "AGREEMENT", p_note: "בהסכם מיום 1.1" });
      await page.getByRole("tab", { name: "גיול חובות" }).click();
      await row(page, "חברת אלפא").getByRole("button", { name: "טיוטת תזכורת" }).click();
      await wa().waitFor();
      assert.equal(await wa().isDisabled(), false);
      await page.getByRole("tab", { name: "לקוחות" }).click();
      await row(page, "חברת אלפא").getByRole("button", { name: "עריכה" }).click();
      page.queue("");
      await page.getByTestId("wa-consent").getByRole("button", { name: "ביטול הסכמה" }).click();
      await page.getByTestId("wa-consent").getByText("בוטלה. שליחת WhatsApp חסומה.").waitFor();
      await page.getByRole("tab", { name: "גיול חובות" }).click();
      await row(page, "חברת אלפא").getByRole("button", { name: "טיוטת תזכורת" }).click();
      await wa().waitFor();
      assert.equal(await wa().isDisabled(), true);
    });
    await context.close();
  }

  {
    const { context, page } = await open(3);
    await t("a level 3 user can lock but is not offered the override; the cash forecast is read only for them", async () => {
      page.queue("יתרה פתוחה מעל 60 יום");
      await row(page, "חברת אלפא").getByRole("button", { name: "חסימת חיוב" }).click();
      await row(page, "חברת אלפא").getByText("חיוב חסום").waitFor();
      assert.equal(await row(page, "חברת אלפא").getByRole("button", { name: /חריג/ }).count(), 0);
      await page.getByRole("tab", { name: "תזרים 13 שבועות" }).click();
      await page.getByText("ההרשאה שלך מאפשרת צפייה בלבד באזור הזה.").waitFor();
      assert.ok(await page.locator("fieldset[disabled]").count() > 0);
    });
    await context.close();
  }
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await browser.close();
  await server.close();
}
if (state.unmatched.length) console.log(`(tables answered with an empty list: ${[...new Set(state.unmatched)].join(", ")})`);
process.exit(failed ? 1 : 0);
