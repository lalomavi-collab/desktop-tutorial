// Checks the finance dashboard over the bank lines: categories, balance, months, recurring charges, the 30 day forecast,
// the drawable salary and the insights. Run with: npm run bank-dashboard-check
import assert from "node:assert/strict";
import {
  normDesc, classify, dayClosing, accountBalances, balanceSeries, monthlyCash, changePct, categoryTotals, spendByDay,
  recurring, isGeneric, sameDayLater, monthTaxes, vatPeriod, forecast30, drawable, defaultReserve, insights, CAT,
} from "../src/lib/cockpit/bankDashboard.ts";

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
    L("2026-08-17", "רכישת מטח", -260.09), L("2026-08-31", "העברה עצמית007", -25000), L("2026-10-01", "עמל.ערוץ ישי6", -9.9), L("2026-08-02", "גמל תשואה לה-י", -9259)];
  assert.deepEqual(classify(ls, []).map((l) => [l.cat.key, l.how]), [
    ["TAX_IT", "RULE"], ["TAX_BL", "RULE"], ["TAX_BL", "RULE"], ["MOVE", "RULE"], ["OWNER_DRAW", "RULE"], ["BANK_FEES", "RULE"], ["UNMATCHED_OUT", "NONE"],
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
  assert.deepEqual(fc.excluded.map((x) => x.amount), [11800, 20000], "the steady receipt and the open pro formas are listed, not counted");
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
  assert.deepEqual(d.cash, { balance: 30618.02, asOf: "2026-10-28", vat: 8200, incomeTax: 6000, bl: 3503, reserve, left: r2(30618.02 - 8200 - 6000 - 3503 - reserve) });
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

t("every text the screen shows is free of dashes used as punctuation", () => {
  const texts = [...Object.values(CAT).map((c) => c.label + c.group)];
  const cl = book();
  for (const i of insights(cl, "2026-10", "2026-09-01", "2026-10-29", drawable("2026-10", { month: "2026-10", profit: 1, incomeTax: 0, bl: 0, afterTax: 1 }, cl, null, 0))) texts.push(i.title, i.body);
  for (const x of forecast30(cl, recurring(cl), 1, "2026-10-28", TAX, 5).excluded) texts.push(x.label, x.why);
  for (const s of texts) assert.doesNotMatch(s, /[—–]| - /, s);
});

function r2(v) { return Math.round(Number(v.toFixed(6)) * 100) / 100; }
