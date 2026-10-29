import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { monthPeriod, summarize } from "../../../lib/cockpit/finance";
import type { ArchiveDoc, FinDocument, FinExpense, FinPayment } from "../../../lib/cockpit/finance";
import { buildPnl, DEFAULT_TAX_SETTINGS } from "../../../lib/cockpit/taxPnl";
import type { TaxSettingsRow } from "../../../lib/cockpit/taxPnl";
import type { TaxParams } from "../../../lib/cockpit/taxParams";
import {
  accountBalances, addMonths, balanceSeries, cardCategories, cardInsights, cardMonths, cardRecurring, cardTaxPaid, categoryTotals, changePct,
  classify, classifyCard, defaultReserve, drawable, forecast30, insights, liquidity, monthlyCash, monthOf, monthTaxes, openCardCharges,
  recurring, runway, spendByDay, vatPeriod, withHistory,
} from "../../../lib/cockpit/bankDashboard";
import type { BankAccount, BankLine, Classified, ExtFact, ExtLine, ReconMatch, StoredBalance, YtdTax } from "../../../lib/cockpit/bankDashboard";
import { Amt } from "../../../components/cockpit/Amt";
import { Donut, GroupedBars } from "../../../components/cockpit/CockpitCharts";
import { MarketChart } from "../../../components/cockpit/MarketChart";
import { acct, pctText } from "../../../lib/cockpit/accounting";
import "../../../styles/cockpit-bank.css";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
/** A bar's month: short, with the year on the first bar and on every January, so a year and a half of bars stays readable. */
const barLabel = (ym: string, i: number) => `${SHORT[Number(ym.slice(5, 7)) - 1]}${i === 0 || ym.endsWith("-01") ? ` ${ym.slice(2, 4)}` : ""}`;
const CUR: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
/** A figure in a foreign currency, in the same form as Amt. */
function Fx({ n, cur }: { n: number; cur: string }) {
  if (cur === "ILS") return <Amt n={n} />;
  const a = acct(n);
  return <span className={`acct${a.neg ? " neg" : ""}${a.zero ? " zero" : ""}`} dir="ltr">{a.neg ? "−" : ""}{a.text}<small>{CUR[cur] ?? cur}</small></span>;
}
const dmy = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join(".") : "");
const PALETTE = ["var(--chart-ok, #216f33)", "var(--chart-cat-2, #2a75ba)", "var(--chart-cat-3, #984588)", "var(--chart-ok-l, #559f68)", "var(--chart-neutral, #9a968c)"];
const HOW: Record<Classified["how"], string> = { MATCH: "", RULE: "", LEARNED: "לפי תנועות קודמות", NONE: "לא שויך" };
const BANKS: Record<string, string> = { "10": "לאומי", "12": "הפועלים", "11": "דיסקונט", "20": "מזרחי טפחות", "31": "הבינלאומי", "17": "מרכנתיל", "14": "אוצר החייל" };

/** A percent change under a figure: up or down against the month before, and whether that is good news. */
function Change({ cur, prev, goodWhenUp }: { cur: number; prev: number | null | undefined; goodWhenUp: boolean }) {
  const p = changePct(cur, prev);
  if (p == null) return <div className="fin-note">אין חודש קודם להשוואה</div>;
  const good = p === 0 ? null : (p > 0) === goodWhenUp;
  return <div className={`fin-note bd-change${good == null ? "" : good ? " good" : " bad"}`}><bdi>{pctText(p)}</bdi> לעומת החודש הקודם</div>;
}

export function BankDashboardTab({ firmId, docs, payments, expenses, archive, reserveSaved, onReserveSaved }: {
  firmId: string; docs: FinDocument[]; payments: FinPayment[]; expenses: FinExpense[]; archive: ArchiveDoc[];
  /** lalum_fin_cashflow_settings.safety_reserve, when the firm saved one. */
  reserveSaved: number | null; onReserveSaved: () => void;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [lines, setLines] = useState<BankLine[]>([]);
  const [matches, setMatches] = useState<ReconMatch[]>([]);
  const [stored, setStored] = useState<StoredBalance[]>([]);
  const [ext, setExt] = useState<ExtLine[]>([]);
  const [facts, setFacts] = useState<ExtFact[]>([]);
  const [settings, setSettings] = useState<TaxSettingsRow | null>(null);
  const [paramsDb, setParamsDb] = useState<TaxParams[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [side, setSide] = useState<"OUT" | "IN">("OUT");
  const [reserveText, setReserveText] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    void (async () => {
      const sb = supabase!;
      // Bank lines can pass the 1000 row page, so they are read page by page, in the order they were stored.
      const all: BankLine[] = [];
      let err = false;
      for (let off = 0; ; off += 1000) {
        const r = await sb.from("lalum_fin_bank_lines").select("id, bank_account_id, value_date, description, reference, amount, balance_after, created_at")
          .order("value_date").order("created_at").order("id").range(off, off + 999);
        if (r.error) { err = true; break; }
        all.push(...((r.data as BankLine[] | null) ?? []).map((l) => ({ ...l, amount: Number(l.amount), balance_after: l.balance_after == null ? null : Number(l.balance_after) })));
        if (!r.data || r.data.length < 1000) break;
      }
      // What Financy shows beyond the statement (migration 20261029150000), finance level 3 only. Missing or refused, it is left out.
      const extAll: ExtLine[] = [];
      for (let off = 0; ; off += 1000) {
        const r = await sb.from("lalum_fin_ext_lines").select("id, account_kind, account_ref, txn_date, description, source_category, amount, currency")
          .order("txn_date").order("id").range(off, off + 999);
        if (r.error) break;
        extAll.push(...((r.data as ExtLine[] | null) ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
        if (!r.data || r.data.length < 1000) break;
      }
      const [a, m, b, s, p, f] = await Promise.all([
        sb.from("lalum_fin_bank_accounts").select("id, bank_code, branch, account_last4, label, is_active"),
        sb.from("lalum_fin_recon_matches").select("bank_line_id, target_kind, expense_id, matched_amount, note"),
        // Stated balances arrive with migration 20261028143000; until it is applied the read fails and the lines' own chain is used.
        sb.from("lalum_fin_bank_balances").select("bank_account_id, as_of, balance, fetched_at").order("as_of", { ascending: false }).limit(500),
        sb.from("lalum_fin_tax_settings").select("*").eq("firm_id", firmId).eq("tax_year", new Date().getFullYear()).maybeSingle(),
        sb.from("lalum_tax_params").select("*"),
        sb.from("lalum_fin_ext_facts").select("kind, account_ref, label, amount, currency, due_on, as_of").order("as_of", { ascending: false }).limit(200),
      ]);
      if (!live) return;
      setLines(all);
      setExt(extAll);
      setFacts(((f.data as ExtFact[] | null) ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
      setAccounts((a.data as BankAccount[] | null) ?? []);
      setMatches(((m.data as ReconMatch[] | null) ?? []).map((x) => ({ ...x, matched_amount: x.matched_amount == null ? null : Number(x.matched_amount) })));
      setStored(((b.data as StoredBalance[] | null) ?? []).map((x) => ({ ...x, balance: Number(x.balance) })));
      setSettings((s.data as TaxSettingsRow | null) ?? null);
      setParamsDb(((p.data ?? []) as Array<{ tax_year: number; status: "VERIFIED" | "DRAFT"; verified_at: string | null; sources: string[]; params: Partial<TaxParams> }>)
        .filter((r) => r.params && Array.isArray(r.params.brackets))
        .map((r) => ({ ...(r.params as TaxParams), year: r.tax_year, status: r.status, verifiedAt: r.verified_at, sources: r.sources })));
      setError(err || a.error || m.error ? "שורות הבנק לא נטענו. ודאו שהתחברתם עם אימות דו שלבי כשותף בפירמה." : "");
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [firmId]);

  const view = useMemo(() => {
    const expCat = new Map(expenses.map((e) => [e.id, e.category]));
    // Before the first statement line the account's days come from Financy; the balance today is always the statement's.
    const all = withHistory(lines, accounts, ext);
    const cl = classify(all, matches, (id) => expCat.get(id));
    const bals = accountBalances(accounts, lines, stored);
    const known = bals.filter((x) => x.balance != null);
    const balance = known.length ? known.reduce((s, x) => s + (x.balance as number), 0) : null;
    const asOf = known.length ? known.map((x) => x.asOf as string).sort()[0] : null;
    const months = monthlyCash(cl, asOf);
    const rec = recurring(cl, asOf);
    const card = classifyCard(ext);
    const firstStatement = lines.reduce<string | null>((m, l) => (m == null || l.value_date < m ? l.value_date : m), null);
    return {
      cl, bals, balance, asOf, months, rec, series: balanceSeries(all), card, cardMonths: cardMonths(card), cardRec: cardRecurring(card),
      firstStatement, fromFinancy: all.length - lines.length,
    };
  }, [lines, matches, accounts, stored, expenses, ext]);

  const sel = month ?? view.months[view.months.length - 1]?.month ?? monthOf(today);
  const year = Number(sel.slice(0, 4));

  // Recomputed with the inputs; the React Compiler memoizes it.
  const tax = (() => {
    const year = Number(sel.slice(0, 4));
    const st = settings ?? { ...DEFAULT_TAX_SETTINGS, firm_id: firmId, tax_year: year, reporting_basis: "CASH" as const };
    const upTo = Number(sel.slice(5, 7));
    let problems: string[] = [], warnings: string[] = [], final = false;
    const ytd: Array<YtdTax | null> = [];
    for (let m = 1; m <= upTo; m++) {
      const rep = buildPnl(docs, payments, expenses, archive, { from: `${year}-01-01`, to: monthPeriod(year, m).to }, st, st.reporting_basis, paramsDb);
      ytd.push(rep.pnl ? { profit: rep.pnl.accounting.profit, incomeTax: rep.pnl.tax.netIncomeTax, bl: rep.pnl.tax.bl.total } : null);
      if (m === upTo) { problems = rep.problems; warnings = rep.pnl?.warnings ?? []; final = rep.final; }
    }
    const byMonth = monthTaxes(year, ytd);
    // VAT payable of every bimonthly period from a year back, from the ledger, so any period still open is covered.
    const vatByPeriod: Record<string, number> = {};
    for (let ym = `${year - 1}-01`; ym <= `${year}-12`; ym = addMonths(ym, 2)) {
      const p = vatPeriod(`${ym}-01`);
      vatByPeriod[p.months[0]] = summarize(docs, payments, expenses, { from: p.from, to: p.to }, archive).vatPayable;
    }
    const incomeTaxByMonth = Object.fromEntries(byMonth.map((x) => [x.month, x.incomeTax]));
    const outstanding = summarize(docs, payments, expenses, { from: "2000-01-01", to: "2100-12-31" }, archive).outstanding;
    return { byMonth, cur: byMonth[upTo - 1], problems, warnings, final, vatByPeriod, incomeTaxByMonth, outstanding };
  })();

  const liq = view.balance != null && view.asOf ? liquidity(view.balance, view.asOf, facts) : null;
  const cards = view.asOf ? openCardCharges(facts, view.asOf).flatMap((c) => (c.due ? [{ amount: c.amount, due: c.due, label: `כרטיס אשראי ***${c.account_ref}` }] : [])) : [];
  const fc = view.balance != null && view.asOf
    ? forecast30(view.cl, view.rec, view.balance, view.asOf, { vatByPeriod: tax.vatByPeriod, incomeTaxByMonth: tax.incomeTaxByMonth }, tax.outstanding,
      { cards, paidElsewhere: cardTaxPaid(view.card) })
    : null;

  const suggested = defaultReserve(view.rec);
  const reserve = reserveText != null && reserveText.trim() !== "" && Number.isFinite(Number(reserveText)) ? Math.max(0, Number(reserveText)) : reserveSaved ?? suggested;
  const isNow = view.asOf != null && sel === monthOf(view.asOf);
  const d = tax.cur ? drawable(sel, tax.cur, view.cl, isNow ? fc : null, reserve) : null;
  const ins = [...insights(view.cl, sel, view.asOf, today, d), ...cardInsights(view.card, sel)];
  const rw = liq ? runway(view.months, liq.liquid) : null;

  const saveReserve = async () => {
    if (!supabase) return;
    const { error: e } = await supabase.from("lalum_fin_cashflow_settings").upsert({ firm_id: firmId, safety_reserve: reserve });
    setMsg(e ? { ok: false, text: "הרזרבה לא נשמרה. שמירה דורשת הרשאת שותף מלאה בהנהלת החשבונות." } : { ok: true, text: "הרזרבה נשמרה. אותה רזרבה משמשת גם את תזרים 13 השבועות." });
    if (!e) { setReserveText(null); onReserveSaved(); }
  };

  if (!loaded) return <div className="ck-meta">טוען את נתוני הבנק...</div>;
  if (error) return <div className="ck-err" aria-live="polite">{error}</div>;
  if (lines.length === 0) return <div className="ck-card"><div className="ck-title">אין עדיין שורות בנק</div><div className="ck-meta">הלוח נבנה מדפי הבנק. אחרי שדף הבנק החודשי ייובא, היתרה, התזרים והתחזית יופיעו כאן.</div></div>;

  const mi = view.months.findIndex((x) => x.month === sel);
  const cur = view.months[mi], prev = mi > 0 ? view.months[mi - 1] : null;
  const cats = categoryTotals(view.cl, sel, side);
  const top = cats.slice(0, 4), rest = cats.slice(4).reduce((s, c) => s + Math.max(0, c.amount), 0);
  const segments = [...top.map((c, i) => ({ label: c.label, value: Math.round(Math.max(0, c.amount)), color: PALETTE[i] })), ...(rest > 0 ? [{ label: "שאר הקטגוריות", value: Math.round(rest), color: PALETTE[4] }] : [])];
  const days = spendByDay(view.cl, sel);
  const maxDay = Math.max(1, ...days);
  const firstDow = new Date(`${sel}-01T00:00:00Z`).getUTCDay();
  const recent = [...view.cl].sort((a, b) => b.value_date.localeCompare(a.value_date) || (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 12);
  const series = view.series;
  // Day and month on the axis while the series spans less than a year; past that, month and year, so no label repeats.
  const longSeries = series.length > 1 && Date.parse(series[series.length - 1].date) - Date.parse(series[0].date) > 360 * 86400000;
  const profitByMonth = new Map(tax.byMonth.map((x) => [x.month, x]));
  const beforeStatement = view.firstStatement != null && sel < monthOf(view.firstStatement);
  const cardRefs = [...new Set(view.card.map((l) => l.account_ref))];
  const cm = view.cardMonths.find((m) => m.month === sel) ?? null;
  const card12 = view.cardMonths.slice(-12);
  const cardAvg = card12.length ? Math.round(card12.reduce((a, m) => a + m.ils, 0) / card12.length) : 0;
  const cardCats = cardCategories(view.card, sel);
  const cardSel = view.card.filter((l) => monthOf(l.txn_date) === sel).sort((a, b) => b.txn_date.localeCompare(a.txn_date) || a.amount - b.amount);
  const fxText = (fx: Record<string, number>) => Object.entries(fx).filter(([, v]) => v !== 0).map(([c, v]) => `${CUR[c] ?? c}${acct(v).text}`).join(", ");

  return (
    <div className="ck-stack bd">
      <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="ck-title">לוח בקרה כספי</div>
          <div className="ck-meta">
            לפי דפי הבנק עד <bdi>{dmy(view.asOf)}</bdi>
            {view.fromFinancy > 0 && view.firstStatement ? <>, ולפני <bdi>{dmy(view.firstStatement)}</bdi> לפי Financy</> : ""}.
            {view.card.length > 0 || facts.length > 0 ? " פירוט הכרטיס, החיוב הפתוח, המסגרות והערבות נקראו מ־Financy, לצפייה בלבד." : " Financy משמש לצפייה בלבד, והנתונים כאן מגיעים מדף הבנק החודשי."}
          </div>
        </div>
        <select className="ck-select" aria-label="חודש" value={sel} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }}>
          {[...view.months].reverse().map((m) => <option key={m.month} value={m.month}>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</option>)}
        </select>
      </div>

      {ins.length > 0 && (
        <div className="bd-insights" aria-label="תובנות">
          {ins.map((i) => <div key={i.title + i.body} className={`ck-card bd-insight ${i.tone}`}><b>{i.title}</b><div className="fin-note">{i.body}</div></div>)}
        </div>
      )}

      <div className="bd-kpis">
        <div className="ck-card fin-stat">
          <div className="ck-meta">מצב נזיל</div><div className="fin-figure"><Amt n={liq ? liq.liquid : view.balance} /></div>
          <div className="fin-note">
            {liq && liq.cardDue > 0
              ? <>עו״ש <bdi><Amt n={liq.balance} /></bdi> ב־<bdi>{dmy(view.asOf)}</bdi>, פחות חיוב כרטיס פתוח <bdi><Amt n={liq.cardDue} /></bdi>{liq.cardDueOn ? <> שיורד ב־<bdi>{dmy(liq.cardDueOn)}</bdi></> : ""}.</>
              : <>יתרת העו״ש ב־<bdi>{dmy(view.asOf)}</bdi>{view.bals.length > 1 ? `, ${view.bals.length} חשבונות` : ""}.</>}
            {rw && rw.months > 0 ? <> מכסה כ־<bdi>{rw.months.toLocaleString("he-IL")}</bdi> חודשי הוצאות של העסק.</> : ""}
          </div>
        </div>
        <div className="ck-card fin-stat fin-inflow"><div className="ck-meta">נכנס ב{MONTHS[Number(sel.slice(5, 7)) - 1]}</div><div className="fin-figure"><Amt n={cur?.inflow ?? 0} /></div><Change cur={cur?.inflow ?? 0} prev={prev?.inflow} goodWhenUp /></div>
        <div className="ck-card fin-stat fin-outflow"><div className="ck-meta">יצא ב{MONTHS[Number(sel.slice(5, 7)) - 1]}</div><div className="fin-figure"><Amt n={cur?.outflow ?? 0} /></div><Change cur={cur?.outflow ?? 0} prev={prev?.outflow} goodWhenUp={false} /></div>
        <div className="ck-card fin-stat"><div className="ck-meta">נטו בבנק</div><div className="fin-figure"><Amt n={cur?.net ?? 0} /></div><Change cur={cur?.net ?? 0} prev={prev?.net} goodWhenUp /></div>
      </div>
      <div className="fin-note">
        לא כולל העברות בין חשבונות, המרות מטבע ומשיכות בעלים (<bdi><Amt n={cur?.owner ?? 0} /></bdi> בחודש הזה).
        {view.card.length > 0 ? " חיוב כרטיס האשראי נספר פעם אחת, ביום שהבנק גבה אותו. הפירוט לפי בית עסק מופיע בכרטיס האשראי למטה ולא נספר שוב." : " חיוב כרטיס האשראי נספר ביום החיוב, כי פירוט הכרטיס עוד לא מגיע אלינו."}
        {beforeStatement ? " החודש הזה קודם לדף הבנק הראשון: התנועות לפי Financy, בלי התאמה לחשבוניות." : cur?.partial ? " החודש לא מכוסה במלואו בדפי הבנק." : ""}
      </div>

      {d && (
        <div className="ck-card bd-draw">
          <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="ck-meta">שכר שאפשר למשוך ב{MONTHS[Number(sel.slice(5, 7)) - 1]}{isNow ? "" : " (לפי הרווח בלבד, החודש עבר)"}</div>
              <div className="fin-figure bd-draw-figure"><Amt n={d.drawable} /></div>
            </div>
            {!tax.final && <span className="ck-badge">הערכה: פרמטרי המס של {year} בטיוטה</span>}
          </div>
          <div className="fin-note">
            {d.cash == null ? "הרווח של החודש אחרי מס הכנסה וביטוח לאומי, פחות מה שכבר נמשך בו."
              : d.binding === "CASH" ? "המגבלה כרגע היא הקופה: הרווח מאפשר יותר, אבל הכסף בחשבון צריך קודם לכסות מסים ורזרבה."
                : "המגבלה כרגע היא הרווח: בקופה יש יותר, אבל חלק ממנו שייך למסים או לחודשים הבאים."}
          </div>
          <div className="bd-wf-grid">
            <table className="bd-wf" aria-label="לפי הרווח">
              <caption>לפי הרווח</caption>
              <tbody>
                <tr><td>רווח החודש לפני מס</td><td><Amt n={d.profit} /></td></tr>
                <tr><td>מס הכנסה על החודש</td><td><Amt n={-d.incomeTax} /></td></tr>
                <tr><td>ביטוח לאומי ובריאות על החודש</td><td><Amt n={-d.bl} /></td></tr>
                <tr className="sub"><td>רווח אחרי מס</td><td><Amt n={d.earned} /></td></tr>
                <tr><td>כבר נמשך החודש (כולל פנסיה)</td><td><Amt n={-d.taken} /></td></tr>
                <tr className="total"><td>נותר לפי הרווח</td><td><Amt n={d.earnedLeft} /></td></tr>
              </tbody>
            </table>
            {d.cash && (
              <table className="bd-wf" aria-label="לפי הקופה">
                <caption>לפי הקופה</caption>
                <tbody>
                  <tr><td>יתרה ב־<bdi>{dmy(d.cash.asOf)}</bdi></td><td><Amt n={d.cash.balance} /></td></tr>
                  <tr><td>מע״מ שעוד לא שולם</td><td><Amt n={-d.cash.vat} /></td></tr>
                  <tr><td>מקדמת מס הכנסה (הערכה)</td><td><Amt n={-d.cash.incomeTax} /></td></tr>
                  <tr><td>ביטוח לאומי ב־30 הימים הקרובים</td><td><Amt n={-d.cash.bl} /></td></tr>
                  {d.cash.card > 0 && <tr><td>חיוב הכרטיס הפתוח (כבר הוצא)</td><td><Amt n={-d.cash.card} /></td></tr>}
                  <tr>
                    <td>
                      <label htmlFor="bd-reserve">רזרבה תפעולית</label>
                      <div className="bd-reserve">
                        <input id="bd-reserve" className="ck-input" inputMode="decimal" dir="ltr" value={reserveText ?? String(reserve)} onChange={(e) => setReserveText(e.target.value)} aria-describedby="bd-reserve-note" />
                        <button type="button" className="ck-btn sm" onClick={() => void saveReserve()} disabled={reserveText == null}>שמירה</button>
                      </div>
                      <div id="bd-reserve-note" className="fin-note">{reserveSaved == null ? "לא נקבעה רזרבה, ולכן מוצג חודש אחד של חיובים קבועים" : "הרזרבה שנשמרה"} (<bdi><Amt n={suggested} /></bdi> לחודש).</div>
                    </td>
                    <td><Amt n={-d.cash.reserve} /></td>
                  </tr>
                  <tr className="total"><td>הקופה מאפשרת</td><td><Amt n={d.cash.left} /></td></tr>
                </tbody>
              </table>
            )}
          </div>
          {msg && <div className={msg.ok ? "ck-meta" : "ck-err"} aria-live="polite">{msg.text}</div>}
          {tax.problems.length > 0 && <div className="fin-note">{tax.problems.join(". ")}.</div>}
          {tax.warnings.length > 0 && <ul className="fin-note bd-list">{tax.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}

      <div className="ck-grid2">
        <div className="ck-card">
          <div className="ck-title">תזרים מזומנים לפי חודש</div>
          <GroupedBars buckets={view.months.map((m, i) => barLabel(m.month, i) + (m.partial ? "*" : ""))} unit="₪"
            series={[{ label: "נכנס", color: "var(--fin-inflow)", values: view.months.map((m) => Math.round(m.inflow)) }, { label: "יצא", color: "var(--fin-outflow)", values: view.months.map((m) => Math.round(m.outflow)) }]} />
          <div className="fin-note">* חודש שלא מכוסה במלואו בדפי הבנק.</div>
        </div>
        <div className="ck-card">
          <MarketChart title="יתרה לאורך זמן" labels={series.map((x) => (longSeries ? `${x.date.slice(5, 7)}.${x.date.slice(2, 4)}` : dmy(x.date).slice(0, 5)))} height={220}
            series={[{ key: "bal", label: "יתרה", color: "var(--chart-ok, #216f33)", values: series.map((x) => x.balance), kind: "area" }]} />
        </div>
      </div>

      <div className="ck-grid2">
        <div className="ck-card">
          <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div className="ck-title">פילוח לפי קטגוריה</div>
            <div className="fin-subtabs" role="tablist" aria-label="כיוון">
              <button type="button" role="tab" className="fin-subtab" aria-selected={side === "OUT"} onClick={() => setSide("OUT")}>הוצאות</button>
              <button type="button" role="tab" className="fin-subtab" aria-selected={side === "IN"} onClick={() => setSide("IN")}>הכנסות</button>
            </div>
          </div>
          {segments.length > 0
            ? <Donut segments={segments} centre={Math.round(cats.reduce((s, c) => s + Math.max(0, c.amount), 0)).toLocaleString("he-IL")} sub={side === "OUT" ? "₪ יצאו" : "₪ נכנסו"} />
            : <div className="ck-meta">אין תנועות בחודש הזה.</div>}
          {cats.length > 4 && <ul className="fin-note bd-list">{cats.slice(4).map((c) => <li key={c.key}>{c.label}: <bdi><Amt n={c.amount} /></bdi></li>)}</ul>}
        </div>
        <div className="ck-card">
          <div className="ck-title">הוצאות לפי יום</div>
          <div className="bd-heat" role="img" aria-label={days.map((v, i) => `${i + 1}: ${Math.round(v)}`).join(", ")}>
            {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((x) => <span key={x} className="bd-heat-dow">{x}</span>)}
            {Array.from({ length: firstDow }, (_, i) => <span key={`e${i}`} />)}
            {days.map((v, i) => (
              <span key={i} className="bd-heat-day" title={`${i + 1}.${sel.slice(5, 7)}: ${Math.round(v).toLocaleString("he-IL")} ₪`}
                style={{ background: v > 0 ? `color-mix(in srgb, var(--fin-outflow) ${Math.round(15 + 70 * (v / maxDay))}%, var(--card))` : undefined, color: v / maxDay > 0.55 ? "var(--card)" : undefined }}>{i + 1}</span>
            ))}
          </div>
          <div className="fin-note">ככל שהיום כהה יותר, יצא בו יותר כסף לעסק. היום הכבד בחודש: <bdi>{days.indexOf(maxDay) + 1}.{sel.slice(5, 7)}</bdi>, <bdi><Amt n={maxDay === 1 && days.every((v) => v === 0) ? 0 : maxDay} /></bdi>.</div>
        </div>
      </div>

      <div className="ck-card">
        <div className="ck-title">תנועות קבועות</div>
        {view.rec.length === 0 ? <div className="ck-meta">עוד אין מספיק חודשים לזיהוי חיובים קבועים.</div> : (
          <div className="ck-table-wrap"><table className="ck-table">
            <thead><tr><th>תנועה</th><th>קטגוריה</th><th>תדירות</th><th className="fin-num">סכום אחרון</th><th className="fin-num">שינוי</th><th>הבא בתאריך</th></tr></thead>
            <tbody>{[...view.rec].sort((a, b) => Number(a.stale) - Number(b.stale)).map((r) => (
              <tr key={r.key}><td className="fin-text">{r.label}</td><td>{r.cat.label}</td><td>{r.cadence === "MONTHLY" ? "חודשי" : "דו חודשי"}</td>
                <td className="fin-num"><Amt n={r.amount} /></td>
                <td className="fin-num">{r.changePct == null || r.changePct === 0 ? "ללא שינוי" : <span className={`bd-change ${(r.changePct > 0) === (r.amount > 0) ? "good" : "bad"}`}><bdi>{pctText(r.changePct)}</bdi></span>}</td>
                <td>{r.stale ? <span className="fin-sub">הופסק? נראה לאחרונה ב־<bdi>{dmy(r.last)}</bdi>, ולכן לא נספר בתחזית</span>
                  : <><bdi>{dmy(r.next)}</bdi>{view.asOf && r.next <= view.asOf && <span className="fin-sub">לא נראה בדף הבנק</span>}</>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {fc && (
        <div className="ck-card">
          <div className="ck-title">תחזית ל־30 יום</div>
          <div className="ck-meta">
            מ־<bdi>{dmy(fc.startOn)}</bdi> עד <bdi>{dmy(fc.end)}</bdi>, מהיתרה בדף הבנק. עמודת היתרה סופרת רק חיובים, כי תקבול נכנס לחשבון רק כשהוא נכנס.
            {fc.expected.length > 0 ? " העמודה שלידה מוסיפה את התקבולים שחוזרים כל חודש באותו סכום." : ""}
          </div>
          {fc.timeline.length === 0 ? <div className="ck-meta">אין חיובים צפויים בתקופה.</div> : (
            <div className="ck-table-wrap"><table className="ck-table">
              <thead><tr><th>תאריך</th><th>תנועה</th><th className="fin-num">סכום</th><th className="fin-num">יתרה</th>{fc.expected.length > 0 && <th className="fin-num">עם תקבולים צפויים</th>}</tr></thead>
              <tbody>{fc.timeline.map((r, i) => (
                <tr key={i} className={r.expected ? "bd-expected" : undefined}><td><bdi>{dmy(r.date)}</bdi></td>
                  <td className="fin-text">{r.label}{r.note && <span className="fin-sub">{r.note}</span>}</td>
                  <td className="fin-num"><Amt n={r.amount} plus={r.expected} /></td><td className="fin-num">{r.expected ? "" : <Amt n={r.balance} />}</td>
                  {fc.expected.length > 0 && <td className="fin-num"><Amt n={r.withReceipts} /></td>}</tr>
              ))}</tbody>
            </table></div>
          )}
          <div className={fc.shortOn ? "ck-warn" : "fin-note"}>
            {fc.shortOn ? <>אם לא ייכנס כסף, היתרה תרד מתחת לאפס ב־<bdi>{dmy(fc.shortOn)}</bdi> ותגיע עד <bdi><Amt n={fc.minBalance} /></bdi> ב־<bdi>{dmy(fc.minOn)}</bdi>.</>
              : <>הקופה מכסה את כל 30 הימים גם בלי שייכנס כסף. הנקודה הנמוכה: <bdi><Amt n={fc.minBalance} /></bdi> ב־<bdi>{dmy(fc.minOn)}</bdi>.</>}
            {fc.shortOn && fc.expected.length > 0 ? (fc.shortOnWithReceipts ? <> גם עם התקבולים הקבועים היא יורדת מתחת לאפס ב־<bdi>{dmy(fc.shortOnWithReceipts)}</bdi>.</> : " עם התקבולים הקבועים היא נשארת מעל אפס.") : ""}
          </div>
          {fc.excluded.length > 0 && (
            <>
              <div className="ck-meta" style={{ marginTop: 8 }}>לא נכללו בתחזית</div>
              <ul className="fin-note bd-list">{fc.excluded.map((x) => <li key={x.label}>{x.label}{x.amount ? <>: <bdi><Amt n={x.amount} /></bdi></> : ""}. {x.why}.</li>)}</ul>
            </>
          )}
        </div>
      )}

      <div className="ck-card">
        <div className="ck-title">משיכות מול רווח, לפי חודש</div>
        <div className="ck-table-wrap"><table className="ck-table">
          <thead><tr><th>חודש</th><th className="fin-num">נכנס לבנק</th><th className="fin-num">יצא מהבנק</th><th className="fin-num">נטו בבנק</th><th className="fin-num">רווח אחרי מס</th><th className="fin-num">נמשך</th></tr></thead>
          <tbody>{[...view.months].reverse().map((m) => {
            const p = profitByMonth.get(m.month);
            return (
              <tr key={m.month}><td>{monthName(m.month)}{m.partial ? " (חלקי)" : ""}</td>
                <td className="fin-num"><Amt n={m.inflow} /></td><td className="fin-num"><Amt n={m.outflow} /></td><td className="fin-num"><Amt n={m.net} /></td>
                <td className="fin-num">{p ? <Amt n={p.afterTax} /> : "לא חושב"}</td><td className="fin-num"><Amt n={m.owner} /></td></tr>
            );
          })}</tbody>
        </table></div>
        <div className="fin-note">הרווח אחרי מס מחושב מהחשבוניות וההוצאות בהנהלת החשבונות (לא מהבנק), לפי מנוע המס, לשנה שנבחרה בלבד.</div>
      </div>

      {view.card.length > 0 && (
        <div className="ck-card">
          <div className="ck-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div className="ck-title">כרטיס אשראי {cardRefs.map((r) => <bdi key={r}>{`***${r}`} </bdi>)}</div>
            <span className="ck-badge">לפי Financy, לצפייה בלבד</span>
          </div>
          <div className="ck-meta">פירוט לפי בית עסק ולפי יום הרכישה. החיוב החודשי כבר נספר בבנק ביום שנגבה, ולכן הפירוט כאן לא נספר שוב בתזרים. עסקה בתשלומים מופיעה בחודש הרכישה.</div>
          <div className="bd-kpis">
            <div className="ck-card fin-stat"><div className="ck-meta">חיוב פתוח</div><div className="fin-figure"><Amt n={liq?.cardDue ?? 0} /></div>
              <div className="fin-note">{liq?.cardDueOn ? <>יורד מהעו״ש ב־<bdi>{dmy(liq.cardDueOn)}</bdi>. הסכום עשוי להשתנות עד אז.</> : "אין חיוב פתוח ידוע אחרי תאריך דף הבנק."}</div></div>
            <div className="ck-card fin-stat"><div className="ck-meta">מסגרת הכרטיס</div><div className="fin-figure"><Amt n={liq?.cardLimit ?? null} /></div>
              <div className="fin-note">{liq?.cardLimit ? <>פנוי <bdi><Amt n={liq.cardLimit - liq.cardDue} /></bdi>, ניצול <bdi>{Math.round((liq.cardDue / liq.cardLimit) * 100)}%</bdi>.</> : "המסגרת לא נקראה."}</div></div>
            <div className="ck-card fin-stat fin-outflow"><div className="ck-meta">רכישות ב{MONTHS[Number(sel.slice(5, 7)) - 1]}</div><div className="fin-figure"><Amt n={cm?.ils ?? 0} /></div>
              <div className="fin-note">{cm ? <>{cm.count} עסקאות{fxText(cm.fx) ? <>, ועוד <bdi>{fxText(cm.fx)}</bdi> במטבע חוץ</> : ""}.</> : "אין רכישות בחודש הזה."}</div></div>
            <div className="ck-card fin-stat"><div className="ck-meta">ממוצע לחודש</div><div className="fin-figure"><Amt n={cardAvg} /></div>
              <div className="fin-note">ב־{card12.length} החודשים האחרונים, בשקלים בלבד.</div></div>
          </div>
          <div className="ck-grid2">
            <div>
              <div className="ck-meta">רכישות בשקלים לפי חודש</div>
              <GroupedBars buckets={card12.map((m, i) => barLabel(m.month, i))} unit="₪" series={[{ label: "רכישות", color: "var(--fin-outflow)", values: card12.map((m) => Math.round(m.ils)) }]} />
            </div>
            <div>
              <div className="ck-meta">לפי קטגוריה ב{MONTHS[Number(sel.slice(5, 7)) - 1]}</div>
              {cardCats.length === 0 ? <div className="ck-meta">אין רכישות בשקלים בחודש הזה.</div> : (
                <div className="ck-table-wrap"><table className="ck-table">
                  <thead><tr><th>קטגוריה</th><th className="fin-num">עסקאות</th><th className="fin-num">סכום</th><th className="fin-num">חלק</th></tr></thead>
                  <tbody>{cardCats.map((c) => <tr key={c.key}><td>{c.label}</td><td className="fin-num">{c.count}</td><td className="fin-num"><Amt n={c.amount} /></td><td className="fin-num"><bdi>{c.share}%</bdi></td></tr>)}</tbody>
                </table></div>
              )}
            </div>
          </div>
          {cardSel.length > 0 && (
            <div className="ck-table-wrap"><table className="ck-table">
              <thead><tr><th>תאריך</th><th>בית עסק</th><th className="fin-num">סכום</th></tr></thead>
              <tbody>{cardSel.map((l) => (
                <tr key={l.id}><td><bdi>{dmy(l.txn_date)}</bdi></td>
                  <td className="fin-text"><span className="fin-name"><bdi>{l.description}</bdi></span><span className="fin-sub">{l.cat.label}</span></td>
                  <td className="fin-num"><Fx n={l.amount} cur={l.currency} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
          {view.cardRec.length > 0 && (
            <>
              <div className="ck-meta" style={{ marginTop: 8 }}>מנויים וחיובים קבועים בכרטיס</div>
              <div className="ck-table-wrap"><table className="ck-table">
                <thead><tr><th>בית עסק</th><th>קטגוריה</th><th className="fin-num">סכום אחרון</th><th>הבא בתאריך</th></tr></thead>
                <tbody>{view.cardRec.map((r) => (
                  <tr key={`${r.key}|${r.currency}`}><td className="fin-text"><bdi>{r.label}</bdi></td><td>{r.cat.label}</td><td className="fin-num"><Fx n={r.amount} cur={r.currency} /></td>
                    <td><bdi>{dmy(r.next)}</bdi></td></tr>
                ))}</tbody>
              </table></div>
            </>
          )}
        </div>
      )}

      <div className="ck-grid2">
        <div className="ck-card">
          <div className="ck-title">תנועות אחרונות</div>
          <div className="ck-table-wrap"><table className="ck-table">
            <thead><tr><th>תאריך</th><th>תנועה</th><th className="fin-num">סכום</th></tr></thead>
            <tbody>{recent.map((l) => (
              <tr key={l.id}><td><bdi>{dmy(l.value_date)}</bdi></td>
                <td className="fin-text"><span className="fin-name">{(l.description ?? "").trim() || "ללא תיאור"}</span><span className="fin-sub">{l.cat.label}{HOW[l.how] ? `, ${HOW[l.how]}` : ""}</span></td>
                <td className="fin-num"><Amt n={l.amount} plus /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="ck-card">
          <div className="ck-title">חשבונות</div>
          <ul className="bd-accounts">
            {view.bals.map((b) => {
              const a = accounts.find((x) => x.id === b.accountId);
              return (
                <li key={b.accountId}>
                  <div><b>{a?.label || `${BANKS[a?.bank_code ?? ""] ?? `בנק ${a?.bank_code ?? ""}`}`}</b> <span className="fin-sub">עו״ש <bdi>{`***${a?.account_last4 ?? ""}`}</bdi></span></div>
                  <div className="bd-acc-figure"><Amt n={b.balance} /></div>
                  <div className="fin-note">{b.source === "STATED" ? "יתרה שהבנק מסר" : b.source === "LINES" ? "לפי שרשרת היתרות בדף הבנק" : "אין עדיין יתרה"}{b.asOf ? <>, <bdi>{dmy(b.asOf)}</bdi></> : ""}</div>
                </li>
              );
            })}
          </ul>
          {liq && (liq.overdraft != null || liq.guarantees.length > 0 || liq.fx.length > 0) && (
            <ul className="bd-accounts" style={{ marginTop: 10 }}>
              {liq.overdraft != null && (
                <li>
                  <div><b>מסגרת אשראי בעו״ש</b></div>
                  <div className="bd-acc-figure"><Amt n={liq.overdraft} /></div>
                  <div className="fin-note">זמין כולל המסגרת: <bdi><Amt n={liq.balance + liq.overdraft} /></bdi>. משיכה מהמסגרת היא הלוואה בריבית, לא כסף של העסק.</div>
                </li>
              )}
              {liq.guarantees.map((g) => (
                <li key={`${g.account_ref}|${g.as_of}`}>
                  <div><b>ערבות בנקאית</b> <span className="fin-sub">{g.label ?? ""}</span></div>
                  <div className="bd-acc-figure"><Amt n={g.amount} /></div>
                  <div className="fin-note">התחייבות של הבנק כלפי צד אחר, נכון ל־<bdi>{dmy(g.as_of)}</bdi>. היא לא חוב לתשלום עכשיו ולכן לא יורדת מהיתרה. אם הערבות תמומש, הבנק בדרך כלל גובה את הסכום מהלקוח שביקש אותה.</div>
                </li>
              ))}
              {liq.fx.map((x) => (
                <li key={`${x.account_ref}|${x.as_of}`}>
                  <div><b>{x.label ?? `חשבון ${x.currency}`}</b></div>
                  <div className="bd-acc-figure"><Fx n={x.amount} cur={x.currency} /></div>
                  <div className="fin-note">נכון ל־<bdi>{dmy(x.as_of)}</bdi>, לפי Financy.</div>
                </li>
              ))}
            </ul>
          )}
          <div className="fin-note">{facts.length > 0 ? "המסגרות, הערבות וחשבון המט״ח לפי Financy. הלוואות לא מוצגות שם, ולכן גם לא כאן." : "הלוואות ומשכנתאות לא מחוברות. כשיהיה חיבור ישיר לבנק הן יופיעו כאן."}</div>
        </div>
      </div>

      <div className="ck-meta">לעיון בלבד, לא ייעוץ מס. הסכום שאפשר למשוך הוא הערכה לפי הנתונים שהוזנו, ופרמטרי המס נקבעים מול רואת החשבון.</div>
    </div>
  );
}
