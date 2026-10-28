// Checks the pure parts of lalum-fin-bank-sync with fakes shaped like the Financy docs (docs-financy.open-finance.ai, read 28.10.2026).
// Run with: npm run bank-sync-check. map.ts is transpiled from supabase/functions/lalum-fin-bank-sync, so the test runs the shipped code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const dir = mkdtempSync(join(tmpdir(), "banksync-"));
const src = readFileSync(new URL("../supabase/functions/lalum-fin-bank-sync/map.ts", import.meta.url), "utf8");
writeFileSync(join(dir, "map.mjs"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const m = await import(pathToFileURL(join(dir, "map.mjs")).href);
const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };

t("only the token and three GET lists can be called", () => {
  assert.equal(m.readUrl("/v2/data/accounts?"), "https://api.open-finance.ai/v2/data/accounts?");
  assert.equal(m.readUrl("/v2/data/transactions?accountId=a&nextPage=eyJTSyI6"), "https://api.open-finance.ai/v2/data/transactions?accountId=a&nextPage=eyJTSyI6");
  assert.ok(m.readUrl("/v2/connections?limit=50"));
  for (const p of ["/v2/payments", "/v2/connections/01J8/refresh", "/v2/data/accounts/01J8ACC", "/v2/data/transactions/../payments",
                   "//evil.example/v2/data/accounts", "/v2/data/accountsX", "https://api.open-finance.ai/v2/data/accounts"]) {
    assert.throws(() => m.readUrl(p), /refused/, p);
  }
  assert.equal(m.TOKEN_URL, "https://api.open-finance.ai/oauth/token");
  // index.ts calls fetch with readUrl or TOKEN_URL only, GET everywhere but the token.
  const index = readFileSync(new URL("../supabase/functions/lalum-fin-bank-sync/index.ts", import.meta.url), "utf8");
  const fetches = index.match(/fetch\(([^,]+),/g);
  assert.deepEqual(fetches, ["fetch(TOKEN_URL,", "fetch(readUrl(`${path}?${q}`),"]);
  assert.equal((index.match(/method: "POST"/g) ?? []).length, 1);
});

const firm = (over = {}) => ({ id: "a1", bank_code: "10", account_last4: "2082", currency: "ILS", is_active: true, provider: null, provider_account_id: null, sync_from: null, ...over });
const fx = (over = {}) => ({ id: "fx1", connectionId: "c1", providerId: "leumi", accountType: "CHECKING", accountName: "עסקי", currency: "ILS",
  accountNumber: "10-800-12342082", parsedAccount: { bank: "10", branch: "800", number: "12342082" }, ...over });

t("the business account links by itself only when nothing else matches", () => {
  const priv = fx({ id: "fx2", accountName: "פרטי", accountNumber: "10-800-55551234", parsedAccount: { bank: "10", branch: "800", number: "55551234" } });
  const card = fx({ id: "fx3", accountType: "CARD", providerId: "max", parsedAccount: null, accountNumber: "4580****2082" });
  const p = m.planLinks([priv, fx(), card], [firm()]);
  assert.deepEqual(p.link.map((x) => [x.firm.id, x.fx.id]), [["a1", "fx1"]]);
  assert.deepEqual(p.other, [{ type: "CHECKING", provider: "leumi", last4: "1234" }, { type: "CARD", provider: "max", last4: "2082" }]);
  // a card ending in the same digits is not a checking account; two checking accounts ending 2082 are ambiguous
  assert.equal(m.planLinks([card], [firm()]).link.length, 0);
  assert.equal(m.planLinks([fx(), fx({ id: "fx9" })], [firm()]).link.length, 0);
  // another bank with the same digits
  assert.equal(m.planLinks([fx({ providerId: "hapoalim", parsedAccount: { bank: "12", number: "12342082" } })], [firm()]).link.length, 0);
  // no parsed number: the raw number and the provider are enough
  assert.equal(m.planLinks([fx({ parsedAccount: null, accountNumber: "800-12342082" })], [firm()]).link.length, 1);
  // a bank code written with a leading zero
  assert.equal(m.planLinks([fx({ parsedAccount: { bank: "010", number: "2082" } })], [firm()]).link.length, 1);
  // no number at all: not linked, and the run says not_linked
  assert.equal(m.planLinks([fx({ parsedAccount: null, accountNumber: undefined })], [firm()]).link.length, 0);
  // an inactive firm account or one without last digits is never linked
  assert.equal(m.planLinks([fx()], [firm({ is_active: false })]).link.length, 0);
  assert.equal(m.planLinks([fx()], [firm({ account_last4: null })]).link.length, 0);
});

t("a linked account stays linked, and a vanished one is reported", () => {
  const linked = firm({ provider: "financy", provider_account_id: "fx1", sync_from: "2026-09-02" });
  const p = m.planLinks([fx()], [linked]);
  assert.equal(p.linked.length, 1); assert.equal(p.link.length, 0); assert.deepEqual(p.other, []);
  const gone = m.planLinks([fx({ id: "fx7" })], [linked]);
  assert.deepEqual(gone.missing, ["a1"]);
  assert.equal(gone.link.length, 0, "the vanished link is not replaced by itself");
});

t("balance: closingBooked first, never the credit line, never in the future", () => {
  const today = "2026-10-28";
  const a = fx({ balances: [
    { balanceType: "interimAvailable", balanceAmount: { amount: 60000, currency: "ILS" }, creditLimitIncluded: true },
    { balanceType: "expected", balanceAmount: { amount: 51000, currency: "ILS" } },
    { balanceType: "closingBooked", balanceAmount: { amount: 52000.555, currency: "ILS" }, referenceDate: "2026-10-27" },
  ] });
  assert.deepEqual(m.pickBalance(a, today), { as_of: "2026-10-27", balance: 52000.56, type: "closingBooked", currency: "ILS" });
  // the short shape of the list example: no type, no date
  assert.deepEqual(m.pickBalance(fx({ balances: [{ amount: 4210.55, currency: "ILS" }] }), today), { as_of: today, balance: 4210.55, type: "unknown", currency: "ILS" });
  // a date after today, a foreign currency, a credit line only, nothing
  assert.equal(m.pickBalance(fx({ balances: [{ balanceType: "closingBooked", balanceAmount: { amount: 1, currency: "ILS" }, referenceDate: "2026-11-01" }] }), today).as_of, today);
  assert.equal(m.pickBalance(fx({ balances: [{ balanceType: "closingBooked", balanceAmount: { amount: 1, currency: "USD" } }] }), today), null);
  assert.equal(m.pickBalance(fx({ balances: [{ balanceType: "interimAvailable", balanceAmount: { amount: 9, currency: "ILS" }, creditLimitIncluded: true }] }), today), null);
  assert.equal(m.pickBalance(fx({ balances: undefined }), today), null);
});

t("transactions become bank lines with the file's sign and a stable key", () => {
  const doc = { id: "01J8TX1", SK: "TX#01J8TX1", accountId: "fx1", providerId: "leumi", type: "NORMAL", merchantName: "Shufersal",
    amount: { chargedAmount: { amount: -239.9, currency: "ILS" }, originalAmount: { amount: -239.9, currency: "ILS" } },
    description: { description: "SHUFERSAL  DEAL ", additionalInfo: "" },
    date: { transactionDate: "2026-10-04", bookingDate: "2026-10-05", valueDate: "2026-10-05" }, balancePerEndDay: 4210.55 };
  const { lines, skipped } = m.mapTransactions([
    doc,
    { ...doc, id: undefined, SK: "TX#01J8TX2", amount: { chargedAmount: { amount: 1180, currency: "ILS" } }, description: { description: "", additionalInfo: "ref 77" }, merchantName: "" },
    { ...doc, id: "01J8TX3", date: { transactionDate: "2026-10-06" } },
    { ...doc },                                                            // the same id twice
    { ...doc, id: "x4", amount: { chargedAmount: { amount: 5, currency: "USD" } } },
    { ...doc, id: "x5", amount: {} },
    { ...doc, id: "x6", date: {} },
    { ...doc, id: undefined, SK: undefined },
  ], "ILS");
  assert.equal(skipped, 5);
  assert.deepEqual(lines[0], { import_hash: "financy:01J8TX1", value_date: "2026-10-05", posted_date: "2026-10-05", description: "SHUFERSAL DEAL", reference: null, amount: -239.9 });
  assert.deepEqual(lines[1], { import_hash: "financy:01J8TX2", value_date: "2026-10-05", posted_date: "2026-10-05", description: null, reference: "ref 77", amount: 1180 });
  assert.equal(lines[2].value_date, "2026-10-06"); assert.equal(lines[2].posted_date, null);
  // no running balance on a line: balancePerEndDay does not say which day it means
  assert.ok(!("balance_after" in lines[0]));
});

t("each run rereads ten days, never before the file ends", () => {
  assert.equal(m.windowFrom("2026-09-02", null), "2026-09-02");
  assert.equal(m.windowFrom("2026-09-02", "2026-10-27"), "2026-10-17");
  assert.equal(m.windowFrom("2026-09-02", "2026-09-05"), "2026-09-02");
  assert.equal(m.dayOf("2026-02-30"), null); assert.equal(m.dayOf("2026-10-27T05:00:00Z"), "2026-10-27");
});

t("freshness and state come from the connection, not from the run", () => {
  const conns = [{ id: "c1", status: "ACTIVE", lastFetchedAt: "2026-10-28T05:10:00.000Z" }, { id: "c2", status: "EXPIRED", lastFetchedAt: "2026-10-01T05:00:00.000Z" }];
  assert.equal(m.dataAt(conns, [fx()]), "2026-10-28T05:10:00.000Z");
  assert.equal(m.dataAt(conns, [fx(), fx({ connectionId: "c2" })]), "2026-10-01T05:00:00.000Z", "the oldest of the linked");
  assert.equal(m.dataAt(conns, [fx({ connectionId: "c9" })]), null);
  assert.equal(m.connectionState(conns[0]), "ok");
  assert.equal(m.connectionState({ status: "COMPLETED" }), "ok");
  assert.equal(m.connectionState(conns[1]), "consent_expired");
  assert.equal(m.connectionState({ status: "CREDENTIALS_ERROR" }), "provider_error");
  assert.equal(m.connectionState(undefined), "connection_missing");
  assert.equal(m.worst(["ok", "consent_expired", "not_linked"]), "consent_expired");
  assert.equal(m.worst(["ok"]), "ok");
});

console.log("bank-sync-check: all passed");
