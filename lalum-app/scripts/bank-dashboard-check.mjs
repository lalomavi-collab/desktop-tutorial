// Checks the finance dashboard over the bank lines: categories, balance, months, recurring charges, the 30 day forecast,
// the drawable salary, the insights, and what Financy adds (the account before the statement, the card, the open charge,
// the limits). Run with: npm run bank-dashboard-check
import assert from "node:assert/strict";
import {
  normDesc, classify, dayClosing, accountBalances, balanceSeries, monthlyCash, changePct, categoryTotals, spendByDay,
  recurring, isGeneric, sameDayLater, monthTaxes, vatPeriod, forecast30, drawable, defaultReserve, insights, CAT,
  withHistory, latestFacts, openCardCharges, liquidity, classifyCard, cardMonths, cardCategories, cardRecurring, cardTaxPaid, cardPairs,
  cardInsights, runway,
} from "../src/lib/cockpit/bankDashboard.ts";
import { lastMonths, balanceWindow, bridge, bridgeScale, forecastDays, flowByDay, heatStep, recentDays, recurringLoad, shares, RANGES } from "../src/lib/cockpit/bankTiles.ts";

const t = (name, fn) => { fn(); console.log(`[PASS] ${name}`); };
const A = "acc-1";
let n = 0;
const L = (value_date, description, amount, balance_after = null, o = {}) =>
  ({ id: `l${String(++n).padStart(3, "0")}`, bank_account_id: A, value_date, description, amount, balance_after, created_at: `2026-10-29T09:00:00.${String(n).padStart(6, "0")}`, ...o });
const M = (line, target_kind, o = {}) => ({ bank_line_id: line.id, target_kind, expense_id: null, matched_amount: line.amount, ...o });
const keys = (cl) => Object.fromEntries(cl.map((l) => [l.id, l.cat.key]));

t("the bank's text is reduced to its counterparty", () => {
  assert.equal(normDesc("הראל פנסיה ו-י"), "הראל פנסיה");
  assert.equal(normDesc("העברה דיגי007"), "העברה דיגי");
  assert.equal(normDesc("מרכנתיל די-.י"), "מרכנתיל די");
  assert.equal(normDesc("עמל.ערוץ יש 11"), normDesc("עמל.ערוץ יש 01"));
  assert.equal(isGeneric("העברה דיגיטל"), true); assert.equal(isGeneric("בנק דיסקונט"), true); assert.equal(isGeneric("הראל בטוח-י"), false);
});

t("a reconciliation decision wins over a rule, and each kind lands where it belongs", () => {
  const visa = L("2026-10-15", "לאומי ויזה", -4619.32), fx = L("2026-09-07", "העברה דיגיטל", -9180), pens = L("2026-10-11", "הראל פנסיה ו-י", -1710);
  const draw = L("2026-10-01", "העברה עצמית", -15000), vat = L("2026-09-25", 'מע"מ-י', -18728), fee = L("2026-10-01", "מסלול בסיסי", -10);
  const sup = L("2026-10-18", "הע. אינטרנט", -1950), refund = L("2026-09-17", "גמל תשואה לה-י", 328), cheque = L("2026-09-02", "החזרת שיק", -11800);
  const cl = classify([visa, fx, pens, draw, vat, fee, sup, refund, cheque], [
    M(visa, "transfer"), M(fx, "transfer"), M(pens, "private"), M(draw, "private"), M(vat, "tax"),
    M(fee, "expense", { expense_id: "e1" }), M(sup, "expense", { expense_id: "e2" }), M(refund, "other"), M(cheque, "income_doc"),
  ], (id) => ({ e1: "FEES", e2: "MARKETING" })[id]);
  assert.deepEqual(Object.values(keys(cl)), ["CARD", "MOVE", "OWNER_SAVINGS", "OWNER_DRAW", "TAX_VAT", "BANK_FEES", "EXP:MARKETING", "REFUNDS", "CLIENTS"]);
  assert.ok(cl.every((l) => l.how === "MATCH"));
});

t("fixed rules cover only names that cannot mean anything else", () => {
  const ls = [L("2026-09-25", "מס הכנסה עצמ-י", -9829), L("2026-10-22", "ביטוח לאומי-י", -3503), L("2026-07-31", "בטוח לאומי ח-י", 1155),
    L("2026-08-17", "רכישת מטח", -260.09), L("2026-08-31", "העברה עצמית007", -25000), L("2026-10-01", "עמל.ערוץ ישי6", -9.9), L("2026-08-02", "גמל תשואה לה-י", -9259),
    L("2026-06-29", 'המרה למט"י', 13369.23), L("2026-08-12", "העברת משכור007", -10000)];
  // The landlord is a provident fund ("גמל תשואה", the owner's match on its refund), and a payroll transfer may pay someone else:
  // neither name tells by itself, so both wait for a decision.
  assert.deepEqual(classify(ls, []).map((l) => [l.cat.key, l.how]), [
    ["TAX_IT", "RULE"], ["TAX_BL", "RULE"], ["TAX_BL", "RULE"], ["MOVE", "RULE"], ["OWNER_DRAW", "RULE"], ["BANK_FEES", "RULE"], ["UNMATCHED_OUT", "NONE"],
    ["MOVE", "RULE"], ["UNMATCHED_OUT", "NONE"],
  ]);
});

t("an undecided line learns from earlier decisions on the same counterparty and direction, only when they agree", () => {
  const a = L("2026-08-10", "הראל פנסיה ו-י", -1710), b = L("2026-09-10", "הראל פנסיה ו-י", -1710);
  const c = L("2026-08-11", "בנק דיסקונט", 4440), d = L("2026-07-30", "בנק דיסקונט", 4130), e = L("2026-07-30", "בנק דיסקונט", -50);
  const x1 = L("2026-08-20", "העברה דיגי007", -2360), x2 = L("2026-08-22", "העברה דיגי007", -500), x3 = L("2026-08-23", "העברה דיגי007", -1672);
  const cl = classify([a, b, c, d, e, x1, x2, x3], [M(b, "private"), M(c, "income_doc"), M(x1, "expense", { expense_id: "e" }), M(x2, "private")], () => "OFFICE");
  const k = keys(cl);
  assert.equal(k[a.id], "OWNER_SAVINGS"); assert.equal(cl.find((l) => l.id === a.id).how, "LEARNED");
  assert.equal(k[d.id], "CLIENTS");
  assert.equal(k[e.id], "UNMATCHED_OUT", "a charge does not learn from receipts");
  assert.equal(k[x3.id], "UNMATCHED_OUT", "two different decisions on the same text teach nothing");
});

t("a line split across targets takes the category of its largest part", () => {
  const l = L("2026-10-05", "העברה דיגיטל", -5000);
  const cl = classify([l], [M(l, "private", { matched_amount: -1000 }), M(l, "expense", { expense_id: "e", matched_amount: -4000 })], () => "SOFTWARE");
  assert.equal(cl[0].cat.key, "EXP:SOFTWARE");
});

t("a day's closing follows the chain, whatever order the lines were stored in", () => {
  // 25.9: the VAT and the income tax advance were loaded with one timestamp; the day closed at -304.41, not at 18,423.59.
  assert.equal(dayClosing([{ amount: -18728, balance_after: -304.41 }, { amount: -9829, balance_after: 18423.59 }]), -304.41);
  assert.equal(dayClosing([{ amount: -9829, balance_after: 18423.59 }, { amount: -18728, balance_after: -304.41 }]), -304.41);
  // A day that ends where it began has no single open end: the last line stands.
  assert.equal(dayClosing([{ amount: 100, balance_after: 1100 }, { amount: -100, balance_after: 1000 }]), 1000);
  assert.equal(dayClosing([{ amount: 5, balance_after: null }]), null);
});

t("the newest balance wins, the bank's own statement on a tie", () => {
  const ls = [L("2026-10-27", "x", -100, 900, { created_at: "b" }), L("2026-10-28", "y", 9440, 21768.02, { created_at: "a" }), L("2026-10-28", "z", 8850, 30618.02, { created_at: "a" })];
  const acc = [{ id: A, bank_code: "10", account_last4: "2082", is_active: true }];
  assert.deepEqual(accountBalances(acc, ls, []), [{ accountId: A, balance: 30618.02, asOf: "2026-10-28", source: "LINES" }]);
  assert.equal(accountBalances(acc, ls, [{ bank_account_id: A, as_of: "2026-10-28", balance: 30000 }])[0].source, "STATED");
  assert.equal(accountBalances(acc, ls, [{ bank_account_id: A, as_of: "2026-10-20", balance: 1 }])[0].balance, 30618.02);
  assert.deepEqual(balanceSeries(ls).map((x) => x.balance), [900, 30618.02]);
});

t("after the last statement the series follows the daily Financy read, day by day", () => {
  // The statement ends 28.10 at 30,618.02. The read of 30.10 brings 29.10 (two lines, no running balance) and 30.10's balance.
  const ls = [L("2026-10-28", "z", 8850, 30618.02), L("2026-10-29", "ביטוח לאומי-י", -3503), L("2026-10-29", "העברה", 1000),
    L("2026-10-30", "לאומי ויזה", -3030.53)];
  const st = [{ bank_account_id: A, as_of: "2026-10-28", balance: 30618.02, source: "file", fetched_at: "a" },
    { bank_account_id: A, as_of: "2026-10-30", balance: 25084.49, source: "financy", fetched_at: "b" }];
  assert.deepEqual(balanceSeries(ls, st), [{ date: "2026-10-28", balance: 30618.02 }, { date: "2026-10-29", balance: 28115.02 },
    { date: "2026-10-30", balance: 25084.49 }]);
  // Without the read the days are chained from the statement; a statement's stored closing beats a read of the same day.
  assert.deepEqual(balanceSeries(ls).map((x) => x.balance), [30618.02, 28115.02, 25084.49]);
  const both = [...st, { bank_account_id: A, as_of: "2026-10-30", balance: 25000, source: "file", fetched_at: "a" }];
  assert.equal(balanceSeries(ls, both).at(-1).balance, 25000);
  const acc = [{ id: A, bank_code: "10", account_last4: "2082", is_active: true }];
  assert.deepEqual(accountBalances(acc, ls, st)[0], { accountId: A, balance: 25084.49, asOf: "2026-10-30", source: "STATED" });
});

const book = () => {
  n = 0;
  const ls = [
    L("2026-07-22", "ביטוח לאומי-י", -3803), L("2026-07-24", "בנק דיסקונט", 4130),
    L("2026-08-02", "מימסרים דחויים", 11800), L("2026-08-10", "הראל פנסיה ו-י", -1710), L("2026-08-13", "הראל בטוח-י", -769.05),
    L("2026-08-16", "לאומי ויזה", -13931.01), L("2026-08-17", "רכישת מטח", -260.09), L("2026-08-23", "ביטוח לאומי-י", -3503),
    L("2026-08-31", "העברה עצמית007", -25000),
    L("2026-09-01", "מימסרים דחויים", 11800), L("2026-09-02", "החזרת שיק", -11800), L("2026-09-03", "הפקדת שיק", 11800),
    L("2026-09-10", "הראל פנסיה ו-י", -1710), L("2026-09-14", "הראל בטוח-י", -771.24), L("2026-09-15", "ביטוח לאומי-י", -8493),
    L("2026-09-15", "לאומי ויזה", -2203.39), L("2026-09-17", "גמל תשואה לה-י", 328), L("2026-09-22", "ביטוח לאומי-י", -3503),
    L("2026-09-25", "מס הכנסה עצמ-י", -9829), L("2026-09-25", 'מע"מ-י', -18728),
    L("2026-10-01", "מימסרים דחויים", 11800), L("2026-10-01", "העברה עצמית", -15000), L("2026-10-11", "הראל פנסיה ו-י", -1710),
    L("2026-10-14", "הראל בטוח-י", -776.35), L("2026-10-15", "לאומי ויזה", -4619.32), L("2026-10-18", "הע. אינטרנט", -1950),
    L("2026-10-22", "ביטוח לאומי-י", -3503), L("2026-10-28", "בנק אוצר החיל", 9440), L("2026-10-28", "העברה דיגיטל", 8850),
  ];
  const by = (d, s) => ls.find((l) => l.value_date === d && l.description === s);
  const ms = [
    M(by("2026-08-02", "מימסרים דחויים"), "income_doc"), M(by("2026-09-01", "מימסרים דחויים"), "income_doc"), M(by("2026-10-01", "מימסרים דחויים"), "income_doc"),
    M(by("2026-09-02", "החזרת שיק"), "income_doc"), M(by("2026-09-03", "הפקדת שיק"), "income_doc"), M(by("2026-10-28", "העברה דיגיטל"), "income_doc"),
    M(by("2026-09-10", "הראל פנסיה ו-י"), "private"), M(by("2026-10-01", "העברה עצמית"), "private"), M(by("2026-10-11", "הראל פנסיה ו-י"), "private"),
    M(by("2026-09-15", "לאומי ויזה"), "transfer"), M(by("2026-10-15", "לאומי ויזה"), "transfer"), M(by("2026-09-17", "גמל תשואה לה-י"), "other"),
    M(by("2026-09-25", 'מע"מ-י'), "tax"), M(by("2026-09-25", "מס הכנסה עצמ-י"), "tax"), M(by("2026-10-18", "הע. אינטרנט"), "expense", { expense_id: "e" }),
  ];
  return classify(ls, ms, () => "MARKETING");
};

t("months: in and out without moves between own accounts, the owner's draws apart, partial months marked", () => {
  const m = monthlyCash(book(), "2026-10-28");
  assert.deepEqual(m.map((x) => x.month), ["2026-07", "2026-08", "2026-09", "2026-10"]);
  const oct = m[3];
  assert.equal(oct.inflow, 30090); assert.equal(oct.owner, 16710);
  assert.equal(oct.outflow, 10848.67); assert.equal(oct.net, 19241.33);
  assert.equal(m[1].moved, 260.09, "the currency purchase is left out of the outflow");
  assert.equal(m[2].inflow, 12128, "the returned cheque nets against the receipts");
  assert.deepEqual(m.map((x) => x.partial), [true, false, false, true]);
  assert.equal(changePct(oct.outflow, 0), null); assert.equal(changePct(110, 100), 10); assert.equal(changePct(-50, -100), 50);
});

t("categories of one month, largest first, a refund netting inside its own category", () => {
  const cl = book();
  const out = categoryTotals(cl, "2026-10", "OUT");
  assert.deepEqual(out.map((c) => c.key), ["CARD", "TAX_BL", "EXP:MARKETING", "UNMATCHED_OUT"]);
  assert.equal(out.reduce((a, c) => a + c.share, 0) >= 99, true);
  const sep = categoryTotals(cl, "2026-09", "OUT").find((c) => c.key === "TAX_BL");
  assert.equal(sep.amount, 11996);
  const days = spendByDay(cl, "2026-10");
  assert.equal(days.length, 31); assert.equal(days[14], 4619.32); assert.equal(days[0], 0, "an owner draw is not business spend");
});

t("recurring: a month apart, several lines of a month summed, a channel name only at a steady amount", () => {
  const rec = recurring(book());
  const by = Object.fromEntries(rec.map((r) => [normDesc(r.label), r]));
  assert.equal(by["ביטוח לאומי"].cadence, "MONTHLY"); assert.equal(by["ביטוח לאומי"].amount, -3503); assert.equal(by["ביטוח לאומי"].prevAmount, -11996);
  assert.equal(by["ביטוח לאומי"].next, "2026-11-22");
  assert.equal(by["לאומי ויזה"].changePct, 109.6);
  assert.equal(by["מימסרים דחויים"].amount, 11800, "a channel name at the same amount every month repeats");
  assert.equal(by["העברה עצמית"], undefined, "draws of 25,000 and 15,000 through a channel name are not a fixed charge");
  assert.equal(by["בנק דיסקונט"], undefined);
  assert.equal(sameDayLater("2026-01-31", 1), "2026-02-28");
  const bi = recurring(classify([L("2026-03-05", "ועד הבית", -600), L("2026-05-05", "ועד הבית", -600), L("2026-07-04", "ועד הבית", -600)], []));
  assert.equal(bi[0].cadence, "BIMONTHLY"); assert.equal(bi[0].next, "2026-09-04");
});

t("each month's share of the year's tax is the difference of the year to date figures", () => {
  const m = monthTaxes(2026, [{ profit: 10000, incomeTax: 1000, bl: 500 }, { profit: 25000, incomeTax: 3100, bl: 1300 }, null]);
  assert.deepEqual(m[1], { month: "2026-02", profit: 15000, incomeTax: 2100, bl: 800, afterTax: 12100 });
  assert.equal(m[2].afterTax, 0);
  assert.deepEqual(vatPeriod("2026-10-28"), { from: "2026-09-01", to: "2026-10-31", months: ["2026-09", "2026-10"] });
  assert.deepEqual(vatPeriod("2026-12-31").months, ["2026-11", "2026-12"]);
});

const TAX = { vatByPeriod: { "2026-07": 18700, "2026-09": 8200 }, incomeTaxByMonth: { "2026-09": 3100, "2026-10": 2900 } };

t("30 days: charges as they repeat, VAT and the advance for the period the last payment did not cover, on its day", () => {
  const cl = book(), rec = recurring(cl);
  const fc = forecast30(cl, rec, 30618.02, "2026-10-28", TAX, 20000);
  assert.equal(fc.end, "2026-11-27");
  const vat = fc.rows.find((r) => r.kind === "VAT");
  assert.deepEqual([vat.date, vat.amount, vat.label], ["2026-11-25", -8200, "מע״מ 09/10"]);
  const it = fc.rows.find((r) => r.kind === "INCOME_TAX");
  assert.deepEqual([it.date, it.amount], ["2026-11-25", -6000]);
  assert.equal(fc.rows.some((r) => normDesc(r.label) === "העברה עצמית"), false, "the owner's draw is what is being computed");
  assert.equal(fc.rows.find((r) => r.kind === "BL").amount, -3503);
  assert.equal(fc.rows[fc.rows.length - 1].balance, r2(30618.02 + fc.rows.reduce((a, r) => a + r.amount, 0)));
  assert.equal(fc.minBalance, fc.rows[fc.rows.length - 1].balance);
  assert.deepEqual(fc.excluded.map((x) => x.amount), [20000], "the open pro formas are listed, not counted");
  assert.deepEqual(fc.expected.map((x) => [x.date, x.amount]), [["2026-11-01", 11800]], "the steady receipt stands beside the charges");
  const tl = fc.timeline;
  assert.equal(tl.length, fc.rows.length + 1);
  assert.equal(tl[tl.length - 1].balance, fc.rows[fc.rows.length - 1].balance, "the receipt is not in the first balance");
  assert.equal(tl[tl.length - 1].withReceipts, r2(fc.rows[fc.rows.length - 1].balance + 11800));
  assert.equal(fc.shortOn, null); assert.equal(fc.shortOnWithReceipts, null);
});

t("30 days without a VAT payment seen: the current period at the 15th, and no advance without a date", () => {
  n = 0;
  const cl = classify([L("2026-10-02", "הראל בטוח-י", -700), L("2026-09-02", "הראל בטוח-י", -700)], []);
  const fc = forecast30(cl, recurring(cl), 10000, "2026-10-28", { vatByPeriod: { "2026-07": 999, "2026-09": 4000 }, incomeTaxByMonth: { "2026-10": 1 } });
  assert.deepEqual(fc.rows.filter((r) => r.kind === "VAT").map((r) => [r.date, r.amount]), [["2026-11-15", -4000]], "the July and August VAT was due on 15.9, before the statement");
  assert.equal(fc.rows.some((r) => r.kind === "INCOME_TAX"), false);
  assert.ok(fc.excluded.some((x) => x.label === "מקדמות מס הכנסה"));
});

t("drawable: the lower of what was earned after tax less what was taken, and what the cash allows", () => {
  const cl = book(), rec = recurring(cl);
  const fc = forecast30(cl, rec, 30618.02, "2026-10-28", TAX);
  const reserve = defaultReserve(rec);
  assert.equal(reserve, r2(776.35 + 4619.32), "insurance and the card, not taxes and not the owner's pension");
  const tax = { month: "2026-10", profit: 40000, incomeTax: 6000, bl: 2500, afterTax: 31500 };
  const d = drawable("2026-10", tax, cl, fc, reserve);
  assert.equal(d.taken, 16710); assert.equal(d.earnedLeft, 14790);
  assert.deepEqual(d.cash, { balance: 30618.02, asOf: "2026-10-28", vat: 8200, incomeTax: 6000, bl: 3503, card: 0, reserve, left: r2(30618.02 - 8200 - 6000 - 3503 - reserve) });
  assert.equal(d.binding, "CASH"); assert.equal(d.drawable, d.cash.left);
  const lean = drawable("2026-10", { ...tax, afterTax: 10000 }, cl, fc, 0);
  assert.equal(lean.drawable, 0, "never negative"); assert.equal(lean.binding, "EARNED");
  const past = drawable("2026-09", tax, cl, null, 0);
  assert.equal(past.cash, null); assert.equal(past.drawable, r2(31500 - 1710));
});

t("insights: an old statement, receipts without a document, an unusual charge, a returned cheque, drawing past the profit", () => {
  const cl = book();
  const tax = { month: "2026-10", profit: 12000, incomeTax: 1500, bl: 800, afterTax: 9700 };
  const d = drawable("2026-10", tax, cl, null, 0);
  const oct = insights(cl, "2026-10", "2026-10-28", "2026-10-29", d).map((i) => i.title);
  assert.deepEqual(oct, ["תקבולים בלי מסמך", "חיובים ללא קטגוריה", "נמשך יותר מהרווח"]);
  assert.match(insights(cl, "2026-10", "2026-10-28", "2026-10-29", d)[0].body, /^1 תקבולים בסך 9,440 ₪/);
  assert.equal(insights(cl, "2026-10", "2026-09-20", "2026-10-29", null)[0].title, "דף הבנק ישן");
  assert.ok(insights(cl, "2026-09", "2026-10-28", "2026-10-29", null).some((i) => i.title === "שיק חזר"));
  // August's card bill (13,931) against the two later ones (median 3,411).
  assert.match(insights(cl, "2026-08", "2026-10-28", "2026-10-29", null).find((i) => i.title === "הוצאה חריגה").body, /^לאומי ויזה: 13,931 ₪ ב-16\.08\.2026, פי 4\.1/);
  n = 0;
  const big = classify([L("2026-08-14", "חשמל", -300), L("2026-09-14", "חשמל", -320), L("2026-10-14", "חשמל", -1500)], []);
  assert.match(insights(big, "2026-10", "2026-10-28", "2026-10-29", null).find((i) => i.title === "הוצאה חריגה").body, /פי 4\.8/);
});

// ---------- What Financy adds ----------

let e = 0;
const X = (account_kind, txn_date, description, amount, o = {}) =>
  ({ id: `x${String(++e).padStart(3, "0")}`, account_kind, account_ref: account_kind === "card" ? "9616" : "2082", txn_date, description, amount, currency: "ILS", ...o });
const ACC = [{ id: A, bank_code: "10", account_last4: "2082", is_active: true }];
const FACTS = [
  { kind: "CARD_ACCRUED", account_ref: "9616", amount: 3030.53, currency: "ILS", due_on: "2026-11-15", as_of: "2026-10-29" },
  { kind: "CARD_ACCRUED", account_ref: "9616", amount: 2977, currency: "ILS", due_on: "2026-11-15", as_of: "2026-10-27" },
  { kind: "CARD_LIMIT", account_ref: "9616", amount: 50000, currency: "ILS", as_of: "2026-10-29" },
  { kind: "OVERDRAFT_LIMIT", account_ref: "2082", amount: 50000, currency: "ILS", as_of: "2026-10-29" },
  { kind: "GUARANTEE", account_ref: "2082", label: "ערבויות", amount: 35181.55, currency: "ILS", as_of: "2026-10-28" },
  { kind: "FX_BALANCE", account_ref: "USD", amount: 0, currency: "USD", as_of: "2026-10-28" },
];

t("the account before the statement comes from Financy, chained back from the statement's opening balance", () => {
  n = 0;
  // The statement opens on 22.7 at 2,325.59 (its first line takes 3,803 and leaves -1,477.41).
  const file = [L("2026-07-22", "ביטוח לאומי-י", -3803, -1477.41), L("2026-07-22", "העברה דיגי007", 11800, 10322.59), L("2026-07-24", "בנק דיסקונט", 4130, 14452.59)];
  const ext = [X("current", "2026-07-21", "בנק הפועלים", 5000), X("current", "2026-07-21", "לאומי ויזה", -5000), X("current", "2026-06-30", "מס הכנסה עצמ-י", -1000),
    X("current", "2026-07-22", "the statement has this day", 999), X("current", "2026-07-01", "other account", 5, { account_ref: "1111" }), X("card", "2026-07-01", "card", -5)];
  const all = withHistory(file, ACC, ext);
  const hist = all.filter((l) => l.origin === "FINANCY");
  assert.deepEqual(hist.map((l) => l.description), ["מס הכנסה עצמ-י", "בנק הפועלים", "לאומי ויזה"], "only this account, only before 22.7, only current lines");
  const closings = dailyClosingsOf(all);
  assert.deepEqual(closings, [["2026-06-30", 2325.59], ["2026-07-21", 2325.59], ["2026-07-22", 10322.59], ["2026-07-24", 14452.59]],
    "21.7 nets to zero and still closes where the chain says");
  assert.equal(hist.find((l) => l.value_date === "2026-06-30").balance_after, 2325.59);
  assert.deepEqual(balanceSeries(all).map((x) => x.balance), [2325.59, 2325.59, 10322.59, 14452.59]);
  assert.deepEqual(accountBalances(ACC, all, []), accountBalances(ACC, file, []), "the balance today is the statement's");
  assert.equal(withHistory(file, ACC, []).length, 3);
  const cl = classify(all, []);
  assert.equal(cl.find((l) => l.description === "לאומי ויזה").cat.key, "CARD");
  assert.equal(insights(cl, "2026-07", "2026-07-24", "2026-07-25", null).find((i) => i.title === "תקבולים בלי מסמך")?.body.startsWith("2 תקבולים"), true,
    "a receipt from Financy is not claimed to miss a document");
});

t("liquid is the balance less the card's open month; the newest fact of each kind counts", () => {
  assert.equal(latestFacts(FACTS).length, 5);
  assert.deepEqual(openCardCharges(FACTS, "2026-10-28"), [{ account_ref: "9616", amount: 3030.53, due: "2026-11-15", as_of: "2026-10-29" }]);
  assert.deepEqual(openCardCharges(FACTS, "2026-11-15"), [], "once the bank took it, it is in the lines");
  const q = liquidity(30618.02, "2026-10-28", FACTS);
  assert.equal(q.liquid, 27587.49, "the figure Financy shows");
  assert.deepEqual([q.cardDue, q.cardDueOn, q.overdraft, q.cardLimit, q.guarantees[0].amount, q.fx[0].currency], [3030.53, "2026-11-15", 50000, 50000, 35181.55, "USD"]);
  assert.deepEqual(liquidity(100, "2026-10-28", []), { balance: 100, asOf: "2026-10-28", cardDue: 0, cardDueOn: null, liquid: 100, overdraft: null, cardLimit: null, guarantees: [], fx: [] });
});

const card = () => {
  e = 0;
  return classifyCard([
    X("card", "2026-08-23", "פלאפון חשבון תקופתי", -132.81), X("card", "2026-09-23", "פלאפון חשבון תקופתי", -132.81), X("card", "2026-10-23", "פלאפון חשבון תקופתי", -132.81),
    X("card", "2026-08-19", "MICROSOFT#G1 MSBILL.INFO", -15, { currency: "USD" }), X("card", "2026-09-19", "MICROSOFT#G2 MSBILL.INFO", -15, { currency: "USD" }),
    X("card", "2026-10-19", "MICROSOFT#G3 MSBILL.INFO", -52.18), X("card", "2026-10-25", "דינמיקה אונליין", -2844.5),
    X("card", "2026-10-02", "FACEBK *NGZDZC52T2 fb.me/ads", -603), X("card", "2026-10-05", "כביש 6", -54.2), X("card", "2026-10-30", "דמי כרטיס", -40),
    X("card", "2026-06-17", "ריהוט נתניה 8W", -10788), X("card", "2026-06-17", "ריהוט נתניה 8W", -10788),
    X("card", "2026-01-14", "מס הכנסה עצמאים וחברות", -7391), X("card", "2026-01-14", 'גביית מע"מ אינטרנט - שע"מ', -4231),
    X("card", "2026-10-07", "LIQPAY*E-TRAVELS.COM.U KYIV", 7.87, { currency: "USD" }), X("current", "2026-07-01", "not the card", -1),
  ]);
};

t("the card: merchants by category, months by purchase, shekels apart from dollars, subscriptions, taxes paid with it", () => {
  const cl = card();
  assert.equal(cl.length, 15, "only card lines");
  const by = Object.fromEntries(cl.map((l) => [l.description, l.cat.key]));
  assert.deepEqual([by["פלאפון חשבון תקופתי"], by["דינמיקה אונליין"], by["FACEBK *NGZDZC52T2 fb.me/ads"], by["כביש 6"], by["דמי כרטיס"], by["מס הכנסה עצמאים וחברות"], by['גביית מע"מ אינטרנט - שע"מ']],
    ["CARD:COMMUNICATION", "CARD:NONE", "CARD:MARKETING", "CARD:VEHICLE", "CARD:CARD_FEES", "CARD:TAX_IT", "CARD:TAX_VAT"]);
  const oct = cardMonths(cl).find((m) => m.month === "2026-10");
  assert.deepEqual(oct, { month: "2026-10", ils: r2(132.81 + 52.18 + 2844.5 + 603 + 54.2 + 40), fx: { USD: -7.87 }, count: 7 });
  assert.equal(cardMonths(cl)[0].month, "2026-01"); assert.equal(cardMonths(cl).length, 10, "every month between, empty ones too");
  assert.deepEqual(cardCategories(cl, "2026-10").map((c) => c.key), ["CARD:NONE", "CARD:MARKETING", "CARD:COMMUNICATION", "CARD:VEHICLE", "CARD:SOFTWARE", "CARD:CARD_FEES"]);
  const subs = cardRecurring(cl);
  assert.deepEqual(subs.map((r) => [normDesc(r.label), r.currency, r.amount, r.next]),
    [["microsoft#g msbill info", "USD", -15, "2026-10-19"], ["פלאפון חשבון תקופתי", "ILS", -132.81, "2026-11-23"]],
    "a merchant charged in two currencies is two series: the dollar one stopped when it moved to shekels, and one shekel month is not a series");
  assert.deepEqual(cardTaxPaid(cl), [{ key: "TAX_IT", date: "2026-01-14" }, { key: "TAX_VAT", date: "2026-01-14" }]);
  assert.deepEqual(cardPairs(cl, "2026-06"), [{ date: "2026-06-17", description: "ריהוט נתניה 8W", amount: -10788, count: 2 }]);
  const ins = cardInsights(cl, "2026-10").map((i) => i.title);
  assert.deepEqual(ins, ["חיוב גדול בכרטיס בלי קטגוריה"]);
  assert.match(cardInsights(cl, "2026-10")[0].body, /^דינמיקה אונליין 2,844\.5 ₪ ב־25\.10\.2026/);
  assert.deepEqual(cardInsights(cl, "2026-06").map((i) => i.title), ["חיוב גדול בכרטיס בלי קטגוריה", "חיובים זהים באותו יום"]);
  assert.deepEqual(cardInsights(cl, "2026-01").map((i) => i.title), ["מס ששולם בכרטיס"]);
});

t("30 days with the card's open month: it replaces the estimated card bill, and the cash for drawing pays it first", () => {
  const cl = book(), rec = recurring(cl);
  const cards = openCardCharges(FACTS, "2026-10-28").map((c) => ({ amount: c.amount, due: c.due, label: "כרטיס ***9616" }));
  const fc = forecast30(cl, rec, 30618.02, "2026-10-28", TAX, 0, { cards });
  assert.equal(fc.rows.some((r) => normDesc(r.label) === "לאומי ויזה"), false, "no estimate beside the known charge");
  assert.deepEqual(fc.rows.filter((r) => r.kind === "CARD").map((r) => [r.date, r.amount]), [["2026-11-15", -3030.53]]);
  const plain = forecast30(cl, rec, 30618.02, "2026-10-28", TAX);
  assert.deepEqual(plain.rows.filter((r) => normDesc(r.label) === "לאומי ויזה").map((r) => [r.date, r.amount]), [["2026-11-15", -4619.32]]);
  const d = drawable("2026-10", { month: "2026-10", profit: 90000, incomeTax: 6000, bl: 2500, afterTax: 81500 }, cl, fc, 1000);
  assert.equal(d.cash.card, 3030.53); assert.equal(d.cash.left, r2(30618.02 - 8200 - 6000 - 3503 - 3030.53 - 1000));
  // A tax paid with the card is a payment like one in the bank: the VAT paid with it on 20.10 is the last payment (07/08), so
  // 09/10 is due on the 20th; one dated after the statement is not seen yet.
  const paid = forecast30(cl, rec, 30618.02, "2026-10-28", TAX, 0, { paidElsewhere: [{ key: "TAX_VAT", date: "2026-11-20" }, { key: "TAX_VAT", date: "2026-10-20" }] });
  assert.deepEqual(paid.rows.filter((r) => r.kind === "VAT").map((r) => [r.label, r.date]), [["מע״מ 09/10", "2026-11-20"]]);
  const low = forecast30(cl, rec, 5000, "2026-10-28", TAX, 0, { cards });
  assert.equal(low.shortOn, low.timeline.find((r) => r.balance < 0).date);
  assert.ok(low.shortOnWithReceipts === null || low.shortOnWithReceipts >= low.shortOn, "receipts can only push the shortfall later");
});

t("a series that missed two payments has stopped: listed, but out of the forecast and the reserve", () => {
  n = 0;
  // Rent paid in June, July and August and not since; insurance every month to October.
  const cl = classify([L("2026-06-02", "גמל תשואה לה-י", -9259), L("2026-07-02", "גמל תשואה לה-י", -9259), L("2026-08-02", "גמל תשואה לה-י", -9259),
    L("2026-08-14", "הראל בטוח-י", -770), L("2026-09-14", "הראל בטוח-י", -770), L("2026-10-14", "הראל בטוח-י", -776.35)], []);
  const rec = recurring(cl, "2026-10-28"), by = Object.fromEntries(rec.map((r) => [normDesc(r.label), r]));
  assert.deepEqual([by["גמל תשואה לה"].missed, by["גמל תשואה לה"].stale, by["הראל בטוח"].missed, by["הראל בטוח"].stale], [2, true, 0, false]);
  assert.equal(recurring(cl, "2026-09-06").find((r) => r.stale), undefined, "one missed payment is late, not stopped");
  assert.equal(recurring(cl)[0].stale, false, "without a statement date nothing is judged");
  const fc = forecast30(cl, rec, 10000, "2026-10-28", { vatByPeriod: {}, incomeTaxByMonth: {} });
  assert.deepEqual(fc.rows.map((r) => normDesc(r.label)), ["הראל בטוח"]);
  assert.match(fc.excluded.find((x) => normDesc(x.label) === "גמל תשואה לה").why, /^לא נראה מאז 02\.08\.2026/);
  assert.equal(defaultReserve(rec), 776.35);
});

t("runway: the liquid balance over the average outflow of the last three full months", () => {
  const m = monthlyCash(book(), "2026-10-28");
  const rw = runway(m, 27587.49);
  assert.deepEqual(rw.basis, ["2026-08", "2026-09"], "July and October are partial");
  assert.equal(rw.avgOut, r2((m[1].outflow + m[2].outflow) / 2));
  assert.equal(rw.months, Math.round((27587.49 / rw.avgOut) * 10) / 10);
  assert.equal(runway([], 1), null);
});

t("every text the screen shows is free of dashes used as punctuation", () => {
  const texts = [...Object.values(CAT).map((c) => c.label + c.group)];
  const cl = book();
  for (const i of insights(cl, "2026-10", "2026-09-01", "2026-10-29", drawable("2026-10", { month: "2026-10", profit: 1, incomeTax: 0, bl: 0, afterTax: 1 }, cl, null, 0))) texts.push(i.title, i.body);
  const cards = [{ amount: 3030.53, due: "2026-11-15", label: "כרטיס" }];
  const fc = forecast30(cl, recurring(cl), 1, "2026-10-28", TAX, 5, { cards });
  for (const x of fc.excluded) texts.push(x.label, x.why);
  for (const x of fc.timeline) texts.push(x.label, x.note ?? "");
  const ccl = card();
  for (const l of ccl) texts.push(l.cat.label + l.cat.group);
  for (const mo of ["2026-01", "2026-06", "2026-10"]) for (const i of cardInsights(ccl, mo)) texts.push(i.title, i.body.replace(/גביית מע"מ אינטרנט - שע"מ/g, ""));
  for (const s of texts) assert.doesNotMatch(s, /[—–]| - /, s);
});

// ---------- The tiles (bankTiles.ts) ----------

t("tiles: one range for every trend, counted back from the last month or day", () => {
  const ms = ["2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((month) => ({ month }));
  assert.deepEqual(lastMonths(ms, "6").map((m) => m.month), ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  assert.equal(lastMonths(ms, "12").length, 12); assert.equal(lastMonths(ms, "all").length, 14);
  const s = ["2026-03-31", "2026-04-28", "2026-04-29", "2026-09-30", "2026-10-28"].map((date, i) => ({ date, balance: i }));
  assert.deepEqual(balanceWindow(s, "6").map((p) => p.date), ["2026-04-29", "2026-09-30", "2026-10-28"], "six months back from 28.10 starts after 28.4");
  assert.equal(balanceWindow(s, "all").length, 5);
  assert.deepEqual(balanceWindow(s.slice(3), "6").map((p) => p.date), ["2026-09-30", "2026-10-28"], "two points stay");
  assert.deepEqual(balanceWindow([s[0], s[4]], "6").map((p) => p.date), ["2026-03-31", "2026-10-28"], "a cut that leaves one point keeps the last two");
  assert.deepEqual(RANGES.map((r) => r.key), ["6", "12", "all"]);
});

t("tiles: the drawable salary as a bridge, every step from where the last ended, the result from zero", () => {
  const b = bridge({ label: "רווח", value: 20000 }, [{ label: "מס", value: -3000 }, { label: "ביטוח לאומי", value: -2500 }, { label: "נמשך", value: 0 }], { label: "נותר" });
  assert.deepEqual(b.map((r) => [r.kind, r.from, r.to]), [["start", 0, 20000], ["step", 20000, 17000], ["step", 17000, 14500], ["step", 14500, 14500], ["total", 0, 14500]]);
  assert.deepEqual(bridgeScale(b), { lo: 0, hi: 20000 });
  const neg = bridge({ label: "יתרה", value: 5000 }, [{ label: "מע״מ", value: -8000 }], { label: "הקופה מאפשרת" });
  assert.equal(neg[2].to, -3000);
  assert.deepEqual(bridgeScale(neg), { lo: -3000, hi: 5000 }, "below zero stays on the scale");
  assert.deepEqual(bridgeScale(bridge({ label: "x", value: 0 }, [], { label: "y" })), { lo: 0, hi: 1 }, "a bridge of zeros still has a scale");
});

t("tiles: the forecast drawn one day at a time, matching its own running balances", () => {
  const cl = book(), rec = recurring(cl);
  const fc = forecast30(cl, rec, 30618.02, "2026-10-28", TAX, 20000);
  const days = forecastDays(fc);
  assert.equal(days.length, 31, "the start day and thirty more");
  assert.deepEqual([days[0].date, days[0].balance], ["2026-10-28", 30618.02]);
  assert.equal(days[days.length - 1].date, fc.end);
  assert.equal(days[days.length - 1].balance, fc.timeline[fc.timeline.length - 1].balance);
  assert.equal(days[days.length - 1].withReceipts, fc.timeline[fc.timeline.length - 1].withReceipts);
  assert.equal(Math.min(...days.map((d) => d.balance)), fc.minBalance, "the low point is the forecast's own");
  const nov1 = days.find((d) => d.date === "2026-11-01");
  assert.equal(r2(nov1.withReceipts - nov1.balance), 11800, "the steady receipt shows only in the second line");
});

t("tiles: money per day, in and out, and five steps of one hue", () => {
  const cl = book();
  const out = flowByDay(cl, "2026-10", "OUT"), inn = flowByDay(cl, "2026-10", "IN");
  assert.equal(out.length, 31);
  assert.deepEqual(out, spendByDay(cl, "2026-10"), "out is the dashboard's spend by day");
  const inLines = cl.filter((l) => l.value_date.startsWith("2026-10") && l.cat.flow === "IN");
  assert.equal(r2(inn.reduce((a, v) => a + v, 0)), r2(inLines.reduce((a, l) => a + l.amount, 0)));
  assert.ok(inn.every((v) => v >= 0) && out.every((v) => v >= 0));
  assert.deepEqual([0, 1, 25, 26, 50, 51, 99, 100].map((v) => heatStep(v, 100)), [0, 1, 1, 2, 2, 3, 4, 4]);
  assert.equal(heatStep(5, 0), 0); assert.equal(heatStep(-5, 10), 0);
});

t("tiles: the last fourteen days, moves between accounts left out", () => {
  n = 0;
  const cl = classify([L("2026-10-28", "מימסרים דחויים", 11800), L("2026-10-27", "הראל בטוח-י", -776.35), L("2026-10-15", "העברה עצמית", -500),
    L("2026-10-14", "הראל בטוח-י", -1), L("2026-10-28", "הראל בטוח-י", -10)], [], () => null);
  const moved = cl.find((l) => l.description === "העברה עצמית");
  const days = recentDays(cl.map((l) => (l === moved ? { ...l, cat: CAT.MOVE } : l)), "2026-10-28");
  assert.equal(days.length, 14);
  assert.deepEqual([days[0].date, days[13].date], ["2026-10-15", "2026-10-28"]);
  assert.deepEqual([days[13].inflow, days[13].outflow], [11800, 10]);
  assert.equal(days[12].outflow, 776.35);
  assert.equal(days[0].outflow, 0, "a move between accounts is not out");
  assert.equal(days.reduce((a, d) => a + d.outflow, 0), 786.35, "14.10 is before the window");
});

t("tiles: the recurring list as a monthly load, stopped series last and out of the totals", () => {
  const cl = book(), rec = recurring(cl, "2026-10-28");
  const load = recurringLoad(rec);
  assert.equal(load.rows.length, rec.length);
  for (const r of load.rows) assert.equal(r.monthly, r2(r.cadence === "MONTHLY" ? r.amount : r.amount / 2));
  const live = rec.filter((r) => !r.stale);
  assert.equal(load.outflow, r2(-live.filter((r) => r.amount < 0).reduce((s, r) => s + (r.cadence === "MONTHLY" ? r.amount : r.amount / 2), 0)));
  assert.equal(load.inflow, r2(live.filter((r) => r.amount > 0).reduce((s, r) => s + (r.cadence === "MONTHLY" ? r.amount : r.amount / 2), 0)));
  const firstStale = load.rows.findIndex((r) => r.stale);
  if (firstStale >= 0) assert.ok(load.rows.slice(firstStale).every((r) => r.stale), "stopped series sit at the end");
  const head = load.rows.filter((r) => !r.stale).map((r) => Math.abs(r.monthly));
  assert.deepEqual(head, [...head].sort((a, b) => b - a), "largest first");
});

t("tiles: parts of a whole for a meter", () => {
  assert.deepEqual(shares([{ value: 27587.49 }, { value: 3030.53 }]).map((p) => p.pct), [90, 10]);
  assert.deepEqual(shares([{ value: -5 }, { value: 5 }]).map((p) => p.pct), [0, 100], "a negative part counts as nothing");
  assert.deepEqual(shares([{ value: 0 }, { value: 0 }]).map((p) => p.pct), [0, 0]);
});

function dailyClosingsOf(lines) {
  return [...new Set(lines.map((l) => l.value_date))].sort().map((d) => [d, dayClosing(lines.filter((l) => l.value_date === d)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id)))]);
}

function r2(v) { return Math.round(Number(v.toFixed(6)) * 100) / 100; }
